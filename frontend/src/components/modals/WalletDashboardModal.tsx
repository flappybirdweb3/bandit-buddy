import { useState, useMemo } from 'react';
import {
  X, Copy, Check, Eye, EyeOff, Send, ArrowDownLeft, History, ShieldCheck,
  Settings, ExternalLink, RefreshCw, ChevronRight, AlertTriangle, Sparkles,
  Shield, Wallet, ArrowUpRight, ArrowLeftRight
} from 'lucide-react';
import { useMPCWallet } from '@/hooks/useMPCWallet';
import { soundManager } from '@/sounds/SoundManager';
import { eventBus } from '@/game/EventBus';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/client';
import WebApp from '@twa-dev/sdk';

// Sub-modals
import { SendModal } from '@/components/modals/wallet/SendModal';
import { ReceiveModal } from '@/components/modals/wallet/ReceiveModal';
import { WalletHistoryModal } from '@/components/modals/wallet/WalletHistoryModal';
import { WalletApprovalsModal } from '@/components/modals/wallet/WalletApprovalsModal';
import { WalletSettingsModal } from '@/components/modals/wallet/WalletSettingsModal';

const NFT_BREED_INFO: Record<string, { emoji: string; rarity: string; color: string }> = {
  Shiba:       { emoji: '🐕', rarity: 'Common',    color: 'text-zinc-400' },
  Corgi:       { emoji: '🦊', rarity: 'Uncommon',  color: 'text-green-400' },
  Bulldog:     { emoji: '🐶', rarity: 'Rare',      color: 'text-blue-400' },
  Husky:       { emoji: '🐺', rarity: 'Epic',      color: 'text-purple-400' },
  Doberman:    { emoji: '🐾', rarity: 'Legendary', color: 'text-amber-400' },
  Pitbull:     { emoji: '💀', rarity: 'Mythic',    color: 'text-red-400' },
};

interface WalletDashboardModalProps {
  onClose: () => void;
  initialTab?: 'tokens' | 'nfts' | 'defi';
}

