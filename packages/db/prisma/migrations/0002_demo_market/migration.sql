CREATE TABLE demo_wallets (
  user_id bigint PRIMARY KEY REFERENCES users(id),
  available numeric(30,6) NOT NULL DEFAULT 0 CHECK (available >= 0)
);
CREATE TABLE demo_orders (
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
CREATE TABLE demo_wallet_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id),
  amount numeric(30,6) NOT NULL,
  kind text NOT NULL CHECK(kind IN ('topup','purchase','sale')),
  order_id bigint REFERENCES demo_orders(id),
  request_key uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_key)
);
CREATE INDEX demo_orders_buyer ON demo_orders(buyer_id,id DESC);
CREATE INDEX demo_orders_seller ON demo_orders(seller_id,id DESC);
CREATE INDEX demo_wallet_entries_user ON demo_wallet_entries(user_id,id DESC);
