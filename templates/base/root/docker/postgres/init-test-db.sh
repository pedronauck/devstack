#!/usr/bin/env sh
set -eu

TEST_DATABASE="{{projectName}}_test"

if psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '${TEST_DATABASE}'" | grep -q 1; then
  exit 0
fi

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER:-postgres}" --dbname postgres -c \
  "CREATE DATABASE \"${TEST_DATABASE}\";"
