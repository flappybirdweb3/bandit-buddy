import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-gas-reporter';
import * as dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const SIGNER_PK = process.env.SIGNER_PRIVATE_KEY ?? '';
const BSCSCAN_KEY = process.env.BSCSCAN_API_KEY ?? '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      viaIR: false,
    },
  },

  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    bscTestnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      chainId: 97,
      accounts: SIGNER_PK ? [SIGNER_PK] : [],
      gasPrice: 10_000_000_000, // 10 gwei
      timeout: 60_000,
    },
    bscMainnet: {
      url: 'https://bsc-dataseed.binance.org/',
      chainId: 56,
      accounts: SIGNER_PK ? [SIGNER_PK] : [],
      gasPrice: 3_000_000_000, // 3 gwei
      timeout: 60_000,
    },
  },

  etherscan: {
    // Single string = Etherscan v2 unified key (works for all chains via chainId param)
    apiKey: BSCSCAN_KEY,
    customChains: [
      {
        network: 'bscTestnet',
        chainId: 97,
        urls: {
          apiURL: 'https://api-testnet.bscscan.com/api',
          browserURL: 'https://testnet.bscscan.com',
        },
      },
    ],
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    token: 'BNB',
    gasPriceApi: 'https://api.bscscan.com/api?module=proxy&action=eth_gasPrice',
    outputFile: 'gas-report.txt',
    noColors: true,
  },

  paths: {
    sources: './src',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },

  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v6',
  },
};

export default config;
