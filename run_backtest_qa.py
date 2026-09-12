import os
import sys
import requests
import json
from dotenv import load_dotenv

# 1. Cấu hình bảo mật: Load thông tin từ file .env thay vì Hardcode
load_dotenv()
API_KEY = os.getenv("DEEPSEEK_API_KEY")
TARGET_DIR = os.getenv("TARGET_DIR", "/home/ubuntu/barnbuddy")
API_URL = "https://api.deepseek.com/v1/chat/completions"
# Model suy luận sâu; đổi được qua env mà không cần sửa code.
MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-reasoner")
IS_REASONING_MODEL = "reasoner" in MODEL
# Đường dẫn báo cáo: mặc định CWD "game_qa.md"; set REPORT_PATH để ghim tuyệt đối,
# ví dụ REPORT_PATH=/home/ubuntu/barnbuddy/game_qa.md
REPORT_PATH = os.getenv("REPORT_PATH", "game_qa.md")

if not API_KEY:
    print("❌ LỖI BẢO MẬT: Không tìm thấy DEEPSEEK_API_KEY trong file .env!")
    sys.exit(1)

print(f"--- Đang phân tích và quét cấu trúc Game từ thư mục: {TARGET_DIR} ---")

structure_summary = ""
# Đuôi file bám sát kiến trúc thật: NestJS/TypeORM (.ts), React (.tsx),
# Solidity (.sol), hạ tầng (.json/.yml/.sql/.prisma) và script Python.
valid_extensions = (
    '.ts', '.tsx', '.js', '.jsx', '.json', '.sol',
    '.prisma', '.sql', '.yml', '.yaml', '.html', '.css', '.py',
)

# Thư mục sinh tự động — bỏ qua ở MỌI độ sâu để prompt không bị nhiễu.
ignored_dirs = {
    '.git', 'node_modules', 'dist', 'build', 'out', 'coverage',
    'typechain-types', 'artifacts', 'cache', '.next', '.turbo',
    '__pycache__', 'venv', '.venv', 'vendor', 'tmp',
}

# Ngân sách ký tự: tránh nhồi prompt quá lớn làm loãng chi tiết code.
MAX_FILE_BYTES = 120_000
MAX_TOTAL_CHARS = 400_000

# BỔ SUNG: Các từ khóa đặc thù của Web3/Solidity và TypeScript
core_keywords = (
    'def ', 'class ', 'function ', 'async function ', 'exports.',
    'contract ', 'interface ', 'library ', 'modifier ', 'event ', 
    'mapping', 'struct ', 'enum ', 'constructor',
    'export class ', 'export interface ', 'export type ', 'export function ',
    'export const ', 'export default ', 'error ',
    '@Entity', '@Column', '@Injectable', '@Controller', '@Module',
    '@Get(', '@Post(', '@Patch(', '@Delete(',
)

# 2. Quét cấu trúc thông minh (deterministic: sắp xếp dirs/files, cắt bớt nếu quá lớn)
truncated = False
for root, dirs, files in os.walk(TARGET_DIR):
    dirs[:] = sorted(d for d in dirs if d not in ignored_dirs)
        
    rel_path = os.path.relpath(root, TARGET_DIR)
    structure_summary += f"\n📂 Thư mục: {rel_path if rel_path != '.' else 'Gốc'}\n"
    
    for file in sorted(files):
        if not file.endswith(valid_extensions):
            continue
        file_path = os.path.join(root, file)
        structure_summary += f"  └─ 📄 File: {file}\n"
        try:
            if os.path.getsize(file_path) > MAX_FILE_BYTES:
                structure_summary += "       ├─> [bỏ qua: file quá lớn]\n"
                continue
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    clean_line = line.strip()
                    if clean_line.startswith(core_keywords):
                        structure_summary += f"       ├─> {clean_line}\n"
        except (OSError, UnicodeDecodeError):
            continue

        if len(structure_summary) > MAX_TOTAL_CHARS:
            truncated = True
            break
    if truncated:
        break

if truncated:
    structure_summary += "\n... [đã cắt bớt: vượt ngân sách ký tự gửi API]\n"

if len(structure_summary) < 50:
    print("❌ Không tìm thấy mã nguồn hoặc cấu trúc game hợp lệ!")
    sys.exit(1)

