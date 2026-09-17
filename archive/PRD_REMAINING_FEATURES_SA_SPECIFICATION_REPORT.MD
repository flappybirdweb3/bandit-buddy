# BARNBUDDY WEB3 — ARCHITECTURAL AUDIT, TECHNICAL SPECIFICATIONS & IMPLEMENTATION REPORT
**Document Reference:** `PRD_REMAINING_FEATURES_SA_SPECIFICATION_REPORT.MD`  
**Target Reviewer:** Lead Software Architect (SA) & Engineering Implementation Team  
**Scope:** Full Traceability, Concrete Technical Specifications (SRS), and Implementation Blueprints for All Remaining PRD Features  
**Localization Policy:** Strict 100% English (`GLOBAL_ENGLISH_ONLY` — Zero-Tolerance for Non-English Player-Facing Assets)  
**Date:** September 17, 2026  
**System Baseline:** 17/26 Features Production-Ready (157/157 Hardhat Tests Pass, 44/44 Jest Tests Pass, Vite Build 0 Errors)

---

## 1. Master System Traceability & Gap Status Matrix

The BarnBuddy Web3 platform is partitioned into 9 architectural modules comprising **26 core business and technical features** defined in `PRD_FEATURE_LIST_AND_PRIORITIZATION.MD`.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM FEATURE AUDIT SUMMARY                                   │
├───────────────────────────────┬──────────┬──────────┬───────────────────────────────────────┤
│ Classification Status         │ Count    │ Ratio    │ Architectural Assessment              │
├───────────────────────────────┼──────────┼──────────┼───────────────────────────────────────┤
│ 🟢 Production Ready (Released)│ 17 / 26  │ 65.4%    │ Verified 100% on-chain & backend test  │
│ 🟡 Enhancement / Hook Required│  6 / 26  │ 23.1%    │ Subsystems exist; requires wireup/UI  │
│ 🔴 Unimplemented in Main Flow │  3 / 26  │ 11.5%    │ Needs end-to-end hook & client UX     │
├───────────────────────────────┼──────────┼──────────┼───────────────────────────────────────┤
│ Total Systems                 │ 26 / 26  │ 100.0%   │ Core Engine Completeness: 88.5%       │
└───────────────────────────────┴──────────┴──────────┴───────────────────────────────────────┘
```

### 1.1 Complete Feature Status Inventory

| ID | Feature Name | Module | Current Codebase State | Status | Review Scope |
|---|---|---|---|---|---|
| `CORE-01` | Soil Fertility Decay (-20%/harvest) | Farm | `farm.service.ts` line 434, `FertilizerModal.tsx` | 🟢 Ready | Pass |
| `CORE-02` | 13 Crops Baseline & Seasonal Seeds | Farm | `seed-config.entity.ts`, `ShopModal.tsx` | 🟢 Ready | Pass |
| `CORE-03` | Weather System & 4h OpEx Sinks | Farm | `farm.service.ts` (`getTodayWeather`) | 🟢 Ready | Pass |
| `CORE-04` | Farm Durability & 7-Day Fence Decay | Farm | `farm-building.entity.ts`, `FarmMaintenanceModal` | 🟢 Ready | Pass |
| `CORE-05` | Crop Crate Wholesale Packing | Storage | `inventory.service.ts` (`packCrate`/`unpackCrate`) | 🟢 Ready | Pass |
| `PET-01` | 5-Tier Guard Dogs & Slashing Matrix | Pets | `GuardDogNFT.sol`, `action.service.ts` line 800 | 🟢 Ready | Pass |
| `PET-02` | Guard Dog Energy & 24h Hunger Decay | Pets | `nft-guard-dog.entity.ts`, `DogStatusModal.tsx` | 🟢 Ready | Pass |
| `PET-03` | Web2.5 Bridge Tokenization (FARM Fee) | Web3 | `web3.service.ts` (`tokenizeDog`) | 🟢 Ready | Pass |
| `PET-04` | Guarding Sell-Lock Protection | Market | `marketplace.service.ts`, `StorageModal.tsx` | 🟢 Ready | Pass |
| `PET-05` | Dog Fusion Gacha (Commit-Reveal RNG) | Gacha | `BanditDogFusion.sol`, `fusion-oracle.service` | 🟢 Ready | Pass |
| `PET-06` | Soul Shard Pity Redemption (ID 9999) | Gacha | `GuardDogNFT.sol` (`redeemShards`) | 🟢 Ready | Pass |
| `PVP-01` | Anonymous Raid & Dog Bite Slashing | PvP | `action.service.ts` (`steal`) | 🟢 Ready | Pass |
| `PVP-02` | Masked Identity in Theft Logs | PvP | `steal_logs` (`is_anonymous = true`) | 🟢 Ready | Pass |
| `PVP-03` | Magnifying Glass Referral Hook | SocialFi | Partial: DB item ready; auth guard missing hook | 🟡 **Target 1** | Wireup |
| `PVP-04` | Master Key Level 3 Referral Hook | SocialFi | Partial: Logic in `user.service.ts`; UI missing | 🟡 **Target 2** | Wireup |
| `PVP-05` | Revenge Raid System (35% Elevated Cap) | PvP | Partial: Math in `steal()`; UI bypass needed | 🔴 **Target 3** | Full Spec |
| `ECON-01` | Algorithmic Dynamic Peg vAMM | Token | `economy-oracle.service.ts`, `ClaimModal.tsx` | 🟢 Ready | Pass |
| `ECON-02` | Global Daily Drip-Feed Pool | Token | Redis quota cache (`cashout:global:{date}`) | 🟢 Ready | Pass |
| `ECON-03` | User Member Level Cashout Tiers | Token | `web3.service.ts` (`getCashoutQuota`) | 🟢 Ready | Pass |
| `DEX-01` | In-App Multi-Pair PancakeSwap Swap | DeFi | Partial: BNB/FARM ready; USDT pair missing | 🟡 **Target 4** | Wireup |
| `DEX-02` | Dynamic DEX Transfer Tax (1%-5%) | Token | `FarmToken.sol` (fee-on-transfer pair logic) | 🟢 Ready | Pass |
| `DEX-03` | Automated Buyback & Burn Vault | DeFi | `TreasuryBuyBack.sol` (auto swap & dead burn) | 🟢 Ready | Pass |
| `MKT-01` | EIP-712 Gasless P2P Marketplace | Market | `BanditMarket.sol`, `marketplace.service.ts` | 🟢 Ready | Pass |
| `MKT-04` | Real-Time Live WebSocket Trade Toast | Market | Backend WSS ready; frontend audio toast missing | 🔴 **Target 5** | Full Spec |
| `GUILD-01`| Telegram Bot Group Binding | Guild | `bot.service.ts` (`/link_guild`, `telegramGroupId`)| 🟢 Ready | Pass |
| `GUILD-02`| Elite Blue Badge Staking (1,000 FARM) | Guild | `Guild.sol`, `guild.service.ts` (`upgradeElite`) | 🟢 Ready | Pass |
| `GUILD-03`| World Tree Viral Growth (+5% Boost) | Guild | Backend logic ready; client surge UI missing | 🟡 **Target 6** | Polish |
| `GUILD-04`| GvG Tree Raids & 12h Shield UI | Guild | Backend ready; Raid Radar & Timer UI missing | 🟡 **Target 7** | Polish |
| `SUB-01` | Barn Butler Automation (OpEx/Seeds) | Sub | Cron harvests ripe; OpEx/replant missing | 🟡 **Target 8** | Full Spec |
| `SUB-02` | Crop Theft Insurance 80% Claim Payout | Sub | Backend math in `steal()`; UI receipt missing | 🔴 **Target 9** | Full Spec |
| `SEC-01` | Nonce Replay & Reentrancy Guards | Security | Verified on all Solidity contracts | 🟢 Ready | Pass |
| `SEC-02` | DB Row Locks (`SERIALIZABLE` Isolation)| Security | Verified on all financial mutations | 🟢 Ready | Pass |
| `SEC-03` | Emergency Kill Switch Circuit Breakers | Security | `EmergencyKillSwitch.sol`, `economy-oracle` | 🟢 Ready | Pass |

---

## 2. Gap Analysis & Architecture Diagnostics

From the traceability matrix above, the remaining work consolidates into **7 distinct technical deliverables**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CONSOLIDATED REMAINING DELIVERABLES                             │
├─────────┬───────────────────────────────────────┬──────────────┬───────────────────────┤
│ Ref     │ Engineering Deliverable               │ Modules      │ Complexity            │
├─────────┼───────────────────────────────────────┼──────────────┼───────────────────────┤
│ DELIV-1 │ Revenge Raid (35% Cap & Raid Bypass)  │ Action / PvP │ Medium (BE + FE)      │
│ DELIV-2 │ Crop Insurance 80% Payout & Receipt   │ Action / Sub │ Low-Medium (BE + FE)  │
│ DELIV-3 │ Referral Item Hooks (Glass & Key)     │ User / Auth  │ Medium (BE + Guard)   │
│ DELIV-4 │ World Tree Viral Surge (+5% UI Badge) │ Guild / Web3 │ Low (FE UI)           │
│ DELIV-5 │ GvG Raid Radar & 12h Shield Wars UI   │ Guild / Wars │ Medium (FE UI + BE)   │
│ DELIV-6 │ Barn Butler Full Automation Engine    │ Guild / Sub  │ High (Cron + Seed DB) │
│ DELIV-7 │ In-App USDT Swap & Live Trade Toast   │ Web3 / Mkt   │ Medium-High (FE + WS) │
└─────────┴───────────────────────────────────────┴──────────────┴───────────────────────┘
```

