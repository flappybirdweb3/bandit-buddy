import os
import requests
import json
from dotenv import load_dotenv

# 1. Cấu hình bảo mật: Load thông tin từ file .env thay vì Hardcode
load_dotenv()
API_KEY = os.getenv("DEEPSEEK_API_KEY")
TARGET_DIR = os.getenv("TARGET_DIR", "/home/ubuntu/barnbuddy")
API_URL = "https://api.deepseek.com/v1/chat/completions"

if not API_KEY:
    print("❌ LỖI BẢO MẬT: Không tìm thấy DEEPSEEK_API_KEY trong file .env!")
    exit()

print(f"--- Đang phân tích và quét cấu trúc Game từ thư mục: {TARGET_DIR} ---")

structure_summary = ""
# BỔ SUNG: Thêm đuôi .sol cho Smart Contract
valid_extensions = ('.py', '.js', '.json', '.ts', '.cpp', '.html', '.css', '.go', '.sol')

# BỔ SUNG: Các từ khóa đặc thù của Web3/Solidity và TypeScript
core_keywords = (
    'def ', 'class ', 'function ', 'async function ', 'exports.',
    'contract ', 'interface ', 'library ', 'modifier ', 'event ', 
    'mapping', 'struct ', 'enum ', 'constructor'
)

# 2. Quét cấu trúc thông minh
for root, dirs, files in os.walk(TARGET_DIR):
    if any(pattern in root for pattern in ['venv', '.git', '__pycache__', 'node_modules', 'dist', 'build']):
        continue
        
    rel_path = os.path.relpath(root, TARGET_DIR)
    structure_summary += f"\n📂 Thư mục: {rel_path if rel_path != '.' else 'Gốc'}\n"
    
    for file in files:
        if file.endswith(valid_extensions):
            file_path = os.path.join(root, file)
            structure_summary += f"  └─ 📄 File: {file}\n"
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for line in lines:
                        clean_line = line.strip()
                        if clean_line.startswith(core_keywords):
                            structure_summary += f"       ├─> {clean_line}\n"
            except Exception:
                pass

if len(structure_summary) < 50:
    print("❌ Không tìm thấy mã nguồn hoặc cấu trúc game hợp lệ!")
    exit()

# 3. Nâng cấp System Prompt (Ép AI phải chú ý đến bối cảnh Web2.5 & Tokenomics)
system_prompt = (
    "Bạn là Kiến trúc sư Hệ thống & Chuyên gia QA Web3. "
    "Dựa trên cấu trúc mã nguồn của game Web2.5 'Bandit Buddy' (NestJS + Hardhat/Solidity + React), "
    "hãy lập kế hoạch kiểm thử E2E cực kỳ chi tiết bằng tiếng Việt.\n\n"
    "YÊU CẦU BẮT BUỘC (Phải có test case cho các tính năng này):\n"
    "1. Lỗ hổng Smart Contract: Kiểm thử Reentrancy, Replay Attack (EIP-712), và kịch bản Bypass thu thuế.\n"
    "2. Kiến trúc Thuế Động (Dynamic Tax): Kiểm tra cơ chế tính thuế dựa trên số dư (balanceOf) tại PancakeSwap Pool.\n"
    "3. Quản trị lạm phát (Kill Switch & Honeypot): Kịch bản giả lập nghẽn mạng để chặn Bank Run và bẫy Bot xả token.\n"
    "4. Đồng bộ State Web2.5: Test lỗ hổng Race Condition khi user thao tác Off-chain (Database) và On-chain cùng lúc.\n"
    "5. Cung cấp code mẫu Hardhat (TypeScript) và NestJS (Jest) cho các kịch bản quan trọng nhất."
)

headers = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {API_KEY}",
    "User-Agent": "BanditBuddy-QA-Agent/1.0"
}

payload = {
    "model": "deepseek-chat",
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Dưới đây là sơ đồ hàm/file của dự án:\n{structure_summary}\n\nHãy xuất báo cáo QA chuẩn Markdown."}
    ],
    "stream": False,
    "temperature": 0.3 # Giảm độ ngẫu nhiên, tăng tính logic và chính xác của code
}

print("🚀 Đang gửi siêu dữ liệu lên DeepSeek API (Mô hình đã tối ưu bối cảnh)...")

try:
    response = requests.post(API_URL, headers=headers, data=json.dumps(payload), timeout=120)
    
    if response.status_code == 200:
        result_json = response.json()
        if 'choices' in result_json and len(result_json['choices']) > 0:
            report_content = result_json['choices'][0]['message']['content']
            
            print("\n================ 🔥 BÁO CÁO KIỂM THỬ GAME TỪ DEEPSEEK QA ================\n")
            
            with open("game_qa.md", "w", encoding="utf-8") as md_file:
                md_file.write(report_content)
            
            print("✅ Đã lưu file 'game_qa.md'. Hãy mở ra để đánh giá chất lượng test case!")
        else:
            print("❌ Lỗi cấu trúc JSON từ DeepSeek.")
    else:
        print(f"❌ API trả về mã lỗi HTTP {response.status_code}\n{response.text}")
        
except Exception as e:
    print(f"❌ Lỗi xử lý dữ liệu: {e}")
