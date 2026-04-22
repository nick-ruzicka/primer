-- Primer seed data.
-- Anchor date: 2026-04-22. Derived dates (renewal countdowns, "X days ago")
-- are computed from that anchor.
--
-- Canonical numbers that deviate from prose in 01_DATASET_SPEC.md:
--   * Northstar Beauty contract_end set to 2026-08-17 (117 days from anchor)
--     instead of the spec's "Sep 12 2026" so the "Renewal (117 days out)"
--     narrative reads true as of the anchor.
--
-- Deliberate contradictions (validation agent targets):
--   * Northstar Beauty: Salesforce renewal forecast=Commit, Catalyst
--     renewal_forecast=Best Case, NetSuite ap_blocked=1 past_due=$18.5k,
--     Gong shows competitor + pricing pushback. Auto-renew=on despite
--     downward relationship trajectory.
--   * Kindred Pet Supply: Catalyst at-risk + adoption collapse, but
--     NetSuite current — different failure mode from Beauty.

PRAGMA foreign_keys = ON;

-- =============================================================
-- Section 1: accounts
-- Parent groups first (so child FKs resolve), then 10 billable accounts.
-- =============================================================

INSERT INTO accounts (account_id, account_name, parent_account_id, parent_account_name, industry, segment, arr_cents, employees, founded_year, hq_city, hq_state, stage, state, logo_color, logo_initial, owner_name, owner_role, created_at) VALUES
  ('northstar_group', 'Northstar Group', NULL, NULL, 'Consumer Brands', 'Portfolio', 0, 1800, 2011, 'Los Angeles', 'CA', NULL, NULL, '#1f2937', 'NG', 'Morgan Yu', 'Senior Account Executive', '2020-01-15'),
  ('quiver_group', 'Quiver Group', NULL, NULL, 'Consumer Brands', 'Portfolio', 0, 420, 2017, 'Austin', 'TX', NULL, NULL, '#1f2937', 'QG', 'Morgan Yu', 'Senior Account Executive', '2021-01-10');

INSERT INTO accounts (account_id, account_name, parent_account_id, parent_account_name, industry, segment, arr_cents, employees, founded_year, hq_city, hq_state, stage, state, logo_color, logo_initial, owner_name, owner_role, created_at) VALUES
  ('northstar_beauty', 'Northstar Beauty', 'northstar_group', 'Northstar Group', 'Beauty & Personal Care', 'DTC', 94000000, 260, 2015, 'Los Angeles', 'CA', 'Renewal', 'hot', '#e89899', 'NB', 'Morgan Yu', 'Senior Account Executive', '2023-03-15'),
  ('northstar_active', 'Northstar Active', 'northstar_group', 'Northstar Group', 'Athletic Apparel', 'DTC', 145000000, 340, 2013, 'Los Angeles', 'CA', 'Expansion', 'warm', '#4a90e2', 'NA', 'Morgan Yu', 'Senior Account Executive', '2022-11-02'),
  ('northstar_home', 'Northstar Home', 'northstar_group', 'Northstar Group', 'Home Goods', 'DTC', 68000000, 180, 2018, 'Los Angeles', 'CA', 'Just live', 'cool', '#8ba885', 'NH', 'Morgan Yu', 'Senior Account Executive', '2024-03-01'),
  ('tidepool_swim', 'Tidepool Swim Co.', NULL, NULL, 'Apparel & Swimwear', 'DTC', 0, 34, 2022, 'San Diego', 'CA', 'Discovery', 'warm', '#2fb5c3', 'TS', 'Morgan Yu', 'Senior Account Executive', '2026-03-28'),
  ('mellow_mattress', 'Mellow Mattress', NULL, NULL, 'Home & Sleep', 'DTC', 31000000, 95, 2016, 'Denver', 'CO', 'Expansion', 'warm', '#6b5b95', 'MM', 'Morgan Yu', 'Senior Account Executive', '2024-08-15'),
  ('ember_coffee', 'Ember Coffee Co.', NULL, NULL, 'Food & Beverage', 'DTC', 8000000, 42, 2019, 'Portland', 'OR', 'Renewal', 'cool', '#7a4e2d', 'EC', 'Morgan Yu', 'Senior Account Executive', '2024-07-23'),
  ('kindred_pet', 'Kindred Pet Supply', NULL, NULL, 'Pet & Animal Care', 'DTC', 14500000, 110, 2017, 'Seattle', 'WA', 'Renewal', 'hot', '#d4a574', 'KP', 'Morgan Yu', 'Senior Account Executive', '2023-06-09'),
  ('hearth_home', 'Hearth Home Goods', NULL, NULL, 'Home Goods', 'DTC', 18000000, 72, 2020, 'Minneapolis', 'MN', 'QBR prep', 'warm', '#d66f3a', 'HH', 'Morgan Yu', 'Senior Account Executive', '2025-12-22'),
  ('quiver_supplements', 'Quiver Supplements', 'quiver_group', 'Quiver Group', 'Health & Wellness', 'DTC', 52000000, 150, 2018, 'Austin', 'TX', 'Expansion', 'warm', '#6a994e', 'QS', 'Morgan Yu', 'Senior Account Executive', '2023-05-10'),
  ('quiver_rituals', 'Quiver Rituals', 'quiver_group', 'Quiver Group', 'Beauty & Wellness', 'DTC', 18000000, 60, 2023, 'Austin', 'TX', 'Expansion', 'warm', '#c57b57', 'QR', 'Morgan Yu', 'Senior Account Executive', '2025-02-15');

-- =============================================================
-- Section 2: salesforce_contracts
-- Prospects (Tidepool) have no contract row.
-- =============================================================

