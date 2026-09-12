"""Test độc lập cho run_backtest_qa.py — chạy offline, không cần DEEPSEEK_API_KEY.

Script gốc thực thi mọi thứ ở module level, nên mỗi test sẽ:
  1. chdir vào tmp_path (không ghi đè game_qa.md thật của repo),
  2. set env DEEPSEEK_API_KEY / TARGET_DIR,
  3. mock dotenv.load_dotenv + requests.post TRƯỚC khi import,
  4. import lại module (đã xoá khỏi sys.modules).

Chạy: pytest -q test_run_backtest_qa.py
"""
import importlib
import json
import os
import sys

import dotenv
import pytest
import requests

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPORT_FILE = "game_qa.md"


class FakeResponse:
    """Giả lập requests.Response với đúng các thuộc tính mà script dùng."""

    def __init__(self, status_code, body, text=None):
        self.status_code = status_code
        self._body = body
        self.text = text if text is not None else json.dumps(body, ensure_ascii=False)

    def json(self):
        return self._body


@pytest.fixture
def run_script(monkeypatch, tmp_path):
    """Trả về hàm chạy script trong môi trường đã cô lập."""
    sys.path.insert(0, SCRIPT_DIR)
    monkeypatch.chdir(tmp_path)
    # Không đọc .env thật -> test tất định và không cần secret
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)

    def _run(env=None, post_impl=None):
        monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
        monkeypatch.delenv("TARGET_DIR", raising=False)
        for key, value in (env or {}).items():
            monkeypatch.setenv(key, value)
        if post_impl is not None:
            monkeypatch.setattr(requests, "post", post_impl)

        monkeypatch.delitem(sys.modules, "run_backtest_qa", raising=False)
        try:
            importlib.import_module("run_backtest_qa")
        except SystemExit as exc:  # script dùng exit() cho các nhánh lỗi
            return exc.code
        return None

    yield _run

    monkeypatch.delitem(sys.modules, "run_backtest_qa", raising=False)
    sys.path.remove(SCRIPT_DIR)


def make_project(base):
    """Project giả: có file hợp lệ, file sai đuôi và thư mục rác."""
    project = base / "proj"

    (project / "src").mkdir(parents=True)
    (project / "src" / "game.ts").write_text(
        "export class Game {}\nasync function play() {}\n", encoding="utf-8"
    )

    (project / "contracts").mkdir()
    (project / "contracts" / "FarmToken.sol").write_text(
        "contract FarmToken {}\nfunction mint() external {}\n", encoding="utf-8"
    )

    (project / "node_modules").mkdir()
    (project / "node_modules" / "junk.js").write_text(
        "function junk() {}\n", encoding="utf-8"
    )

    (project / "notes.txt").write_text("contract Ignored\n", encoding="utf-8")
    return project


def test_success_writes_report_to_game_qa_md(run_script, tmp_path, capsys):
    project = make_project(tmp_path)
    captured = {}

    def fake_post(url, headers=None, data=None, timeout=None):
        captured.update(url=url, headers=headers, timeout=timeout)
        captured["payload"] = json.loads(data)
        return FakeResponse(200, {"choices": [{"message": {"content": "# QA REPORT"}}]})

    code = run_script(
        env={"DEEPSEEK_API_KEY": "test-key", "TARGET_DIR": str(project)},
        post_impl=fake_post,
    )

    assert code is None
    out = capsys.readouterr().out
    assert "Đang phân tích" in out
    assert "game_qa.md" in out

    report = tmp_path / REPORT_FILE
    assert report.read_text(encoding="utf-8") == "# QA REPORT"
    # Báo cáo phải nằm đúng game_qa.md trong CWD, không phải tên cũ nào khác
    assert [p.name for p in tmp_path.glob("*.md")] == [REPORT_FILE]

    assert captured["url"] == "https://api.deepseek.com/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["headers"]["Content-Type"] == "application/json"
    assert captured["timeout"] == 120

    payload = captured["payload"]
    assert payload["model"] == "deepseek-reasoner"
    assert "temperature" not in payload  # deepseek-reasoner không hỗ trợ temperature
    assert payload["stream"] is False
    assert payload["messages"][0]["role"] == "system"
    assert "Bandit Buddy" in payload["messages"][0]["content"]

    user_content = payload["messages"][1]["content"]
    assert "game.ts" in user_content
    assert "FarmToken.sol" in user_content
    assert "junk" not in user_content          # node_modules phải bị bỏ qua
    assert "notes.txt" not in user_content     # sai đuôi file phải bị bỏ qua


