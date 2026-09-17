import { ethers } from 'hardhat';

async function main() {
  const hash = '0xab3ff9a831321056090d91cb13b6fb91bc71e58a733f93f2d54b7d9fcb49f949';
  const receipt = await ethers.provider.getTransactionReceipt(hash);
  console.log('Status:', receipt?.status);
  console.log('BlockNumber:', receipt?.blockNumber);
  console.log('GasUsed:', receipt?.gasUsed.toString());
  console.log('Logs:', receipt?.logs);

  const block = receipt?.blockNumber!;
  const balBefore = await ethers.provider.getBalance('0xe59FfB05EdF59464e8803E81A4d790d828915006', block - 1);
  const balAfter = await ethers.provider.getBalance('0xe59FfB05EdF59464e8803E81A4d790d828915006', block);
  console.log('Treasury bal before block:', ethers.formatEther(balBefore));
  console.log('Treasury bal at block:    ', ethers.formatEther(balAfter));
  console.log('Diff:', ethers.formatEther(balAfter - balBefore));

  const recBefore = await ethers.provider.getBalance('0x348fde3b47ebae4ecb86365723d4239f6937af07', block - 1);
  const recAfter = await ethers.provider.getBalance('0x348fde3b47ebae4ecb86365723d4239f6937af07', block);
  console.log('Recipient bal before block:', ethers.formatEther(recBefore));
  console.log('Recipient bal at block:    ', ethers.formatEther(recAfter));
  console.log('Diff:', ethers.formatEther(recAfter - recBefore));
}

main().catch(console.error);
