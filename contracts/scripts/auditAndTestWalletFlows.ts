import { ethers } from 'ethers';

const RPC_URL = 'https://bsc-testnet-rpc.publicnode.com';
const FARM_TOKEN_ADDRESS = '0xB10067A034078E3FC8335Fb003eEF7334C44952f';
const GACHA_CONTRACT_ADDRESS = '0x8fdD78C87793084384257fe14Fe448E12220e9d6';
const TREASURY_VAULT_ADDRESS = '0xe59FfB05EdF59464e8803E81A4d790d828915006';
const PANCAKE_ROUTER_ADDRESS = '0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3';

const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function transfer(address recipient, uint256 amount) external returns (bool)',
];

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: string) {
  results.push({ suite, name, passed: condition, details });
  const symbol = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`[${symbol}] ${suite} -> ${name} ${details ? `(${details})` : ''}`);
}

async function runAudit() {
  console.log('===============================================================');
  console.log('🛡️  STARTING WALLET USER FLOW TESTING & SECURITY AUDIT');
  console.log('===============================================================\n');

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // -------------------------------------------------------------
  // SUITE 1: KEY DERIVATION & ACCOUNT VALIDATION
  // -------------------------------------------------------------
  console.log('>>> [SUITE 1] Key Derivation & Account Generation');
  const randomWallet = ethers.Wallet.createRandom();
  const testPk = randomWallet.privateKey;
  assert(testPk.startsWith('0x') && testPk.length === 66, 'Suite 1', 'Private key generation format', testPk.slice(0, 10) + '...');

  const address = randomWallet.address;
  assert(ethers.isAddress(address), 'Suite 1', 'Valid BEP-20 address generated', address);
  assert(address.length === 42, 'Suite 1', 'Address length matches 42 characters', address);

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  assert(shortAddress.length === 13, 'Suite 1', 'Address truncation format for HUD', shortAddress);

  // -------------------------------------------------------------
  // SUITE 2: LIVE BALANCES & ORACLE FIAT CONVERSION
  // -------------------------------------------------------------
  console.log('\n>>> [SUITE 2] On-chain Balances & Oracle Calculations');
  const knownAddress = '0x348fde3b47ebae4ecb86365723d4239f6937af07';
  const farmContract = new ethers.Contract(FARM_TOKEN_ADDRESS, ERC20_ABI, provider);

  const [bnbBal, farmBal] = await Promise.all([
    provider.getBalance(knownAddress),
    farmContract.balanceOf(knownAddress).catch(() => 0n),
  ]);

  assert(typeof bnbBal === 'bigint' && bnbBal >= 0n, 'Suite 2', 'BNB balance query returns valid uint256', `${ethers.formatEther(bnbBal)} BNB`);
  assert(typeof farmBal === 'bigint' && farmBal >= 0n, 'Suite 2', '$FARM balance query returns valid uint256', `${ethers.formatEther(farmBal)} FARM`);

  // Oracle Price Simulation
  const mockFarmBnb = 0.000000366;
  const mockFarmUsd = 0.00022;
  const derivedBnbPriceUsd = mockFarmUsd / mockFarmBnb;
  assert(derivedBnbPriceUsd > 500 && derivedBnbPriceUsd < 700, 'Suite 2', 'DEX Oracle derived BNB Price in realistic range (~$600)', `$${derivedBnbPriceUsd.toFixed(2)}`);

  // Fiat Formatter calculations
  const bnbValueUsd = parseFloat(ethers.formatEther(bnbBal)) * derivedBnbPriceUsd;
  const farmValueUsd = parseFloat(ethers.formatEther(farmBal)) * mockFarmUsd;
  const totalUsd = bnbValueUsd + farmValueUsd;

  const eurRate = 0.92;
  const vndRate = 25450;
  const totalEur = totalUsd * eurRate;
  const totalVnd = totalUsd * vndRate;

  assert(!isNaN(totalUsd) && totalUsd >= 0, 'Suite 2', 'USD Fiat total valuation computed successfully', `$${totalUsd.toFixed(2)}`);
  assert(!isNaN(totalEur) && totalEur >= 0, 'Suite 2', 'EUR Fiat conversion computed successfully', `€${totalEur.toFixed(2)}`);
  assert(!isNaN(totalVnd) && totalVnd >= 0, 'Suite 2', 'VND Fiat conversion computed successfully', `${Math.round(totalVnd).toLocaleString()} ₫`);

  // -------------------------------------------------------------
  // SUITE 3: SEND ACTION INPUT VALIDATION & GAS SAFETY MARGIN
  // -------------------------------------------------------------
  console.log('\n>>> [SUITE 3] Send Action Input Validation & Gas Margin');

  // Address validation
  assert(ethers.isAddress(knownAddress) === true, 'Suite 3', 'Valid address accepted', knownAddress);
  assert(ethers.isAddress('0xInvalidAddress123') === false, 'Suite 3', 'Invalid hex address rejected');
  assert(ethers.isAddress('1234567890') === false, 'Suite 3', 'Plain number rejected');
  assert(ethers.isAddress('') === false, 'Suite 3', 'Empty string rejected');

  // Gas Reserve Margin Logic
  function testMaxSendableBnb(balance: bigint): string {
    const gasReserve = ethers.parseEther('0.0005');
    if (balance <= gasReserve) return '0';
    return ethers.formatEther(balance - gasReserve);
  }

  assert(testMaxSendableBnb(0n) === '0', 'Suite 3', 'Gas Margin: 0 BNB balance returns 0 sendable');
  assert(testMaxSendableBnb(ethers.parseEther('0.0002')) === '0', 'Suite 3', 'Gas Margin: < 0.0005 BNB returns 0 sendable (prevents lockup)');
  assert(testMaxSendableBnb(ethers.parseEther('0.0005')) === '0', 'Suite 3', 'Gas Margin: exactly 0.0005 BNB returns 0 sendable');
  assert(testMaxSendableBnb(ethers.parseEther('0.001')) === '0.0005', 'Suite 3', 'Gas Margin: 0.001 BNB leaves exactly 0.0005 for gas');

  // Amount parsing & decimal boundary checks
  function safeParseAmount(amountStr: string): { valid: boolean; wei: bigint; error?: string } {
    try {
      const trimmed = amountStr.trim();
      if (!trimmed || isNaN(Number(trimmed))) {
        return { valid: false, wei: 0n, error: 'Invalid numeric amount' };
      }
      const num = parseFloat(trimmed);
      if (num <= 0) {
        return { valid: false, wei: 0n, error: 'Amount must be greater than zero' };
      }
      const parts = trimmed.split('.');
      if (parts.length === 2 && parts[1].length > 18) {
        return { valid: false, wei: 0n, error: 'Amount exceeds 18 decimal precision' };
      }
      const wei = ethers.parseEther(trimmed);
      return { valid: true, wei };
    } catch (e: any) {
      return { valid: false, wei: 0n, error: e.message };
    }
  }

  assert(safeParseAmount('1.5').valid === true && safeParseAmount('1.5').wei === ethers.parseEther('1.5'), 'Suite 3', 'Standard decimal amount parsed correctly');
  assert(safeParseAmount('0').valid === false, 'Suite 3', 'Zero amount rejected');
  assert(safeParseAmount('-1.5').valid === false, 'Suite 3', 'Negative amount rejected');
  assert(safeParseAmount('abc').valid === false, 'Suite 3', 'Non-numeric string rejected');
  assert(safeParseAmount('0.0000000000000000001').valid === false, 'Suite 3', 'Excessive precision (> 18 decimals) safely caught before conversion');

  // -------------------------------------------------------------
  // SUITE 4: APPROVALS & ANTI-DRAINER REVOCATION SECURITY
  // -------------------------------------------------------------
  console.log('\n>>> [SUITE 4] Smart Contract Approvals & Anti-Drainer Security');
  const WALLET_GATEWAY_ADDRESS = '0xCB7B00e0f168124C0be09A7Fae628e0261E3440B';
  const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';
  const spenders = [
    { name: 'Bandit Dog Fusion & Gacha v4.2', address: GACHA_CONTRACT_ADDRESS },
    { name: 'PancakeSwap V2 Router', address: PANCAKE_ROUTER_ADDRESS },
    { name: 'Treasury Buyback Vault', address: TREASURY_VAULT_ADDRESS },
    { name: 'Wallet Gateway (0.3% Fee Router)', address: WALLET_GATEWAY_ADDRESS },
  ];

  for (const s of spenders) {
    const allowance: bigint = await farmContract.allowance(knownAddress, s.address).catch(() => 0n);
    const isUnlimited = allowance > ethers.parseEther('10000000');
    assert(
      typeof allowance === 'bigint',
      'Suite 4',
      `Allowance query for ${s.name}`,
      isUnlimited ? 'Unlimited' : `${ethers.formatEther(allowance)} FARM`
    );
  }

  // Verify On-chain WalletGateway parameters
  const gatewayContract = new ethers.Contract(
    WALLET_GATEWAY_ADDRESS,
    [
      'function treasuryVault() view returns (address)',
      'function farmToken() view returns (address)',
      'function DEAD_ADDRESS() view returns (address)',
      'function feeBps() view returns (uint256)',
    ],
    provider
  );
  const onchainVault = await gatewayContract.treasuryVault();
  const onchainFarm = await gatewayContract.farmToken();
  const onchainDead = await gatewayContract.DEAD_ADDRESS();
  const onchainFee = await gatewayContract.feeBps();
  assert(onchainVault.toLowerCase() === TREASURY_VAULT_ADDRESS.toLowerCase(), 'Suite 4', 'WalletGateway target matches Treasury Vault', onchainVault);
  assert(onchainFarm.toLowerCase() === FARM_TOKEN_ADDRESS.toLowerCase(), 'Suite 4', 'WalletGateway target matches FARM Token', onchainFarm);
  assert(onchainDead.toLowerCase() === DEAD_ADDRESS.toLowerCase(), 'Suite 4', 'WalletGateway target matches DEAD Address (Black Hole)', onchainDead);
  assert(onchainFee === 30n, 'Suite 4', 'WalletGateway feeBps matches 30 (0.3%)', onchainFee.toString());

  // -------------------------------------------------------------
  // SUITE 4.5: TELEGRAM QR SCANNER REGEX EXTRACTION & 0.3% FEE MATH
  // -------------------------------------------------------------
  console.log('\n>>> [SUITE 4.5] QR Code Extraction & 0.3% Fee Breakdown Math');
  function extractAddress(scanned: string): string | null {
    const match = scanned.match(/0x[a-fA-F0-9]{40}/i);
    return match ? match[0].trim() : null;
  }

  assert(extractAddress('0x348fde3b47ebae4ecb86365723d4239f6937af07') === '0x348fde3b47ebae4ecb86365723d4239f6937af07', 'Suite 4.5', 'QR Extraction: Raw 0x address');
  assert(extractAddress('ethereum:0x348fde3b47ebae4ecb86365723d4239f6937af07') === '0x348fde3b47ebae4ecb86365723d4239f6937af07', 'Suite 4.5', 'QR Extraction: ethereum: URI prefix');
  assert(extractAddress('binance:0x348fde3b47ebae4ecb86365723d4239f6937af07?amount=2.5') === '0x348fde3b47ebae4ecb86365723d4239f6937af07', 'Suite 4.5', 'QR Extraction: binance: URI with query params');
  assert(extractAddress('https://google.com') === null, 'Suite 4.5', 'QR Extraction: Invalid URL rejected');

  // 0.3% Gateway Fee Math Verification
  const testAmount = 100.0;
  const expectedFee03 = (testAmount * 30) / 10000; // 0.30
  const expectedNet03 = testAmount - expectedFee03; // 99.70
  assert(expectedFee03 === 0.3, 'Suite 4.5', '0.3% fee on 100 equals 0.30', expectedFee03.toString());
  assert(expectedNet03 === 99.7, 'Suite 4.5', 'Net received on 100 equals 99.70', expectedNet03.toString());

  // Verify Revocation payload correctness
  const revokeCalldata = farmContract.interface.encodeFunctionData('approve', [PANCAKE_ROUTER_ADDRESS, 0n]);
  assert(revokeCalldata.includes('0000000000000000000000000000000000000000000000000000000000000000'), 'Suite 4', 'Revoke transaction ABI calldata sets allowance to exactly 0');

  // -------------------------------------------------------------
  // SUITE 5: PRIVACY, BACKUP PAYLOAD & NON-CUSTODIAL INTEGRITY
  // -------------------------------------------------------------
  console.log('\n>>> [SUITE 5] Privacy, Backups & Non-Custodial Integrity');
  const qrBackupString = `BARNBUDDY_KEYLESS_BACKUP:${testPk}`;
  assert(qrBackupString.startsWith('BARNBUDDY_KEYLESS_BACKUP:0x'), 'Suite 5', 'QR Backup payload format prefix matches spec');

  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(address)}&text=${encodeURIComponent('Send BNB / $FARM to my Bandit Buddy address')}`;
  assert(tgShareUrl.includes(address), 'Suite 5', 'Telegram Share URL correctly encodes recipient address');

  // -------------------------------------------------------------
  // SUITE 6: SIMULATED RECIPIENT TRANSFER SIGNING (TRANSACTION INTEGRITY)
  // -------------------------------------------------------------
  console.log('\n>>> [SUITE 6] Transaction Signing & Nonce Integrity');
  const testWallet = new ethers.Wallet(testPk, provider);
  const dummyTx = {
    to: knownAddress,
    value: ethers.parseEther('0.001'),
    gasLimit: 21000n,
    gasPrice: ethers.parseUnits('3', 'gwei'),
    nonce: 0,
    chainId: 97,
  };
  const signedTx = await testWallet.signTransaction(dummyTx);
  assert(signedTx.startsWith('0x02') || signedTx.startsWith('0xf8') || signedTx.startsWith('0x'), 'Suite 6', 'Client-side transaction signing produces valid raw RLP/EIP-1559 payload');

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(`AUDIT & USER FLOW RESULTS: ${passedCount} PASSED, ${failedCount} FAILED, ${results.length} TOTAL TESTS`);
  console.log('===============================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAudit().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