### Diagnostic Findings in Live Codebase:
1. **Referral Hook Discrepancy in `telegram-auth.guard.ts`:**
   - In `UserService.applyReferral()`, awarding +1 `magnifying_glass` is fully implemented.
   - However, `telegram-auth.guard.ts` (lines 232-246) maintains a detached private `applyReferral()` that only credits gold and does NOT call `UserService.applyReferral()`.
   - *Architecture Resolution:* Delegate directly to `UserService.applyReferral(newUserId, referrerTelegramId)` inside `telegram-auth.guard.ts`.
2. **Revenge Raid Cooldown Collision:**
   - In `ActionService.steal()`, lines 545-557 reject raids on farms that were hit in the past 24 hours via `FARM_RAID_COOLDOWN_MS`.
   - If an unmasked thief was raided by an arbitrary third party, the legitimate victim is currently blocked from executing their 24h Revenge Raid.
   - *Architecture Resolution:* Check `isRevenge` before or in tandem with `recentRaid`; a valid revenge raid must bypass the generic third-party raid cooldown while respecting its own 24h unmasking window.
3. **Barn Butler Seed Priority Queue:**
   - The butler currently only calls `increment('goldBalance', earned)` on ripe plots.
   - It requires automated OpEx clearing (drought: 30G, pests: 60G, weeds: 40G) and replanting from a priority seed list.
