#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly REPOSITORY_URL="https://github.com/neagsom229-lang/website_-Nocturne.git"
readonly APP_DIR="/var/www/nocturne"
readonly PG_HOST="127.0.0.1"
readonly PG_PORT="5432"

log() {
  printf '[nocturne-setup] %s\n' "$*"
}

fail() {
  printf '[nocturne-setup] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ "${EUID}" -eq 0 ]] || fail "Run this script as root, for example: sudo bash setup.sh"

APP_USER="${APP_USER:-${SUDO_USER:-ubuntu}}"
id "$APP_USER" >/dev/null 2>&1 || fail "Application user '$APP_USER' does not exist."
APP_HOME="$(getent passwd "$APP_USER" | cut -d: -f6)"
[[ -n "$APP_HOME" && -d "$APP_HOME" ]] || fail "Could not find the home directory for '$APP_USER'."

DB_NAME="${DB_NAME:-}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
JWT_SECRET="${JWT_SECRET:-}"
YOUTUBE_API_KEY="${YOUTUBE_API_KEY:-}"

CONFIG_FILE="${ENV_FILE:-}"
if [[ -z "$CONFIG_FILE" ]]; then
  for candidate in /etc/nocturne/setup.env "$APP_DIR/.env" "$(dirname "$(realpath "$0")")/.env"; do
    if [[ -f "$candidate" ]]; then
      CONFIG_FILE="$candidate"
      break
    fi
  done
fi

if [[ -n "$CONFIG_FILE" && -f "$CONFIG_FILE" ]]; then
  chmod 600 "$CONFIG_FILE"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == *=* ]] || continue

    key="${line%%=*}"
    value="${line#*=}"
    key="${key//[[:space:]]/}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ ${#value} -ge 2 && ( "${value:0:1}" == '"' || "${value:0:1}" == "'" ) \
      && "${value: -1}" == "${value:0:1}" ]]; then
      value="${value:1:${#value}-2}"
    fi

    case "$key" in
      DB_NAME) DB_NAME="${DB_NAME:-$value}" ;;
      DB_USER) DB_USER="${DB_USER:-$value}" ;;
      DB_PASSWORD) DB_PASSWORD="${DB_PASSWORD:-$value}" ;;
      JWT_SECRET) JWT_SECRET="${JWT_SECRET:-$value}" ;;
      YOUTUBE_API_KEY) YOUTUBE_API_KEY="${YOUTUBE_API_KEY:-$value}" ;;
    esac
  done < "$CONFIG_FILE"
fi

