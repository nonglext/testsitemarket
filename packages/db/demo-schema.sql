-- Ручной скрипт для базы, в которой уже созданы users и lots.
-- При обычном деплое используйте npm run migrate:deploy.
CREATE TABLE IF NOT EXISTS demo_wallets (
  user_id bigint PRIMARY KEY REFERENCES users(id),
  available numeric(30,6) NOT NULL DEFAULT 0 CHECK (available >= 0)
);
CREATE TABLE IF NOT EXISTS demo_orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buyer_id bigint NOT NULL REFERENCES users(id),
  seller_id bigint NOT NULL REFERENCES users(id),
  lot_id bigint NOT NULL REFERENCES lots(id),
  lot_title text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(30,6) NOT NULL,
  total numeric(30,6) NOT NULL,
  status text NOT NULL CHECK (status IN ('paid','delivered','completed')),
  request_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  completed_at timestamptz,
  UNIQUE(buyer_id, request_key),
  CHECK(buyer_id <> seller_id)
);
CREATE TABLE IF NOT EXISTS demo_wallet_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id),
  amount numeric(30,6) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('topup','purchase','sale')),
  order_id bigint REFERENCES demo_orders(id),
  request_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, request_key)
);
CREATE TABLE IF NOT EXISTS demo_order_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES demo_orders(id),
  sender_id bigint NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  client_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, sender_id, client_key)
);
CREATE INDEX IF NOT EXISTS demo_orders_buyer ON demo_orders(buyer_id,id DESC);
CREATE INDEX IF NOT EXISTS demo_orders_seller ON demo_orders(seller_id,id DESC);
CREATE INDEX IF NOT EXISTS demo_wallet_entries_user ON demo_wallet_entries(user_id,id DESC);
CREATE INDEX IF NOT EXISTS demo_order_messages_order ON demo_order_messages(order_id,id);