# 3. Nâng cấp System Prompt (Ép AI phải chú ý đến bối cảnh Web2.5 & Tokenomics)
system_prompt = (
    "Bạn là Kiến trúc sư Hệ thống & Chuyên gia QA Web3 cho game Web2.5 'Bandit Buddy'.\n\n"
    "STACK THẬT CỦA DỰ ÁN:\n"
    "- Backend: NestJS + TypeORM + PostgreSQL; auth qua header x-telegram-init-data; "
    "ValidationPipe toàn cục { whitelist: true, forbidNonWhitelisted: true, transform: true }.\n"
    "- Smart contracts: Hardhat + Solidity ^0.8.24 + OpenZeppelin v5 trên BSC "
    "(FarmToken, FarmTokenClaim, GuardDogNFT ERC-1155, BanditDogFusion, BanditMarket, "
    "GuildStaking, TreasuryBuyBack, LiquidityLocker).\n"
    "- Frontend: React + TypeScript + React Query + wagmi/viem + Phaser 3.\n\n"
    "RÀNG BUỘC CHỐNG BỊA ĐẶT (BẮT BUỘC TUÂN THỦ):\n"
    "- CHỈ viết test case cho hàm / hợp đồng / bảng THỰC SỰ xuất hiện trong sơ đồ bên dưới. "
    "Tuyệt đối không nhắc tới contract, modifier, event hay bảng không tồn tại "
    "(ví dụ AntiBot, BotDetected, lastBuy, TWAP nếu sơ đồ không có).\n"
    "- Mỗi test case phải ghi rõ: module mục tiêu, input, custom error / event mong đợi, "
    "và dùng đúng chữ ký hàm thật. ethers v6 so sánh bigint, không so với number.\n"
    "- KHÔNG bịa số liệu Pass/Fail. Nếu chưa thực sự chạy test, ghi trạng thái 'Chưa chạy' "
    "và để trống cột kết quả. Không tự tổng hợp tỷ lệ PASS.\n"
    "- Nếu hợp đồng dùng model thuế/tier khác với giả định của bạn, PHẢI mô tả theo code thật "
    "và nêu rủi ro tương ứng, không sửa lại cho khớp giả định.\n\n"
    "YÊU CẦU BẮT BUỘC (phải có test case cho các nhóm này):\n"
    "1. Bảo mật Smart Contract: Reentrancy (TreasuryBuyBack.executeBuyBack, GuildStaking.unstake), "
    "replay nonce (BanditMarket EIP-712, FarmTokenClaim ECDSA, BanditDogFusion commit-reveal), "
    "access control trên MỌI hàm admin, pause/kill-switch.\n"
    "2. Thuế FARM (holdings-based): tier tính theo balanceOf VÍ NGƯỜI DÙNG (KHÔNG phải balance pool), "
    "ngưỡng tier2Balance/tier3Balance, thuế buy/sell theo từng tier, trần MAX_TAX_BPS, "
    "và vector né thuế bằng cách giữ vừa đúng ngưỡng tier.\n"
    "3. Kinh tế token & Web2.5 bridge: FarmTokenClaim min/max + setSigner (rotateSigner.ts), "
    "GuardDogNFT maxSupply/burnOnPurchase/fusionContract, BanditDogFusion pity + Soul Shard id 9999, "
    "GuildStaking UNSTAKE_DELAY 7 ngày và khả năng rút khi contract bị pause.\n"
    "4. Đồng bộ Off-chain ↔ On-chain: race condition DB, idempotency event listener "
    "(unique tx_hash + log_index), reorg/retry, optimistic locking.\n"
    "5. Validation biên: DTO whitelist/mass-assignment, field thiếu validator "
    "(ví dụ SyncNftDto.walletAddress, RepairDto.amount), số không được ép kiểu.\n\n"
    "ĐỊNH DẠNG ĐẦU RA: Markdown gồm (a) bảng ma trận Test Case với cột ID / module / loại / ưu tiên, "
    "(b) chi tiết từng test theo mục tiêu – tiền điều kiện – các bước – kỳ vọng – trạng thái, "
    "(c) code mẫu Hardhat (TypeScript) và Jest cho các case quan trọng nhất, "
    "(d) mục 'Rủi ro & Khuyến nghị' phân theo P0/P1/P2."
)

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}",
    "User-Agent": "BanditBuddy-QA-Agent/1.0"
}

payload = {
    "model": MODEL,
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Dưới đây là sơ đồ hàm/file của dự án:\n{structure_summary}\n\nHãy xuất báo cáo QA chuẩn Markdown."}
    ],
    "stream": False,
}
# deepseek-reasoner KHÔNG hỗ trợ temperature — chỉ gửi khi dùng model chat thường.
if not IS_REASONING_MODEL:
    payload["temperature"] = 0.3

print("🚀 Đang gửi siêu dữ liệu lên DeepSeek API (Mô hình đã tối ưu bối cảnh)...")

try:
    response = requests.post(API_URL, headers=headers, data=json.dumps(payload), timeout=120)
    
    if response.status_code == 200:
        result_json = response.json()
        if 'choices' in result_json and len(result_json['choices']) > 0:
            report_content = result_json['choices'][0]['message']['content']
            
            print("\n================ 🔥 BÁO CÁO KIỂM THỬ GAME TỪ DEEPSEEK QA ================\n")
            
            with open(REPORT_PATH, "w", encoding="utf-8") as md_file:
                md_file.write(report_content)
            
            print(f"✅ Đã lưu báo cáo vào '{os.path.abspath(REPORT_PATH)}'.")
        else:
            print("❌ Lỗi cấu trúc JSON từ DeepSeek.")
    else:
        print(f"❌ API trả về mã lỗi HTTP {response.status_code}\n{response.text}")
        
except Exception as e:
    print(f"❌ Lỗi xử lý dữ liệu: {e}")
