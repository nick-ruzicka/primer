# 01 — Dataset Spec

The data layer is the foundation. The agent's reasoning quality is bounded by the realism of this data. We need enough variation across accounts that the system demonstrates range, and enough fidelity within each account that the brief has something substantive to reason about.

## Design principles

1. **One SQLite database, shared by all MCP servers.** Path: `data/primer.db`. Seeded once from `data/seed.sql`.
2. **Every account has complete data in all six source systems.** No missing tables. If a field would realistically be null (e.g., no exec sponsor yet), use NULL explicitly — don't skip the row.
3. **The Northstar Group story stays canonical.** Beauty is the trust-repair hero. Active and Home are healthy siblings. Don't change this.
4. **Other accounts span the full range of AE workflow states** — discovery, new business, straightforward renewal, at-risk, expansion, QBR prep.
5. **Contradictions are intentional.** Salesforce says Commit, Catalyst says Watchlist, NetSuite shows past-due — that's the validation agent's job to surface. Build the data so this happens for Beauty and one or two others.

## Schema

### accounts
Primary account table — one row per billable entity.

```sql
CREATE TABLE accounts (
    account_id TEXT PRIMARY KEY,
    account_name TEXT NOT NULL,
    parent_account_id TEXT,             -- NULL if standalone
    parent_account_name TEXT,
    industry TEXT,
    segment TEXT,                        -- 'DTC' | 'Retail' | 'B2B' | etc.
    arr_cents INTEGER NOT NULL,          -- store in cents to avoid float math
    employees INTEGER,
    founded_year INTEGER,
    hq_city TEXT,
    hq_state TEXT,
    stage TEXT,                          -- 'New business' | 'Expansion' | 'Renewal' | 'Discovery' | 'QBR prep'
    state TEXT,                          -- 'hot' | 'warm' | 'cool' (traffic light)
    logo_color TEXT,                     -- hex for the account logo tile
    logo_initial TEXT,                   -- 2-letter initials (NB, NA, NH etc.)
    owner_name TEXT,
    owner_role TEXT,
    created_at TEXT NOT NULL,            -- ISO date
    FOREIGN KEY (parent_account_id) REFERENCES accounts(account_id)
);
```

### salesforce_opportunities
Open and recently closed opportunities.

```sql
CREATE TABLE salesforce_opportunities (
    opp_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    opp_name TEXT NOT NULL,
    stage TEXT NOT NULL,                 -- 'Discovery' | 'Evaluation' | 'Proposal' | 'Negotiation' | 'Closed Won' | 'Closed Lost'
    amount_cents INTEGER,
    close_date TEXT,                     -- ISO date
    forecast_category TEXT,              -- 'Commit' | 'Best Case' | 'Pipeline' | 'Omitted' | 'Closed'
    status TEXT,                         -- 'open' | 'closed_won' | 'closed_lost'
    created_at TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
```

### salesforce_contracts
Contract metadata per account.

```sql
CREATE TABLE salesforce_contracts (
    contract_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,             -- "Flows Pro + Journeys"
    contract_start TEXT NOT NULL,
    contract_end TEXT NOT NULL,
    auto_renew INTEGER DEFAULT 1,        -- boolean
    seats_used INTEGER,
    seats_licensed INTEGER,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
```

### salesforce_contacts
Decision makers and influencers.

```sql
CREATE TABLE salesforce_contacts (
    contact_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    role TEXT,                           -- 'Decision Maker' | 'Executive Sponsor' | 'Champion' | 'Influencer' | 'Blocker'
    tenure_months INTEGER,               -- months in current role at this account
    linkedin_url TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
```

### snowflake_usage
Product usage aggregates.

```sql
CREATE TABLE snowflake_usage (
    account_id TEXT PRIMARY KEY,
    sends_30d INTEGER,
    sends_prior_30d INTEGER,             -- for computing trend
    flows_active INTEGER,
    flows_provisioned INTEGER,
    flows_paused_this_period INTEGER,
    health_score INTEGER,                -- 0-100
    health_score_prior INTEGER,
    adoption_score INTEGER,              -- 0-100
    adoption_group_avg INTEGER,          -- group average for parent-account comparisons
    last_send_date TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
```

### catalyst_health
Relationship and renewal posture.

```sql
CREATE TABLE catalyst_health (
    account_id TEXT PRIMARY KEY,
    relationship_status TEXT,            -- 'Healthy' | 'Watchlist' | 'At Risk' | 'Cold'
    status_since TEXT,                   -- date of last status change
    relationship_score INTEGER,          -- 0-100
    relationship_score_prior INTEGER,
    renewal_forecast TEXT,               -- 'Commit' | 'Best Case' | 'Pipeline' | 'At Risk'
    expansion_readiness TEXT,            -- 'High' | 'Medium' | 'Low' | 'None'
    last_executive_touch TEXT,           -- ISO date
    notes TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
```

### netsuite_billing
Invoicing, balances, billing state.