INSERT INTO salesforce_contracts (contract_id, account_id, plan_name, contract_start, contract_end, auto_renew, seats_used, seats_licensed) VALUES
  ('ctr_nb_001', 'northstar_beauty', 'Flows Pro + Journeys', '2025-08-17', '2026-08-17', 1, 14, 20),
  ('ctr_na_001', 'northstar_active', 'Flows Pro + Journeys + SMS Plus', '2025-10-01', '2026-09-30', 1, 22, 25),
  ('ctr_nh_001', 'northstar_home', 'Flows Pro', '2026-03-01', '2027-03-01', 1, 10, 12),
  ('ctr_mm_001', 'mellow_mattress', 'Flows Pro', '2024-08-15', '2026-08-15', 1, 6, 8),
  ('ctr_ec_001', 'ember_coffee', 'Flows Starter', '2024-07-23', '2026-07-23', 1, 3, 4),
  ('ctr_kp_001', 'kindred_pet', 'Flows Pro', '2023-06-09', '2026-06-09', 1, 5, 8),
  ('ctr_hh_001', 'hearth_home', 'Flows Pro', '2025-12-22', '2026-12-22', 1, 6, 8),
  ('ctr_qs_001', 'quiver_supplements', 'Flows Pro + Journeys', '2025-05-10', '2026-05-10', 1, 11, 14),
  ('ctr_qr_001', 'quiver_rituals', 'Flows Starter', '2025-02-15', '2026-02-14', 1, 4, 6);
-- Quiver Rituals already in an auto-renewed term beginning 2026-02-15; represented as two adjacent rows would be overkill for V1, keeping the original term end to show renewal already processed.

-- =============================================================
-- Section 3: salesforce_contacts
-- 2-4 per billable account. Prospects get 2 stakeholders, no exec sponsor.
-- =============================================================

-- Northstar Beauty
INSERT INTO salesforce_contacts (contact_id, account_id, name, title, email, role, tenure_months, linkedin_url) VALUES
  ('con_nb_priya',  'northstar_beauty', 'Priya Shah',   'VP Marketing',                  'priya.shah@northstargroup.com',   'Champion',          28,   'https://www.linkedin.com/in/priyashah-nb'),
  ('con_nb_sam',    'northstar_beauty', 'Sam Rivera',   'CMO, Northstar Group',          'sam.rivera@northstargroup.com',   'Executive Sponsor', 54,   'https://www.linkedin.com/in/sam-rivera-ng'),
  ('con_nb_maya',   'northstar_beauty', 'Maya Chen',    'Director of Lifecycle',         'maya.chen@northstargroup.com',    'Influencer',        14,   'https://www.linkedin.com/in/mayachen-lifecycle'),
  ('con_nb_carla',  'northstar_beauty', 'Carla Reyes',  'CFO, Northstar Group',          'carla.reyes@northstargroup.com',  'Blocker',           1,    'https://www.linkedin.com/in/carlareyes-cfo');

-- Northstar Active
INSERT INTO salesforce_contacts (contact_id, account_id, name, title, email, role, tenure_months, linkedin_url) VALUES
  ('con_na_avery',  'northstar_active', 'Avery Collins', 'Head of Growth',               'avery.collins@northstargroup.com','Decision Maker',    18,  'https://www.linkedin.com/in/averycollins'),
  ('con_na_sam',    'northstar_active', 'Sam Rivera',    'CMO, Northstar Group',         'sam.rivera@northstargroup.com',   'Executive Sponsor', 54,  'https://www.linkedin.com/in/sam-rivera-ng'),
  ('con_na_jules',  'northstar_active', 'Jules Okafor',  'Senior Manager, CRM',          'jules.okafor@northstargroup.com', 'Champion',          24,  'https://www.linkedin.com/in/julesokafor');

-- Northstar Home
INSERT INTO salesforce_contacts (contact_id, account_id, name, title, email, role, tenure_months, linkedin_url) VALUES
  ('con_nh_riley',  'northstar_home', 'Riley Brooks',   'Senior Lifecycle Manager',      'riley.brooks@northstargroup.com', 'Decision Maker',    9,   'https://www.linkedin.com/in/rileybrooks-lifecycle'),
  ('con_nh_sam',    'northstar_home', 'Sam Rivera',     'CMO, Northstar Group',          'sam.rivera@northstargroup.com',   'Executive Sponsor', 54,  'https://www.linkedin.com/in/sam-rivera-ng'),
  ('con_nh_dani',   'northstar_home', 'Dani Park',      'Email Marketing Specialist',    'dani.park@northstargroup.com',    'Influencer',        6,   'https://www.linkedin.com/in/danipark-email');

-- Tidepool (prospect — 2 stakeholders, no exec sponsor yet)
INSERT INTO salesforce_contacts (contact_id, account_id, name, title, email, role, tenure_months, linkedin_url) VALUES
  ('con_ts_casey',  'tidepool_swim', 'Casey Lim',      'CMO',                           'casey@tidepoolswim.com',          'Decision Maker',    3,   'https://www.linkedin.com/in/caseylim-cmo'),
  ('con_ts_ren',    'tidepool_swim', 'Ren Patel',      'Head of Ecommerce',             'ren@tidepoolswim.com',            'Influencer',        7,   'https://www.linkedin.com/in/renpatel-ecom');

-- Mellow Mattress
INSERT INTO salesforce_contacts (contact_id, account_id, name, title, email, role, tenure_months, linkedin_url) VALUES
  ('con_mm_darren', 'mellow_mattress', 'Darren Cole',   'Director of Ecommerce',        'darren@mellowmattress.com',       'Decision Maker',    24,  'https://www.linkedin.com/in/darrencole-ecom'),
  ('con_mm_nia',    'mellow_mattress', 'Nia Okoye',     'VP Marketing',                 'nia@mellowmattress.com',          'Executive Sponsor', 30,  'https://www.linkedin.com/in/niaokoye'),
  ('con_mm_sasha',  'mellow_mattress', 'Sasha Brent',   'Lifecycle Specialist',         'sasha@mellowmattress.com',        'Champion',          18,  'https://www.linkedin.com/in/sashabrent-lifecycle');

-- Ember Coffee
INSERT INTO salesforce_contacts (contact_id, account_id, name, title, email, role, tenure_months, linkedin_url) VALUES
  ('con_ec_sloane', 'ember_coffee', 'Sloane Kim',     'Marketing Manager',             'sloane@embercoffee.co',           'Decision Maker',    14,  'https://www.linkedin.com/in/sloanekim-mkt'),
  ('con_ec_ian',    'ember_coffee', 'Ian Wexler',     'Founder',                       'ian@embercoffee.co',              'Executive Sponsor', 84,  'https://www.linkedin.com/in/ianwexler-ember');