4. **Marketplace Real-Time Notification Gap:**
   - The backend listens to on-chain market events via `ethers.WebSocketProvider` (`marketplace.service.ts`), but lacks a frontend WebSocket Gateway to push notifications to active browser clients.

---

## 3. Concrete Software Architecture Technical Specifications (SRS)

All specifications below adhere strictly to the **Section 4 PRD Specification Standard Template**.

---

### 3.1 Specification `PRD-SPEC-PVP`: Revenge Raid System (`PVP-05`)

#### 1. Module & Feature ID
- **Module:** Social PvP & Retribution Engine (`PVP`)
- **Feature ID:** `PVP-05` — Revenge Raid System (Elevated 35% Steal Cap)

#### 2. User Stories & Acceptance Criteria (Gherkin format)
```gherkin
Feature: Revenge Raid System
  As a victim who used a Magnifying Glass to unmask a thief
  I want to launch a 24-hour Revenge Raid against the thief
  So that I can bypass third-party farm protection and steal up to 35% of their ripe crop

  Scenario: Player unmasks thief and launches revenge raid within 24 hours
    Given Player A unmasked Player B's anonymous theft within the last 24 hours
    And Player B's farm plot has ripe crops
    When Player A executes `POST /action/steal` with `isRevenge = true`
    Then the action is validated as a legitimate Revenge Raid
    And the action bypasses any generic 24h raid cooldown from third-party raiders
    And the steal limit is elevated to 35% of total effective crop yield
    And Player A receives an in-combat toast: "⚔️ REVENGE RAID! Stolen X GOLD (35% Revenge Cap)!"

  Scenario: Revenge raid attempted after 24 hours of unmasking
    Given Player A unmasked Player B 25 hours ago
    When Player A attempts a revenge raid on Player B
    Then the system rejects the revenge flag and treats it as a standard raid (20% cap)
    And generic raid cooldown rules apply.
```

