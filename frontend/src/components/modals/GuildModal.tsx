import { useState } from 'react';
import { X, Shield, Users, Crown, Plus, LogIn, LogOut, Loader2, Sword, Star } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import type { GuildInfo, GuildListEntry } from '@/types/game.types';

interface Props { onClose: () => void }

type Tab = 'my-guild' | 'browse';

function GuildCard({ guild, onJoin, busy }: { guild: GuildListEntry; onJoin: () => void; busy: boolean }) {
  return (
    <div className="glass rounded-2xl p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
        guild.tier === 'elite' ? 'bg-amber-500/20' : 'bg-white/10'
      }`}>
        {guild.tier === 'elite' ? '⭐' : '🏰'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-white font-bold text-sm leading-tight truncate">{guild.name}</p>
          {guild.tier === 'elite' && (
            <span className="text-[9px] font-black text-amber-400 bg-amber-400/15 px-1.5 py-0.5 rounded-full">ELITE</span>
          )}
        </div>
        <p className="text-white/40 text-[10px]">
          {guild.memberCount}/50 members • {guild.stakedFarm.toFixed(0)} $FARM staked
        </p>
        <p className="text-white/30 text-[10px]">Owner: @{guild.ownerUsername}</p>
      </div>
      <button
        disabled={busy}
        onClick={onJoin}
        className="glass text-green-400/80 text-xs px-3 py-1.5 rounded-xl active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1"
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <LogIn size={11} />}
        Join
      </button>
    </div>
  );
}

function MyGuildView({ guild, onLeave, busy }: { guild: GuildInfo; onLeave: () => void; busy: boolean }) {
  const treeColor = guild.worldTreeHp > 600 ? 'bg-green-500' : guild.worldTreeHp > 300 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex flex-col gap-3">
      {/* Guild banner */}
      <div className={`rounded-2xl p-4 ${guild.tier === 'elite' ? 'bg-amber-500/10 border border-amber-400/25' : 'glass'}`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-white font-black text-base">{guild.name}</h3>
            <p className="text-white/40 text-xs">
              {guild.tier === 'elite' ? '⭐ Elite Guild' : '🏰 Free Tier'} • Tax {(guild.taxRate * 100).toFixed(0)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-amber-300 font-black text-sm">{guild.stakedFarm.toFixed(0)}</p>
            <p className="text-white/30 text-[9px]">$FARM staked</p>
          </div>
        </div>
        {guild.tier === 'free' && Number(guild.stakedFarm) < 500 && (
          <p className="text-white/30 text-[10px] mt-1">
            Stake 500 $FARM to unlock Elite tier (+harvest tax pool)
          </p>
        )}
      </div>

      {/* World Tree */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">🌳</span>
            <span className="text-white/70 text-sm font-bold">World Tree</span>
          </div>
          <span className="text-white/60 text-xs font-bold">{guild.worldTreeHp}/1000 HP</span>
        </div>
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${treeColor}`} style={{ width: `${guild.worldTreeHp / 10}%` }} />
        </div>
      </div>

      {/* Members */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users size={14} className="text-white/50" />
          <span className="text-white/70 text-sm font-bold">Members ({guild.memberCount}/50)</span>
        </div>
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
          {guild.members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-sm flex-shrink-0">
                {m.role === 'owner' ? '👑' : m.role === 'officer' ? '⭐' : '👤'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-xs font-bold truncate">@{m.username}</p>
                <p className="text-white/30 text-[9px] capitalize">{m.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* My role badge */}
      <div className="text-center">
        <span className="text-white/30 text-[10px]">
          Your role: <span className="text-white/60 capitalize font-bold">{guild.myRole}</span>
        </span>
      </div>

      {guild.myRole !== 'owner' && (
        <button
          disabled={busy}
          onClick={onLeave}
          className="w-full py-3 rounded-2xl glass text-red-400/70 font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          Leave Guild
        </button>
      )}
    </div>
  );
}

export function GuildModal({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('my-guild');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: myGuild, isLoading: myGuildLoading } = useQuery({
    queryKey: ['my-guild'],
    queryFn: api.getMyGuild,
    staleTime: 30_000,
  });

  const { data: guildList = [], isLoading: listLoading } = useQuery({
    queryKey: ['guild-list'],
    queryFn: () => api.listGuilds(),
    staleTime: 60_000,
    enabled: tab === 'browse',
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createGuild(name),
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      setCreating(false);
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const joinMutation = useMutation({
    mutationFn: (guildId: string) => api.joinGuild(guildId),
    onSuccess: (data) => {
      setResult(`✅ ${data.message}`);
      queryClient.invalidateQueries({ queryKey: ['my-guild', 'guild-list'] });
      setTab('my-guild');
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const leaveMutation = useMutation({
    mutationFn: api.leaveGuild,
    onSuccess: () => {
      setResult('✅ Left guild');
      queryClient.invalidateQueries({ queryKey: ['my-guild'] });
    },
    onError: (err: Error) => setResult(`❌ ${err.message}`),
  });

  const busy = createMutation.isPending || joinMutation.isPending || leaveMutation.isPending;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md glass rounded-t-3xl slide-up flex flex-col"
        style={{ maxHeight: '82vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 flex-shrink-0" />

        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-blue-400" />
            <div>
              <h2 className="text-white font-black text-base leading-none">Guilds</h2>
              <p className="text-white/40 text-xs">Team up, stake $FARM, dominate</p>
            </div>
          </div>
          <button onClick={onClose} className="glass rounded-full p-2 text-white/60 hover:text-white active:scale-90 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 px-5 mb-3">
          <div className="glass rounded-2xl flex p-1 gap-1">
            {(['my-guild', 'browse'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  tab === t ? 'bg-white/15 text-white' : 'text-white/40'
                }`}
              >
                {t === 'my-guild' ? <><Crown size={11} /> My Guild</> : <><Users size={11} /> Browse</>}
              </button>
            ))}
          </div>
        </div>

        {result && (
          <div className="mx-5 mb-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/70">
            {result}
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-5 pb-8">
          {tab === 'my-guild' && (
            <>
              {myGuildLoading && <div className="text-center py-10 text-white/40 text-sm">Loading…</div>}
              {!myGuildLoading && !myGuild && !creating && (
                <div className="flex flex-col items-center py-12 gap-4 text-center">
                  <Shield size={40} className="text-white/20" />
                  <p className="text-white/40 text-sm">You're not in a guild yet.</p>
                  <div className="flex gap-2 w-full">
                    <button
                      onClick={() => { setCreating(true); setResult(null); }}
                      className="flex-1 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff' }}
                    >
                      <Plus size={14} /> Create Guild
                    </button>
                    <button
                      onClick={() => setTab('browse')}
                      className="flex-1 py-3 rounded-2xl glass text-white/70 text-sm font-bold active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <LogIn size={14} /> Join Guild
                    </button>
                  </div>
                </div>
              )}

              {creating && (
                <div className="flex flex-col gap-3 mt-2">
                  <p className="text-white/60 text-sm font-bold">Create a New Guild (200G)</p>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Guild name (max 100 chars)"
                    maxLength={100}
                    className="glass rounded-2xl px-4 py-3 text-white text-sm outline-none placeholder:text-white/30 bg-transparent"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busy || newName.trim().length < 2}
                      onClick={() => { setResult(null); createMutation.mutate(newName.trim()); }}
                      className="flex-1 py-3 rounded-2xl text-sm font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff' }}
                    >
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Create — 200G
                    </button>
                    <button onClick={() => setCreating(false)} className="glass px-4 py-3 rounded-2xl text-white/50 text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!myGuildLoading && myGuild && (
                <MyGuildView guild={myGuild} onLeave={() => leaveMutation.mutate()} busy={busy} />
              )}
            </>
          )}

          {tab === 'browse' && (
            <div className="flex flex-col gap-2.5">
              {listLoading && <div className="text-center py-10 text-white/40 text-sm">Loading…</div>}
              {!listLoading && guildList.length === 0 && (
                <div className="flex flex-col items-center py-14 gap-3 text-center">
                  <Shield size={36} className="text-white/20" />
                  <p className="text-white/30 text-sm">No guilds yet. Be the first!</p>
                </div>
              )}
              {guildList.map((g) => (
                <GuildCard
                  key={g.id}
                  guild={g}
                  busy={busy}
                  onJoin={() => { setResult(null); joinMutation.mutate(g.id); }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