export function WalletDashboardModal({ onClose, initialTab = 'tokens' }: WalletDashboardModalProps) {
  const {
    address,
    shortAddress,
    bnbBalance,
    farmBalance,
    bnbFormatted,
    farmFormatted,
    bnbPriceUsd,
    farmPriceUsd,
    usdtPriceUsd,
    bnbValueUsd,
    farmValueUsd,
    usdtValueUsd,
    totalAssetsUsd,
    priceChanges24h,
    usdtFormatted,
    formatFiat,
    currency,
    isBackedUp,
    walletLocked,
    approvals,
    refreshBalances,
    isLoadingBalances,
  } = useMPCWallet();

  const [activeTab, setActiveTab] = useState<'tokens' | 'nfts' | 'defi'>(initialTab);
  const [activeSubmodal, setActiveSubmodal] = useState<'send' | 'receive' | 'history' | 'approvals' | 'settings' | null>(null);
  const [sendDefaultToken, setSendDefaultToken] = useState<'BNB' | 'FARM' | 'USDT'>('BNB');
  const [copied, setCopied] = useState(false);
  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    return localStorage.getItem('bb_wallet_hud_hide_balance') === '1';
  });

  // Fetch NFT status for NFTs tab
  const { data: nftStatus, isLoading: isLoadingNfts } = useQuery({
    queryKey: ['nftStatus'],
    queryFn: api.getNftStatus,
    staleTime: 30_000,
  });

  const handleCopyAddress = () => {
    if (!address) return;
    soundManager.play('click');
    try {
      (WebApp as any)?.HapticFeedback?.notificationOccurred?.('success');
    } catch {}
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleHideBalance = () => {
    soundManager.play('click');
    try {
      (WebApp as any)?.HapticFeedback?.selectionChanged?.();
    } catch {}
    const next = !hideBalance;
    setHideBalance(next);
    localStorage.setItem('bb_wallet_hud_hide_balance', next ? '1' : '0');
  };

  const openSend = (token: 'BNB' | 'FARM' | 'USDT' = 'BNB') => {
    soundManager.play('click');
    setSendDefaultToken(token);
    setActiveSubmodal('send');
  };

  return (
    <>
      <div className="fixed inset-0 z-[210] flex items-center justify-center px-3 sm:px-4">
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={onClose} />

        <div className="relative w-full max-w-sm glass rounded-3xl p-5 border border-white/10 shadow-2xl slide-up text-white flex flex-col max-h-[90vh]">
          {/* Top Bar: Address pill, Settings, and Close */}
          <div className="w-full flex items-center justify-between mb-4 flex-shrink-0">
            {/* Truncated Address with Copy */}
            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-white/10 hover:border-amber-400/40 active:scale-95 transition-all text-xs font-mono group"
              title="Click to copy address"
            >
              <span className={`w-2 h-2 rounded-full animate-pulse ${walletLocked ? 'bg-red-400' : 'bg-emerald-400'}`} />
              <span className="text-white/80 group-hover:text-white font-semibold">{shortAddress}</span>
              {copied ? (
                <Check size={12} className="text-emerald-400" />
              ) : (
                <Copy size={12} className="text-white/40 group-hover:text-amber-300" />
              )}
            </button>

            {/* Header Right Actions: Refresh, Settings, Close */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  soundManager.play('click');
                  refreshBalances();
                }}
                className="glass rounded-full p-2 text-white/50 hover:text-white active:scale-90 transition-all"
                title="Refresh Balances"
              >
                <RefreshCw size={15} className={isLoadingBalances ? 'animate-spin text-amber-300' : ''} />
              </button>

              <button
                onClick={() => {
                  soundManager.play('click');
                  setActiveSubmodal('settings');
                }}
                className="glass rounded-full p-2 text-white/50 hover:text-white active:scale-90 transition-all relative"
                title="Wallet Settings & Backup"
              >
                <Settings size={15} />
                {!isBackedUp && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>

              <button
                onClick={onClose}
                className="glass rounded-full p-2 text-white/50 hover:text-white active:scale-90 transition-all"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Wallet Locked Banner — wrong key on device, signing disabled */}
          {walletLocked && (
            <div
              onClick={() => {
                soundManager.play('click');
                setActiveSubmodal('settings');
              }}
              className="mb-3.5 p-2.5 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-between cursor-pointer hover:bg-red-500/20 active:scale-98 transition-all flex-shrink-0"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-400 flex-shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-black text-red-300 leading-tight">
                    Wallet Locked — Transactions Disabled
                  </span>
                  <span className="text-[10px] text-white/60 leading-tight">
                    Wrong or missing key on this device — tap to fix
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className="text-red-300 flex-shrink-0" />
            </div>
          )}

          {/* Backup Alert Banner (if unbacked and not locked) */}
          {!isBackedUp && !walletLocked && (
            <div
              onClick={() => {
                soundManager.play('click');
                setActiveSubmodal('settings');
              }}
              className="mb-3.5 p-2.5 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-between cursor-pointer hover:bg-amber-500/20 active:scale-98 transition-all flex-shrink-0"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-black text-amber-300 leading-tight">
                    Keyless Backup Recommended
                  </span>
                  <span className="text-[10px] text-white/60 leading-tight">
                    Protect your wallet against device loss
                  </span>
                </div>
              </div>
              <ChevronRight size={14} className="text-amber-300 flex-shrink-0" />
            </div>
          )}

          {/* Total Assets Overview */}
          <div className="glass rounded-2xl p-4 border border-white/10 mb-4 text-center flex flex-col items-center flex-shrink-0 relative overflow-hidden">
            <div className="flex items-center gap-1.5 text-white/50 text-xs font-medium mb-1">
              <span>Total Assets</span>
              <button
                onClick={toggleHideBalance}
                className="hover:text-white transition-colors"
                title={hideBalance ? 'Show balance' : 'Hide balance'}
              >
                {hideBalance ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <span className="px-1.5 py-0.2 rounded bg-white/10 text-[9px] font-mono font-bold text-amber-300">
                {currency}
              </span>
            </div>

            <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight my-0.5">
              {hideBalance ? '••••••••' : formatFiat(totalAssetsUsd)}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-white/40 font-mono mt-1">
              <span>BNB Smart Chain (BEP-20)</span>
              <span>•</span>
              <span className="text-emerald-400 font-bold">Live Oracle</span>
            </div>
          </div>

          {/* Quick Actions Row (5 Action Buttons: Send, Receive, Swap, History, Approvals) */}
          <div className="grid grid-cols-5 gap-1.5 mb-4 flex-shrink-0">
            {/* Send */}
            <button
              onClick={() => openSend('BNB')}
              className="flex flex-col items-center gap-1.5 group active:scale-95 transition-all"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl glass border border-white/15 group-hover:border-amber-400/50 group-hover:bg-amber-400/10 flex items-center justify-center text-amber-300 transition-colors shadow-md">
                <Send size={17} />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-white/80 group-hover:text-white">Send</span>
            </button>

            {/* Receive */}
            <button
              onClick={() => {
                soundManager.play('click');
                setActiveSubmodal('receive');
              }}
              className="flex flex-col items-center gap-1.5 group active:scale-95 transition-all"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl glass border border-white/15 group-hover:border-emerald-400/50 group-hover:bg-emerald-400/10 flex items-center justify-center text-emerald-400 transition-colors shadow-md">
                <ArrowDownLeft size={17} />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-white/80 group-hover:text-white">Receive</span>
            </button>

            {/* Swap */}
            <button
              onClick={() => {
                soundManager.play('click');
                onClose();
                eventBus.emit('show-claim', { tab: 'dex' });
              }}
              className="flex flex-col items-center gap-1.5 group active:scale-95 transition-all"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl glass border border-white/15 group-hover:border-teal-400/50 group-hover:bg-teal-400/10 flex items-center justify-center text-teal-300 transition-colors shadow-md">
                <ArrowLeftRight size={17} />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-white/80 group-hover:text-white">Swap</span>
            </button>

            {/* History */}
            <button
              onClick={() => {
                soundManager.play('click');
                setActiveSubmodal('history');
              }}
              className="flex flex-col items-center gap-1.5 group active:scale-95 transition-all"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl glass border border-white/15 group-hover:border-blue-400/50 group-hover:bg-blue-400/10 flex items-center justify-center text-blue-300 transition-colors shadow-md">
                <History size={17} />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-white/80 group-hover:text-white">History</span>
            </button>

            {/* Approvals */}
            <button
              onClick={() => {
                soundManager.play('click');
                setActiveSubmodal('approvals');
              }}
              className="flex flex-col items-center gap-1.5 group active:scale-95 transition-all relative"
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl glass border border-white/15 group-hover:border-purple-400/50 group-hover:bg-purple-400/10 flex items-center justify-center text-purple-300 transition-colors shadow-md">
                <ShieldCheck size={17} />
                {approvals.length > 0 && (
                  <span className="absolute top-0 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-black" />
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-white/80 group-hover:text-white">Approvals</span>
            </button>
          </div>

          {/* Navigation Tabs (Tokens, NFTs, DeFi & Vault) */}
          <div className="flex border-b border-white/10 mb-3 flex-shrink-0">
            <button
              onClick={() => {
                soundManager.play('click');
                setActiveTab('tokens');
              }}
              className={`flex-1 pb-2 text-xs font-bold transition-all relative ${
                activeTab === 'tokens' ? 'text-amber-300' : 'text-white/40 hover:text-white/70'
              }`}
            >
              <span>Tokens</span>
              {activeTab === 'tokens' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
              )}
            </button>

            <button
              onClick={() => {
                soundManager.play('click');
                setActiveTab('nfts');
              }}
              className={`flex-1 pb-2 text-xs font-bold transition-all relative ${
                activeTab === 'nfts' ? 'text-amber-300' : 'text-white/40 hover:text-white/70'
              }`}
            >
              <span>NFTs</span>
              {activeTab === 'nfts' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
              )}
            </button>

            <button
              onClick={() => {
                soundManager.play('click');
                setActiveTab('defi');
              }}
              className={`flex-1 pb-2 text-xs font-bold transition-all relative ${
                activeTab === 'defi' ? 'text-amber-300' : 'text-white/40 hover:text-white/70'
              }`}
            >
              <span>Vault & DeFi</span>
              {activeTab === 'defi' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
              )}
            </button>
          </div>

          {/* Tab Contents Scrollable Area */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[160px]">
            {/* 1. TOKENS TAB */}
            {activeTab === 'tokens' && (
              <div className="space-y-2">
                {/* BNB Card */}
                <div
                  onClick={() => openSend('BNB')}
                  className="glass rounded-2xl p-3 border border-white/10 hover:border-amber-400/40 active:scale-98 transition-all flex items-center justify-between cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400 text-black font-black flex items-center justify-center text-xs shadow-md">
                      BNB
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                          BNB
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-white/50">Gas</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-white/40 font-mono">
                          ${bnbPriceUsd.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 rounded">
                          +{priceChanges24h.BNB}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black font-mono text-white">
                      {hideBalance ? '••••' : bnbFormatted}
                    </span>
                    <span className="text-[11px] text-white/50 font-mono">
                      {hideBalance ? '••••' : formatFiat(bnbValueUsd)}
                    </span>
                  </div>
                </div>

                {/* $FARM Card */}
                <div
                  onClick={() => openSend('FARM')}
                  className="glass rounded-2xl p-3 border border-white/10 hover:border-emerald-400/40 active:scale-98 transition-all flex items-center justify-between cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white font-black flex items-center justify-center text-base shadow-md">
                      🌾
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white group-hover:text-emerald-300 transition-colors">
                          $FARM
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">Reward</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-white/40 font-mono">
                          ${farmPriceUsd.toFixed(6)}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 rounded">
                          +{priceChanges24h.FARM}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black font-mono text-white">
                      {hideBalance ? '••••' : farmFormatted}
                    </span>
                    <span className="text-[11px] text-white/50 font-mono">
                      {hideBalance ? '••••' : formatFiat(farmValueUsd)}
                    </span>
                  </div>
                </div>

                {/* USDT Card */}
                <div
                  onClick={() => openSend('USDT')}
                  className="glass rounded-2xl p-3 border border-white/10 hover:border-teal-400/40 active:scale-98 transition-all flex items-center justify-between cursor-pointer group text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-500 text-white font-black flex items-center justify-center text-lg shadow-md">
                      ₮
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white group-hover:text-teal-300 transition-colors">
                          USDT
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300">BEP-20</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-white/40 font-mono">
                          ${usdtPriceUsd.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 rounded">
                          +{priceChanges24h.USDT}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black font-mono text-white">
                      {hideBalance ? '••••' : usdtFormatted}
                    </span>
                    <span className="text-[11px] text-white/50 font-mono">
                      {hideBalance ? '••••' : formatFiat(usdtValueUsd)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. NFTS TAB */}
            {activeTab === 'nfts' && (
              <div className="space-y-2">
                {nftStatus && nftStatus.breedCount > 0 ? (
                  <div className="space-y-2">
                    {nftStatus.ownedBreeds.map((breed) => {
                      const info = NFT_BREED_INFO[breed.dogType] ?? { emoji: '🐕', rarity: 'Guard Dog', color: 'text-white/60' };
                      return (
                        <div
                          key={breed.tokenId}
                          className="glass rounded-2xl p-3 border border-white/10 flex items-center justify-between text-left"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{info.emoji}</span>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white">{breed.dogType}</span>
                                <span className={`text-[9px] font-bold ${info.color}`}>{info.rarity}</span>
                              </div>
                              <span className="text-[10px] text-amber-300 font-mono">
                                +{breed.defensePower}% Defense • {breed.isGuarding ? 'Guarding Farm' : 'In Kennel'}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-white/40">#{breed.tokenId}</span>
                        </div>
                      );
                    })}
                    <div className="glass rounded-xl p-2.5 flex items-center justify-between text-xs">
                      <span className="text-white/40">Total NFT Defense Bonus:</span>
                      <span className="text-amber-300 font-bold">{nftStatus.totalNftDefense}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-white/40">
                    <span className="text-3xl mb-2">🐕</span>
                    <p className="text-sm font-bold text-white mb-1">No Guard Dog NFTs Found</p>
                    <p className="text-xs text-white/40 max-w-[220px] mb-3">
                      Pull or fuse guard dog companions in Gacha to secure your crops against raiders!
                    </p>
                    <button
                      onClick={() => {
                        soundManager.play('click');
                        onClose();
                        eventBus.emit('show-shop', { tab: 'defense' });
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-400 text-black font-black text-xs active:scale-95 transition-all shadow-md"
                    >
                      Get Guard Dog
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. VAULT & DEFI TAB */}
            {activeTab === 'defi' && (
              <div className="space-y-2 text-left">
                {/* Treasury Buyback Vault Card */}
                <div className="glass rounded-2xl p-3 border border-white/10">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-400" />
                      <span className="text-xs font-bold text-white">Treasury Buyback Vault</span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono">
                      Auto-Burn 2.0 BNB
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed mb-2">
                    Collects 75% of Gacha BNB fees to periodically execute on-chain $FARM buybacks on PancakeSwap and permanently burn them.
                  </p>
                  <a
                    href="https://testnet.bscscan.com/address/0xe59FfB05EdF59464e8803E81A4d790d828915006"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:underline font-mono"
                  >
                    <span>0xe59F...5006 (Verify Contract)</span>
                    <ExternalLink size={10} />
                  </a>
                </div>

                {/* DEX Liquidity Card - FARM / BNB */}
                <div className="glass rounded-2xl p-3 border border-white/10">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <ArrowUpRight size={14} className="text-amber-400" />
                      <span className="text-xs font-bold text-white">PancakeSwap V2 Pool</span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono font-bold">
                      $FARM / BNB
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed mb-2">
                    Decentralized liquidity pool for instant swapping between BNB and $FARM tokens.
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <a
                      href="https://testnet.bscscan.com/address/0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white font-mono"
                    >
                      <span>Router: 0x9Ac6...e5c3</span>
                      <ExternalLink size={10} />
                    </a>
                    <button
                      onClick={() => {
                        soundManager.play('click');
                        onClose();
                        eventBus.emit('show-claim', { tab: 'dex' });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold border border-amber-500/30 active:scale-95 transition-all"
                    >
                      Swap FARM / BNB
                    </button>
                  </div>
                </div>

                {/* DEX Liquidity Card - FARM / USDT */}
                <div className="glass rounded-2xl p-3 border border-white/10">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <ArrowUpRight size={14} className="text-teal-400" />
                      <span className="text-xs font-bold text-white">PancakeSwap V2 Pool</span>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-300 font-mono font-bold">
                      $FARM / USDT
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed mb-2">
                    Direct stablecoin pair for low-volatility trading and instant cash-out to BEP-20 USDT.
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-white/5">
                    <a
                      href="https://testnet.bscscan.com/token/0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white font-mono"
                    >
                      <span>USDT: 0x3376...4dDd</span>
                      <ExternalLink size={10} />
                    </a>
                    <button
                      onClick={() => {
                        soundManager.play('click');
                        onClose();
                        eventBus.emit('show-claim', { tab: 'dex' });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 text-[10px] font-bold border border-teal-500/30 active:scale-95 transition-all"
                    >
                      Swap FARM / USDT
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nested Sub-modals */}
      {activeSubmodal === 'send' && (
        <SendModal
          defaultToken={sendDefaultToken}
          onClose={() => setActiveSubmodal(null)}
          onBack={() => setActiveSubmodal(null)}
        />
      )}

      {activeSubmodal === 'receive' && (
        <ReceiveModal
          onClose={() => setActiveSubmodal(null)}
          onBack={() => setActiveSubmodal(null)}
        />
      )}

      {activeSubmodal === 'history' && (
        <WalletHistoryModal
          onClose={() => setActiveSubmodal(null)}
          onBack={() => setActiveSubmodal(null)}
        />
      )}

      {activeSubmodal === 'approvals' && (
        <WalletApprovalsModal
          onClose={() => setActiveSubmodal(null)}
          onBack={() => setActiveSubmodal(null)}
        />
      )}

      {activeSubmodal === 'settings' && (
        <WalletSettingsModal
          onClose={() => setActiveSubmodal(null)}
          onBack={() => setActiveSubmodal(null)}
        />
      )}
    </>
  );
}