```sql
CREATE TABLE netsuite_billing (
    account_id TEXT PRIMARY KEY,
    current_balance_cents INTEGER,
    past_due_balance_cents INTEGER,
    past_due_days INTEGER,               -- 0 if current
    last_invoice_number TEXT,
    last_invoice_amount_cents INTEGER,
    last_invoice_date TEXT,
    ap_blocked INTEGER DEFAULT 0,        -- boolean
    ap_blocked_date TEXT,                -- when the block was set
    ap_blocked_reason TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
```

### gong_calls
Call summaries with extracted signals.

```sql
CREATE TABLE gong_calls (
    call_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    call_date TEXT NOT NULL,
    call_type TEXT,                      -- 'QBR' | 'Discovery' | 'Check-in' | 'Expansion' | 'Renewal' | 'Kickoff'
    duration_minutes INTEGER,
    summary TEXT NOT NULL,
    competitor_mentioned INTEGER DEFAULT 0,
    competitor_name TEXT,
    competitor_mention_count INTEGER DEFAULT 0,
    pricing_pushback INTEGER DEFAULT 0,
    sentiment TEXT,                      -- 'positive' | 'neutral' | 'negative' | 'mixed'
    followups TEXT,                      -- pipe-delimited action items
    risks_mentioned TEXT,                -- pipe-delimited
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
```

### external_signals
Exa-sourced or manually curated public signals.

```sql
CREATE TABLE external_signals (
    signal_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    signal_type TEXT,                    -- 'funding' | 'executive_change' | 'hiring' | 'press' | 'social_post' | 'podcast' | 'competitive'
    source TEXT,                         -- 'TechCrunch' | 'LinkedIn' | 'DTC Pod' | etc.
    title TEXT NOT NULL,
    snippet TEXT,
    url TEXT,
    signal_date TEXT,                    -- ISO date
    reliability TEXT,                    -- 'high' | 'medium' | 'low'
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);
```

---

## The accounts

### 1. Northstar Beauty — **hero account, trust-repair call**

- **Parent:** Northstar Group (parent_account_id of Beauty/Active/Home)
- **ARR:** $940,000
- **Stage:** Renewal (117 days out)
- **State:** hot (flagged)
- **DM:** Priya Shah, VP Marketing, 2y4m tenure (champion)
- **Exec sponsor:** Sam Rivera, CMO of Northstar Group
- **Contract:** Flows Pro + Journeys, auto-renew on, Sep 12 2026
- **Catalyst:** Watchlist (since Mar 28), relationship score 61 (down from 74), forecast Best Case, expansion readiness Low
- **Snowflake:** health 61 (down from 74), sends 3.1M (down 18% from 3.8M), 9 of 20 flows active, 3 paused since March, adoption 61 vs group avg 74
- **NetSuite:** past due $18,500 · 41 days overdue · AP blocked as of Apr 18 · "Finance marked account as blocked for further invoicing pending resolution"
- **Gong:** Apr 11 QBR — competitor "Active Loyalty" referenced 2x, pricing pushback yes, sentiment mixed, risks: flat adoption, billing friction, limited client resourcing
- **Salesforce opps:** Loyalty messaging expansion (Proposal, $180k), Mobile app opt-in pilot (Discovery, $60k), AI Pro pilot (Closed Lost, $220k)
- **External:** CFO change (Northstar Group hires Carla Reyes, Apr 2) · Priya LinkedIn post on vendor overlap (Apr 9) · DTC Pod mentions Priya's frustration with stitched-together lifecycle tools (Apr 11) · 2 lifecycle marketing roles posted in last 30 days

**The deliberate contradictions in the data (validation agent should catch):**
- Salesforce forecast = Commit, but Catalyst forecast = Best Case AND NetSuite shows AP-blocked past-due AND Gong shows competitor mention + pricing pushback
- Auto-renew = on, but relationship score trajectory suggests churn risk

### 2. Northstar Active — **healthy sibling, expansion opportunity**

- **Parent:** Northstar Group
- **ARR:** $1,450,000
- **Stage:** Expansion (Q2)
- **State:** warm
- **DM:** Avery Collins, Head of Growth, 18m tenure
- **Exec sponsor:** Sam Rivera (same as Beauty)
- **Catalyst:** Healthy, relationship 82, forecast Commit, expansion readiness High
- **Snowflake:** health 82, sends 6.2M (up 14%), 18 of 20 flows active, adoption 82
- **NetSuite:** current, $0 past due
- **Gong:** recent call positive, asked about Identity add-on
- **Opps:** Identity add-on (Evaluation, $240k), SMS volume tier upgrade (Negotiation, $85k/yr)

### 3. Northstar Home — **healthy sibling, simple renewal**

- **Parent:** Northstar Group
- **ARR:** $680,000
- **Stage:** Just live (renewed in March)
- **State:** cool
- **DM:** Riley Brooks, Senior Lifecycle Manager, 9m tenure
- **Catalyst:** Healthy, relationship 74, forecast Commit
- **Snowflake:** health 74, sends 2.1M steady, 14 of 16 flows active
- **NetSuite:** current, $0 past due
- **Gong:** kickoff call from Mar, positive
- **Opps:** none open

### 4. Tidepool Swim Co. — **new business, discovery stage**

