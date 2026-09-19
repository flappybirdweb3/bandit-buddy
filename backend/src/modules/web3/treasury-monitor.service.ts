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
  'function totalUsdtConverted() external view returns (uint256)',
  'function usdtConversionThreshold() external view returns (uint256)',
  'function DEAD_ADDRESS() external view returns (address)',
  'function triggerBuyBack() external',
  'function executeBuyBack(uint256 bnbAmount, uint256 minFarmOut) external',
  'function convertUSDTtoBNB(uint256 minBnbOut) external',
  'function paused() external view returns (bool)',
  'event BuyBackAndBurned(uint256 indexed bnbSpent, uint256 indexed farmBurned)',
  'event USDTConvertedToBNB(uint256 usdtIn, uint256 bnbOut)',
  'event FundsReceived(address indexed from, uint256 amount)',
];

const ERC20_ABI = [
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
];

// FarmToken.sol: uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18
const FARM_MAX_SUPPLY = 1_000_000_000n * 10n ** 18n;

const PANCAKE_ROUTER_ABI = [
  'function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts)',
];

const DEAD_BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

export interface BuyBackEventRecord {
  txHash: string;
  bnbSpent: string;
  farmBurned: string;
  timestamp: number;
  blockNumber: number;
}

export interface UsdtConversionEventRecord {
  txHash: string;
  usdtIn: string;
  bnbOut: string;
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
  // USDT conversion status (SA IMPL-02)
  usdtBalance: string;
  usdtBalanceWei: string;
  usdtConversionThreshold: string;
  usdtConversionThresholdWei: string;
  usdtConversionProgressPercent: number;
  totalUsdtConverted: string;
  isUsdtReady: boolean;
  recentEvents: BuyBackEventRecord[];
  lastCheckedAt: number;
  // Off-chain GOLD burned via claim conversion (all time, from gold_transactions)
  totalGoldConverted?: string;
}

