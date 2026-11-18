CREATE TABLE demo_order_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES demo_orders(id),
  sender_id bigint NOT NULL REFERENCES users(id),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  client_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id,sender_id,client_key)
);
CREATE INDEX demo_order_messages_order ON demo_order_messages(order_id,id);
