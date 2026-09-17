import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { RedisService } from '../../common/redis.service';

const TREASURY_ABI = [
  'function buyBackThreshold() external view returns (uint256)',
  'function slippageBps() external view returns (uint256)',
  'function totalBurned() external view returns (uint256)',
  'function totalBnbSpent() external view returns (uint256)',
  'function DEAD_ADDRESS() external view returns (address)',
  'function triggerBuyBack() external',
  'function executeBuyBack(uint256 bnbAmount, uint256 minFarmOut) external',
  'function paused() external view returns (bool)',
  'event BuyBackAndBurned(uint256 indexed bnbSpent, uint256 indexed farmBurned)',
  'event FundsReceived(address indexed from, uint256 amount)',
];

const FARM_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
];

const DEAD_BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

export interface BuyBackEventRecord {
  txHash: string;
  bnbSpent: string;
  farmBurned: string;
  timestamp: number;
  blockNumber: number;
}

export interface TreasuryStatus {
  contractAddress: string;
  bnbBalance: string;
  bnbBalanceWei: string;
  buyBackThreshold: string;
  buyBackThresholdWei: string;
  progressPercent: number;
  totalBurned: string;
  totalBnbSpent: string;
  deadAddress: string;
  isReady: boolean;
  isPaused: boolean;
  recentEvents: BuyBackEventRecord[];
  lastCheckedAt: number;
}

const REDIS_TREASURY_STATUS_KEY = 'treasury:buyback:status';
const REDIS_BUYBACK_HISTORY_KEY = 'treasury:buyback:history';

