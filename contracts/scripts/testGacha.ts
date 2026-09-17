/**
 * Manual test: full commit-reveal Gacha pull on BSC Testnet.
 * Run: npx ts-node scripts/testGacha.ts
 */
import { ethers } from 'ethers';
import * as crypto from 'crypto';

const RPC = 'https://data-seed-prebsc-1-s1.binance.org:8545/';
const MNEMONIC = 'income time green black tenant uncover person universe toss fly rare size';

const FARM_ADDRESS   = '0x7eaDD0273eb170B4ba28050F675C4878bEb75ae3';
const FUSION_ADDRESS = '0xacF816f75bd52d0aB0cD4E9272965ebecEeA40f7';
const NFT_ADDRESS    = '0x6deDA9ab6107e70a74C8dEB284450F37Ec2e63E6';

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
];

const FUSION_ABI = [
  'function pullCost() view returns (uint256)',
  'function pendingPulls(address) view returns (bytes32 commitment, uint256 commitBlock, bool revealed)',
  'function commit(bytes32 commitment)',
  'function reveal(bytes32 secret)',
  'event Committed(address indexed player, bytes32 commitment, uint256 commitBlock)',
  'event Revealed(address indexed player, uint256 indexed tokenId, uint256 pity)',
];

const NFT_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = ethers.Wallet.fromPhrase(MNEMONIC, provider);
  console.log('Deployer:', wallet.address);

  const farm   = new ethers.Contract(FARM_ADDRESS,   ERC20_ABI,  wallet);
  const fusion = new ethers.Contract(FUSION_ADDRESS, FUSION_ABI, wallet);
  const nft    = new ethers.Contract(NFT_ADDRESS,    NFT_ABI,    wallet);

  const pullCost: bigint = await fusion.pullCost();
  console.log('Pull cost:', ethers.formatEther(pullCost), 'FARM');

  const farmBalance: bigint = await farm.balanceOf(wallet.address);
  console.log('FARM balance:', ethers.formatEther(farmBalance));

  // Step 1: Approve FARM if needed
  const allowance: bigint = await farm.allowance(wallet.address, FUSION_ADDRESS);
  if (allowance < pullCost) {
    console.log('Approving FARM...');
    const approveTx = await farm.approve(FUSION_ADDRESS, pullCost);
    await approveTx.wait();
    console.log('Approved:', approveTx.hash);
  } else {
    console.log('FARM already approved');
  }

  // Step 2: Generate secret and commitment
  const secret = '0x' + crypto.randomBytes(32).toString('hex') as `0x${string}`;
  const commitment = ethers.keccak256(
    ethers.solidityPacked(['bytes32', 'address'], [secret, wallet.address])
  );
  console.log('Secret:', secret);
  console.log('Commitment:', commitment);

  // Step 3: Commit
  console.log('\n--- COMMIT ---');
  const commitTx = await fusion.commit(commitment);
  const commitReceipt = await commitTx.wait();
  console.log('Commit tx:', commitTx.hash);
  const commitBlock = commitReceipt.blockNumber;
  console.log('Commit block:', commitBlock);

  // Step 4: Wait MIN_REVEAL_BLOCKS (2)
  console.log('\nWaiting for 2 blocks...');
  let currentBlock = commitBlock;
  while (currentBlock < commitBlock + 2) {
    await new Promise(r => setTimeout(r, 3000));
    currentBlock = await provider.getBlockNumber();
    console.log(`  current block: ${currentBlock} (need >= ${commitBlock + 2})`);
  }

  // Step 5: Reveal
  console.log('\n--- REVEAL ---');
  const revealTx = await fusion.reveal(secret);
  const revealReceipt = await revealTx.wait();
  console.log('Reveal tx:', revealTx.hash);

  // Step 6: Parse Revealed event
  const iface = new ethers.Interface(FUSION_ABI);
  let mintedTokenId: bigint | null = null;
  for (const log of revealReceipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === 'Revealed') {
        mintedTokenId = parsed.args.tokenId as bigint;
        const pity = parsed.args.pity as bigint;
        console.log('Revealed event: tokenId =', mintedTokenId.toString(), ', pity =', pity.toString());
      }
    } catch { /* skip non-matching logs */ }
  }

  if (mintedTokenId === null) {
    console.error('ERROR: No Revealed event found in receipt!');
    process.exit(1);
  }

  // Step 7: Verify NFT balance
  const nftBalance: bigint = await nft.balanceOf(wallet.address, mintedTokenId);
  console.log(`\nNFT balance of tokenId ${mintedTokenId}: ${nftBalance}`);
  if (nftBalance === 1n) {
    console.log('SUCCESS: NFT minted correctly!');
  } else {
    console.error('ERROR: NFT balance not 1');
  }

  console.log('\nBSCScan commit tx:', `https://testnet.bscscan.com/tx/${commitTx.hash}`);
  console.log('BSCScan reveal tx:', `https://testnet.bscscan.com/tx/${revealTx.hash}`);
}

main().catch(console.error);
