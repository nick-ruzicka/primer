-- Primer shared SQLite schema.
-- All six MCP servers read from this DB. No writes at runtime.
-- ARR and money fields are stored in cents (integers) to avoid float math.

-- WAL survives connection close (it's stored in the DB header), so setting
-- it once at seed time enables concurrent reads for every process that
-- opens primer.db afterwards.
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
    account_id TEXT PRIMARY KEY,
    account_name TEXT NOT NULL,
    parent_account_id TEXT,
    parent_account_name TEXT,
    industry TEXT,
    segment TEXT,
    arr_cents INTEGER NOT NULL,
    employees INTEGER,
    founded_year INTEGER,
    hq_city TEXT,
    hq_state TEXT,
    stage TEXT,
    state TEXT,
    logo_color TEXT,
    logo_initial TEXT,
    owner_name TEXT,
    owner_role TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (parent_account_id) REFERENCES accounts(account_id)
);

CREATE TABLE salesforce_opportunities (
    opp_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    opp_name TEXT NOT NULL,
    stage TEXT NOT NULL,
    amount_cents INTEGER,
    close_date TEXT,
    forecast_category TEXT,
    status TEXT,
    created_at TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE salesforce_contracts (
    contract_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    contract_start TEXT NOT NULL,
    contract_end TEXT NOT NULL,
    auto_renew INTEGER DEFAULT 1,
    seats_used INTEGER,
    seats_licensed INTEGER,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE salesforce_contacts (
    contact_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    role TEXT,
    tenure_months INTEGER,
    linkedin_url TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE snowflake_usage (
    account_id TEXT PRIMARY KEY,
    sends_30d INTEGER,
    sends_prior_30d INTEGER,
    flows_active INTEGER,
    flows_provisioned INTEGER,
    flows_paused_this_period INTEGER,
    health_score INTEGER,
    health_score_prior INTEGER,
    adoption_score INTEGER,
    adoption_group_avg INTEGER,
    last_send_date TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE catalyst_health (
    account_id TEXT PRIMARY KEY,
    relationship_status TEXT,
    status_since TEXT,
    relationship_score INTEGER,
    relationship_score_prior INTEGER,
    renewal_forecast TEXT,
    expansion_readiness TEXT,
    last_executive_touch TEXT,
    notes TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE netsuite_billing (
    account_id TEXT PRIMARY KEY,
    current_balance_cents INTEGER,
    past_due_balance_cents INTEGER,
    past_due_days INTEGER,
    last_invoice_number TEXT,
    last_invoice_amount_cents INTEGER,
    last_invoice_date TEXT,
    ap_blocked INTEGER DEFAULT 0,
    ap_blocked_date TEXT,
    ap_blocked_reason TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE gong_calls (
    call_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    call_date TEXT NOT NULL,
    call_type TEXT,
    duration_minutes INTEGER,
    summary TEXT NOT NULL,
    competitor_mentioned INTEGER DEFAULT 0,
    competitor_name TEXT,
    competitor_mention_count INTEGER DEFAULT 0,
    pricing_pushback INTEGER DEFAULT 0,
    sentiment TEXT,
    followups TEXT,
    risks_mentioned TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE TABLE external_signals (
    signal_id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    signal_type TEXT,
    source TEXT,
    title TEXT NOT NULL,
    snippet TEXT,
    url TEXT,
    signal_date TEXT,
    reliability TEXT,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

CREATE INDEX idx_opps_account ON salesforce_opportunities(account_id);
CREATE INDEX idx_opps_status ON salesforce_opportunities(account_id, status);
CREATE INDEX idx_contacts_account ON salesforce_contacts(account_id);
CREATE INDEX idx_calls_account_date ON gong_calls(account_id, call_date DESC);
CREATE INDEX idx_signals_account_date ON external_signals(account_id, signal_date DESC);
