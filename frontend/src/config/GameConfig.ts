// ================================================================
// GameConfig.ts — Barn Buddy Web3
// Single source of truth for all static game item data.
// Parsed from: Items Specification Document
// ================================================================

// ── Enums / Union Types ──────────────────────────────────────────

export type CropCategory = 'root' | 'grain' | 'fruit' | 'vine' | 'flower';
export type PetTier = 'low' | 'medium' | 'high' | 'legendary' | 'special';
export type FertilizerEffect = 'reduce_grow_time' | 'sabotage_weeds' | 'sabotage_bugs';
export type ToolId = 'hand' | 'hoe' | 'watering_can' | 'bug_spray' | 'weed_killer';

// ── Interfaces ───────────────────────────────────────────────────

export interface Crop {
  id: string;
  nameEn: string;
  nameVi: string;
  category: CropCategory;
  levelRequired: number;
  growTimeHours: number;
  growTimeSec: number;          // growTimeHours × 3600
  costGold: number;
  baseYield: number;
  iconKey: string;
  roi: number;                  // Math.round((baseYield - costGold) / costGold * 100)
  maxStealableGold: number;     // baseYield × 0.20  (20% steal cap)
  goldPerSteal: number;         // baseYield × 0.05  (5% per steal action)
}

export interface Fertilizer {
  id: string;
  nameEn: string;
  nameVi: string;
  effect: FertilizerEffect;
  effectValueHours: number | null;  // hours reduced from grow time (null for sabotage items)
  effectValueSec: number | null;    // effectValueHours × 3600
  costGold: number | null;          // null = free (costs energy only)
  energyCost: number | null;        // null = no energy cost
  iconKey: string;
  isSabotage: boolean;
}

export interface GuardPet {
  id: string;
  nameEn: string;
  nameVi: string;
  petType: string;          // snake_case key used in DB dog_type column
  tier: PetTier;
  defensePower: number;     // 0–100: percentage points subtracted from thief success rate
  biteRate: number;         // 0–100: % chance of biting / penalising thief on fail
  hasMaintenanceCost: boolean;
  iconKey: string;
  description: string;
}

export interface FarmingTool {
  id: ToolId;
  nameEn: string;
  nameVi: string;
  description: string;
  iconKey: string;
}

// ── Helper ───────────────────────────────────────────────────────

function makeCrop(
  nameEn: string,
  nameVi: string,
  category: CropCategory,
  levelRequired: number,
  growTimeHours: number,
  costGold: number,
  baseYield: number,
): Crop {
  const growTimeSec = growTimeHours * 3600;
  return {
    id: nameEn.toLowerCase().replace(/\s+/g, '_'),
    nameEn,
    nameVi,
    category,
    levelRequired,
    growTimeHours,
    growTimeSec,
    costGold,
    baseYield,
    iconKey: nameEn.toLowerCase().replace(/\s+/g, '_'),
    roi: Math.round(((baseYield - costGold) / costGold) * 100),
    maxStealableGold: Math.round(baseYield * 0.20),
    goldPerSteal: Math.round(baseYield * 0.05),
  };
}

// ── 1. Crops / Seeds ─────────────────────────────────────────────
// Source: Section 1 — Seeds & Crops System
// Columns: levelRequired | nameEn | nameVi | category | growTimeHours | costGold | baseYield

export const CROPS: Crop[] = [
  makeCrop('Turnip',       'Turnip',            'root',   0,  10, 120,  200),
  makeCrop('Carrot',       'Carrot',            'root',   1,  13, 370,  600),
  makeCrop('Corn',         'Corn',              'grain',  2,  15, 500,  850),
  makeCrop('Potato',       'Potato',            'root',   3,  18, 620, 1000),
  makeCrop('Eggplant',     'Eggplant',          'fruit',  4,  20, 750, 1200),
  makeCrop('Tomato',       'Tomato',            'fruit',  5,  22, 880, 1450),
  makeCrop('Pea',          'Pea',               'grain',  6,  26,1000, 1700),
  makeCrop('Watermelon',   'Watermelon',        'fruit',  7,  30,1150, 2000),
  makeCrop('Strawberry',   'Strawberry',        'fruit',  9,  35,1500, 2500),
  makeCrop('Pumpkin',      'Pumpkin',           'fruit', 11,  40,2000, 3300),
  makeCrop('Grape',        'Grape',             'vine',  13,  46,2500, 4200),
  makeCrop('Sunflower',    'Sunflower',         'flower',15,  52,3200, 5500),
  makeCrop('Rose',         'Rose',              'flower',18,  60,4000, 7000),
];

// ── 2. Farming Tools ─────────────────────────────────────────────
// Source: Section 2 — Farming Tools

export const FARMING_TOOLS: FarmingTool[] = [
  {
    id: 'hand',
    nameEn: 'Hand / Glove',
    nameVi: 'Hand / Glove',
    description: 'Default tool. Harvest your own crops or steal from neighbours.',
    iconKey: 'tool_hand',
  },
  {
    id: 'hoe',
    nameEn: 'Hoe / Trowel',
    nameVi: 'Hoe / Trowel',
    description: 'Till empty soil before planting, or remove a dead/dried-up crop.',
    iconKey: 'tool_hoe',
  },
  {
    id: 'watering_can',
    nameEn: 'Watering Can',
    nameVi: 'Watering Can',
    description: 'Water dry, cracked soil to restore it to plantable condition.',
    iconKey: 'tool_watering_can',
  },
  {
    id: 'bug_spray',
    nameEn: 'Bug Spray',
    nameVi: 'Bug Spray',
    description: 'Eradicate pest infestations planted by mischievous neighbours.',
    iconKey: 'tool_bug_spray',
  },
  {
    id: 'weed_killer',
    nameEn: 'Weed Killer',
    nameVi: 'Weed Killer',
    description: 'Eliminate weeds thrown into your farm by other players.',
    iconKey: 'tool_weed_killer',
  },
];