const REDIS_TREASURY_STATUS_KEY = 'treasury:buyback:status';
const REDIS_BUYBACK_HISTORY_KEY = 'treasury:buyback:history';
const REDIS_USDT_CONVERSION_HISTORY_KEY = 'treasury:usdt:history';

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
   * Step 1: Check BNB balance → trigger Buy-back & Burn if >= buyBackThreshold.
   * Step 2: Check USDT balance → convert to BNB if >= usdtConversionThreshold (SA IMPL-02).
   */
  @Cron('*/1 * * * *')
  async handleCron(): Promise<void> {
    await this.checkAndExecuteBuyBack();
  }

  async checkAndExecuteBuyBack(): Promise<{ triggered: boolean; txHash?: string; error?: string }> {
    if (this.isProcessing) {
      this.logger.debug('Treasury task already in progress. Skipping cycle.');
      return { triggered: false, error: 'Task already in progress' };
    }

    const treasuryAddress =
      this.config.get<string>('web3.treasuryContractAddress') ||
      this.config.get<string>('TREASURY_CONTRACT_ADDRESS') ||
      '0xe59FfB05EdF59464e8803E81A4d790d828915006';

    if (!treasuryAddress || treasuryAddress === ethers.ZeroAddress) {
      this.logger.warn('TREASURY_CONTRACT_ADDRESS is not configured. Treasury monitor inactive.');
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

      const usdtAddress =
        this.config.get<string>('web3.usdtTokenAddress') ||
        this.config.get<string>('USDT_TOKEN_ADDRESS') ||
        '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd'; // BSC Testnet USDT

      const pancakeRouterAddress =
        this.config.get<string>('web3.pancakeRouterAddress') ||
        this.config.get<string>('PANCAKE_ROUTER_ADDRESS') ||
        '0xD99D1c33F9fC3444f8101754aBC46c52416550d1'; // BSC Testnet PancakeSwap V2 Router

      const farmContract = new ethers.Contract(farmTokenAddress, ERC20_ABI, provider);
      const usdtContract = new ethers.Contract(usdtAddress, ERC20_ABI, provider);

      // Fetch all onchain state in parallel
      const [
        bnbBalance,
        buyBackThreshold,
        isPaused,
        totalBnbSpent,
        deadBalance,
        farmTotalSupply,
        usdtBalance,
        usdtThreshold,
        totalUsdtConverted,
      ] = await Promise.all([
        provider.getBalance(treasuryAddress),
        treasuryContract.buyBackThreshold().catch(() => ethers.parseEther('2.0')),
        treasuryContract.paused().catch(() => false),
        treasuryContract.totalBnbSpent().catch(() => 0n),
        farmContract.balanceOf(DEAD_BURN_ADDRESS).catch(() => 0n),
        farmContract.totalSupply().catch(() => FARM_MAX_SUPPLY),
        usdtContract.balanceOf(treasuryAddress).catch(() => 0n),
        treasuryContract.usdtConversionThreshold().catch(() => ethers.parseUnits('50', 18)),
        treasuryContract.totalUsdtConverted().catch(() => 0n),
      ]);

      // erc20Burned: tokens destroyed via ERC20 burn() (BanditDogFusion gacha/fusion/tokenize,
      // any burnFrom path) — reduces totalSupply, NOT sent to DEAD_ADDRESS.
      // deadBalance: tokens sent to 0x...dEaD (buyback, routeTokenTransfer FARM fee, burnHeldFarm).
      // Both sources are non-overlapping — sum gives true total deflationary pressure.
      const erc20Burned = FARM_MAX_SUPPLY > farmTotalSupply ? FARM_MAX_SUPPLY - farmTotalSupply : 0n;
      const effectiveTotalBurned = erc20Burned + deadBalance;

      const bnbBalanceStr = ethers.formatEther(bnbBalance);
      const thresholdStr = ethers.formatEther(buyBackThreshold);
      const bnbProgress = buyBackThreshold > 0n
        ? Math.min(100, Number((bnbBalance * 10000n) / buyBackThreshold) / 100)
        : 0;

      const usdtBalanceStr = ethers.formatUnits(usdtBalance, 18);
      const usdtThresholdStr = ethers.formatUnits(usdtThreshold, 18);
      const usdtProgress = usdtThreshold > 0n
        ? Math.min(100, Number((usdtBalance * 10000n) / usdtThreshold) / 100)
        : 0;

      // Cache current status in Redis
      const status: TreasuryStatus = {
        contractAddress: treasuryAddress,
        bnbBalance: bnbBalanceStr,
        bnbBalanceWei: bnbBalance.toString(),
        buyBackThreshold: thresholdStr,
        buyBackThresholdWei: buyBackThreshold.toString(),
        progressPercent: bnbProgress,
        totalBurned: ethers.formatEther(effectiveTotalBurned),
        totalBnbSpent: ethers.formatEther(totalBnbSpent),
        deadAddress: DEAD_BURN_ADDRESS,
        isReady: bnbBalance >= buyBackThreshold,
        isPaused,
        usdtBalance: usdtBalanceStr,
        usdtBalanceWei: usdtBalance.toString(),
        usdtConversionThreshold: usdtThresholdStr,
        usdtConversionThresholdWei: usdtThreshold.toString(),
        usdtConversionProgressPercent: usdtProgress,
        totalUsdtConverted: ethers.formatUnits(totalUsdtConverted, 18),
        isUsdtReady: usdtBalance >= usdtThreshold,
        recentEvents: await this.getRecentBuyBackEventsFromCache(),
        lastCheckedAt: Date.now(),
      };
      await this.redis.set(REDIS_TREASURY_STATUS_KEY, JSON.stringify(status), 15);

      this.logger.log(
        `[Treasury] BNB: ${bnbBalanceStr}/${thresholdStr} (${bnbProgress.toFixed(1)}%) | USDT: ${usdtBalanceStr}/${usdtThresholdStr} (${usdtProgress.toFixed(1)}%)`,
      );

      if (isPaused) {
        this.logger.warn('[Treasury] Contract is paused. Skipping all executions.');
        return { triggered: false, error: 'Contract is paused' };
      }

      const signerPrivateKey =
        this.config.get<string>('web3.signerPrivateKey') ||
        this.config.get<string>('SIGNER_PRIVATE_KEY');

      if (!signerPrivateKey) {
        this.logger.error('Missing SIGNER_PRIVATE_KEY. Cannot trigger on-chain actions.');
        return { triggered: false, error: 'Missing SIGNER_PRIVATE_KEY' };
      }

      const wallet = new ethers.Wallet(signerPrivateKey, provider);
      const contractWithSigner = treasuryContract.connect(wallet) as ethers.Contract;

      // ── Step 1: BNB Buyback & Burn ───────────────────────────────────────────
      if (bnbBalance >= buyBackThreshold) {
        this.logger.log(`[Treasury] BNB threshold reached (${bnbBalanceStr} BNB). Triggering buyback...`);
        const result = await this._executeBuyBack(contractWithSigner, treasuryContract, bnbBalanceStr);
        if (result.triggered) return result;
      } else {
        this.logger.debug(`[Treasury] BNB threshold not met. Standing by.`);
      }

      // ── Step 2: USDT → BNB Batch Conversion (SA IMPL-02 / ADR-04) ───────────
      if (usdtBalance >= usdtThreshold) {
        this.logger.log(`[Treasury] USDT threshold reached ($${usdtBalanceStr}). Converting to BNB...`);
        await this._convertUSDTtoBNB(
          contractWithSigner,
          treasuryContract,
          pancakeRouterAddress,
          provider,
          usdtAddress,
          usdtBalance,
        );
      } else {
        this.logger.debug(`[Treasury] USDT threshold not met. Standing by.`);
      }

      return { triggered: false };
    } catch (err: any) {
      this.logger.error(`[Treasury] Cycle error: ${err.message}`, err.stack);
      return { triggered: false, error: err.message };
    } finally {
      this.isProcessing = false;
    }
  }

  private async _executeBuyBack(
    contractWithSigner: ethers.Contract,
    readContract: ethers.Contract,
    bnbBalanceStr: string,
  ): Promise<{ triggered: boolean; txHash?: string }> {
    let gasLimit = 600_000n;
    try {
      const estimated = await contractWithSigner.triggerBuyBack.estimateGas();
      gasLimit = (estimated * 125n) / 100n;
    } catch (estErr) {
      this.logger.warn(`Gas estimation failed (${(estErr as Error).message}), using fallback ${gasLimit}`);
    }

    const tx = await contractWithSigner.triggerBuyBack({ gasLimit });
    this.logger.log(`[Treasury] triggerBuyBack submitted: ${tx.hash}. Awaiting confirmation...`);
    const receipt = await tx.wait(1);

    if (!receipt || receipt.status !== 1) {
      throw new Error(`BuyBack transaction reverted: ${tx.hash}`);
    }

    let bnbSpentFormatted = bnbBalanceStr;
    let farmBurnedFormatted = '0';

    for (const log of receipt.logs) {
      try {
        const parsed = readContract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed?.name === 'BuyBackAndBurned') {
          bnbSpentFormatted = ethers.formatEther(parsed.args.bnbSpent);
          farmBurnedFormatted = ethers.formatEther(parsed.args.farmBurned);
          break;
        }
      } catch { /* skip logs from other contracts */ }
    }

    const eventRecord: BuyBackEventRecord = {
      txHash: tx.hash,
      bnbSpent: bnbSpentFormatted,
      farmBurned: farmBurnedFormatted,
      timestamp: Date.now(),
      blockNumber: receipt.blockNumber,
    };

    await this.saveBuyBackEventToCache(eventRecord);
    await this.pushTelegramProofOfBurn(eventRecord);

    this.logger.log(
      `[Treasury] BuyBack success! Spent: ${bnbSpentFormatted} BNB, Burned: ${farmBurnedFormatted} $FARM. Tx: ${tx.hash}`,
    );

    return { triggered: true, txHash: tx.hash };
  }

  private async _convertUSDTtoBNB(
    contractWithSigner: ethers.Contract,
    readContract: ethers.Contract,
    pancakeRouterAddress: string,
    provider: ethers.JsonRpcProvider,
    usdtAddress: string,
    usdtBalance: bigint,
  ): Promise<void> {
    // Compute minBnbOut = getAmountsOut([USDT, WBNB]) × 98% (sandwich attack protection per SA ADR-03)
    const pancakeRouter = new ethers.Contract(pancakeRouterAddress, PANCAKE_ROUTER_ABI, provider);

    // BSC Mainnet: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
    // BSC Testnet: 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd
    const wbnbAddress =
      this.config.get<string>('web3.wbnbAddress') ||
      this.config.get<string>('WBNB_ADDRESS') ||
      '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

    let minBnbOut = 0n;
    try {
      const amounts = await pancakeRouter.getAmountsOut(usdtBalance, [usdtAddress, wbnbAddress]);
      minBnbOut = (amounts[1] * 98n) / 100n; // 2% slippage tolerance
      this.logger.debug(`[Treasury] USDT→BNB quote: ${ethers.formatUnits(usdtBalance, 18)} USDT → ${ethers.formatEther(amounts[1])} BNB (min: ${ethers.formatEther(minBnbOut)})`);
    } catch (quoteErr) {
      this.logger.warn(`[Treasury] PancakeSwap quote failed (${(quoteErr as Error).message}). Skipping USDT conversion.`);
      return;
    }

    let gasLimit = 300_000n;
    try {
      const estimated = await contractWithSigner.convertUSDTtoBNB.estimateGas(minBnbOut);
      gasLimit = (estimated * 125n) / 100n;
    } catch (estErr) {
      this.logger.warn(`[Treasury] USDT conversion gas estimate failed: ${(estErr as Error).message}`);
    }

    const tx = await contractWithSigner.convertUSDTtoBNB(minBnbOut, { gasLimit });
    this.logger.log(`[Treasury] convertUSDTtoBNB submitted: ${tx.hash}. Awaiting confirmation...`);
    const receipt = await tx.wait(1);

    if (!receipt || receipt.status !== 1) {
      throw new Error(`USDT conversion transaction reverted: ${tx.hash}`);
    }

    let usdtIn = '0';
    let bnbOut = '0';
    for (const log of receipt.logs) {
      try {
        const parsed = readContract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (parsed?.name === 'USDTConvertedToBNB') {
          usdtIn = ethers.formatUnits(parsed.args.usdtIn, 18);
          bnbOut = ethers.formatEther(parsed.args.bnbOut);
          break;
        }
      } catch { /* skip logs from other contracts */ }
    }

    const conversionRecord: UsdtConversionEventRecord = {
      txHash: tx.hash,
      usdtIn,
      bnbOut,
      timestamp: Date.now(),
      blockNumber: receipt.blockNumber,
    };
    await this.saveUsdtConversionEventToCache(conversionRecord);

    this.logger.log(
      `[Treasury] USDT→BNB conversion success! $${usdtIn} USDT → ${bnbOut} BNB. Tx: ${tx.hash}`,
    );
  }

  async getStatus(): Promise<TreasuryStatus> {
    const cached = await this.redis.get(REDIS_TREASURY_STATUS_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch { /* fall through to fresh read */ }
    }

    const treasuryAddress =
      this.config.get<string>('web3.treasuryContractAddress') ||
      this.config.get<string>('TREASURY_CONTRACT_ADDRESS') ||
      ethers.ZeroAddress;

    const farmTokenAddress =
      this.config.get<string>('web3.farmTokenAddress') ||
      this.config.get<string>('FARM_TOKEN_ADDRESS') ||
      '0xB10067A034078E3FC8335Fb003eEF7334C44952f';

    const usdtAddress =
      this.config.get<string>('web3.usdtTokenAddress') ||
      this.config.get<string>('USDT_TOKEN_ADDRESS') ||
      '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd';

    const provider = this.getProvider();
    const treasuryContract = new ethers.Contract(treasuryAddress, TREASURY_ABI, provider);
    const farmContract = new ethers.Contract(farmTokenAddress, ERC20_ABI, provider);
    const usdtContract = new ethers.Contract(usdtAddress, ERC20_ABI, provider);

    const [
      balance,
      threshold,
      totalBnbSpent,
      isPaused,
      deadBalance,
      farmTotalSupply,
      usdtBalance,
      usdtThreshold,
      totalUsdtConverted,
    ] = await Promise.all([
      provider.getBalance(treasuryAddress),
      treasuryContract.buyBackThreshold().catch(() => ethers.parseEther('2.0')),
      treasuryContract.totalBnbSpent().catch(() => 0n),
      treasuryContract.paused().catch(() => false),
      farmContract.balanceOf(DEAD_BURN_ADDRESS).catch(() => 0n),
      farmContract.totalSupply().catch(() => FARM_MAX_SUPPLY),
      usdtContract.balanceOf(treasuryAddress).catch(() => 0n),
      treasuryContract.usdtConversionThreshold().catch(() => ethers.parseUnits('50', 18)),
      treasuryContract.totalUsdtConverted().catch(() => 0n),
    ]);

    const erc20Burned = FARM_MAX_SUPPLY > farmTotalSupply ? FARM_MAX_SUPPLY - farmTotalSupply : 0n;
    const effectiveTotalBurned = erc20Burned + deadBalance;
    const progress = threshold > 0n ? Math.min(100, Number((balance * 10000n) / threshold) / 100) : 0;
    const usdtProgress = usdtThreshold > 0n
      ? Math.min(100, Number((usdtBalance * 10000n) / usdtThreshold) / 100)
      : 0;

    const status: TreasuryStatus = {
      contractAddress: treasuryAddress,
      bnbBalance: ethers.formatEther(balance),
      bnbBalanceWei: balance.toString(),
      buyBackThreshold: ethers.formatEther(threshold),
      buyBackThresholdWei: threshold.toString(),
      progressPercent: progress,
      totalBurned: ethers.formatEther(effectiveTotalBurned),
      totalBnbSpent: ethers.formatEther(totalBnbSpent),
      deadAddress: DEAD_BURN_ADDRESS,
      isReady: balance >= threshold,
      isPaused,
      usdtBalance: ethers.formatUnits(usdtBalance, 18),
      usdtBalanceWei: usdtBalance.toString(),
      usdtConversionThreshold: ethers.formatUnits(usdtThreshold, 18),
      usdtConversionThresholdWei: usdtThreshold.toString(),
      usdtConversionProgressPercent: usdtProgress,
      totalUsdtConverted: ethers.formatUnits(totalUsdtConverted, 18),
      isUsdtReady: usdtBalance >= usdtThreshold,
      recentEvents: await this.getRecentBuyBackEventsFromCache(),
      lastCheckedAt: Date.now(),
    };

    await this.redis.set(REDIS_TREASURY_STATUS_KEY, JSON.stringify(status), 15);
    return status;
  }

  private async getRecentBuyBackEventsFromCache(): Promise<BuyBackEventRecord[]> {
    try {
      const raw = await this.redis.get(REDIS_BUYBACK_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private async saveBuyBackEventToCache(event: BuyBackEventRecord): Promise<void> {
    try {
      const history = await this.getRecentBuyBackEventsFromCache();
      history.unshift(event);
      await this.redis.set(REDIS_BUYBACK_HISTORY_KEY, JSON.stringify(history.slice(0, 20)), 86400 * 30);
    } catch (err) {
      this.logger.warn(`Failed to save buyback event: ${(err as Error).message}`);
    }
  }

  private async saveUsdtConversionEventToCache(event: UsdtConversionEventRecord): Promise<void> {
    try {
      const raw = await this.redis.get(REDIS_USDT_CONVERSION_HISTORY_KEY);
      const history: UsdtConversionEventRecord[] = raw ? JSON.parse(raw) : [];
      history.unshift(event);
      await this.redis.set(REDIS_USDT_CONVERSION_HISTORY_KEY, JSON.stringify(history.slice(0, 20)), 86400 * 30);
    } catch (err) {
      this.logger.warn(`Failed to save USDT conversion event: ${(err as Error).message}`);
    }
  }

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
