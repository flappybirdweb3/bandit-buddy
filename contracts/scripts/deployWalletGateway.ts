import { ethers } from 'hardhat';

async function main() {
  const TREASURY_VAULT = '0xe59FfB05EdF59464e8803E81A4d790d828915006';
  const FARM_TOKEN = '0xB10067A034078E3FC8335Fb003eEF7334C44952f';
  const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
  const [deployer] = await ethers.getSigners();

  console.log('====================================================');
  console.log('Deploying WalletGateway to BSC Testnet...');
  console.log('Deployer:', deployer.address);
  console.log('Treasury Vault Target:', TREASURY_VAULT);
  console.log('FARM Token Target:', FARM_TOKEN);
  console.log('Black Hole / Burn Target:', DEAD_ADDRESS);

  const GatewayFactory = await ethers.getContractFactory('WalletGateway');
  const gateway = await GatewayFactory.deploy(TREASURY_VAULT, FARM_TOKEN, deployer.address);
  await gateway.waitForDeployment();

  const address = await gateway.getAddress();
  console.log('✅ WalletGateway successfully deployed at:', address);
  console.log('Fee BPS:', (await gateway.feeBps()).toString(), '(0.3%)');
  console.log('farmToken:', await gateway.farmToken());
  console.log('treasuryVault:', await gateway.treasuryVault());
  console.log('DEAD_ADDRESS:', await gateway.DEAD_ADDRESS());
  console.log('BscScan URL:', `https://testnet.bscscan.com/address/${address}`);
  console.log('====================================================');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