// ── 3. Fertilizers & Consumables ─────────────────────────────────
// Source: Section 3 — Consumables & Fertilizers

export const FERTILIZERS: Fertilizer[] = [
  {
    id: 'fertilizer_normal',
    nameEn: 'Normal Fertilizer',
    nameVi: 'Normal Fertilizer',
    effect: 'reduce_grow_time',
    effectValueHours: 1,
    effectValueSec: 3600,
    costGold: 50,
    energyCost: null,
    iconKey: 'fertilizer_normal',
    isSabotage: false,
  },
  {
    id: 'fertilizer_super',
    nameEn: 'Super Fertilizer',
    nameVi: 'Super Fertilizer',
    effect: 'reduce_grow_time',
    effectValueHours: 2.5,
    effectValueSec: 9000,
    costGold: 150,
    energyCost: null,
    iconKey: 'fertilizer_super',
    isSabotage: false,
  },
  {
    id: 'fertilizer_advanced',
    nameEn: 'Advanced Fertilizer',
    nameVi: 'Advanced Fertilizer',
    effect: 'reduce_grow_time',
    effectValueHours: 5,
    effectValueSec: 18000,
    costGold: 300,
    energyCost: null,
    iconKey: 'fertilizer_advanced',
    isSabotage: false,
  },
  {
    id: 'bag_of_weeds',
    nameEn: 'Bag of Weeds',
    nameVi: 'Bag of Weeds',
    effect: 'sabotage_weeds',
    effectValueHours: null,
    effectValueSec: null,
    costGold: null,     // free — costs energy
    energyCost: 15,
    iconKey: 'bag_weeds',
    isSabotage: true,
  },
  {
    id: 'bag_of_bugs',
    nameEn: 'Bag of Bugs',
    nameVi: 'Bag of Bugs',
    effect: 'sabotage_bugs',
    effectValueHours: null,
    effectValueSec: null,
    costGold: null,     // free — costs energy
    energyCost: 15,
    iconKey: 'bag_bugs',
    isSabotage: true,
  },
];

// ── 4. Guard Pets (NFTs) ─────────────────────────────────────────
// Source: Section 4 — Guard Animals
// defensePower: percentage points subtracted from thief's base success rate (80%)
// biteRate: used as the penalty multiplier on theft failure

export const GUARD_PETS: GuardPet[] = [
  {
    id: 'stray_dog',
    nameEn: 'Stray Dog',
    nameVi: 'Stray Dog',
    petType: 'stray_dog',
    tier: 'low',
    defensePower: 10,
    biteRate: 10,
    hasMaintenanceCost: false,
    iconKey: 'pet_stray_dog',
    description: 'A scrappy street dog. Low defense but better than nothing.',
  },
  {
    id: 'beagle',
    nameEn: 'Beagle',
    nameVi: 'Beagle',
    petType: 'beagle',
    tier: 'medium',
    defensePower: 25,
    biteRate: 25,
    hasMaintenanceCost: false,
    iconKey: 'pet_beagle',
    description: 'Loyal and alert. Reliable medium-tier farm protection.',
  },
  {
    id: 'husky',
    nameEn: 'Husky',
    nameVi: 'Husky',
    petType: 'husky',
    tier: 'high',
    defensePower: 40,
    biteRate: 40,
    hasMaintenanceCost: false,
    iconKey: 'pet_husky',
    description: 'Powerful and intimidating. Deters most casual thieves.',
  },
  {
    id: 'german_shepherd',
    nameEn: 'German Shepherd',
    nameVi: 'German Shepherd',
    petType: 'german_shepherd',
    tier: 'legendary',
    defensePower: 60,
    biteRate: 60,
    hasMaintenanceCost: false,
    iconKey: 'pet_german_shepherd',
    description: 'Elite guard dog. Only the most skilled raiders dare attempt entry.',
  },
  {
    id: 'elephant',
    nameEn: 'Elephant',
    nameVi: 'Elephant',
    petType: 'elephant',
    tier: 'special',
    defensePower: 80,
    biteRate: 80,
    hasMaintenanceCost: true,   // requires food maintenance cost
    iconKey: 'pet_elephant',
    description: 'Virtually impenetrable. Requires daily feed — but nothing gets past it.',
  },
];

// ── Lookup helpers ────────────────────────────────────────────────

export const CROP_BY_ID = Object.fromEntries(CROPS.map((c) => [c.id, c])) as Record<string, Crop>;
export const PET_BY_TYPE = Object.fromEntries(GUARD_PETS.map((p) => [p.petType, p])) as Record<string, GuardPet>;
export const CROP_BY_LEVEL = CROPS.reduce<Record<number, Crop[]>>((acc, c) => {
  (acc[c.levelRequired] ??= []).push(c);
  return acc;
}, {});

// Crops unlocked at or below a given player level
export function getUnlockedCrops(playerLevel: number): Crop[] {
  return CROPS.filter((c) => c.levelRequired <= playerLevel);
}
