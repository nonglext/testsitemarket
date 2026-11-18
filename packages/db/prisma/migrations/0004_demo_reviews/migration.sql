CREATE TABLE demo_reviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL UNIQUE REFERENCES demo_orders(id),
  seller_id bigint NOT NULL REFERENCES users(id),
  buyer_id bigint NOT NULL REFERENCES users(id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (buyer_id <> seller_id)
);

CREATE INDEX demo_reviews_seller_created ON demo_reviews(seller_id, created_at DESC, id DESC);