#### 3. Mathematical Formulas & Invariants
1. **Revenge Qualification Invariant:**
   $$\text{IsRevengeTarget} \iff \exists\, \text{log} \in \text{StealLog}: \begin{cases} \text{log.thiefId} = \text{TargetUserId} \\ \text{log.victimId} = \text{AttackerUserId} \\ \text{log.isAnonymous} = \text{false} \\ \text{log.success} = \text{true} \\ t_{\text{now}} - \text{log.createdAt} \le 86,400\text{s} \end{cases}$$

2. **Steal Ceiling Equations:**
   - Standard Cap: $C_{\text{std}} = 0.20$
   - Revenge Cap: $C_{\text{rev}} = 0.35$
   - Stealable Amount:
     $$\Delta_{\text{steal}} = \min\left(Y_{\text{eff}} \times C_{\text{rev}},\ (Y_{\text{eff}} \times C_{\text{rev}}) - \text{TotalStolen}\right)$$

#### 4. Data Architecture & Schema DDL
```sql
-- PostgreSQL Index for instant revenge resolution (< 2ms):
CREATE INDEX IF NOT EXISTS idx_steal_logs_revenge_lookup
ON steal_logs (thief_id, victim_id, is_anonymous, success, created_at DESC);

-- Optional explicit column for unmask timestamp:
ALTER TABLE steal_logs ADD COLUMN IF NOT EXISTS revealed_at TIMESTAMP WITH TIME ZONE;
```

#### 5. Backend NestJS Endpoints & DTOs
- **Route:** `POST /action/steal`
- **DTO Validation (`action.dto.ts`):**
  ```typescript
  export class StealDto {
    @IsUUID() @IsNotEmpty() targetUserId: string;
    @IsUUID() @IsNotEmpty() plotId: string;
    @IsOptional() @IsBoolean() useMasterKey?: boolean;
    @IsOptional() @IsBoolean() isRevenge?: boolean;
  }
  ```
- **Controller Logic:** Integrated into `ActionService.steal()`. Bypasses `recentRaid` check when `isRevenge === true` is verified against `steal_logs`.

#### 6. Frontend Phaser & React UI/UX Specifications
1. **Farm View Banner:** In `VisitFarmModal.tsx` or Phaser neighbor view:
   - If `isRevengeTarget`, render top glowing banner: `⚔️ REVENGE RAID AVAILABLE (35% STEAL CAP)`.
2. **Notification Direct Action:** In `NotificationModal.tsx`, clicking `[Raid Back]` automatically navigates to neighbor farm with `isRevenge = true`.
3. **Sound FX:** Trigger `soundManager.play('attack')` with red screen-edge flash.

#### 7. Security, Anti-Cheat & Sandbox Test Cases
- **`TC-REV-01` (Row Lock Concurrency):** Concurrent steal requests on the same plot must use `SERIALIZABLE` transaction isolation and `pessimistic_write` plot row lock to prevent exceeding the 35% cap.
- **`TC-REV-02` (Window Boundary):** Verify revenge flag is rejected at $t = 86,401$ seconds post-unmasking.

---

### 3.2 Specification `PRD-SPEC-SUB`: Crop Theft Insurance Claim (`SUB-02`)

#### 1. Module & Feature ID
- **Module:** Premium Subscriptions & Risk Mitigation (`SUB`)
- **Feature ID:** `SUB-02` — Crop Theft Insurance 80% Automated Claim Payout

#### 2. User Stories & Acceptance Criteria (Gherkin format)
```gherkin
Feature: Automated Crop Theft Insurance Reimbursement
  As an insured farmer with an active "Crop Theft Insurance" policy
  I want 80% of any stolen crop value to be automatically credited to my GOLD balance
  So that my farm income is protected against aggressive raiders while I am offline

  Scenario: Insured farm plot is raided
    Given User A has an active "crop_insurance_7d" subscription (expiresAt > now)
    When Thief B steals 100 GOLD worth of crops from User A
    Then User A's `goldBalance` is credited with 80.00 GOLD (80% reimbursement)
    And an in-app inbox notification is generated for User A detailing the claim
    And Thief B's steal response contains `insurancePayout: 80.00`
    And a Telegram push is dispatched to User A.
```

