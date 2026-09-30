#!/bin/sh
set -eu

database_directory="$(dirname "${DATABASE_PATH:-/data/bedroom-pop.sqlite}")"
if [ -d "$database_directory" ]; then
  chown node:node "$database_directory"
fi
if [ -n "${DATABASE_PATH:-}" ] && [ -e "$DATABASE_PATH" ]; then
  chown node:node "$DATABASE_PATH"
fi

exec gosu node "$@"
