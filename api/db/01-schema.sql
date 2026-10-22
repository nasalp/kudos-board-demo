-- Kudos Board schema. Loaded by Postgres on first start (docker-entrypoint-initdb.d)
-- and by the acceptance tests against a throwaway Testcontainers database.

CREATE TABLE users (
    id   SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE kudos (
    id         SERIAL PRIMARY KEY,
    from_user  INT NOT NULL REFERENCES users (id),
    to_user    INT NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT no_self_kudos CHECK (from_user <> to_user)
);

CREATE INDEX kudos_to_user_idx ON kudos (to_user);
CREATE INDEX kudos_created_at_idx ON kudos (created_at DESC);