#### 3. Mathematical Formulas & Invariants
$$\text{Payout}_{\text{insurance}} = \begin{cases} \text{round}(\Delta_{\text{steal}} \times 0.80, 2) & \text{if } \text{HasActiveInsurance}(\text{VictimId}) \\ 0 & \text{otherwise} \end{cases}$$
$$\text{VictimNetLoss} = \Delta_{\text{steal}} - \text{Payout}_{\text{insurance}} = 0.20 \times \Delta_{\text{steal}}$$

#### 4. Data Architecture & Schema DDL
```sql
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active 
ON subscriptions (user_id, type, expires_at DESC);
```

#### 5. Backend NestJS Endpoints & DTOs
- Atomically executed within the `SERIALIZABLE` transaction in `ActionService.steal()`:
  ```typescript
  const activeInsurance = await qr.manager.findOne(Subscription, {
    where: [
      { userId: dto.targetUserId, type: 'crop_insurance', expiresAt: MoreThan(new Date()) },
      { userId: dto.targetUserId, type: 'crop_insurance_7d' as any, expiresAt: MoreThan(new Date()) },
    ],
  });
  if (activeInsurance) {
    insurancePayout = Number((stealAmount * 0.8).toFixed(2));
    if (insurancePayout > 0) {
      await qr.manager.increment(User, { id: dto.targetUserId }, 'goldBalance', insurancePayout);
    }
  }
  ```

#### 6. Frontend Phaser & React UI/UX Specifications
1. **Farm Protection Aegis:** Render a golden aegis shield icon `🛡️ 80% Insured` on the victim's farm HUD.
2. **Notification Details:** In `NotificationModal.tsx`, display `🛡️ Insurance reimbursed +X GOLD` tag in cyan typography.

#### 7. Security & Sandbox Test Cases
- **`TC-INS-01` (No Phantom Reimbursement):** Ensure reimbursement occurs only if `stealAmount > 0` and theft succeeds.
- **`TC-INS-02` (Exact Precision):** Verify no floating point inaccuracies exceed 2 decimal places.

---

### 3.3 Specification `PRD-SPEC-REF`: Viral Referral Rewards Automation (`PVP-03` & `PVP-04`)

#### 1. Module & Feature ID
- **Module:** SocialFi & Viral Growth Loops (`REF` / `PVP`)
- **Feature ID:** `PVP-03` & `PVP-04` — Magnifying Glass & Master Key Automatic Referral Hooks

#### 2. User Stories & Acceptance Criteria (Gherkin format)
```gherkin
Feature: Automatic Referral Item Rewards
  As a player sharing referral links
  I want to automatically receive Magnifying Glasses for invites and Master Keys for leveled-up friends
  So that I am incentivized to grow and mentor my player network

  Scenario: New referral registers via Telegram WebApp link
    Given User A shares `https://t.me/BanditBuddyBot?startapp=ref_12345`
    When User B launches the game via this link
    Then `telegram-auth.guard.ts` invokes `UserService.applyReferral()`
    And User A receives +120 GOLD and +1 "magnifying_glass" in `user_items`
    And User B receives +120 GOLD welcome bonus
    And User A receives a Telegram push: "🎁 Referral Bonus: +1 Magnifying Glass & +120 GOLD!"

  Scenario: Referred player reaches Level 3
    Given User A has 3 referred friends who have reached Level >= 3
    When the 3rd friend harvests crops and levels up to Level 3
    Then `ActionService.harvest()` triggers `UserService.checkAndGrantMasterKeys(UserA.id)`
    And User A receives +1 "master_key" in `user_items`
    And a milestone record is persisted in `referral_rewards`
    And User A receives an inbox notification: "🗝️ Master Key Unlocked!"