@Injectable()
export class TreasuryMonitorService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TreasuryMonitorService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private isProcessing = false;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Initial check on server startup (delayed 5s to allow connections to settle)
    setTimeout(() => {
      this.checkAndExecuteBuyBack().catch((err) => {
        this.logger.warn(`Initial Treasury check error: ${err.message}`);
      });
    }, 5000);
  }

  private getProvider(): ethers.JsonRpcProvider {
    if (!this.provider) {
      const rpcUrl =
        this.config.get<string>('web3.bscRpcUrl') ||
        this.config.get<string>('BSC_RPC_URL') ||
        this.config.get<string>('RPC_URL') ||
        'https://bsc-testnet-rpc.publicnode.com';

      this.provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
        staticNetwork: true,
      });
    }
    return this.provider;
  }

  /**
   * Background worker running every 1 minute.
   * Scans TreasuryBuyBack contract balance. If balance >= threshold (2.0 BNB), triggers Buy-back & Burn.
   */
  @Cron('*/1 * * * *')
  async handleCron(): Promise<void> {
    await this.checkAndExecuteBuyBack();
  }

  /**
   * Checks treasury balance and executes buyback if threshold is satisfied.
   */
  async checkAndExecuteBuyBack(): Promise<{ triggered: boolean; txHash?: string; error?: string }> {
    if (this.isProcessing) {
      this.logger.debug('Treasury buy-back task already in progress. Skipping cycle.');
      return { triggered: false, error: 'Task already in progress' };
    }

    const treasuryAddress =
      this.config.get<string>('web3.treasuryContractAddress') ||
      this.config.get<string>('TREASURY_CONTRACT_ADDRESS') ||
      '0xe59FfB05EdF59464e8803E81A4d790d828915006';

    if (!treasuryAddress || treasuryAddress === ethers.ZeroAddress) {
      this.logger.warn('TREASURY_CONTRACT_ADDRESS is not configured. Buy-back monitor inactive.');
      return { triggered: false, error: 'Treasury address not configured' };
    }

    this.isProcessing = true;
    try {
      const provider = this.getProvider();
      const treasuryContract = new ethers.Contract(treasuryAddress, TREASURY_ABI, provider);

      const farmTokenAddress =
        this.config.get<string>('web3.farmTokenAddress') ||
        this.config.get<string>('FARM_TOKEN_ADDRESS') ||
        '0xB10067A034078E3FC8335Fb003eEF7334C44952f';
      const farmContract = new ethers.Contract(farmTokenAddress, FARM_ABI, provider);

      // Fetch onchain status
      const [balance, threshold, isPaused, treasuryBurned, totalBnbSpent, deadBalance] = await Promise.all([
        provider.getBalance(treasuryAddress),
        treasuryContract.buyBackThreshold().catch(() => ethers.parseEther('2.0')),
        treasuryContract.paused().catch(() => false),
        treasuryContract.totalBurned().catch(() => 0n),
        treasuryContract.totalBnbSpent().catch(() => 0n),
        farmContract.balanceOf(DEAD_BURN_ADDRESS).catch(() => 0n),
      ]);

      const effectiveTotalBurned = deadBalance > treasuryBurned ? deadBalance : treasuryBurned;

      const bnbBalanceStr = ethers.formatEther(balance);
      const thresholdStr = ethers.formatEther(threshold);
      const progressPercent = threshold > 0n
        ? Math.min(100, Number((balance * 10000n) / threshold) / 100)
        : 0;

      // Cache current status in Redis
      const status: TreasuryStatus = {
        contractAddress: treasuryAddress,
        bnbBalance: bnbBalanceStr,
        bnbBalanceWei: balance.toString(),
        buyBackThreshold: thresholdStr,
        buyBackThresholdWei: threshold.toString(),
        progressPercent,
        totalBurned: ethers.formatEther(effectiveTotalBurned),
        totalBnbSpent: ethers.formatEther(totalBnbSpent),
        deadAddress: DEAD_BURN_ADDRESS,
        isReady: balance >= threshold,
        isPaused,
        recentEvents: await this.getRecentEventsFromCache(),
        lastCheckedAt: Date.now(),
      };
      await this.redis.set(REDIS_TREASURY_STATUS_KEY, JSON.stringify(status), 15);

      this.logger.log(
        `[Treasury] Vault Balance: ${bnbBalanceStr} BNB / Threshold: ${thresholdStr} BNB (${progressPercent.toFixed(1)}%)`,
      );

      if (isPaused) {
        this.logger.warn('[Treasury] Contract is currently paused. Skipping buyback execution.');
        return { triggered: false, error: 'Contract is paused' };
      }

      // Check if threshold is reached
      if (balance < threshold) {
        this.logger.debug(`[Treasury] Threshold not met (${bnbBalanceStr} < ${thresholdStr} BNB). Standing by.`);
        return { triggered: false };
      }

      // Threshold reached! Execute buyback
      this.logger.log(`🚀 [Treasury] Threshold reached (${bnbBalanceStr} BNB >= ${thresholdStr} BNB)! Triggering on-chain Buyback & Burn...`);

      const signerPrivateKey =
        this.config.get<string>('web3.signerPrivateKey') ||
        this.config.get<string>('SIGNER_PRIVATE_KEY');

      if (!signerPrivateKey) {
        this.logger.error('Missing SIGNER_PRIVATE_KEY. Cannot trigger on-chain buy-back.');
        return { triggered: false, error: 'Missing SIGNER_PRIVATE_KEY' };
      }

      const wallet = new ethers.Wallet(signerPrivateKey, provider);
      const contractWithSigner = treasuryContract.connect(wallet) as ethers.Contract;

      // Estimate gas with 25% safety margin
      let gasLimit = 600_000n;
      try {
        const estimated = await contractWithSigner.triggerBuyBack.estimateGas();
        gasLimit = (estimated * 125n) / 100n;
      } catch (estErr) {
        this.logger.warn(`Gas estimation failed (${(estErr as Error).message}), using fallback ${gasLimit}`);
      }

      const tx = await contractWithSigner.triggerBuyBack({
        gasLimit,
      });

      this.logger.log(`[Treasury] triggerBuyBack transaction submitted: ${tx.hash}. Waiting for confirmation...`);
      const receipt = await tx.wait(1);

      if (!receipt || receipt.status !== 1) {
        throw new Error(`Transaction reverted or failed to confirm: ${tx.hash}`);
      }

      // Parse BuyBackAndBurned event
      let bnbSpentFormatted = bnbBalanceStr;
      let farmBurnedFormatted = '0';

      for (const log of receipt.logs) {
        try {
          const parsed = treasuryContract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (parsed && parsed.name === 'BuyBackAndBurned') {
            bnbSpentFormatted = ethers.formatEther(parsed.args.bnbSpent);
            farmBurnedFormatted = ethers.formatEther(parsed.args.farmBurned);
            break;
          }
        } catch {
          // Skip logs from other contracts in the receipt
        }
      }

      const eventRecord: BuyBackEventRecord = {
        txHash: tx.hash,
        bnbSpent: bnbSpentFormatted,
        farmBurned: farmBurnedFormatted,
        timestamp: Date.now(),
        blockNumber: receipt.blockNumber,
      };

      await this.saveEventToCache(eventRecord);
      await this.pushTelegramProofOfBurn(eventRecord);

      this.logger.log(
        `✅ [Treasury] Auto Buy-back & Burn Successful! Spent: ${bnbSpentFormatted} BNB, Burned: ${farmBurnedFormatted} $FARM. Tx: ${tx.hash}`,
      );

      return { triggered: true, txHash: tx.hash };
    } catch (err: any) {
      this.logger.error(`❌ [Treasury] Buy-back execution error: ${err.message}`, err.stack);
      return { triggered: false, error: err.message };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retrieves current status for UI and API consumption.
   */
  async getStatus(): Promise<TreasuryStatus> {
    const cached = await this.redis.get(REDIS_TREASURY_STATUS_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Fallback to fresh read
      }
    }

    const treasuryAddress =
      this.config.get<string>('web3.treasuryContractAddress') ||
      this.config.get<string>('TREASURY_CONTRACT_ADDRESS') ||
      ethers.ZeroAddress;

    const provider = this.getProvider();
    const balance = await provider.getBalance(treasuryAddress).catch(() => 0n);
    const treasuryContract = new ethers.Contract(treasuryAddress, TREASURY_ABI, provider);

    const farmTokenAddress =
      this.config.get<string>('web3.farmTokenAddress') ||
      this.config.get<string>('FARM_TOKEN_ADDRESS') ||
      '0xB10067A034078E3FC8335Fb003eEF7334C44952f';
    const farmContract = new ethers.Contract(farmTokenAddress, FARM_ABI, provider);

    const [threshold, treasuryBurned, totalBnbSpent, isPaused, deadBalance] = await Promise.all([
      treasuryContract.buyBackThreshold().catch(() => ethers.parseEther('2.0')),
      treasuryContract.totalBurned().catch(() => 0n),
      treasuryContract.totalBnbSpent().catch(() => 0n),
      treasuryContract.paused().catch(() => false),
      farmContract.balanceOf(DEAD_BURN_ADDRESS).catch(() => 0n),
    ]);

    const effectiveTotalBurned = deadBalance > treasuryBurned ? deadBalance : treasuryBurned;

    const bnbBalanceStr = ethers.formatEther(balance);
    const thresholdStr = ethers.formatEther(threshold);
    const progress = threshold > 0n ? Math.min(100, Number((balance * 10000n) / threshold) / 100) : 0;

    const status: TreasuryStatus = {
      contractAddress: treasuryAddress,
      bnbBalance: bnbBalanceStr,
      bnbBalanceWei: balance.toString(),
      buyBackThreshold: thresholdStr,
      buyBackThresholdWei: threshold.toString(),
      progressPercent: progress,
      totalBurned: ethers.formatEther(effectiveTotalBurned),
      totalBnbSpent: ethers.formatEther(totalBnbSpent),
      deadAddress: DEAD_BURN_ADDRESS,
      isReady: balance >= threshold,
      isPaused,
      recentEvents: await this.getRecentEventsFromCache(),
      lastCheckedAt: Date.now(),
    };

    await this.redis.set(REDIS_TREASURY_STATUS_KEY, JSON.stringify(status), 15);
    return status;
  }

  private async getRecentEventsFromCache(): Promise<BuyBackEventRecord[]> {
    try {
      const raw = await this.redis.get(REDIS_BUYBACK_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private async saveEventToCache(event: BuyBackEventRecord): Promise<void> {
    try {
      const history = await this.getRecentEventsFromCache();
      history.unshift(event);
      const capped = history.slice(0, 20); // Keep last 20 events
      await this.redis.set(REDIS_BUYBACK_HISTORY_KEY, JSON.stringify(capped), 86400 * 30);
    } catch (err) {
      this.logger.warn(`Failed to save buyback event to cache: ${(err as Error).message}`);
    }
  }

  /**
   * Broadcasts verifiable Proof of Burn notification to Telegram admin/community.
   */
  private async pushTelegramProofOfBurn(event: BuyBackEventRecord): Promise<void> {
    const botToken = this.config.get<string>('telegram.botToken');
    const adminChatId = this.config.get<string>('ADMIN_TELEGRAM_CHAT_ID');

    if (!botToken || !adminChatId) {
      this.logger.debug('Telegram adminChatId not configured for Proof of Burn broadcast.');
      return;
    }

    const bscScanUrl = `https://testnet.bscscan.com/tx/${event.txHash}`;
    const text = [
      `🔥 <b>[AUTO BUY-BACK & BURN EXECUTED]</b> 🔥`,
      ``,
      `💰 <b>BNB Spent:</b> ${Number(event.bnbSpent).toFixed(4)} BNB`,
      `🔥 <b>$FARM Burned:</b> ${Number(event.farmBurned).toLocaleString()} $FARM`,
      `💀 <b>Destination:</b> <code>0x0000...dEaD</code>`,
      `📜 <b>Proof of Burn:</b> <a href="${bscScanUrl}">View on BscScan</a>`,
      ``,
      `<i>All acquired tokens were permanently destroyed from circulating supply!</i>`,
      `#BanditBuddy #FarmToken #Deflationary #ProofOfBurn`,
    ].join('\n');

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: adminChatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });
      if (!res.ok) {
        this.logger.warn(`Telegram broadcast returned ${res.status}: ${await res.text()}`);
      }
    } catch (e) {
      this.logger.error(`Telegram notification error: ${(e as Error).message}`);
    }
  }
}
