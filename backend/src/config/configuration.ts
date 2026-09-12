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
    appUrl: process.env.APP_URL || 'https://flappyx.com',
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