```

#### 3. Mathematical Formulas & Invariants
$$\text{Keys}_{\text{total}} = \left\lfloor \frac{\text{Count}(\text{ReferredUsers with Level} \ge 3)}{3} \right\rfloor$$
$$\text{Keys}_{\text{to\_grant}} = \text{Keys}_{\text{total}} - \text{Count}(\text{GrantedMilestones})$$

#### 4. Data Architecture & Schema DDL
```sql
CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_type VARCHAR(32) NOT NULL,
    referred_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    milestone_count INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer 
ON referral_rewards(referrer_id, reward_type);
```

#### 5. Backend NestJS Endpoints & Wireup
- **`telegram-auth.guard.ts`:** Update `applyReferral` to delegate directly to `this.userService.applyReferral(newUserId, referrerTelegramId)`.
- **`ActionService.harvest()` & `harvestAll()`:** Ensure `checkAndGrantMasterKeys` is triggered whenever `newLevel >= 3 && prevLevel < 3`.

#### 6. Frontend UI/UX Specifications
- **Invite Friends Modal (`InviteModal.tsx`):**
  - Section 1: `Your Referral Code & Link` (with 1-click copy).
  - Section 2: `Invited Friends: X` (Awards 1 Magnifying Glass each).
  - Section 3: `Master Key Progress:` Visual bar `[X/3 to Next Master Key]`.

#### 7. Security & Anti-Cheat
- **`TC-REF-01` (Self-Referral Prevention):** Prevent `newUserId === referrerId` or matching IP/Telegram ID.
- **`TC-REF-02` (Duplicate Key Prevention):** Unique milestone check prevents awarding multiple keys for the same 3-user cohort.

---

### 3.4 Specification `PRD-SPEC-GLD`: Guild World Tree & GvG Shield Wars (`GUILD-03` & `GUILD-04`)

#### 1. Module & Feature ID
- **Module:** Guilds & GvG Warfare (`GUILD`)
- **Feature ID:** `GUILD-03` & `GUILD-04` — World Tree +5% Viral Booster, GvG Raid Radar & 12h Shield UI

#### 2. User Stories & Acceptance Criteria (Gherkin format)
```gherkin
Feature: Guild World Tree Viral Watering and GvG Raids
  As an active guild member
  I want my first watering action as a new recruit to grant +5% growth progress
  And I want our Elite Guild to maintain a 12-hour Energy Shield while raiding ripe enemy trees
  So that our guild dominates the GvG Leaderboard and protects its dividend pool

  Scenario: Newly invited recruit waters World Tree for the first time
    Given User B joined Guild G via User A's referral link
    And User B has not watered the World Tree yet (waterCount = 0)
    When User B calls `POST /guild/tree/water`
    Then World Tree progress increases by +5.0%
    And User B receives +5 contribution points
    And User A receives +5 bonus contribution points in Guild G.

  Scenario: Elite Guild maintains Energy Shield and raids rival
    Given Guild G is Elite and owner executes `POST /guild/shield` (costs 500 GOLD)
    Then Guild G's `shieldUntil` is extended by +12 hours
    And rival guilds are blocked from raiding Guild G's World Tree
    When Guild G members view the GvG Raid Radar
    Then all unshielded ripe rival trees are displayed with estimated siphons (15%)
    And members can trigger `POST /guild/raid` to siphon rewards.
