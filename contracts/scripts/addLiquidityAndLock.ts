import { ethers, network } from "hardhat";

const PANCAKE_ROUTER_TESTNET = "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3";
const PANCAKE_ROUTER_MAINNET = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB_TESTNET = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
const WBNB_MAINNET = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

const ROUTER_ABI = [
  "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
  "function factory() external view returns (address)",
];
const FACTORY_ABI = ["function getPair(address, address) external view returns (address)"];
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address) external view returns (uint256)",
];
const FARM_ABI = [...ERC20_ABI, "function setPancakePair(address pair) external"];
const LOCKER_ABI = [
  "function lockTokens(address lpToken, uint256 amount, uint256 durationSec, address beneficiary) external",
];

async function main() {
  const isMainnet = network.name === "bscMainnet";
  const [deployer] = await ethers.getSigners();
  const routerAddress = isMainnet ? PANCAKE_ROUTER_MAINNET : PANCAKE_ROUTER_TESTNET;
  const wbnb = isMainnet ? WBNB_MAINNET : WBNB_TESTNET;

  const farmTokenAddress = process.env.FARM_TOKEN_ADDRESS;
  const lockerAddress = process.env.LIQUIDITY_LOCKER_ADDRESS;
  if (!farmTokenAddress) throw new Error("FARM_TOKEN_ADDRESS required in .env");
  if (!lockerAddress) throw new Error("LIQUIDITY_LOCKER_ADDRESS required in .env");

  const farmAmount = ethers.parseUnits(process.env.FARM_AMOUNT_TO_ADD ?? "500000", 18);
  const bnbAmount = ethers.parseEther(process.env.BNB_AMOUNT_TO_ADD ?? "1");
  const beneficiary = process.env.TREASURY_ADDRESS ?? deployer.address;

  console.log(`Network: ${network.name} | FarmToken: ${farmTokenAddress}`);
  console.log(`Adding ${ethers.formatUnits(farmAmount, 18)} FARM + ${ethers.formatEther(bnbAmount)} BNB`);

  const farmToken = new ethers.Contract(farmTokenAddress, FARM_ABI, deployer);
  const router = new ethers.Contract(routerAddress, ROUTER_ABI, deployer);
  const locker = new ethers.Contract(lockerAddress, LOCKER_ABI, deployer);

  // 1. Approve router
  console.log("Step 1: Approving PancakeRouter...");
  await (await farmToken.approve(routerAddress, farmAmount)).wait();
  console.log("  Approved.");

  // 2. Add liquidity — LP tokens land directly in LiquidityLocker
  console.log("Step 2: addLiquidityETH → LP to LiquidityLocker...");
  const deadline = Math.floor(Date.now() / 1000) + 300;
  await (await router.addLiquidityETH(
    farmTokenAddress, farmAmount,
    (farmAmount * 95n) / 100n,
    (bnbAmount * 95n) / 100n,
    lockerAddress,    // LP recipient = LiquidityLocker
    deadline,
    { value: bnbAmount }
  )).wait();
  console.log("  Liquidity added.");

  // 3. Resolve LP pair address
  console.log("Step 3: Resolving LP pair address...");
  const factoryAddress = await router.factory();
  const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, deployer);
  const lpPairAddress = await factory.getPair(farmTokenAddress, wbnb);
  if (lpPairAddress === ethers.ZeroAddress) throw new Error("LP pair not found after addLiquidity");
  console.log(`  LP pair: ${lpPairAddress}`);

  // 4. Enable tax routing on FarmToken
  console.log("Step 4: Setting PancakePair on FarmToken...");
  await (await farmToken.setPancakePair(lpPairAddress)).wait();
  console.log("  PancakePair set — tax routing active.");

  // 5. Lock LP tokens (12 months)
  console.log("Step 5: Locking LP tokens for 12 months...");
  const lpToken = new ethers.Contract(lpPairAddress, ERC20_ABI, deployer);
  const lpBalance = await lpToken.balanceOf(lockerAddress);
  console.log(`  LP in locker: ${ethers.formatUnits(lpBalance, 18)}`);
  await (await locker.lockTokens(lpPairAddress, lpBalance, 31_536_000, beneficiary)).wait();
  console.log(`  LP locked until ${new Date(Date.now() + 31_536_000_000).toISOString()} for ${beneficiary}`);

  console.log("\nDone! Tax routing active. LP locked 12 months.");
}

main().catch((e) => { console.error(e); process.exit(1); });