-- Kindred Pet Supply
INSERT INTO salesforce_contacts (contact_id, account_id, name, title, email, role, tenure_months, linkedin_url) VALUES
  ('con_kp_jamie',  'kindred_pet', 'Jamie Park',      'VP Marketing',                  'jamie.park@kindredpet.com',       'Decision Maker',    2,   'https://www.linkedin.com/in/jamiepark-vpmkt'),
  ('con_kp_rowan',  'kindred_pet', 'Rowan Sato',      'Former VP Marketing (left)',    'rowan.sato@kindredpet.com',       'Influencer',        0,   'https://www.linkedin.com/in/rowansato'),
  ('con_kp_lee',    'kindred_pet', 'Lee Avery',       'Director of Retention',         'lee.avery@kindredpet.com',        'Champion',          22,  'https://www.linkedin.com/in/leeavery-retention'),
  ('con_kp_marta',  'kindred_pet', 'Marta Ruiz',      'COO',                           'marta.ruiz@kindredpet.com',       'Executive Sponsor', 48,  'https://www.linkedin.com/in/martaruiz-coo');

-- Hearth Home Goods
INSERT INTO salesforce_contacts (contact_id, account_id, name, title, email, role, tenure_months, linkedin_url) VALUES
  ('con_hh_mira',   'hearth_home', 'Mira Okonkwo',    'Director of Growth',            'mira@hearthhomegoods.com',        'Decision Maker',    4,   'https://www.linkedin.com/in/miraokonkwo-growth'),
  ('con_hh_theo',   'hearth_home', 'Theo Lansing',    'CEO',                           'theo@hearthhomegoods.com',        'Executive Sponsor', 60,  'https://www.linkedin.com/in/theolansing-ceo'),
  ('con_hh_gina',   'hearth_home', 'Gina Mehta',      'Email Marketing Manager',       'gina@hearthhomegoods.com',        'Champion',          4,   'https://www.linkedin.com/in/ginamehta-email');

-- Quiver Supplements
INSERT INTO salesforce_contacts (contact_id, account_id, name, title, email, role, tenure_months, linkedin_url) VALUES
  ('con_qs_taylor', 'quiver_supplements', 'Taylor Reyes', 'VP Brand, Quiver Group',    'taylor.reyes@quiverbrands.com',   'Decision Maker',    36,  'https://www.linkedin.com/in/taylorreyes-quiver'),
  ('con_qs_kay',    'quiver_supplements', 'Kay Nakamura', 'CEO, Quiver Group',         'kay.nakamura@quiverbrands.com',   'Executive Sponsor', 96,  'https://www.linkedin.com/in/kaynakamura-quiver'),
  ('con_qs_owen',   'quiver_supplements', 'Owen Blake',   'Senior Retention Manager',  'owen.blake@quiverbrands.com',     'Champion',          20,  'https://www.linkedin.com/in/owenblake-retention');

-- Quiver Rituals (shares Taylor Reyes as DM)
INSERT INTO salesforce_contacts (contact_id, account_id, name, title, email, role, tenure_months, linkedin_url) VALUES
  ('con_qr_taylor', 'quiver_rituals', 'Taylor Reyes',   'VP Brand, Quiver Group',      'taylor.reyes@quiverbrands.com',   'Decision Maker',    36,  'https://www.linkedin.com/in/taylorreyes-quiver'),
  ('con_qr_kay',    'quiver_rituals', 'Kay Nakamura',   'CEO, Quiver Group',           'kay.nakamura@quiverbrands.com',   'Executive Sponsor', 96,  'https://www.linkedin.com/in/kaynakamura-quiver'),
  ('con_qr_priya',  'quiver_rituals', 'Priya Sanghvi',  'Brand Manager, Rituals',      'priya.sanghvi@quiverbrands.com',  'Champion',          10,  'https://www.linkedin.com/in/priyasanghvi-rituals');

-- =============================================================
-- Section 4: salesforce_opportunities
-- Mix of open + recently closed per account.
-- =============================================================

-- Northstar Beauty: renewal opp (Commit, drives the contradiction with Catalyst), two expansion opps, one lost.
INSERT INTO salesforce_opportunities (opp_id, account_id, opp_name, stage, amount_cents, close_date, forecast_category, status, created_at) VALUES
  ('opp_nb_renewal', 'northstar_beauty', 'Renewal FY27',                   'Negotiation',  94000000, '2026-08-17', 'Commit',    'open',        '2026-02-20'),
  ('opp_nb_loyalty', 'northstar_beauty', 'Loyalty messaging expansion',    'Proposal',     18000000, '2026-06-30', 'Best Case', 'open',        '2026-01-18'),
  ('opp_nb_mobile',  'northstar_beauty', 'Mobile app opt-in pilot',        'Discovery',     6000000, '2026-07-15', 'Pipeline',  'open',        '2026-03-22'),
  ('opp_nb_ai',      'northstar_beauty', 'AI Pro pilot',                   'Closed Lost',  22000000, '2026-02-28', 'Omitted',   'closed_lost', '2025-11-14');

-- Northstar Active: two open expansions.
INSERT INTO salesforce_opportunities (opp_id, account_id, opp_name, stage, amount_cents, close_date, forecast_category, status, created_at) VALUES
  ('opp_na_identity', 'northstar_active', 'Identity add-on',               'Evaluation',   24000000, '2026-06-15', 'Best Case', 'open',        '2026-02-02'),
  ('opp_na_sms',      'northstar_active', 'SMS volume tier upgrade',       'Negotiation',   8500000, '2026-05-05', 'Commit',    'open',        '2026-01-30');

-- Northstar Home: just renewed, no open opps.
INSERT INTO salesforce_opportunities (opp_id, account_id, opp_name, stage, amount_cents, close_date, forecast_category, status, created_at) VALUES
  ('opp_nh_renewal_closed', 'northstar_home', 'Renewal FY26', 'Closed Won', 68000000, '2026-02-28', 'Closed', 'closed_won', '2025-11-10');

-- Tidepool: prospect, single discovery opp.
INSERT INTO salesforce_opportunities (opp_id, account_id, opp_name, stage, amount_cents, close_date, forecast_category, status, created_at) VALUES
  ('opp_ts_initial', 'tidepool_swim', 'Initial platform', 'Discovery', 22000000, '2026-07-30', 'Pipeline', 'open', '2026-04-01');

