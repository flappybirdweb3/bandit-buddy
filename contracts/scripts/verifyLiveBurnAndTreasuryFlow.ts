import { ethers } from 'hardhat';

async function main() {
  const GATEWAY_ADDRESS = '0xCB7B00e0f168124C0be09A7Fae628e0261E3440B';
  const TREASURY_VAULT = '0xe59FfB05EdF59464e8803E81A4d790d828915006';
  const FARM_TOKEN_ADDRESS = '0xB10067A034078E3FC8335Fb003eEF7334C44952f';
  const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
  const TEST_RECIPIENT = '0x348fde3b47ebae4ecb86365723d4239f6937af07';

  const [deployer] = await ethers.getSigners();
  const provider = ethers.provider;

  console.log('================================================================');
  console.log('🛡️  VERIFYING LIVE ON-CHAIN WITHDRAWAL FEE ROUTING ON BSC TESTNET');
  console.log('================================================================');
  console.log('Deployer / Sender:    ', deployer.address);
  console.log('WalletGateway:        ', GATEWAY_ADDRESS);
  console.log('Treasury Vault:       ', TREASURY_VAULT);
  console.log('FARM Token Address:   ', FARM_TOKEN_ADDRESS);
  console.log('Black Hole / Dead:    ', DEAD_ADDRESS);
  console.log('Test Recipient:       ', TEST_RECIPIENT);
  console.log('================================================================\n');

  const gateway = await ethers.getContractAt('WalletGateway', GATEWAY_ADDRESS);
  const farmToken = await ethers.getContractAt('IERC20', FARM_TOKEN_ADDRESS);

  // 1. Verify Contract Configuration
  const onchainVault = await gateway.treasuryVault();
  const onchainFarm = await gateway.farmToken();
  const onchainDead = await gateway.DEAD_ADDRESS();
  const onchainFeeBps = await gateway.feeBps();

  console.log('>>> [STEP 1] Contract Configuration Verification:');
  console.log('  - On-chain Treasury Vault:', onchainVault, onchainVault.toLowerCase() === TREASURY_VAULT.toLowerCase() ? '✅ MATCH' : '❌ MISMATCH');
  console.log('  - On-chain FARM Token:    ', onchainFarm, onchainFarm.toLowerCase() === FARM_TOKEN_ADDRESS.toLowerCase() ? '✅ MATCH' : '❌ MISMATCH');
  console.log('  - On-chain Dead Address:  ', onchainDead, onchainDead.toLowerCase() === DEAD_ADDRESS.toLowerCase() ? '✅ MATCH' : '❌ MATCH');
  console.log('  - On-chain Fee BPS:       ', onchainFeeBps.toString(), '(0.3%) ✅ MATCH');

  if (
    onchainVault.toLowerCase() !== TREASURY_VAULT.toLowerCase() ||
    onchainFarm.toLowerCase() !== FARM_TOKEN_ADDRESS.toLowerCase() ||
    onchainDead.toLowerCase() !== DEAD_ADDRESS.toLowerCase() ||
    onchainFeeBps !== 30n
  ) {
    throw new Error('Contract parameter verification failed!');
  }

  // 2. Test Case 1: BNB Withdrawal Routing (0.3% to Treasury, 99.7% to Recipient)
  console.log('\n>>> [STEP 2] Testing BNB Withdrawal Routing (routeBNBTransfer):');
  const bnbSendAmount = ethers.parseEther('0.001'); // 0.001 BNB
  const expectedBnbFee = ethers.parseEther('0.000003'); // 0.3% = 0.000003 BNB
  const expectedBnbNet = ethers.parseEther('0.000997'); // 99.7% = 0.000997 BNB

  const initialTreasuryBnb = await provider.getBalance(TREASURY_VAULT);
  const initialRecipientBnb = await provider.getBalance(TEST_RECIPIENT);

  console.log(`  Sending ${ethers.formatEther(bnbSendAmount)} BNB through routeBNBTransfer...`);
  const bnbTx = await gateway.routeBNBTransfer(TEST_RECIPIENT, { value: bnbSendAmount });
  console.log('  Tx submitted! TxHash:', bnbTx.hash);
  const bnbReceipt = await bnbTx.wait(1);
  const bnbBlock = bnbReceipt?.blockNumber!;
  console.log('  ✅ Confirmed in Block:', bnbBlock);

  const finalTreasuryBnb = await provider.getBalance(TREASURY_VAULT, bnbBlock);
  const preTreasuryBnb = await provider.getBalance(TREASURY_VAULT, bnbBlock - 1);
  const finalRecipientBnb = await provider.getBalance(TEST_RECIPIENT, bnbBlock);
  const preRecipientBnb = await provider.getBalance(TEST_RECIPIENT, bnbBlock - 1);

  const bnbFeeDelta = finalTreasuryBnb - preTreasuryBnb;
  const bnbNetDelta = finalRecipientBnb - preRecipientBnb;

  console.log(`  - Treasury Vault BNB Delta: ${ethers.formatEther(bnbFeeDelta)} BNB (Expected: ${ethers.formatEther(expectedBnbFee)} BNB)`);
  console.log(`  - Recipient Net BNB Delta:  ${ethers.formatEther(bnbNetDelta)} BNB (Expected: ${ethers.formatEther(expectedBnbNet)} BNB)`);

  if (bnbFeeDelta !== expectedBnbFee || bnbNetDelta !== expectedBnbNet) {
    throw new Error('BNB transfer routing balance verification failed!');
  }
  console.log('  ✅ BNB WITHDRAWAL ROUTING CONFIRMED: 0.3% -> Treasury Vault, 99.7% -> Recipient');

  // 3. Test Case 2: $FARM Withdrawal Routing (0.3% to Black Hole / DEAD, 99.7% to Recipient)
  console.log('\n>>> [STEP 3] Testing $FARM Withdrawal Routing (routeTokenTransfer):');
  const deployerFarmBal = await farmToken.balanceOf(deployer.address);
  console.log('  Deployer $FARM Balance:', ethers.formatEther(deployerFarmBal), 'FARM');

  const farmSendAmount = ethers.parseEther('10'); // 10 FARM
  const expectedFarmFee = ethers.parseEther('0.03'); // 0.3% = 0.03 FARM
  const expectedFarmNet = ethers.parseEther('9.97'); // 99.7% = 9.97 FARM

  if (deployerFarmBal < farmSendAmount) {
    console.log('  ⚠️ Deployer has insufficient FARM for test, checking if owner can mint or transfer...');
    const farmContract = await ethers.getContractAt('FarmToken', FARM_TOKEN_ADDRESS);
    const mintTx = await farmContract.mint(deployer.address, ethers.parseEther('1000'));
    await mintTx.wait(1);
    console.log('  Minted 1000 FARM to deployer');
  }

  // Ensure allowance
  const currentAllowance = await farmToken.allowance(deployer.address, GATEWAY_ADDRESS);
  if (currentAllowance < farmSendAmount) {
    console.log('  Approving WalletGateway to spend FARM...');
    const approveTx = await farmToken.approve(GATEWAY_ADDRESS, ethers.parseEther('1000000'));
    await approveTx.wait(1);
    console.log('  ✅ Approved WalletGateway');
  }

  console.log(`  Routing ${ethers.formatEther(farmSendAmount)} $FARM through routeTokenTransfer...`);
  const farmTx = await gateway.routeTokenTransfer(FARM_TOKEN_ADDRESS, TEST_RECIPIENT, farmSendAmount);
  console.log('  Tx submitted! TxHash:', farmTx.hash);
  const farmReceipt = await farmTx.wait(1);
  const farmBlock = farmReceipt?.blockNumber!;
  console.log('  ✅ Confirmed in Block:', farmBlock);

  const preDeadFarm = await farmToken.balanceOf(DEAD_ADDRESS, { blockTag: farmBlock - 1 });
  const finalDeadFarm = await farmToken.balanceOf(DEAD_ADDRESS, { blockTag: farmBlock });

  const preTreasuryFarm = await farmToken.balanceOf(TREASURY_VAULT, { blockTag: farmBlock - 1 });
  const finalTreasuryFarm = await farmToken.balanceOf(TREASURY_VAULT, { blockTag: farmBlock });

  const preRecipientFarm = await farmToken.balanceOf(TEST_RECIPIENT, { blockTag: farmBlock - 1 });
  const finalRecipientFarm = await farmToken.balanceOf(TEST_RECIPIENT, { blockTag: farmBlock });

  const deadFarmDelta = finalDeadFarm - preDeadFarm;
  const treasuryFarmDelta = finalTreasuryFarm - preTreasuryFarm;
  const recipientFarmDelta = finalRecipientFarm - preRecipientFarm;

  console.log(`  - Black Hole (DEAD_ADDRESS) $FARM Delta: +${ethers.formatEther(deadFarmDelta)} FARM (Expected: +${ethers.formatEther(expectedFarmFee)} FARM)`);
  console.log(`  - Treasury Vault $FARM Delta:           ${ethers.formatEther(treasuryFarmDelta)} FARM (Expected: 0.0 FARM - NO FARM IN VAULT)`);
  console.log(`  - Recipient Net $FARM Delta:            +${ethers.formatEther(recipientFarmDelta)} FARM (Expected: +${ethers.formatEther(expectedFarmNet)} FARM)`);

  if (deadFarmDelta !== expectedFarmFee) {
    throw new Error(`Dead address delta mismatch! Got ${ethers.formatEther(deadFarmDelta)}, expected ${ethers.formatEther(expectedFarmFee)}`);
  }
  if (treasuryFarmDelta !== 0n) {
    throw new Error(`Treasury received FARM unexpectedly! Delta: ${ethers.formatEther(treasuryFarmDelta)}`);
  }
  if (recipientFarmDelta !== expectedFarmNet) {
    throw new Error(`Recipient net delta mismatch! Got ${ethers.formatEther(recipientFarmDelta)}, expected ${ethers.formatEther(expectedFarmNet)}`);
  }

  console.log('  ✅ $FARM WITHDRAWAL ROUTING CONFIRMED: 0.3% -> Black Hole (0x...dEaD) PERMANENTLY BURNED, 0% -> Treasury, 99.7% -> Recipient');

  console.log('\n================================================================');
  console.log('🎉 SUMMARY OF AUDIT & ON-CHAIN VERIFICATION');
  console.log('================================================================');
  console.log('Contract Address:     ', GATEWAY_ADDRESS);
  console.log('BNB Transfer Tx:      ', bnbTx.hash);
  console.log('  -> BscScan: https://testnet.bscscan.com/tx/' + bnbTx.hash);
  console.log('$FARM Transfer Tx:    ', farmTx.hash);
  console.log('  -> BscScan: https://testnet.bscscan.com/tx/' + farmTx.hash);
  console.log('================================================================');
}

main().catch((err) => {
  console.error('Execution error:', err);
  process.exit(1);
});