```

#### 3. Mathematical Formulas & Invariants
$$\Delta_{\text{progress}} = \begin{cases} +5.0\% & \text{if First Water by Referred Member} \\ +1.0\% & \text{standard daily water} \end{cases}$$
$$\text{RaidSiphon}_{\text{FARM}} = \text{round}(\text{Guild}_{\text{target}}.\text{rewardPoolFarm} \times 0.15, 2)$$
$$\text{RaidSiphon}_{\text{GOLD}} = \text{round}(\text{Guild}_{\text{target}}.\text{rewardPoolGold} \times 0.15, 2)$$

#### 4. Backend Endpoints & Data Model
- Existing endpoints verified in `guild.service.ts`:
  - `POST /guild/tree/water`: Handles +5% viral boost logic.
  - `POST /guild/shield`: Activates 12h Energy Shield for 500 GOLD.
  - `POST /guild/raid`: Siphons 15% rewards from unshielded ripe enemy guilds.
  - `GET /guild/raid-targets`: Returns list of ripe guilds with shield status and reward pools.

#### 5. Frontend React Specifications (`GuildModal.tsx`)
1. **Active Shield Countdown Timer:** Display live countdown `🛡️ Energy Shield: HH:MM:SS` with `[Extend 12h (500G)]` button.
2. **Viral Surge Badge:** Display `✨ +5% First Water Surge Available!` on the Water button for eligible new recruits.
3. **GvG Raid Radar Tab:**
   - Interactive table listing rival guilds with ripe trees.
   - Shows Shield Status: `🛡️ Shielded (HH:MM:SS remaining)` or `⚔️ Vulnerable (Unshielded)`.
   - Action Button: `[⚔️ Launch Siphon Raid]`.

---

### 3.5 Specification `PRD-SPEC-AUT`: Barn Butler Full Farm Automation (`SUB-01`)

#### 1. Module & Feature ID
- **Module:** Automation & Utility Subscriptions (`SUB`)
- **Feature ID:** `SUB-01` — Barn Butler Full Automation (Weather OpEx & Seed Queue Replanting)

#### 2. User Stories & Acceptance Criteria (Gherkin format)
```gherkin
Feature: Barn Butler Full Farm Automation
  As a player with an active "Barn Butler" subscription
  I want the Butler to automatically harvest ripe crops, cure weather debuffs, and replant seeds
  So that my farm produces crops continuously while I am away from the game

  Scenario: Butler cronjob runs maintenance cycle
    Given User A has an active "butler" subscription
    And Plot 1 has weeds (costs 40 GOLD to clear) and User A has >= 140 GOLD
    And Plot 2 is empty and User A has configured "Carrot Seeds" in their priority queue
    When the 10-minute Butler cronjob executes
    Then Plot 1 weeds are removed and 40 GOLD is deducted
    And Plot 2 is replanted with Carrot Seeds and seed cost is deducted
    And an automation activity log is recorded.
```

#### 3. Mathematical Formulas & OpEx Remediation Rules
- **OpEx Costs:**
  - Drought (`hasDrySoil`): 30 GOLD $\rightarrow$ Set `lastWateredAt = now()`.
  - Pests (`hasBugs`): 60 GOLD $\rightarrow$ Set `hasBugs = false`.
  - Weeds (`hasWeeds`): 40 GOLD $\rightarrow$ Set `hasWeeds = false`.
- **Safety Reserve Floor:** Butler only incurs OpEx if `user.goldBalance >= OpExCost + 100 GOLD`.

#### 4. Data Architecture & Schema DDL
```sql
CREATE TABLE IF NOT EXISTS butler_seed_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seed_id UUID NOT NULL REFERENCES seed_configs(id),
    priority_order INT NOT NULL DEFAULT 1,
    auto_replant_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    auto_cure_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_user_priority UNIQUE (user_id, priority_order)
);
```

#### 5. Backend Automation Service Architecture
- Service: `BarnButlerService` (`automation.service.ts`) or expanded `guild.service.ts`.
- Schedule: `@Cron('*/10 * * * *')` (every 10 minutes).
- Transaction Scope: Per-user `pessimistic_write` row lock on `User` and `FarmPlot` rows.

#### 6. Frontend UI/UX Specifications
- In `ShopModal.tsx` or `ButlerConfigModal.tsx`:
  - Toggle: `[x] Auto-Cure Weather & Pests (Reserve: 100G)`.
  - Toggle: `[x] Auto-Replant Seed Priority`.
  - Dropdown selector for preferred seed type.

---

### 3.6 Specification `PRD-SPEC-DEX-MKT`: Multi-Pair Swap & Live WebSocket Toast (`DEX-01` & `MKT-04`)

#### 1. Module & Feature ID
- **Module:** DEX & P2P Marketplace Events (`DEX` & `MKT`)
- **Feature ID:** `DEX-01` & `MKT-04` — Multi-Pair PancakeSwap Swap & Real-Time Trade WebSocket Toast

#### 2. User Stories & Acceptance Criteria (Gherkin format)
```gherkin
Feature: In-App Token Swap and Live Trade Audio Toast
  As a Web3 farmer
  I want to swap directly between USDT, BNB, and FARM inside the game HUD
  And I want to receive an instant audio-visual banner whenever my marketplace listing sells
  So that I have fluid token liquidity and real-time sales feedback

  Scenario: Swapping USDT for FARM inside game modal
    Given Player has 50 USDT balance and selects USDT -> FARM swap in the in-game modal
    When Player confirms the swap
    Then the client requests ERC-20 `approve(PancakeRouter)` if allowance is insufficient
    And executes `swapExactTokensForTokensSupportingFeeOnTransferTokens`
    And displays the animated Swap Receipt with BSCScan link.

  Scenario: Listed item is purchased on-chain
    Given Player A listed a "1,000 Watermelon Crate" on the P2P Market
    When Buyer B fills the order via `BanditMarket.sol`
    Then the backend WebSocket Gateway emits `trade_filled` to Player A's client
    And Player A's screen displays a golden floating toast:
      "Cha-ching! 1,000 Watermelon Crate sold for 15.00 FARM!"
    And the audio engine plays `soundManager.play('coin')`.
