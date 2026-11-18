create table users (
  id bigint generated always as identity primary key,
  nickname text not null,
  email text not null,
  password_hash text not null,
  status text not null default 'active',
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  seller_since timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table files (
  id bigint generated always as identity primary key,
  owner_id bigint not null references users,
  purpose text not null,
  s3_key text unique not null,
  mime text,
  size bigint,
  status text
);

create table profiles (
  user_id bigint primary key references users,
  avatar_file_id bigint references files,
  banner_file_id bigint references files,
  theme text check(theme in ('light','gray','black'))
);

create table sessions (
  id bigint generated always as identity primary key,
  user_id bigint not null references users,
  refresh_hash text unique not null,
  device text,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table auth_challenges (
  id bigint generated always as identity primary key,
  user_id bigint not null references users,
  purpose text not null,
  token_hash text unique not null,
  expires_at timestamptz not null
);

create table user_factors (
  id bigint generated always as identity primary key,
  user_id bigint not null references users,
  kind text,
  secret_ciphertext text
);

create table user_roles (
  user_id bigint not null references users,
  role text check(role in ('admin','moderator','support')),
  primary key(user_id,role)
);

create table categories (
  id bigint generated always as identity primary key,
  parent_id bigint references categories,
  name text not null,
  slug text not null,
  icon text,
  position integer default 0,
  status text default 'active'
);

create table category_policies (
  id bigint generated always as identity primary key,
  category_id bigint not null references categories,
  version integer not null,
  fee_bps integer check(fee_bps between 0 and 10000),
  settings jsonb not null,
  unique(category_id,version)
);

create table platform_settings (
  key text primary key,
  value jsonb not null
);

create table category_fields (
  id bigint generated always as identity primary key,
  category_id bigint not null references categories,
  key text not null,
  type text not null,
  label text not null,
  hint text,
  required boolean default false,
  filterable boolean default false,
  position integer,
  archived_at timestamptz,
  unique(category_id,key)
);

create table category_field_options (
  id bigint generated always as identity primary key,
  field_id bigint not null references category_fields,
  label text not null
);

create table lots (
  id bigint generated always as identity primary key,
  seller_id bigint not null references users,
  category_id bigint not null references categories,
  title text not null,
  description text not null,
  price numeric(30,6) not null check(price>0),
  quantity integer not null check(quantity>=0),
  delivery_mode text,
  status text not null,
  bumped_at timestamptz,
  policy_accepted_at timestamptz,
  version integer default 1
);

create table lot_field_values (
  lot_id bigint not null references lots,
  field_id bigint not null references category_fields,
  value jsonb,
  file_id bigint references files,
  primary key(lot_id,field_id)
);

create table lot_files (
  lot_id bigint not null references lots,
  file_id bigint not null references files,
  position integer,
  primary key(lot_id,file_id)
);

create table orders (
  id bigint generated always as identity primary key,
  buyer_id bigint not null references users,
  seller_id bigint not null references users,
  lot_id bigint not null references lots,
  quantity integer not null check(quantity>0),
  gross_amount numeric(30,6) not null,
  fee_amount numeric(30,6) not null,
  snapshot jsonb not null,
  status text not null,
  delivered_at timestamptz,
  confirm_due_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  check(buyer_id<>seller_id)
);

create table inventory_items (
  id bigint generated always as identity primary key,
  lot_id bigint not null references lots,
  payload_ciphertext text not null,
  order_id bigint references orders,
  released_at timestamptz
);

create table order_messages (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders,
  sender_id bigint not null references users,
  client_message_id uuid not null,
  body text not null,
  external_warning boolean default false,
  created_at timestamptz not null default now(),
  unique(order_id,sender_id,client_message_id)
);

create table message_files (
  message_id bigint not null references order_messages,
  file_id bigint not null references files,
  primary key(message_id,file_id)
);

create table notifications (
  id bigint generated always as identity primary key,
  user_id bigint not null references users,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table disputes (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders,
  opened_by bigint not null references users,
  reason text,
  status text not null,
  arbiter_id bigint references users,
  decision text,
  rationale text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table dispute_evidence (
  id bigint generated always as identity primary key,
  dispute_id bigint not null references disputes,
  author_id bigint not null references users,
  file_id bigint not null references files
);

create table reviews (
  id bigint generated always as identity primary key,
  order_id bigint unique not null references orders,
  rating integer not null check(rating between 1 and 5),
  body text,
  reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create table balances (
  id bigint generated always as identity primary key,
  owner_id bigint references users,
  kind text not null,
  asset text not null default 'USDT',
  amount numeric(30,6) not null default 0,
  unique nulls not distinct(owner_id,kind,asset)
);

create table transactions (
  id bigint generated always as identity primary key,
  business_ref text unique not null,
  idempotency_key text unique not null,
  request_hash text not null,
  created_at timestamptz not null default now()
);

create table transaction_entries (
  id bigint generated always as identity primary key,
  transaction_id bigint not null references transactions,
  balance_id bigint not null references balances,
  amount numeric(30,6) not null check(amount<>0)
);

create table payment_networks (
  id bigint generated always as identity primary key,
  code text not null,
  environment text not null,
  contract text not null,
  settings jsonb not null,
  unique(code,environment)
);

create table deposit_addresses (
  id bigint generated always as identity primary key,
  user_id bigint not null references users,
  network_id bigint not null references payment_networks,
  address text not null,
  derivation_index bigint not null,
  unique(network_id,address),
  unique(network_id,user_id)
);

create table chain_cursors (
  network_id bigint primary key references payment_networks,
  height bigint not null,
  block_hash text not null
);

create table deposits (
  id bigint generated always as identity primary key,
  network_id bigint not null references payment_networks,
  address_id bigint not null references deposit_addresses,
  tx_hash text not null,
  event_index integer not null,
  block_hash text,
  amount numeric(30,6) not null,
  status text not null,
  ledger_tx_id bigint references transactions,
  unique(network_id,tx_hash,event_index)
);

create table withdrawals (
  id bigint generated always as identity primary key,
  user_id bigint not null references users,
  network_id bigint not null references payment_networks,
  address text not null,
  amount numeric(30,6) not null,
  network_fee numeric(30,6) not null,
  send_amount numeric(30,6) not null,
  status text not null,
  expires_at timestamptz,
  reviewer_id bigint references users,
  tx_hash text,
  reserve_tx_id bigint not null references transactions,
  settlement_tx_id bigint references transactions
);

create table reports (
  id bigint generated always as identity primary key,
  author_id bigint not null references users,
  user_id bigint references users,
  lot_id bigint references lots,
  reason text,
  status text,
  check(num_nonnulls(user_id,lot_id)=1)
);

create table risk_rules (
  id bigint generated always as identity primary key,
  kind text,
  threshold numeric,
  action text
);

create table risk_signals (
  id bigint generated always as identity primary key,
  user_id bigint not null references users,
  kind text,
  details jsonb,
  created_at timestamptz not null default now()
);

create table payout_holds (
  id bigint generated always as identity primary key,
  user_id bigint not null references users,
  actor_id bigint references users,
  reason text,
  created_at timestamptz not null default now(),
  released_at timestamptz
);

create table verifications (
  id bigint generated always as identity primary key,
  user_id bigint not null references users,
  kind text,
  file_id bigint references files,
  status text
);

create table subscription_plans (
  id bigint generated always as identity primary key,
  name text,
  discount_bps integer,
  price numeric(30,6)
);

create table seller_subscriptions (
  id bigint generated always as identity primary key,
  user_id bigint not null references users,
  plan_id bigint not null references subscription_plans,
  starts_at timestamptz,
  ends_at timestamptz,
  auto_renew boolean
);

create table lot_bumps (
  id bigint generated always as identity primary key,
  lot_id bigint not null references lots,
  price numeric(30,6),
  transaction_id bigint references transactions,
  created_at timestamptz not null default now()
);

create table admin_logs (
  id bigint generated always as identity primary key,
  actor_id bigint not null references users,
  action text not null,
  target text,
  reason text,
  changes jsonb,
  request_id uuid,
  created_at timestamptz not null default now()
);

create table outbox_events (
  id bigint generated always as identity primary key,
  kind text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create unique index users_email_ci on users(lower(email));
create unique index users_nickname_ci on users(lower(nickname));
create unique index categories_path on categories(parent_id,slug) nulls not distinct;
create unique index disputes_open on disputes(order_id) where status='open';
create index lots_catalog on lots(category_id,status,price);
create index order_chat on order_messages(order_id,id);
create index orders_deadline on orders(status,confirm_due_at);
