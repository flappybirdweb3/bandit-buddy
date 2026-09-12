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

  web3: {
    signerPrivateKey: process.env.SIGNER_PRIVATE_KEY || '',
    bscRpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
    chainId: parseInt(process.env.BSC_CHAIN_ID || '56', 10),
    farmTokenAddress: process.env.FARM_TOKEN_ADDRESS || '',
    claimContractAddress: process.env.CLAIM_CONTRACT_ADDRESS || '',
    nftContractAddress: process.env.NFT_CONTRACT_ADDRESS || '',
    marketContractAddress: process.env.MARKET_CONTRACT_ADDRESS || '',
    gachaContractAddress: process.env.GACHA_CONTRACT_ADDRESS || '',
    guildStakingAddress: process.env.GUILD_STAKING_ADDRESS || '',
    treasuryContractAddress: process.env.TREASURY_CONTRACT_ADDRESS || '',
    depositTreasuryAddress: process.env.DEPOSIT_TREASURY_ADDRESS || '',
    bscWssUrl: process.env.BSC_WSS_URL || '',
  },

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
