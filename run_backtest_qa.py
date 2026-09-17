import os
import sys
import requests
import json
from dotenv import load_dotenv

VALID_EXTENSIONS = (
    '.ts', '.tsx', '.js', '.jsx', '.json', '.sol',
    '.prisma', '.sql', '.yml', '.yaml', '.html', '.css', '.py',
)

IGNORED_DIRS = {
    '.git', 'node_modules', 'dist', 'build', 'out', 'coverage',
    'typechain-types', 'artifacts', 'cache', '.next', '.turbo',
    '__pycache__', 'venv', '.venv', 'vendor', 'tmp',
}

MAX_FILE_BYTES = 120_000
MAX_TOTAL_CHARS = 400_000

CORE_KEYWORDS = (
    'def ', 'class ', 'function ', 'async function ', 'exports.',
    'contract ', 'interface ', 'library ', 'modifier ', 'event ', 
    'mapping', 'struct ', 'enum ', 'constructor',
    'export class ', 'export interface ', 'export type ', 'export function ',
    'export const ', 'export default ', 'error ',
    '@Entity', '@Column', '@Injectable', '@Controller', '@Module',
    '@Get(', '@Post(', '@Patch(', '@Delete(',
)

SYSTEM_PROMPT = (
    "You are a System Architect & Web3 QA Specialist for the Web2.5 game 'Bandit Buddy'.\n\n"
    "ACTUAL PROJECT STACK:\n"
    "- Backend: NestJS + TypeORM + PostgreSQL; auth via x-telegram-init-data header; "
    "Global ValidationPipe { whitelist: true, forbidNonWhitelisted: true, transform: true }.\n"
    "- Smart contracts: Hardhat + Solidity ^0.8.24 + OpenZeppelin v5 on BSC "
    "(FarmToken, FarmTokenClaim, GuardDogNFT ERC-1155, BanditDogFusion, BanditMarket, "
    "GuildStaking, TreasuryBuyBack, LiquidityLocker).\n"
    "- Frontend: React + TypeScript + React Query + wagmi/viem + Phaser 3.\n\n"
    "ANTI-HALLUCINATION CONSTRAINTS (MANDATORY):\n"
    "- ONLY write test cases for functions / contracts / tables that ACTUALLY appear in the schema below. "
    "Never reference non-existent contracts, modifiers, events, or tables "
    "(e.g., AntiBot, BotDetected, lastBuy, TWAP if not in schema).\n"
    "- Each test case must specify: target module, inputs, expected custom error / event, "
    "and use actual function signatures. ethers v6 compares bigint, not number.\n"
    "- DO NOT fabricate Pass/Fail figures. If tests have not been executed, mark status as 'Unexecuted' "
    "and leave the result column empty. Do not synthesize PASS rates.\n"
    "- If a contract uses a different tax/tier model than assumed, describe according to real code "
    "and identify corresponding risks, do not alter findings to match assumptions.\n\n"
    "MANDATORY REQUIREMENTS (must include test cases for these groups):\n"
    "1. Smart Contract Security: Reentrancy (TreasuryBuyBack.executeBuyBack, GuildStaking.unstake), "
    "replay nonce (BanditMarket EIP-712, FarmTokenClaim ECDSA, BanditDogFusion commit-reveal), "
    "access control on EVERY admin function, pause/kill-switch.\n"
    "2. FARM Tax (holdings-based): tier calculated by USER WALLET balanceOf (NOT pool balance), "
    "tier2Balance/tier3Balance thresholds, buy/sell tax per tier, MAX_TAX_BPS cap, "
    "and tax avoidance vectors by holding exactly at threshold boundaries.\n"
    "3. Token Economics & Web2.5 Bridge: FarmTokenClaim min/max + setSigner (rotateSigner.ts), "
    "GuardDogNFT maxSupply/burnOnPurchase/fusionContract, BanditDogFusion pity + Soul Shard id 9999, "
    "GuildStaking UNSTAKE_DELAY 7 days and withdrawal capability during paused state.\n"
    "4. Off-chain ↔ On-chain Synchronization: DB race conditions, event listener idempotency "
    "(unique tx_hash + log_index), reorg/retry, optimistic locking.\n"
    "5. Boundary Validation: DTO whitelist/mass-assignment, missing field validators "
    "(e.g., SyncNftDto.walletAddress, RepairDto.amount), uncoerced numbers.\n\n"
    "OUTPUT FORMAT: Markdown containing (a) Test Case matrix table with columns ID / Module / Type / Priority, "
    "(b) test details with Objective - Preconditions - Steps - Expectations - Status, "
    "(c) sample Hardhat (TypeScript) and Jest code for critical cases, "
    "(d) 'Risks & Recommendations' section categorized by P0/P1/P2."
)

