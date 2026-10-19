#!/usr/bin/env bash
# Lance un Postgres temporaire, applique la migration et les données d'exemple, puis exécute les tests SQL.
# Prérequis : binaires PostgreSQL (initdb, pg_ctl, psql) dans le PATH ou dans /usr/lib/postgresql/*/bin.
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
export PATH="${PGBIN:+$PGBIN:}$PATH"

TMP="$(mktemp -d)"
PORT=55432
cleanup() { ${RUN_AS:-} pg_ctl -D "$TMP/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$TMP"; }
RUN_AS=""
trap cleanup EXIT

if [ "$(id -u)" = "0" ]; then
  id -u postgres >/dev/null 2>&1 || useradd -m postgres
  chown -R postgres "$TMP"
  RUN_AS="sudo -u postgres env PATH=$PATH"
  command -v sudo >/dev/null || RUN_AS="runuser -u postgres -- env PATH=$PATH"
fi

$RUN_AS initdb -D "$TMP/data" -U postgres -A trust >/dev/null
$RUN_AS pg_ctl -D "$TMP/data" -o "-p $PORT -k $TMP -c timezone=UTC" -l "$TMP/log" start >/dev/null
sleep 1

PSQL="psql -h $TMP -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
# Base en UTF8 comme sur Supabase (normalisation Unicode des pseudos), quel que soit le locale du système.
$PSQL -c "create database cutshop encoding 'UTF8' locale 'C' template template0" postgres
$PSQL -f supabase/tests/supabase_stub.sql cutshop
# Le fichier d'installation complète (migrations + données d'exemple) est celui collé dans Supabase.
node scripts/build-setup-sql.mjs >/dev/null
$PSQL -f supabase/installation_complete.sql cutshop
$PSQL -f supabase/tests/db_test.sql cutshop
