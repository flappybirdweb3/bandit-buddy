import { ethers } from 'hardhat';

async function main() {
  const TREASURY_VAULT   = '0xe59FfB05EdF59464e8803E81A4d790d828915006';
  const FARM_TOKEN       = '0xB10067A034078E3FC8335Fb003eEF7334C44952f';
  const PANCAKE_ROUTER   = '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3'; // BSC Testnet V2 Router
  const USDT_TOKEN       = '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'; // BSC Testnet USDT
  const WBNB             = '0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd'; // BSC Testnet WBNB
  const [deployer] = await ethers.getSigners();

  console.log('====================================================');
  console.log('Deploying WalletGateway to BSC Testnet...');
  console.log('Deployer:', deployer.address);
  console.log('Treasury Vault:', TREASURY_VAULT);
  console.log('FARM Token:', FARM_TOKEN);
  console.log('PancakeSwap Router:', PANCAKE_ROUTER);
  console.log('USDT Token:', USDT_TOKEN);
  console.log('WBNB:', WBNB);

  const GatewayFactory = await ethers.getContractFactory('WalletGateway');
  const gateway = await GatewayFactory.deploy(
    TREASURY_VAULT,
    FARM_TOKEN,
    PANCAKE_ROUTER,
    USDT_TOKEN,
    WBNB,
    deployer.address,
  );
  await gateway.waitForDeployment();

  const address = await gateway.getAddress();
  console.log('✅ WalletGateway successfully deployed at:', address);
  console.log('Fee BPS:', (await gateway.feeBps()).toString(), '(0.3%)');
  console.log('CASHOUT_FEE_BPS:', (await gateway.CASHOUT_FEE_BPS()).toString(), '(1%)');
  console.log('farmToken:', await gateway.farmToken());
  console.log('usdtToken:', await gateway.usdtToken());
  console.log('treasuryVault:', await gateway.treasuryVault());
  console.log('BscScan URL:', `https://testnet.bscscan.com/address/${address}`);
  console.log('====================================================');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
