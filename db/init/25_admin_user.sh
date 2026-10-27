#!/bin/sh
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  UPDATE usuarios SET clave_hash = crypt('${ADMIN_INITIAL_PASSWORD}', gen_salt('bf', 10)) WHERE username = 'admin';
  DROP EXTENSION pgcrypto;
EOSQL