DB_NAME="${DB_NAME:-nocturne}"
DB_USER="${DB_USER:-nocturne}"
[[ "$DB_NAME" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || fail "DB_NAME must contain only letters, digits, and underscores, and cannot start with a digit."
[[ "$DB_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || fail "DB_USER must contain only letters, digits, and underscores, and cannot start with a digit."
[[ -n "$DB_PASSWORD" ]] || fail "Set DB_PASSWORD in $APP_DIR/.env (or export DB_PASSWORD) before running setup."
[[ ${#JWT_SECRET} -ge 32 ]] || fail "Set JWT_SECRET to a random value of at least 32 characters in $APP_DIR/.env."
[[ "$DB_PASSWORD" != *$'\n'* && "$DB_PASSWORD" != *$'\r'* ]] || fail "DB_PASSWORD cannot contain newline characters."
[[ "$JWT_SECRET" != *$'\n'* && "$JWT_SECRET" != *$'\r'* ]] || fail "JWT_SECRET cannot contain newline characters."

install -d -m 700 /etc/nocturne
if [[ "$CONFIG_FILE" != "/etc/nocturne/setup.env" && -f "$CONFIG_FILE" \
  && ! -f /etc/nocturne/setup.env ]]; then
  install -m 600 "$CONFIG_FILE" /etc/nocturne/setup.env
elif [[ ! -f /etc/nocturne/setup.env ]]; then
  {
    printf 'DB_NAME=%s\nDB_USER=%s\nDB_PASSWORD=%s\nJWT_SECRET=%s\n' \
      "$DB_NAME" "$DB_USER" "$DB_PASSWORD" "$JWT_SECRET"
    [[ -z "$YOUTUBE_API_KEY" ]] || printf 'YOUTUBE_API_KEY=%s\n' "$YOUTUBE_API_KEY"
  } > /etc/nocturne/setup.env
  chmod 600 /etc/nocturne/setup.env
fi
chown root:root /etc/nocturne/setup.env
chmod 600 /etc/nocturne/setup.env

log "Installing system packages."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git gnupg nginx openssl postgresql postgresql-contrib python3

systemctl enable --now postgresql

if [[ ! -d "$APP_DIR/.git" ]]; then
  if [[ -e "$APP_DIR" ]]; then
    fail "$APP_DIR exists but is not a Git checkout. Move it aside or remove it before setup."
  fi
  install -d -m 755 -o "$APP_USER" -g "$APP_USER" "$(dirname "$APP_DIR")"
  log "Cloning the application repository."
  runuser -u "$APP_USER" -- git clone "$REPOSITORY_URL" "$APP_DIR"
fi

chown -R "$APP_USER:$APP_USER" "$APP_DIR"
cd "$APP_DIR"
[[ -f migrations.sql ]] || fail "migrations.sql was not found in $APP_DIR."

log "Installing Node.js 22 LTS from NodeSource."
NODE_SETUP="$(mktemp)"
trap 'rm -f "${NODE_SETUP:-}" "${ROLE_SQL:-}" "${RUNTIME_ENV_TMP:-}"' EXIT
curl -fsSL https://deb.nodesource.com/setup_22.x -o "$NODE_SETUP"
bash "$NODE_SETUP"
rm -f "$NODE_SETUP"
DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
npm install --global pm2

log "Creating or updating the local PostgreSQL role and database."
ROLE_SQL="$(mktemp)"
DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
  python3 - "$ROLE_SQL" <<'PY'
import os
import sys

def sql_literal(value):
    return "'" + value.replace("'", "''") + "'"

db_user = sql_literal(os.environ["DB_USER"])
db_password = sql_literal(os.environ["DB_PASSWORD"])
statement = f"""
DO $setup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = {db_user}) THEN
    EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', {db_user}, {db_password});
  ELSE
    EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', {db_user}, {db_password});
  END IF;
END
$setup$;
"""
with open(sys.argv[1], "w", encoding="utf-8") as sql:
    sql.write(statement)
os.chmod(sys.argv[1], 0o600)
PY
runuser -u postgres -- psql -v ON_ERROR_STOP=1 -f "$ROLE_SQL"
rm -f "$ROLE_SQL"
ROLE_SQL=""

database_exists="$(runuser -u postgres -- psql -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")"
if [[ "$database_exists" != "1" ]]; then
  runuser -u postgres -- createdb --owner="$DB_USER" "$DB_NAME"
else
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c \
    "ALTER DATABASE \"$DB_NAME\" OWNER TO \"$DB_USER\""
fi

log "Applying PostgreSQL schema migrations."
PGPASSWORD="$DB_PASSWORD" psql \
  --host="$PG_HOST" --port="$PG_PORT" --username="$DB_USER" --dbname="$DB_NAME" \
  --set=ON_ERROR_STOP=1 --file="$APP_DIR/migrations.sql"

log "Writing the protected application environment file."
RUNTIME_ENV_TMP="$(mktemp "$APP_DIR/.env.XXXXXX")"
DB_NAME="$DB_NAME" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
  JWT_SECRET="$JWT_SECRET" YOUTUBE_API_KEY="$YOUTUBE_API_KEY" \
  python3 - "$RUNTIME_ENV_TMP" <<'PY'
import os
import sys
from urllib.parse import quote

def dotenv_quote(value):
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "\\r") + '"'

db_name = quote(os.environ["DB_NAME"], safe="")
db_user = quote(os.environ["DB_USER"], safe="")
db_password = quote(os.environ["DB_PASSWORD"], safe="")
database_url = f"postgresql://{db_user}:{db_password}@127.0.0.1:5432/{db_name}"

values = {
    "NODE_ENV": "production",
    "PORT": "3000",
    "DATABASE_URL": database_url,
    "JWT_SECRET": os.environ["JWT_SECRET"],
}
if os.environ.get("YOUTUBE_API_KEY"):
    values["YOUTUBE_API_KEY"] = os.environ["YOUTUBE_API_KEY"]

with open(sys.argv[1], "w", encoding="utf-8") as env_file:
    for key, value in values.items():
        env_file.write(f"{key}={dotenv_quote(value)}\n")
os.chmod(sys.argv[1], 0o600)
PY
mv -f "$RUNTIME_ENV_TMP" "$APP_DIR/.env"
RUNTIME_ENV_TMP=""
chown "$APP_USER:$APP_USER" "$APP_DIR/.env"

log "Building the frontend."
runuser -u "$APP_USER" -- npm --prefix "$APP_DIR" ci
runuser -u "$APP_USER" -- npm --prefix "$APP_DIR" run build
runuser -u "$APP_USER" -- npm --prefix "$APP_DIR" prune --omit=dev
chmod 755 /var/www "$APP_DIR"
find "$APP_DIR/dist" -type d -exec chmod 755 {} +
find "$APP_DIR/dist" -type f -exec chmod 644 {} +

log "Configuring Nginx."
cat > /etc/nginx/sites-available/nocturne <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/nocturne/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
ln -sfn /etc/nginx/sites-available/nocturne /etc/nginx/sites-enabled/nocturne
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

log "Starting the API with PM2 as $APP_USER."
if runuser -u "$APP_USER" -- env HOME="$APP_HOME" pm2 describe nocturne-api >/dev/null 2>&1; then
  runuser -u "$APP_USER" -- env HOME="$APP_HOME" pm2 restart nocturne-api --update-env
else
  runuser -u "$APP_USER" -- env HOME="$APP_HOME" pm2 start "$APP_DIR/backend/server.js" \
    --name nocturne-api --cwd "$APP_DIR" --time
fi
runuser -u "$APP_USER" -- env HOME="$APP_HOME" pm2 save
pm2 startup systemd -u "$APP_USER" --hp "$APP_HOME"

log "Setup complete. Check PM2 with: sudo -u $APP_USER pm2 status"
log "Health endpoint: http://127.0.0.1/api/health"
