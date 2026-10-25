CREATE TABLE command_receipts (
  owner_id text NOT NULL,
  actor_id text NOT NULL,
  request_id text NOT NULL,
  body_sha256 text NOT NULL,
  revision integer NOT NULL,
  result text NOT NULL,
  created_at text NOT NULL,
  PRIMARY KEY (owner_id, actor_id, request_id)
);
