export const BSC_TESTNET_CHAIN_ID = 97;
export const BSC_MAINNET_CHAIN_ID = 56;

export const ACTIVE_CHAIN_ID = BSC_TESTNET_CHAIN_ID;

export const CONTRACTS = {
  [BSC_TESTNET_CHAIN_ID]: {
    farmTokenSale: '0x846c237453AD0005D6Ee927Eb623365C298de9b9',
    farmVesting:   '0x4e48a7d01A010A72466E5AF67ce62430372708E2',
    farmToken:     '0xB10067A034078E3FC8335Fb003eEF7334C44952f',
    usdt:          '0x337610d27C682e347c9cD60bD4b3B107c9D34dD9',
  },
} as const;

export const FARM_TOKEN_SALE_ABI = [
  'function rounds(uint8 roundId) view returns (uint256 priceWei, uint256 totalAllocation, uint256 sold, uint64 startTime, uint64 endTime, bool requiresWhitelist, uint256 tgeBps, uint32 cliffDays, uint32 vestingDays, uint256 minUsdtAmount, uint256 maxUsdtPerWallet)',
  'function buy(uint8 roundId, uint256 usdtAmount) returns (uint256 farmAmount, uint256 vestingIndex)',
  'function remaining(uint8 roundId) view returns (uint256)',
  'function farmForUsdt(uint8 roundId, uint256 usdtAmount) view returns (uint256)',
  'function canBuy(uint8 roundId, address account) view returns (bool ok, string memory reason)',
  'function spent(uint8 roundId, address account) view returns (uint256)',
  'function paused() view returns (bool)',
] as const;

export const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
] as const;

export const BSC_TESTNET_RPC = 'https://bsc-testnet-rpc.publicnode.com';