-- Mellow Mattress: RCS expansion.
INSERT INTO salesforce_opportunities (opp_id, account_id, opp_name, stage, amount_cents, close_date, forecast_category, status, created_at) VALUES
  ('opp_mm_rcs', 'mellow_mattress', 'RCS channel add-on', 'Proposal', 9600000, '2026-06-10', 'Best Case', 'open', '2026-03-05');

-- Ember Coffee: no open opps (simple renewal).
-- (no rows)

-- Kindred: closed lost loyalty.
INSERT INTO salesforce_opportunities (opp_id, account_id, opp_name, stage, amount_cents, close_date, forecast_category, status, created_at) VALUES
  ('opp_kp_loyalty', 'kindred_pet', 'Loyalty', 'Closed Lost', 4500000, '2026-03-18', 'Omitted', 'closed_lost', '2025-12-02');

-- Hearth Home Goods: none (too early).
-- (no rows)

-- Quiver Supplements: expansion opp to test a loyalty module.
INSERT INTO salesforce_opportunities (opp_id, account_id, opp_name, stage, amount_cents, close_date, forecast_category, status, created_at) VALUES
  ('opp_qs_loyalty', 'quiver_supplements', 'Loyalty expansion', 'Evaluation', 7500000, '2026-06-20', 'Best Case', 'open', '2026-02-12');

-- Quiver Rituals: SMS add-on.
INSERT INTO salesforce_opportunities (opp_id, account_id, opp_name, stage, amount_cents, close_date, forecast_category, status, created_at) VALUES
  ('opp_qr_sms', 'quiver_rituals', 'SMS add-on', 'Evaluation', 4000000, '2026-06-30', 'Best Case', 'open', '2026-03-01');

-- =============================================================
-- Section 5: snowflake_usage
-- One row per customer account. Prospect (Tidepool) gets a NULL-filled row.
-- =============================================================