- **Standalone** (no parent)
- **ARR:** $0 (prospect)
- **Stage:** New business — Discovery
- **State:** warm
- **DM:** Casey Lim, CMO, new role (3m)
- **Catalyst:** n/a for prospects — this row has most fields NULL with a note field
- **Snowflake:** n/a
- **NetSuite:** n/a
- **Gong:** one discovery call Apr 15, positive, asked about sign-up units and list growth
- **Opps:** Initial platform (Discovery, $220k)
- **External:** announced $8M Series A two weeks ago, hiring for Email Marketing Manager

### 5. Mellow Mattress — **healthy expansion, clear upsell**

- **Standalone**
- **ARR:** $310,000
- **Stage:** Expansion
- **State:** warm
- **DM:** Darren Cole, Director of Ecommerce, 2y tenure
- **Catalyst:** Healthy, relationship 78, forecast Commit, expansion readiness High
- **Snowflake:** health 78, sends up 22% YoY, 15 of 15 flows active (maxed!)
- **NetSuite:** current
- **Gong:** recent call — they want to add RCS channel
- **Opps:** RCS channel add-on (Proposal, $96k)

### 6. Ember Coffee Co. — **straightforward renewal, no drama**

- **Standalone**
- **ARR:** $80,000
- **Stage:** Renewal (92 days out)
- **State:** cool
- **DM:** Sloane Kim, Marketing Manager, 14m tenure
- **Catalyst:** Healthy, relationship 71, forecast Commit
- **Snowflake:** health 71, steady
- **NetSuite:** current
- **Gong:** check-in call last month, no issues
- **Opps:** none

### 7. Kindred Pet Supply — **at-risk, adoption collapse (different failure mode from Beauty)**

- **Standalone**
- **ARR:** $145,000
- **Stage:** Renewal (48 days out)
- **State:** hot (flagged)
- **DM:** Jamie Park, VP Marketing (**new, 2m tenure — decision maker turnover**)
- **Previous DM:** Rowan Sato (left the company)
- **Catalyst:** At Risk, relationship 48 (down from 81), forecast At Risk, exec sponsor touch 127 days ago
- **Snowflake:** health 48, sends down 41% since DM change, 4 of 12 flows active, 8 paused
- **NetSuite:** current (billing is fine, product adoption is the problem)
- **Gong:** recent call — new DM candid about "evaluating whether we're using it to its full potential, otherwise we'll consolidate"
- **Opps:** Loyalty (Closed Lost, $45k)
- **External:** new VP Marketing posted on LinkedIn about "consolidating marketing stack"

**Intentional contrast with Beauty:** both flagged, but for different reasons. Beauty is trust/billing; Kindred is DM-change + adoption. Two distinct failure modes.

### 8. Hearth Home Goods — **just-closed new business, first QBR prep**

- **Standalone**
- **ARR:** $180,000
- **Stage:** QBR prep (call in 5 days)
- **State:** warm
- **DM:** Mira Okonkwo, Director of Growth, new to platform (4m since kickoff)
- **Catalyst:** Healthy (new), relationship 68 (baseline for new accounts)
- **Snowflake:** health 68, ramping — sends 180k first month, 920k most recent (scaling as expected)
- **NetSuite:** current, first invoice paid on time
- **Gong:** kickoff call + 2 check-ins, all positive
- **Opps:** none (too early)

### 9. Quiver Supplements — **second portfolio hero, healthy**

- **Parent:** Quiver Group
- **ARR:** $520,000
- **Stage:** Expansion
- **State:** warm
- **DM:** Taylor Reyes, VP Brand, 3y tenure
- **Catalyst:** Healthy, relationship 79, forecast Commit, expansion readiness High
- **Snowflake:** health 79, sends up 18% YoY
- **NetSuite:** current
- **Gong:** recent call — expansion conversation for Rituals brand

### 10. Quiver Rituals — **second portfolio sibling**

- **Parent:** Quiver Group
- **ARR:** $180,000
- **Stage:** Expansion (Stage 2)
- **State:** warm
- **DM:** (shared with Supplements — Taylor Reyes)
- **Catalyst:** Healthy (newer account), relationship 70
- **Snowflake:** health 70, ramping
- **NetSuite:** current
- **Opps:** SMS add-on (Evaluation, $40k)

---

## Seed data generation instructions

Write `data/seed.sql` as pure SQL INSERT statements. One file, runnable with `sqlite3 primer.db < seed.sql`. No ORM needed for seeding.

Include a `data/seed.py` helper that:
1. Deletes `primer.db` if it exists
2. Creates schema from `data/schema.sql`
3. Runs `data/seed.sql`
4. Prints summary: "Seeded 10 accounts across 2 parent groups"

Every account gets at least:
- 1 contract row
- 2-4 contacts (1 DM, 1 exec sponsor, 1-2 influencers)
- 1-3 opportunities (except prospects/cool accounts with 0)
- 1 usage row (except prospects — use NULL fields)
- 1 health row (except prospects)
- 1 billing row (except prospects)
- 2-4 Gong calls across the last 90 days
- 3-6 external signals

Write call summaries in natural prose (2-3 sentences each), not keyword lists. The agent will reason over them, so they need to sound like real call notes.
