/**
 * SC-DEPLOY-1 – Create FARM/WBNB pair on PancakeSwap V2 (BSC Testnet)
 *
 * Uses the OLD FARM token (no setPancakePair, no LiquidityLocker).
 * DexOracleService and DexVolumeService only need the pair address — no
 * FarmToken V2 features are required.
 *
 * Usage:
 *   npx hardhat run scripts/createPairAndAddLiquidity.ts --network bscTestnet
 *
 * Required env (../..env):
 *   SIGNER_PRIVATE_KEY  — admin wallet PK
 *
 * Output:
 *   deployments/pair-bscTestnet.json  — recorded pair address
 *   deployment.bscTestnet.json        — updated with pancakePair field
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Constants ─────────────────────────────────────────────────────────────────

const PANCAKE_ROUTER_TESTNET = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";
const WBNB_TESTNET           = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
const FACTORY_TESTNET        = "0xb7926c0430afb07aa7defde6da862ae0bde767bc";

// How much liquidity to seed
const FARM_AMOUNT = ethers.parseUnits("100000", 18); // 100 000 FARM
const BNB_AMOUNT  = ethers.parseEther("0.02");        // 0.02 BNB (testnet: gas for pair creation ~0.035 BNB)

const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function factory() external view returns (address)",
];
const FACTORY_ABI = ["function getPair(address tokenA, address tokenB) external view returns (address pair)"];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function readDeployment(): Record<string, string> {
  const p = path.join(__dirname, "..", "deployment.bscTestnet.json");
  if (!fs.existsSync(p)) throw new Error("deployment.bscTestnet.json not found");
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeDeployment(data: Record<string, unknown>): void {
  const p = path.join(__dirname, "..", "deployment.bscTestnet.json");
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function writePairFile(pairAddress: string): void {
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const out = {
    network: "bscTestnet",
    chainId: 97,
    pancakePair: pairAddress,
    farmToken: readDeployment().farmToken,
    wbnb: WBNB_TESTNET,
    router: PANCAKE_ROUTER_TESTNET,
    factory: FACTORY_TESTNET,
    farmAmount: ethers.formatUnits(FARM_AMOUNT, 18),
    bnbAmount: ethers.formatEther(BNB_AMOUNT),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, "pair-bscTestnet.json"), JSON.stringify(out, null, 2));
  console.log(`  Saved → deployments/pair-bscTestnet.json`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (network.name !== "bscTestnet") {
    throw new Error(`Must run on bscTestnet, got: ${network.name}`);
  }

  const deployment = readDeployment();
  const farmTokenAddress = deployment.farmToken;
  if (!farmTokenAddress) throw new Error("farmToken missing from deployment.bscTestnet.json");

  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer : ${deployer.address}`);
  console.log(`FARM     : ${farmTokenAddress}`);
  console.log(`Router   : ${PANCAKE_ROUTER_TESTNET}`);
  console.log(`Adding   : ${ethers.formatUnits(FARM_AMOUNT, 18)} FARM + ${ethers.formatEther(BNB_AMOUNT)} BNB\n`);

  // Guard: tBNB balance check
  const bnbBalance = await ethers.provider.getBalance(deployer.address);
  const needed = BNB_AMOUNT + ethers.parseEther("0.04"); // gas buffer (pair creation ~0.035 BNB)
  if (bnbBalance < needed) {
    throw new Error(
      `Insufficient tBNB: have ${ethers.formatEther(bnbBalance)}, need >= ${ethers.formatEther(needed)}.\n` +
      `Top up via https://testnet.bnbchain.org/faucet-smart (INFRA-1).`
    );
  }
  console.log(`tBNB balance: ${ethers.formatEther(bnbBalance)} ✓`);

  // Step 0: Check if pair already exists
  const factory = new ethers.Contract(FACTORY_TESTNET, FACTORY_ABI, deployer);
  const existingPair = await factory.getPair(farmTokenAddress, WBNB_TESTNET);
  if (existingPair !== ethers.ZeroAddress) {
    console.log(`\nPair already exists: ${existingPair}`);
    console.log("Writing pair address and exiting — no duplicate liquidity added.");
    writePairFile(existingPair);
    const updated = { ...deployment, pancakePair: existingPair };
    writeDeployment(updated);
    console.log(`\nPANCAKE_PAIR_ADDRESS=${existingPair}`);
    return;
  }

  // Step 1: Approve router to spend FARM tokens
  console.log("Step 1: Approving PancakeRouter to spend FARM...");
  const farmToken = new ethers.Contract(farmTokenAddress, ERC20_ABI, deployer);

  const farmBalance = await farmToken.balanceOf(deployer.address);
  console.log(`  FARM balance: ${ethers.formatUnits(farmBalance, 18)}`);
  if (farmBalance < FARM_AMOUNT) {
    throw new Error(`Insufficient FARM: have ${ethers.formatUnits(farmBalance, 18)}, need 100000`);
  }

  const approveTx = await farmToken.approve(PANCAKE_ROUTER_TESTNET, FARM_AMOUNT);
  await approveTx.wait();
  console.log(`  Approved ${ethers.formatUnits(FARM_AMOUNT, 18)} FARM ✓`);

  // Step 2: Add liquidity
  console.log("Step 2: addLiquidityETH (LP tokens to deployer)...");
  const router = new ethers.Contract(PANCAKE_ROUTER_TESTNET, ROUTER_ABI, deployer);
  const deadline = Math.floor(Date.now() / 1000) + 600; // 10 min

  const addTx = await router.addLiquidityETH(
    farmTokenAddress,
    FARM_AMOUNT,
    (FARM_AMOUNT * 95n) / 100n, // 5% slippage on FARM
    (BNB_AMOUNT  * 95n) / 100n, // 5% slippage on BNB
    deployer.address,            // LP tokens go to deployer (no locker on testnet)
    deadline,
    { value: BNB_AMOUNT },
  );
  console.log(`  Tx: ${addTx.hash}`);
  const receipt = await addTx.wait();
  console.log(`  Confirmed in block ${receipt?.blockNumber} ✓`);

  // Step 3: Resolve pair address
  console.log("Step 3: Reading pair address from factory...");
  const pairAddress = await factory.getPair(farmTokenAddress, WBNB_TESTNET);
  if (pairAddress === ethers.ZeroAddress) {
    throw new Error("Pair address is zero after addLiquidityETH — something went wrong");
  }
  console.log(`  Pair: ${pairAddress} ✓`);

  // Step 4: Save outputs
  console.log("Step 4: Writing deployment artifacts...");
  writePairFile(pairAddress);
  const updated = { ...deployment, pancakePair: pairAddress };
  writeDeployment(updated);
  console.log(`  Updated deployment.bscTestnet.json ✓`);

  console.log(`
════════════════════════════════════════════════════════
  FARM/WBNB Pair Created on BSC Testnet
════════════════════════════════════════════════════════
  PANCAKE_PAIR_ADDRESS=${pairAddress}

  Next steps:
  1. Update barnbuddy/.env:
       PANCAKE_PAIR_ADDRESS=${pairAddress}
       PANCAKE_FACTORY_ADDRESS=${FACTORY_TESTNET}
       PANCAKE_ROUTER_ADDRESS=${PANCAKE_ROUTER_TESTNET}
       WBNB_ADDRESS=${WBNB_TESTNET}
  2. Rebuild backend:
       docker compose build backend && docker compose up -d backend
  3. Wait 3 min → verify GET /web3/exchange-rate returns live farmPriceUsd
════════════════════════════════════════════════════════
`);
}

main().catch((e) => { console.error(e); process.exit(1); });