INSERT INTO snowflake_usage (account_id, sends_30d, sends_prior_30d, flows_active, flows_provisioned, flows_paused_this_period, health_score, health_score_prior, adoption_score, adoption_group_avg, last_send_date) VALUES
  ('northstar_beauty',    3100000,  3780000, 9,  20, 3, 61, 74, 61, 74, '2026-04-20'),
  ('northstar_active',    6200000,  5440000, 18, 20, 0, 82, 78, 82, 74, '2026-04-21'),
  ('northstar_home',      2100000,  2050000, 14, 16, 0, 74, 72, 74, 74, '2026-04-21'),
  ('tidepool_swim',       NULL,     NULL,    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('mellow_mattress',     1800000,  1476000, 15, 15, 0, 78, 72, 78, NULL, '2026-04-21'),
  ('ember_coffee',        540000,   530000,  5,  5,  0, 71, 70, 71, NULL, '2026-04-20'),
  ('kindred_pet',         720000,   1220000, 4,  12, 8, 48, 81, 48, NULL, '2026-04-19'),
  ('hearth_home',         920000,   180000,  7,  8,  0, 68, 54, 68, NULL, '2026-04-21'),
  ('quiver_supplements',  2400000,  2035000, 12, 14, 0, 79, 76, 79, 74, '2026-04-21'),
  ('quiver_rituals',      410000,   330000,  5,  6,  0, 70, 64, 70, 74, '2026-04-20');

-- =============================================================
-- Section 6: catalyst_health
-- Prospect (Tidepool) gets a row with most fields NULL and a prospect note.
-- =============================================================

INSERT INTO catalyst_health (account_id, relationship_status, status_since, relationship_score, relationship_score_prior, renewal_forecast, expansion_readiness, last_executive_touch, notes) VALUES
  ('northstar_beauty',   'Watchlist', '2026-03-28', 61, 74, 'Best Case', 'Low',    '2026-02-14', 'Moved to Watchlist after Q1 adoption dip and Apr 18 AP block. Priya engaged but exec sponsor signal is mixed.'),
  ('northstar_active',   'Healthy',   '2025-09-02', 82, 78, 'Commit',    'High',   '2026-04-04', 'Adoption leader in the Northstar portfolio. Active asking about Identity add-on.'),
  ('northstar_home',     'Healthy',   '2026-03-02', 74, 72, 'Commit',    'Medium', '2026-03-15', 'Just renewed. Steady adoption; Riley new in seat but engaged.'),
  ('tidepool_swim',      NULL,        NULL,         NULL, NULL, NULL,     NULL,     NULL,        'Prospect — no relationship history yet. Discovery call held 2026-04-15.'),
  ('mellow_mattress',    'Healthy',   '2025-06-01', 78, 72, 'Commit',    'High',   '2026-04-08', 'Adoption saturated (15/15 flows active). RCS expansion in flight.'),
  ('ember_coffee',       'Healthy',   '2025-08-15', 71, 70, 'Commit',    'Low',    '2026-03-10', 'Small but steady. No expansion angle near-term.'),
  ('kindred_pet',        'At Risk',   '2026-03-01', 48, 81, 'At Risk',   'None',   '2025-12-16', 'New VP Marketing (Jamie Park) candid about evaluating consolidation. Exec sponsor touch stale (127 days).'),
  ('hearth_home',        'Healthy',   '2025-12-22', 68, 54, 'Commit',    'Medium', '2026-04-10', 'New customer, ramping on plan. First QBR in 5 days.'),
  ('quiver_supplements', 'Healthy',   '2024-05-10', 79, 76, 'Commit',    'High',   '2026-04-02', 'Anchor account in Quiver portfolio. Driving Rituals ramp.'),
  ('quiver_rituals',     'Healthy',   '2025-04-15', 70, 64, 'Commit',    'Medium', '2026-04-02', 'Newer brand, steady ramp. Shares DM with Supplements.');

-- =============================================================
-- Section 7: netsuite_billing
-- Prospect (Tidepool) has no billing row — no billable activity.
-- =============================================================

INSERT INTO netsuite_billing (account_id, current_balance_cents, past_due_balance_cents, past_due_days, last_invoice_number, last_invoice_amount_cents, last_invoice_date, ap_blocked, ap_blocked_date, ap_blocked_reason) VALUES
  ('northstar_beauty',   1850000, 1850000, 41, 'INV-2026-0387', 1850000, '2026-03-12', 1, '2026-04-18', 'Finance marked account as blocked for further invoicing pending resolution'),
  ('northstar_active',   0,       0,       0,  'INV-2026-0412', 2916667, '2026-04-01', 0, NULL, NULL),
  ('northstar_home',     0,       0,       0,  'INV-2026-0301', 5666667, '2026-03-01', 0, NULL, NULL),
  ('mellow_mattress',    0,       0,       0,  'INV-2026-0398', 2583333, '2026-03-15', 0, NULL, NULL),
  ('ember_coffee',       0,       0,       0,  'INV-2026-0372', 666667,  '2026-03-23', 0, NULL, NULL),
  ('kindred_pet',        0,       0,       0,  'INV-2026-0404', 1208333, '2026-04-09', 0, NULL, NULL),
  ('hearth_home',        0,       0,       0,  'INV-2026-0365', 1500000, '2026-03-22', 0, NULL, NULL),
  ('quiver_supplements', 0,       0,       0,  'INV-2026-0391', 4333333, '2026-04-10', 0, NULL, NULL),
  ('quiver_rituals',     0,       0,       0,  'INV-2026-0378', 1500000, '2026-03-15', 0, NULL, NULL);

-- =============================================================
-- Section 8: gong_calls
-- 2-4 per account across the last 90 days. Tidepool gets 1 (discovery only).
-- Summaries written as natural prose (2-3 sentences), not keyword lists.
-- =============================================================

-- Northstar Beauty
INSERT INTO gong_calls (call_id, account_id, call_date, call_type, duration_minutes, summary, competitor_mentioned, competitor_name, competitor_mention_count, pricing_pushback, sentiment, followups, risks_mentioned) VALUES
  ('call_nb_qbr_0411',   'northstar_beauty', '2026-04-11', 'QBR',       60, 'Priya walked through Q1 performance and flagged that flows adoption is still hovering around sixty percent of provisioned seats. She referenced Active Loyalty twice as a lower-cost alternative her team has been evaluating, and pushed back on pricing when we mentioned the Q3 renewal discussion — she asked whether we could hold their current rate given limited bandwidth on her side to fully utilize seats. Sam Rivera joined for the last twenty minutes and said any renewal conversation needs a clear resourcing story from .', 1, 'Active Loyalty', 2, 1, 'mixed',    'Share benchmarking data on sibling accounts | Schedule flows activation workshop with Priya''s team | Revisit pricing options ahead of renewal | Loop in CX best practices team', 'flat adoption | billing friction | limited client resourcing | competitor evaluation'),
  ('call_nb_checkin_0304','northstar_beauty', '2026-03-04', 'Check-in',  30, 'Monthly check-in. Priya noted the lifecycle team is short-staffed with two open roles and asked about a template library we could share to unblock them in the interim. No immediate concerns raised, but the energy felt lower than prior months and she was more transactional than usual.', 0, NULL, 0, 0, 'neutral',  'Share template library | Confirm which flows we can pre-build', 'team resourcing | lower engagement energy'),
  ('call_nb_roadmap_0207','northstar_beauty', '2026-02-07', 'Check-in',  45, 'Forward-looking roadmap session. Priya was enthusiastic about the Journeys improvements shipping in Q2 and wanted early access for her team. No pricing or competitor concerns surfaced; tone was genuinely positive.', 0, NULL, 0, 0, 'positive', 'Confirm Journeys early access list | Send Q2 roadmap deck', '');

-- Northstar Active
INSERT INTO gong_calls (call_id, account_id, call_date, call_type, duration_minutes, summary, competitor_mentioned, competitor_name, competitor_mention_count, pricing_pushback, sentiment, followups, risks_mentioned) VALUES
  ('call_na_expansion_0414', 'northstar_active', '2026-04-14', 'Expansion', 45, 'Avery opened by asking how Identity add-on would integrate with their existing CDP. Call was high-energy; she walked through a Q3 activation plan that assumes Identity is live by July. Jules jumped in with implementation questions and flagged the SMS volume tier upgrade as a parallel need.', 0, NULL, 0, 0, 'positive', 'Send Identity technical brief | Scope SMS tier upgrade timing', ''),
  ('call_na_qbr_0316',       'northstar_active', '2026-03-16', 'QBR',       60, 'Strong QBR. Active hit all adoption milestones and Avery shared internal stats showing email revenue up 14 percent QoQ. No risks raised; conversation pivoted quickly into expansion planning for Identity.', 0, NULL, 0, 0, 'positive', 'Draft Identity SOW | Share QBR deck with Sam Rivera', '');

-- Northstar Home
INSERT INTO gong_calls (call_id, account_id, call_date, call_type, duration_minutes, summary, competitor_mentioned, competitor_name, competitor_mention_count, pricing_pushback, sentiment, followups, risks_mentioned) VALUES
  ('call_nh_kickoff_0305',   'northstar_home', '2026-03-05', 'Kickoff',  45, 'Post-renewal kickoff with Riley. Walked through the expanded Flows Pro scope and set check-in cadence for the first 90 days. Riley is new in seat and asked thoughtful questions about measurement; we committed to a reporting template.', 0, NULL, 0, 0, 'positive', 'Send reporting template | Schedule 30-day check-in', ''),
  ('call_nh_checkin_0408',   'northstar_home', '2026-04-08', 'Check-in', 30, 'Thirty-day post-renewal check-in. Sends are steady at 2.1M, fourteen of sixteen flows active, no issues. Riley wants to discuss a newsletter audit next month.', 0, NULL, 0, 0, 'positive', 'Schedule newsletter audit for May', '');

-- Tidepool (prospect — one discovery call)
INSERT INTO gong_calls (call_id, account_id, call_date, call_type, duration_minutes, summary, competitor_mentioned, competitor_name, competitor_mention_count, pricing_pushback, sentiment, followups, risks_mentioned) VALUES
  ('call_ts_disco_0415', 'tidepool_swim', '2026-04-15', 'Discovery', 45, 'First discovery call with Casey and Ren. They closed an $8M Series A two weeks ago and are building out lifecycle from scratch — currently running Mailchimp plus a homegrown SMS script. Casey asked specifically about sign-up unit performance and list growth benchmarks for similar-stage DTC brands; Ren probed on pricing flexibility given they''re pre-profit.', 0, NULL, 0, 1, 'positive', 'Send sign-up unit benchmarks | Share starter-tier pricing sheet | Intro to implementation team', 'pre-profit stage | pricing sensitivity');

-- Mellow Mattress
INSERT INTO gong_calls (call_id, account_id, call_date, call_type, duration_minutes, summary, competitor_mentioned, competitor_name, competitor_mention_count, pricing_pushback, sentiment, followups, risks_mentioned) VALUES
  ('call_mm_expansion_0410', 'mellow_mattress', '2026-04-10', 'Expansion', 45, 'Darren wants to add RCS as their next channel. He walked through projected volume and asked how we handle opt-in flows. Very clear buying signal; ask was when we can start.', 0, NULL, 0, 0, 'positive', 'Send RCS proposal by Friday | Confirm launch timeline', ''),
  ('call_mm_checkin_0311',   'mellow_mattress', '2026-03-11', 'Check-in',  30, 'Standard monthly check-in. Sends are up 22 percent MoM, all 15 flows active. Darren mentioned he''d want to explore RCS next quarter.', 0, NULL, 0, 0, 'positive', 'Prepare RCS primer deck', '');

-- Ember Coffee
INSERT INTO gong_calls (call_id, account_id, call_date, call_type, duration_minutes, summary, competitor_mentioned, competitor_name, competitor_mention_count, pricing_pushback, sentiment, followups, risks_mentioned) VALUES
  ('call_ec_checkin_0325', 'ember_coffee', '2026-03-25', 'Check-in', 30, 'Quiet check-in. Sloane reported everything is steady; no product blockers, no team changes. She confirmed they''ll renew at current tier in July.', 0, NULL, 0, 0, 'positive', 'Send renewal paperwork in June', '');

-- Kindred Pet Supply
INSERT INTO gong_calls (call_id, account_id, call_date, call_type, duration_minutes, summary, competitor_mentioned, competitor_name, competitor_mention_count, pricing_pushback, sentiment, followups, risks_mentioned) VALUES
  ('call_kp_intro_0408',   'kindred_pet', '2026-04-08', 'Check-in',  45, 'First call with Jamie Park since she took over as VP Marketing. She was candid: team is reviewing whether they''re using  to its full potential, and if not they''ll consolidate onto their ESP. She asked for a 60-day plan to show material improvement on flows activation.', 0, NULL, 0, 0, 'negative', 'Draft 60-day activation plan | Rebuild relationship with Jamie | Brief COO Marta Ruiz', 'consolidation risk | flows adoption collapse | exec sponsor stale'),
  ('call_kp_checkin_0305', 'kindred_pet', '2026-03-05', 'Check-in',  30, 'Bridging call after Rowan Sato''s departure. Lee Avery (retention director) ran the call and flagged that sends have dropped sharply during the transition. She asked for patience while leadership settles.', 0, NULL, 0, 0, 'neutral',  'Wait for new VP introduction | Monitor sends weekly', 'DM turnover | sends collapse');

-- Hearth Home Goods
INSERT INTO gong_calls (call_id, account_id, call_date, call_type, duration_minutes, summary, competitor_mentioned, competitor_name, competitor_mention_count, pricing_pushback, sentiment, followups, risks_mentioned) VALUES
  ('call_hh_kickoff_1222', 'hearth_home', '2025-12-22', 'Kickoff',  60, 'Kickoff with Mira and Theo. Walked through implementation plan for the first 90 days and set measurable goals: 500k sends by month three, 80% of priority flows active by end of Q1. Energy was high; Theo emphasized the CEO''s personal interest in nailing lifecycle this year.', 0, NULL, 0, 0, 'positive', 'Stand up implementation plan | Schedule first QBR for April', ''),
  ('call_hh_checkin_0212', 'hearth_home', '2026-02-12', 'Check-in', 30, 'Sixty-day check-in. Ahead of plan on sends (400k vs 300k goal) and flows rollout. Mira wants to discuss adding SMS channel in Q3.', 0, NULL, 0, 0, 'positive', 'Prep SMS primer for QBR | Send benchmarks', ''),
  ('call_hh_checkin_0402', 'hearth_home', '2026-04-02', 'Check-in', 30, 'Pre-QBR sync. 920k sends this month, seven of eight flows active. Mira confirmed QBR date and asked what proof points she should bring to the CEO.', 0, NULL, 0, 0, 'positive', 'Build CEO-ready QBR slide | Finalize agenda', '');

-- Quiver Supplements
INSERT INTO gong_calls (call_id, account_id, call_date, call_type, duration_minutes, summary, competitor_mentioned, competitor_name, competitor_mention_count, pricing_pushback, sentiment, followups, risks_mentioned) VALUES
  ('call_qs_expansion_0407', 'quiver_supplements', '2026-04-07', 'Expansion', 45, 'Taylor opened the door on a loyalty module pilot. She framed it as proof of concept before rolling across Quiver Group brands, including Rituals. Strong exec buy-in; Kay Nakamura joined briefly to reinforce priority.', 0, NULL, 0, 0, 'positive', 'Scope loyalty pilot | Price pilot separately from production | Confirm Rituals rollout timing', ''),
  ('call_qs_qbr_0220',       'quiver_supplements', '2026-02-20', 'QBR',       60, 'Strong QBR. Sends up 18 percent YoY, health score holding in high seventies, and Taylor is visibly enthusiastic about the platform. Conversation turned quickly to portfolio-level expansion.', 0, NULL, 0, 0, 'positive', 'Schedule portfolio planning session', '');

-- Quiver Rituals
INSERT INTO gong_calls (call_id, account_id, call_date, call_type, duration_minutes, summary, competitor_mentioned, competitor_name, competitor_mention_count, pricing_pushback, sentiment, followups, risks_mentioned) VALUES
  ('call_qr_checkin_0401', 'quiver_rituals', '2026-04-01', 'Check-in', 30, 'Monthly check-in with Priya Sanghvi. Rituals is ramping steadily and she is excited about the SMS add-on under evaluation. Taylor joined briefly to align on Supplements loyalty pilot applying to Rituals next.', 0, NULL, 0, 0, 'positive', 'Send SMS evaluation plan | Loop in loyalty pilot timing', '');

-- =============================================================
-- Section 9: external_signals
-- 3-6 per account. Prospects (Tidepool) get 2-3 focused on funding/hiring.
-- =============================================================

-- Northstar Beauty
INSERT INTO external_signals (signal_id, account_id, signal_type, source, title, snippet, url, signal_date, reliability) VALUES
  ('sig_nb_cfo',      'northstar_beauty', 'executive_change', 'PR Newswire',   'Northstar Group names Carla Reyes CFO',                                                  'Consumer portfolio Northstar Group today announced the appointment of Carla Reyes as Chief Financial Officer, effective immediately. Reyes joins from Luma Brands where she led a cost transformation program.', 'https://example.com/northstar-cfo-appoints', '2026-04-02', 'high'),
  ('sig_nb_linkedin', 'northstar_beauty', 'social_post',      'LinkedIn',      'Priya Shah on vendor overlap in the lifecycle stack',                                    'Frustrated with how many overlapping tools we run for lifecycle. Thinking hard about consolidation in 2026 — would love recommendations for teams that''ve done this well.',                                      'https://www.linkedin.com/posts/priyashah-overlap',   '2026-04-09', 'high'),
  ('sig_nb_podcast',  'northstar_beauty', 'podcast',          'DTC Pod',       'DTC Pod ep. 412 — Priya Shah on stitched-together lifecycle',                            'In a wide-ranging conversation, Priya talks about the pain of running four different lifecycle tools and why she thinks the next eighteen months will be about consolidation.',                                'https://example.com/dtc-pod-412',                     '2026-04-11', 'medium'),
  ('sig_nb_hiring1',  'northstar_beauty', 'hiring',           'LinkedIn Jobs', 'Northstar Beauty hiring Senior Lifecycle Marketing Manager',                             'Senior Lifecycle Marketing Manager — Los Angeles — building out lifecycle programs across email and SMS.',                                                                                                      'https://example.com/jobs/nb-lifecycle-sr',            '2026-04-05', 'high'),
  ('sig_nb_hiring2',  'northstar_beauty', 'hiring',           'LinkedIn Jobs', 'Northstar Beauty hiring Lifecycle Marketing Coordinator',                                'Lifecycle Marketing Coordinator — Los Angeles — supporting email and SMS campaigns and reporting.',                                                                                                              'https://example.com/jobs/nb-lifecycle-coord',         '2026-03-28', 'high');

-- Northstar Active
INSERT INTO external_signals (signal_id, account_id, signal_type, source, title, snippet, url, signal_date, reliability) VALUES
  ('sig_na_press',   'northstar_active', 'press',       'Retail Dive',   'Northstar Active posts best Q1 in company history',              'Northstar Active credits email-led retention programs with a standout Q1 as DTC peers continue to struggle.', 'https://example.com/retail-dive-active-q1', '2026-04-03', 'high'),
  ('sig_na_social',  'northstar_active', 'social_post', 'LinkedIn',      'Avery Collins on flows discipline',                              'Fewer, better flows. We''ve been ruthless about pruning and it''s paying off.',                                 'https://www.linkedin.com/posts/avery-flows', '2026-03-20', 'medium'),
  ('sig_na_hiring',  'northstar_active', 'hiring',      'LinkedIn Jobs', 'Northstar Active hiring CRM Manager',                            'CRM Manager — Los Angeles — support Identity rollout and lifecycle expansion.',                                'https://example.com/jobs/na-crm-mgr',        '2026-04-11', 'high');

-- Northstar Home
INSERT INTO external_signals (signal_id, account_id, signal_type, source, title, snippet, url, signal_date, reliability) VALUES
  ('sig_nh_press',  'northstar_home', 'press',       'Modern Retail', 'Northstar Home expands into cookware',                             'Northstar Home announced a cookware line launching Q3, extending beyond textiles and decor.',              'https://example.com/modern-retail-nh', '2026-04-12', 'high'),
  ('sig_nh_social', 'northstar_home', 'social_post', 'LinkedIn',      'Riley Brooks on first 90 days',                                    'New in seat at Northstar Home — learning a lot from the Beauty and Active teams. Excited for what''s ahead.', 'https://www.linkedin.com/posts/riley-90days', '2026-02-18', 'medium'),
  ('sig_nh_hiring', 'northstar_home', 'hiring',      'LinkedIn Jobs', 'Northstar Home hiring Email Marketing Specialist',                 'Email Marketing Specialist — Los Angeles — support the expanded cookware launch.',                         'https://example.com/jobs/nh-email',    '2026-03-30', 'high');

-- Tidepool (prospect — funding + hiring)
INSERT INTO external_signals (signal_id, account_id, signal_type, source, title, snippet, url, signal_date, reliability) VALUES
  ('sig_ts_funding', 'tidepool_swim', 'funding',     'TechCrunch',   'Tidepool Swim Co. raises $8M Series A led by Forerunner',             'San Diego-based DTC swimwear brand Tidepool announced an $8M Series A led by Forerunner Ventures. Funds will expand marketing and retail partnerships.', 'https://example.com/techcrunch-tidepool', '2026-04-08', 'high'),
  ('sig_ts_hiring',  'tidepool_swim', 'hiring',      'LinkedIn Jobs', 'Tidepool Swim Co. hiring Email Marketing Manager',                   'Email Marketing Manager — San Diego — build out lifecycle from the ground up.',                                                                          'https://example.com/jobs/ts-email-mgr',   '2026-04-14', 'high'),
  ('sig_ts_social',  'tidepool_swim', 'social_post', 'LinkedIn',      'Casey Lim on joining Tidepool',                                      'Excited to join Tidepool as CMO. Day one means building lifecycle marketing from zero — recommendations welcome.',                                       'https://www.linkedin.com/posts/casey-join','2026-02-02', 'medium');

-- Mellow Mattress
INSERT INTO external_signals (signal_id, account_id, signal_type, source, title, snippet, url, signal_date, reliability) VALUES
  ('sig_mm_social', 'mellow_mattress', 'social_post', 'LinkedIn',      'Darren Cole on adding RCS',                                       'Thinking about RCS as the next frontier for our retention program. Early conversations are promising.',   'https://www.linkedin.com/posts/darren-rcs', '2026-04-06', 'medium'),
  ('sig_mm_press',  'mellow_mattress', 'press',       'Modern Retail', 'Mellow Mattress hits 300k subscribers',                           'Denver-based DTC mattress brand Mellow crosses 300,000 subscribers, credits lifecycle programs.',         'https://example.com/modern-retail-mellow',  '2026-03-22', 'high'),
  ('sig_mm_hiring', 'mellow_mattress', 'hiring',      'LinkedIn Jobs', 'Mellow hiring Retention Analyst',                                 'Retention Analyst — Denver — support growing lifecycle program.',                                         'https://example.com/jobs/mm-analyst',       '2026-04-12', 'high');

-- Ember Coffee
INSERT INTO external_signals (signal_id, account_id, signal_type, source, title, snippet, url, signal_date, reliability) VALUES
  ('sig_ec_social', 'ember_coffee', 'social_post', 'LinkedIn',      'Ian Wexler on slow, steady growth',             'We''re in year five and still learning. Email remains our #1 channel.', 'https://www.linkedin.com/posts/ian-slow', '2026-03-30', 'medium'),
  ('sig_ec_press',  'ember_coffee', 'press',       'Food & Wine',   'Ember Coffee expands subscription program',     'Portland roaster Ember Coffee expands its subscription program with single-origin tier.', 'https://example.com/foodwine-ember', '2026-04-01', 'high'),
  ('sig_ec_hiring', 'ember_coffee', 'hiring',      'LinkedIn Jobs', 'Ember Coffee hiring Marketing Coordinator',     'Marketing Coordinator — Portland — support growing subscription program.',             'https://example.com/jobs/ec-coord',  '2026-04-10', 'high');

-- Kindred Pet Supply
INSERT INTO external_signals (signal_id, account_id, signal_type, source, title, snippet, url, signal_date, reliability) VALUES
  ('sig_kp_linkedin', 'kindred_pet', 'social_post',      'LinkedIn',      'Jamie Park on consolidating the marketing stack',              'New role, fresh eyes. First order of business: consolidate the marketing stack. Too many tools, not enough leverage.', 'https://www.linkedin.com/posts/jamie-consolidate', '2026-03-14', 'high'),
  ('sig_kp_exec',     'kindred_pet', 'executive_change', 'PR Newswire',   'Kindred Pet Supply names Jamie Park VP Marketing',             'Kindred Pet Supply named Jamie Park as VP Marketing, succeeding Rowan Sato who departed in January.',                   'https://example.com/kindred-vp-appoint',            '2026-02-10', 'high'),
  ('sig_kp_press',    'kindred_pet', 'press',            'PetBiz Today',  'Kindred trims marketing vendors in Q1',                        'Mid-market pet brand Kindred reported trimming six marketing vendors in Q1 as part of a cost-rationalization program.', 'https://example.com/petbiz-kindred-trim',           '2026-03-28', 'medium'),
  ('sig_kp_competitor','kindred_pet','competitive',      'Industry Tips', 'Kindred competitor Fetchly raises $30M',                       'Fetchly, a direct Kindred competitor, raised a $30M Series B led by Sequoia. Plans aggressive lifecycle expansion.',    'https://example.com/fetchly-raise',                 '2026-04-05', 'medium');

-- Hearth Home Goods
INSERT INTO external_signals (signal_id, account_id, signal_type, source, title, snippet, url, signal_date, reliability) VALUES
  ('sig_hh_press',  'hearth_home', 'press',       'Home Accents Today', 'Hearth Home Goods expands into tabletop',              'Minneapolis-based Hearth announced expansion into tabletop collections ahead of the fall season.', 'https://example.com/hat-hearth', '2026-04-05', 'high'),
  ('sig_hh_social', 'hearth_home', 'social_post', 'LinkedIn',            'Mira Okonkwo on onboarding experience',                'Our onboarding with  has been genuinely smooth — shoutout to the team.',                'https://www.linkedin.com/posts/mira-onboard', '2026-03-01', 'medium'),
  ('sig_hh_hiring', 'hearth_home', 'hiring',      'LinkedIn Jobs',       'Hearth hiring CRM Specialist',                         'CRM Specialist — Minneapolis — help scale lifecycle program.',                                   'https://example.com/jobs/hh-crm', '2026-04-02', 'high');

-- Quiver Supplements
INSERT INTO external_signals (signal_id, account_id, signal_type, source, title, snippet, url, signal_date, reliability) VALUES
  ('sig_qs_press',  'quiver_supplements', 'press',       'NutraPulse',    'Quiver Supplements posts 40% YoY growth',           'Austin-based Quiver Supplements posted 40 percent YoY growth, driven by retention programs.', 'https://example.com/nutrapulse-qs', '2026-04-01', 'high'),
  ('sig_qs_social', 'quiver_supplements', 'social_post', 'LinkedIn',      'Taylor Reyes on portfolio-level loyalty',           'Running a loyalty pilot through Supplements first, then Rituals. Portfolio thinking is underrated.', 'https://www.linkedin.com/posts/taylor-loyalty', '2026-04-05', 'medium'),
  ('sig_qs_hiring', 'quiver_supplements', 'hiring',      'LinkedIn Jobs', 'Quiver hiring Retention Analyst',                   'Retention Analyst — Austin — support loyalty pilot rollout.',                                  'https://example.com/jobs/qs-analyst', '2026-04-10', 'high');

-- Quiver Rituals
INSERT INTO external_signals (signal_id, account_id, signal_type, source, title, snippet, url, signal_date, reliability) VALUES
  ('sig_qr_press',  'quiver_rituals', 'press',       'Beauty Independent', 'Quiver Rituals launches new hair line',            'Austin-based Quiver Rituals debuted a new hair-care line aimed at textured hair types.',       'https://example.com/beauty-ind-qr', '2026-04-12', 'high'),
  ('sig_qr_social', 'quiver_rituals', 'social_post', 'LinkedIn',           'Priya Sanghvi on Rituals ramp',                    'Six months in, and the Rituals brand is finally finding its voice. Email is the growth driver.', 'https://www.linkedin.com/posts/priya-rituals-ramp', '2026-03-18', 'medium'),
  ('sig_qr_hiring', 'quiver_rituals', 'hiring',      'LinkedIn Jobs',      'Quiver Rituals hiring Lifecycle Marketing Manager','Lifecycle Marketing Manager — Austin — own end-to-end lifecycle for Rituals.',                  'https://example.com/jobs/qr-lifecycle', '2026-04-07', 'high');
