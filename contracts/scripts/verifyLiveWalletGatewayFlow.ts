import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

async function main() {
  const GATEWAY_ADDRESS = '0xeF832Ade201962498243bd4819E031746440B4fE';
  const TREASURY_VAULT = '0xe59FfB05EdF59464e8803E81A4d790d828915006';
  const TEST_RECIPIENT = '0x348fde3b47ebae4ecb86365723d4239f6937af07';

  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  console.log('====================================================');
  console.log('TESTING LIVE WALLET GATEWAY ON BSC TESTNET');
  console.log('Sender:', deployer.address);
  console.log('Gateway Contract:', GATEWAY_ADDRESS);
  console.log('Treasury Vault Target:', TREASURY_VAULT);
  console.log('Test Recipient:', TEST_RECIPIENT);
  console.log('====================================================\n');

  const GatewayFactory = await ethers.getContractFactory('WalletGateway');
  const gateway = GatewayFactory.attach(GATEWAY_ADDRESS) as any;

  const initialTreasuryBal = await provider.getBalance(TREASURY_VAULT);
  const initialRecipientBal = await provider.getBalance(TEST_RECIPIENT);

  const testSendAmount = ethers.parseEther('0.001'); // 0.001 BNB
  const expectedFee = ethers.parseEther('0.000003'); // 0.3%
  const expectedNet = ethers.parseEther('0.000997'); // 99.7%

  console.log(`Sending ${ethers.formatEther(testSendAmount)} BNB through routeBNBTransfer...`);
  const tx = await gateway.routeBNBTransfer(TEST_RECIPIENT, {
    value: testSendAmount,
  });
  console.log('Tx submitted, waiting for confirmation... TxHash:', tx.hash);
  const receipt = await tx.wait(1);
  console.log('✅ Tx Confirmed in block:', receipt.blockNumber);

  const finalTreasuryBal = await provider.getBalance(TREASURY_VAULT);
  const finalRecipientBal = await provider.getBalance(TEST_RECIPIENT);

  const feeDelta = finalTreasuryBal - initialTreasuryBal;
  const netDelta = finalRecipientBal - initialRecipientBal;

  console.log('\n--- BALANCE VERIFICATION RESULTS ---');
  console.log(`Treasury Vault Fee Received: ${ethers.formatEther(feeDelta)} BNB (Expected: ${ethers.formatEther(expectedFee)} BNB)`);
  console.log(`Recipient Net Received:      ${ethers.formatEther(netDelta)} BNB (Expected: ${ethers.formatEther(expectedNet)} BNB)`);

  if (feeDelta === expectedFee && netDelta === expectedNet) {
    console.log('\n🎉 ALL LIVE ON-CHAIN GATEWAY CHECKS PASSED PERFECTLY!');
  } else {
    throw new Error('Fee or net delta mismatch!');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
