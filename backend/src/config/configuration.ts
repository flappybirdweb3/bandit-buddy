export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10) || 5432,
    name: process.env.DB_NAME || 'barnbuddy',
    user: process.env.DB_USER || 'barnbuddy',
    password: process.env.DB_PASSWORD || 'barnbuddy_secret',
    ssl: process.env.DB_SSL !== 'false' && process.env.NODE_ENV === 'production',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10) || 6379,
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'BanditBuddyBot',
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    appUrl: process.env.APP_URL || 'https://dapp.banditbuddy.xyz',
    // Max age of an accepted initData payload (seconds).
    // Telegram Desktop retains initData for days/weeks if the app/tab is left open.
    // Default to 90 days (7,776,000s) to prevent desktop users from being falsely locked out.
    initDataMaxAgeSec: parseInt(process.env.TELEGRAM_INITDATA_MAX_AGE_SEC ?? '7776000', 10) || 7776000,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: '7d',
  },

  // Chain id drives every chain-specific default below, so resolve it first and derive
  // the RPC endpoint from it. Previously `chainId` and `bscRpcUrl` were resolved
  // INDEPENDENTLY: setting BSC_CHAIN_ID=97 alone still handed out a MAINNET dataseed
  // node, and both Web3Service and MarketplaceService then built a FallbackProvider
  // whose primary spoke mainnet while its fallbacks spoke testnet. With `quorum: 1`
  // ethers accepts whichever endpoint answers first, so reads could silently mix chains.
  web3: (() => {
    const SUPPORTED_CHAIN_IDS = new Set([56, 97]); // 56 = BSC mainnet, 97 = BSC testnet
    const parsedChainId = parseInt(process.env.BSC_CHAIN_ID ?? '56', 10);
    const chainId = SUPPORTED_CHAIN_IDS.has(parsedChainId) ? parsedChainId : 56;

    if (!SUPPORTED_CHAIN_IDS.has(parsedChainId)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[config] BSC_CHAIN_ID="${process.env.BSC_CHAIN_ID}" is neither 56 (mainnet) ` +
          `nor 97 (testnet) — falling back to 56.`,
      );
    }

    const defaultRpcUrl = chainId === 97
      ? 'https://bsc-testnet-rpc.publicnode.com'
      : 'https://bsc-dataseed.binance.org/';

    return {
      signerPrivateKey: process.env.SIGNER_PRIVATE_KEY || '',
      chainId,
      isTestnet: chainId === 97,
      bscRpcUrl: process.env.BSC_RPC_URL || defaultRpcUrl,
      farmTokenAddress: process.env.FARM_TOKEN_ADDRESS || '',
      claimContractAddress: process.env.CLAIM_CONTRACT_ADDRESS || '',
      nftContractAddress: process.env.NFT_CONTRACT_ADDRESS || '',
      marketContractAddress: process.env.MARKET_CONTRACT_ADDRESS || '',
      gachaContractAddress: process.env.GACHA_CONTRACT_ADDRESS || '',
      guildStakingAddress: process.env.GUILD_STAKING_ADDRESS || '',
      treasuryContractAddress: process.env.TREASURY_CONTRACT_ADDRESS || '',
      depositTreasuryAddress: process.env.DEPOSIT_TREASURY_ADDRESS || '',
      bscWssUrl: process.env.BSC_WSS_URL || '',
      // Hard per-request timeout (ms) applied to EVERY JSON-RPC fetch. Left at the
      // ethers default an unreachable node makes JsonRpcProvider retry "detect
      // network" forever, so the HTTP request never settles and the reverse proxy
      // answers 504. Override with BSC_RPC_TIMEOUT_MS.
      rpcTimeoutMs: parseInt(process.env.BSC_RPC_TIMEOUT_MS ?? '5000', 10) || 5000,
      // Absolute ceiling for app-level await of any single chain call, independent of
      // how many fallback endpoints ethers decides to try. Override with
      // BSC_RPC_DEADLINE_MS.
      rpcRequestDeadlineMs: parseInt(process.env.BSC_RPC_DEADLINE_MS ?? '8000', 10) || 8000,
      // Cooldown (seconds) before allowing GOLD refund on a pending claim intent.
      // Protects against racing against pending mempool transactions.
      claimRefundCooldownSec: parseInt(process.env.CLAIM_REFUND_COOLDOWN_SEC ?? '600', 10) || 600,
    };
  })(),

  admin: {
    passcode: process.env.ADMIN_PASSCODE || '',
  },

  seasonal: {
    // Override via env: SEASONAL_EVENT=halloween|christmas|lunar|none
    event: process.env.SEASONAL_EVENT || 'none',
  },

  game: {
    minTrustScore: parseInt(process.env.MIN_TRUST_SCORE ?? '30', 10) || 30,
    initialPlots: 6,
    initialEnergy: 100,
    // Starting GOLD for a brand-new account. users.gold_balance defaults to 0 in the
    // schema, so THIS value is what actually funds a first-time player — without it they
    // cannot afford the cheapest seed (120G) and the farm loop dead-ends immediately.
    // Parsed without `|| 250` on purpose: STARTING_GOLD=0 is a legitimate config and must
    // not be silently replaced by the fallback.
    startingGold: (() => {
      const parsed = Number(process.env.STARTING_GOLD ?? 250);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : 250;
    })(),
    maxEnergy: 100,
    energyRegenPerHour: 15,    // 15/h → full in ~6.7h (was 10/h = 10h)
    stealEnergyCost: 10,
    dogBiteEnergyCost: 20,
    maxStealPercent: 0.20,
    stealPerActionPercent: 0.05,
    dogBitePenaltyPercent: 0.05,
    baseStealSuccessRate: 75,  // slightly harder (was 80)
  },
});