def scan_codebase(target_dir: str, max_total_chars: int = MAX_TOTAL_CHARS) -> str:
    """Scan and extract codebase structure, prioritizing core directories."""
    structure_summary = ""
    truncated = False

    def dir_sort_key(d: str) -> tuple:
        priority = {'contracts': 0, 'backend': 1, 'database': 2, 'frontend': 3}
        return (priority.get(d, 10), d)

    for root, dirs, files in os.walk(target_dir):
        dirs[:] = sorted([d for d in dirs if d not in IGNORED_DIRS], key=dir_sort_key)
        
        rel_path = os.path.relpath(root, target_dir)
        structure_summary += f"\n📂 Directory: {rel_path if rel_path != '.' else 'Root'}\n"
        
        for file in sorted(files):
            if not file.endswith(VALID_EXTENSIONS):
                continue
            file_path = os.path.join(root, file)
            structure_summary += f"  └─ 📄 File: {file}\n"
            try:
                if os.path.getsize(file_path) > MAX_FILE_BYTES:
                    structure_summary += "       ├─> [skipped: file too large]\n"
                    continue
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        clean_line = line.strip()
                        if clean_line.startswith(CORE_KEYWORDS):
                            structure_summary += f"       ├─> {clean_line}\n"
            except UnicodeDecodeError:
                print(f"⚠️ Warning: Skipped file {file} due to Unicode decode error.")
                continue
            except OSError as err:
                print(f"⚠️ Warning: Unable to read file {file}: {err}")
                continue

            if len(structure_summary) > max_total_chars:
                truncated = True
                break
        if truncated:
            break

    if truncated:
        structure_summary += "\n... [truncated: exceeded character budget for API]\n"

    return structure_summary

def main():
    load_dotenv()
    api_key = os.getenv("DEEPSEEK_API_KEY")
    target_dir = os.getenv("TARGET_DIR", "/home/ubuntu/barnbuddy")
    api_url = "https://api.deepseek.com/v1/chat/completions"
    model = os.getenv("DEEPSEEK_MODEL", "deepseek-reasoner")
    is_reasoning_model = "reasoner" in model
    report_path = os.getenv("REPORT_PATH", "game_qa.md")

    if not api_key:
        print("❌ SECURITY ERROR: DEEPSEEK_API_KEY not found in .env file!")
        sys.exit(1)

    print(f"--- Analyzing and scanning Game structure from directory: {target_dir} ---")

    structure_summary = scan_codebase(target_dir)

    if len(structure_summary) < 50:
        print("❌ No valid source code or game structure found!")
        sys.exit(1)

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "User-Agent": "BanditBuddy-QA-Agent/1.0"
    }

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Below is the project function/file schema:\n{structure_summary}\n\nPlease generate a standard Markdown QA report."}
        ],
        "stream": False,
    }
    if not is_reasoning_model:
        payload["temperature"] = 0.3

    print("🚀 Sending metadata to DeepSeek API (Context-optimized model)...")

    try:
        response = requests.post(api_url, headers=headers, data=json.dumps(payload), timeout=120)
        
        if response.status_code == 200:
            result_json = response.json()
            if 'choices' in result_json and len(result_json['choices']) > 0:
                report_content = result_json['choices'][0]['message']['content']
                
                print("\n================ 🔥 GAME TEST REPORT FROM DEEPSEEK QA ================\n")
                
                with open(report_path, "w", encoding="utf-8") as md_file:
                    md_file.write(report_content)
                
                print(f"✅ Saved report to '{os.path.abspath(report_path)}'.")
            else:
                print("❌ JSON structure error from DeepSeek.")
        else:
            print(f"❌ API returned HTTP {response.status_code}\n{response.text}")
            
    except Exception as e:
        print(f"❌ Data processing error: {e}")

if __name__ == '__main__':
    main()
