export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10) || 5432,
    name: process.env.DB_NAME || 'barnbuddy',
    user: process.env.DB_USER || 'barnbuddy',
    password: process.env.DB_PASSWORD || 'barnbuddy_secret',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10) || 6379,
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: '7d',
  },

  web3: {
    signerPrivateKey: process.env.SIGNER_PRIVATE_KEY || '',
    bscRpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
    farmTokenAddress: process.env.FARM_TOKEN_ADDRESS || '',
    claimContractAddress: process.env.CLAIM_CONTRACT_ADDRESS || '',
    nftContractAddress: process.env.NFT_CONTRACT_ADDRESS || '',
  },

  game: {
    minTrustScore: parseInt(process.env.MIN_TRUST_SCORE ?? '30', 10) || 30,
    initialPlots: 6,
    initialEnergy: 100,
    maxEnergy: 100,
    energyRegenPerHour: 10,
    stealEnergyCost: 10,
    dogBiteEnergyCost: 20,
    maxStealPercent: 0.20,
    stealPerActionPercent: 0.05,
    dogBitePenaltyPercent: 0.05,
    baseStealSuccessRate: 80,
  },
});
