-- ================================================================
-- init_items.sql — Barn Buddy Web3
-- Database: PostgreSQL 16+
-- Purpose : Initialise / re-seed all static item tables.
--
-- WARNING : The seed_configs block uses TRUNCATE ... CASCADE which
--           will delete all active farm_plots rows. Run on an empty
--           DB or during a scheduled maintenance window only.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- SECTION 1 — Extend seed_configs with spec fields
-- (Safe to re-run: IF NOT EXISTS guards prevent duplicate columns)
-- ────────────────────────────────────────────────────────────────

ALTER TABLE seed_configs
  ADD COLUMN IF NOT EXISTS level_required  INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category        VARCHAR(20)  NOT NULL DEFAULT 'root',
  ADD COLUMN IF NOT EXISTS grow_time_hours NUMERIC(5,1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS name_vi         VARCHAR(100);


-- ────────────────────────────────────────────────────────────────
-- SECTION 2 — Seed the crops
-- Columns: name, cost_gold, grow_time_sec, base_yield, icon_key,
--          level_required, category, grow_time_hours, name_vi
--
-- Derived values (read-only, not stored):
--   roi              = ROUND((base_yield - cost_gold) / cost_gold * 100)
--   max_stealable    = base_yield * 0.20
--   gold_per_steal   = base_yield * 0.05
-- ────────────────────────────────────────────────────────────────

TRUNCATE seed_configs RESTART IDENTITY CASCADE;

INSERT INTO seed_configs
  (name, cost_gold, grow_time_sec, base_yield, icon_key,
   level_required, category, grow_time_hours, name_vi)
VALUES
--  name            cost    grow_sec  yield  icon_key         lvl  category  hrs   name_vi
  ('Turnip',        120,    36000,    200,   'turnip',          0, 'root',   10.0, 'Củ cải trắng'),
  ('Carrot',        370,    46800,    600,   'carrot',          1, 'root',   13.0, 'Cà rốt'),
  ('Corn',          500,    54000,    850,   'corn',            2, 'grain',  15.0, 'Ngô / Bắp'),
  ('Potato',        620,    64800,   1000,   'potato',          3, 'root',   18.0, 'Khoai tây'),
  ('Eggplant',      750,    72000,   1200,   'eggplant',        4, 'fruit',  20.0, 'Cà tím'),
  ('Tomato',        880,    79200,   1450,   'tomato',          5, 'fruit',  22.0, 'Cà chua'),
  ('Pea',          1000,    93600,   1700,   'pea',             6, 'grain',  26.0, 'Đậu Hà Lan'),
  ('Watermelon',   1150,   108000,   2000,   'watermelon',      7, 'fruit',  30.0, 'Dưa hấu'),
  ('Strawberry',   1500,   126000,   2500,   'strawberry',      9, 'fruit',  35.0, 'Dâu tây'),
  ('Pumpkin',      2000,   144000,   3300,   'pumpkin',        11, 'fruit',  40.0, 'Bí ngô'),
  ('Grape',        2500,   165600,   4200,   'grape',          13, 'vine',   46.0, 'Nho'),
  ('Sunflower',    3200,   187200,   5500,   'sunflower',      15, 'flower', 52.0, 'Hoa Hướng Dương'),
  ('Rose',         4000,   216000,   7000,   'rose',           18, 'flower', 60.0, 'Hoa Hồng');


-- ────────────────────────────────────────────────────────────────
-- SECTION 3 — pet_configs (Guard Pet catalogue / NFT types)
-- Separate from nft_guard_dogs (which tracks per-user ownership).
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pet_configs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_type            VARCHAR(50) NOT NULL UNIQUE,   -- matches nft_guard_dogs.dog_type
  name_en             VARCHAR(100) NOT NULL,
  name_vi             VARCHAR(100) NOT NULL,
  tier                VARCHAR(20)  NOT NULL           -- low | medium | high | legendary | special
                        CHECK (tier IN ('low','medium','high','legendary','special')),
  defense_power       INTEGER      NOT NULL DEFAULT 0 CHECK (defense_power BETWEEN 0 AND 100),
  bite_rate           INTEGER      NOT NULL DEFAULT 0 CHECK (bite_rate BETWEEN 0 AND 100),
  has_maintenance_cost BOOLEAN     NOT NULL DEFAULT FALSE,
  icon_key            VARCHAR(100),
  description         TEXT,
  created_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Upsert so re-running is safe
INSERT INTO pet_configs
  (pet_type, name_en, name_vi, tier, defense_power, bite_rate, has_maintenance_cost, icon_key, description)
VALUES
  ('stray_dog',
   'Stray Dog',         'Chó cỏ',        'low',       10, 10, FALSE,
   'pet_stray_dog',
   'A scrappy street dog. Low defense but better than nothing.'),

  ('beagle',
   'Beagle',            'Chó Săn Thỏ',   'medium',    25, 25, FALSE,
   'pet_beagle',
   'Loyal and alert. Reliable medium-tier farm protection.'),

  ('husky',
   'Husky',             'Chó Husky',     'high',      40, 40, FALSE,
   'pet_husky',
   'Powerful and intimidating. Deters most casual thieves.'),

  ('german_shepherd',
   'German Shepherd',   'Chó Bec-giê',   'legendary', 60, 60, FALSE,
   'pet_german_shepherd',
   'Elite guard dog. Only the most skilled raiders dare attempt entry.'),

  ('elephant',
   'Elephant',          'Voi',           'special',   80, 80, TRUE,
   'pet_elephant',
   'Virtually impenetrable. Requires daily feed — but nothing gets past it.')

ON CONFLICT (pet_type) DO UPDATE SET
  name_en              = EXCLUDED.name_en,
  name_vi              = EXCLUDED.name_vi,
  tier                 = EXCLUDED.tier,
  defense_power        = EXCLUDED.defense_power,
  bite_rate            = EXCLUDED.bite_rate,
  has_maintenance_cost = EXCLUDED.has_maintenance_cost,
  icon_key             = EXCLUDED.icon_key,
  description          = EXCLUDED.description;


-- ────────────────────────────────────────────────────────────────
-- SECTION 4 — Fertilizers / Consumables reference table
-- ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consumable_configs (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  item_key            VARCHAR(50)  NOT NULL UNIQUE,
  name_en             VARCHAR(100) NOT NULL,
  name_vi             VARCHAR(100) NOT NULL,
  effect              VARCHAR(30)  NOT NULL
                        CHECK (effect IN ('reduce_grow_time','sabotage_weeds','sabotage_bugs')),
  effect_hours        NUMERIC(5,1),        -- NULL for sabotage items
  effect_sec          INTEGER,             -- effect_hours * 3600, NULL for sabotage
  cost_gold           NUMERIC(10,2),       -- NULL = free (costs energy)
  energy_cost         INTEGER,             -- NULL = no energy cost
  is_sabotage         BOOLEAN      NOT NULL DEFAULT FALSE,
  icon_key            VARCHAR(100),
  created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

INSERT INTO consumable_configs
  (item_key, name_en, name_vi, effect, effect_hours, effect_sec, cost_gold, energy_cost, is_sabotage, icon_key)
VALUES
  ('fertilizer_normal',
   'Normal Fertilizer',   'Phân bón thường',   'reduce_grow_time',  1.0,  3600, 50,   NULL, FALSE, 'fertilizer_normal'),

  ('fertilizer_super',
   'Super Fertilizer',    'Phân bón siêu cấp', 'reduce_grow_time',  2.5,  9000, 150,  NULL, FALSE, 'fertilizer_super'),

  ('fertilizer_advanced',
   'Advanced Fertilizer', 'Phân bón cao cấp',  'reduce_grow_time',  5.0, 18000, 300,  NULL, FALSE, 'fertilizer_advanced'),

  ('bag_of_weeds',
   'Bag of Weeds',        'Túi cỏ dại',        'sabotage_weeds',    NULL,  NULL, NULL, 15,   TRUE,  'bag_weeds'),

  ('bag_of_bugs',
   'Bag of Bugs',         'Túi sâu bọ',        'sabotage_bugs',     NULL,  NULL, NULL, 15,   TRUE,  'bag_bugs')

ON CONFLICT (item_key) DO UPDATE SET
  name_en      = EXCLUDED.name_en,
  name_vi      = EXCLUDED.name_vi,
  effect       = EXCLUDED.effect,
  effect_hours = EXCLUDED.effect_hours,
  effect_sec   = EXCLUDED.effect_sec,
  cost_gold    = EXCLUDED.cost_gold,
  energy_cost  = EXCLUDED.energy_cost,
  is_sabotage  = EXCLUDED.is_sabotage,
  icon_key     = EXCLUDED.icon_key;


-- ────────────────────────────────────────────────────────────────
-- SECTION 5 — Verification queries (run manually after seeding)
-- ────────────────────────────────────────────────────────────────

/*
SELECT
  name,
  level_required                                                AS lvl,
  grow_time_hours                                               AS hours,
  cost_gold,
  base_yield,
  ROUND((base_yield - cost_gold) / cost_gold * 100)            AS roi_pct,
  ROUND(base_yield * 0.20, 2)                                   AS max_stealable,
  ROUND(base_yield * 0.05, 2)                                   AS per_steal
FROM seed_configs
ORDER BY level_required;

SELECT pet_type, tier, defense_power, bite_rate, has_maintenance_cost
FROM pet_configs
ORDER BY defense_power;

SELECT item_key, effect, effect_hours, cost_gold, energy_cost
FROM consumable_configs
ORDER BY cost_gold NULLS LAST;
*/
