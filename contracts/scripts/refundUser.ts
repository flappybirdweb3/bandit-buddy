import { ethers } from "hardhat";

const user = "0x348fde3b47ebae4ecb86365723d4239f6937af07";
const farmAddr = "0xB10067A034078E3FC8335Fb003eEF7334C44952f";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Sending refund and compensation to user:", user);
  console.log("From deployer:", deployer.address);

  // 1. Transfer 100 FARM
  const farm = await ethers.getContractAt("IERC20", farmAddr);
  const farmAmount = ethers.parseEther("100");
  console.log("Transferring 100 FARM...");
  const farmTx = await farm.transfer(user, farmAmount);
  await farmTx.wait();
  console.log("FARM transferred! Tx:", farmTx.hash);

  // 2. Transfer 0.01 BNB for gas
  console.log("Transferring 0.01 BNB...");
  const bnbTx = await deployer.sendTransaction({
    to: user,
    value: ethers.parseEther("0.01")
  });
  await bnbTx.wait();
  console.log("BNB transferred! Tx:", bnbTx.hash);

  const newFarmBal = await farm.balanceOf(user);
  const newBnbBal = await ethers.provider.getBalance(user);
  console.log("User updated FARM balance:", ethers.formatEther(newFarmBal));
  console.log("User updated BNB balance:", ethers.formatEther(newBnbBal));
}

main().catch(console.error);