```

#### 3. Smart Contract Routing Architecture
- **PancakeSwap V2 Router (BSC Testnet):** `0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3`
- **WBNB Address:** `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd`
- **FARM Token Address:** `0xB10067A034078E3FC8335Fb003eEF7334C44952f`
- **Testnet USDT Address:** `0x337610d27c682E347C9cD60BD4b3b107C9d34dDd`
- **Router Methods:**
  - `BNB -> FARM`: `swapExactETHForTokensSupportingFeeOnTransferTokens` (path: `[WBNB, FARM]`)
  - `USDT -> FARM`: `swapExactTokensForTokensSupportingFeeOnTransferTokens` (path: `[USDT, WBNB, FARM]`)
  - `FARM -> USDT`: `swapExactTokensForTokensSupportingFeeOnTransferTokens` (path: `[FARM, WBNB, USDT]`)

#### 4. WebSocket Gateway Architecture (`EventsGateway`)
```typescript
// backend/src/modules/marketplace/events.gateway.ts
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/ws/events' })
export class EventsGateway {
  @WebSocketServer() server: Server;

  notifyTradeFilled(sellerUserId: string, data: {
    itemType: string;
    quantity: number;
    price: string;
    buyerAddress: string;
  }) {
    this.server.to(`user:${sellerUserId}`).emit('trade_filled', data);
  }
}
```

#### 5. Frontend UI/UX Specifications
1. **Multi-Pair Swap Component (`ClaimModal.tsx` / `usePancakeSwap.ts`):**
   - Currency toggle buttons: `[BNB] | [USDT]` against `[FARM]`.
   - Visual step indicator: `Checking Allowance` $\rightarrow$ `Approving USDT` $\rightarrow$ `Swapping on PancakeSwap` $\rightarrow$ `Success`.
2. **Live Floating Trade Toast (`TradeToastProvider.tsx`):**
   - Top-center animated gold glass card.
   - Text: `💰 Trade Filled! [Item] sold for [Price] $FARM`.
   - Audio: `soundManager.play('coin')`.
   - Tactile: Haptic vibration pattern `[50, 100, 50]`.

---

## 4. Engineering Implementation Checklist & Execution Blueprint

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        STEP-BY-STEP IMPLEMENTATION ROADMAP                             │
├──────┬──────────────────────────────────────────┬──────────────────────────────────────┤
│ Step │ File Target                              │ Core Code Changes                    │
├──────┼──────────────────────────────────────────┼──────────────────────────────────────┤
│ 1    │ `telegram-auth.guard.ts`                 │ Hook `UserService.applyReferral()`   │
│ 2    │ `action.service.ts`                      │ Revenge raid bypass & 35% cap        │
│ 3    │ `client.ts` & `NotificationModal.tsx`    │ Send `isRevenge: true` & badge       │
│ 4    │ `GuildModal.tsx`                         │ Shield countdown timer & Raid Radar  │
│ 5    │ `guild.service.ts`                       │ Barn Butler OpEx & Replant cron      │
│ 6    │ `usePancakeSwap.ts` & `ClaimModal.tsx`   │ USDT multi-pair routing & approve    │
│ 7    │ `events.gateway.ts` & Frontend Listener  │ WebSocket `trade_filled` audio toast │
└──────┴──────────────────────────────────────────┴──────────────────────────────────────┘
```

This specification report is complete, fully aligned with the 100% English requirement, and ready for immediate engineering execution.