def test_missing_api_key_aborts_without_writing_report(run_script, tmp_path, capsys):
    project = make_project(tmp_path)

    run_script(env={"TARGET_DIR": str(project)})

    assert "LỖI BẢO MẬT" in capsys.readouterr().out
    assert not (tmp_path / REPORT_FILE).exists()


def test_empty_target_dir_aborts(run_script, tmp_path, capsys):
    empty = tmp_path / "empty"
    empty.mkdir()

    run_script(env={"DEEPSEEK_API_KEY": "k", "TARGET_DIR": str(empty)})

    assert "Không tìm thấy mã nguồn" in capsys.readouterr().out
    assert not (tmp_path / REPORT_FILE).exists()


def test_http_error_is_reported(run_script, tmp_path, capsys):
    project = make_project(tmp_path)

    run_script(
        env={"DEEPSEEK_API_KEY": "k", "TARGET_DIR": str(project)},
        post_impl=lambda *a, **kw: FakeResponse(500, {"error": "boom"}, text="boom"),
    )

    assert "HTTP 500" in capsys.readouterr().out
    assert not (tmp_path / REPORT_FILE).exists()


def test_unexpected_json_shape_is_reported(run_script, tmp_path, capsys):
    project = make_project(tmp_path)

    run_script(
        env={"DEEPSEEK_API_KEY": "k", "TARGET_DIR": str(project)},
        post_impl=lambda *a, **kw: FakeResponse(200, {"unexpected": True}),
    )

    assert "Lỗi cấu trúc JSON" in capsys.readouterr().out
    assert not (tmp_path / REPORT_FILE).exists()


def test_network_exception_is_caught(run_script, tmp_path, capsys):
    project = make_project(tmp_path)

    def boom(*a, **kw):
        raise requests.Timeout("connection timed out")

    run_script(env={"DEEPSEEK_API_KEY": "k", "TARGET_DIR": str(project)}, post_impl=boom)

    assert "Lỗi xử lý dữ liệu" in capsys.readouterr().out
    assert not (tmp_path / REPORT_FILE).exists()


def test_existing_report_is_overwritten(run_script, tmp_path):
    project = make_project(tmp_path)
    (tmp_path / REPORT_FILE).write_text("BÁO CÁO CŨ", encoding="utf-8")

    run_script(
        env={"DEEPSEEK_API_KEY": "k", "TARGET_DIR": str(project)},
        post_impl=lambda *a, **kw: FakeResponse(
            200, {"choices": [{"message": {"content": "BÁO CÁO MỚI"}}]}
        ),
    )

    assert (tmp_path / REPORT_FILE).read_text(encoding="utf-8") == "BÁO CÁO MỚI"


def test_report_is_written_to_cwd_not_target_dir(run_script, tmp_path):
    project = make_project(tmp_path)

    run_script(
        env={"DEEPSEEK_API_KEY": "k", "TARGET_DIR": str(project)},
        post_impl=lambda *a, **kw: FakeResponse(
            200, {"choices": [{"message": {"content": "# QA"}}]}
        ),
    )

    # Script luôn ghi vào game_qa.md của CWD, không rơi vào TARGET_DIR
    assert (tmp_path / REPORT_FILE).is_file()
    assert not (project / REPORT_FILE).exists()


def test_report_path_env_overrides_default(run_script, tmp_path):
    project = make_project(tmp_path)
    custom = tmp_path / "custom_report.md"

    run_script(
        env={
            "DEEPSEEK_API_KEY": "k",
            "TARGET_DIR": str(project),
            "REPORT_PATH": str(custom),
        },
        post_impl=lambda *a, **kw: FakeResponse(
            200, {"choices": [{"message": {"content": "# CUSTOM"}}]}
        ),
    )

    assert custom.read_text(encoding="utf-8") == "# CUSTOM"
    assert not (tmp_path / REPORT_FILE).exists()


def test_chat_model_keeps_temperature(run_script, tmp_path):
    project = make_project(tmp_path)
    captured = {}

    def fake_post(url, headers=None, data=None, timeout=None):
        captured["payload"] = json.loads(data)
        return FakeResponse(200, {"choices": [{"message": {"content": "# QA"}}]})

    run_script(
        env={
            "DEEPSEEK_API_KEY": "k",
            "TARGET_DIR": str(project),
            "DEEPSEEK_MODEL": "deepseek-chat",
        },
        post_impl=fake_post,
    )

    assert captured["payload"]["model"] == "deepseek-chat"
    assert captured["payload"]["temperature"] == 0.3
