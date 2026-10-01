# Deploy Nocturne to Oracle Cloud Always Free

This guide deploys the Vite frontend and Express API together on one Ubuntu
24.04 ARM VM, with PostgreSQL running locally on that VM. Nginx serves the
frontend and reverse-proxies `/api/` to Express on `127.0.0.1:3000`. PM2 keeps
the API running. No database password or JWT secret belongs in GitHub.

## 1. Create the Oracle Cloud VM

1. Sign up or sign in at [cloud.oracle.com](https://cloud.oracle.com/).
2. Open **Compute → Instances → Create instance**.
3. Give the instance a name such as `nocturne`.
4. For the image, select **Ubuntu 24.04**.
5. Click **Change shape**, select **Ampere → VM.Standard.A1.Flex**, and choose
   **2 OCPUs** and **12 GB memory** (subject to your tenancy's current Always
   Free capacity and quota).
6. Set the boot volume to **50 GB**.
7. Add your SSH public key (paste the `.pub` key, or choose the public-key
   file). Keep the private key on your own computer.
8. Create the instance and note its public IPv4 address.

Always Free eligibility, quotas, capacity, and reclaim policies can change.
Confirm the current terms in your Oracle account before provisioning.

## 2. Configure network ingress

In the instance's **Networking** details, open its VCN and the subnet's
**Security List** (or the network security group attached to the VNIC). Add
stateful ingress rules:

| Source CIDR | IP protocol | Destination port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | `22` (SSH) |
| `0.0.0.0/0` | TCP | `80` (HTTP) |
| `0.0.0.0/0` | TCP | `443` (HTTPS) |

PostgreSQL port `5432` and the Node port `3000` should **not** be opened to the
public internet. Nginx is the public entry point.

## 3. Connect over SSH and configure secrets

From your computer, connect as the Ubuntu user (substitute the key path and
instance address):

```sh
ssh -i ~/.ssh/<private-key> ubuntu@<instance-public-ip>
```

Clone the repository and create the server-side configuration file:

```sh
sudo mkdir -p /var/www
sudo chown ubuntu:ubuntu /var/www
git clone https://github.com/neagsom229-lang/website_-Nocturne.git /var/www/nocturne
cd /var/www/nocturne
cp .env.example .env
chmod 600 .env
nano .env
```

For the **local PostgreSQL** deployment, use these entries in `.env` (replace
the placeholders on the VM; do not commit this file):

```dotenv
DB_NAME=nocturne
DB_USER=nocturne
DB_PASSWORD=<long-random-hex-password>
JWT_SECRET=<random-secret-at-least-32-characters>
YOUTUBE_API_KEY=
```

Generate safe random values on the VM if needed:

```sh
openssl rand -hex 32
openssl rand -base64 48
```

The first value is URL-safe for the database password. Keep `.env` private;
the setup script secures its saved configuration and writes a protected
runtime `.env` containing the local `DATABASE_URL`.

## 4. Run the setup script

Run the setup from the checkout. It installs PostgreSQL, Nginx, Node.js 22
LTS, and PM2; creates/updates the database role and database; applies
`migrations.sql`; builds the app; configures Nginx; and starts the API under
PM2:

```sh
sudo bash setup.sh
```

The script is safe to re-run: it re-applies idempotent schema migrations,
rebuilds the frontend, and restarts the PM2 app. It does not print database
passwords or the JWT secret.

Check the backend and health endpoint:

```sh
sudo -u ubuntu pm2 status
sudo -u ubuntu pm2 logs nocturne-api --lines 50
curl --fail http://127.0.0.1/api/health
```

The health response should include `"status":"ok"` and
`"database":"connected"`. PM2 logs should show the API listening on port
`3000`. Visit `http://<instance-public-ip>/` in a browser to test the app over
HTTP.

## 5. Configure HTTPS with Let's Encrypt

For a trusted Let's Encrypt certificate, first point a domain's DNS `A` record
to the instance's public IP and wait for DNS to resolve. Then install Certbot
and request a certificate (replace the domain and email):

```sh
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <your-domain> --redirect \
  --agree-tos --no-eff-email -m <your-email>
```

Choose the HTTPS redirect when prompted if `--redirect` is not supported by
your Certbot version. Certbot updates the Nginx site for TLS and configures
automatic renewal. Verify renewal configuration with:

```sh
sudo certbot renew --dry-run
```

Then visit `https://<your-domain>/`. A public IP alone is generally not enough
for the standard Let's Encrypt Nginx flow; configure a domain first.

## 6. Verify persistence after a reboot or redeploy

1. Register an account and save some data (for example, a media item or diary
   entry).
2. Confirm it is visible after logging out and back in.
3. Reboot the VM with `sudo reboot`, wait for it to return, and check
   `sudo -u ubuntu pm2 status`.
4. Log back in and confirm the account and saved data remain. PostgreSQL is
   installed on the VM's boot volume, so it survives app restarts and VM
   reboots. This is not a substitute for backups; configure and test backups
   separately.

To deploy a later GitHub update:

```sh
cd /var/www/nocturne
git pull --ff-only
sudo bash setup.sh
```

## Keep-alive and Oracle reclaim note

Oracle may reclaim Always Free resources under its current capacity and
utilization policies. A periodic HTTP request is **not a guarantee** against
reclamation and should not be treated as a way to bypass Oracle's policies.
For a basic health check, you can add a cron entry that requests the local
health endpoint every five minutes:

```sh
(crontab -l 2>/dev/null; echo '*/5 * * * * curl --fail --silent --max-time 10 http://127.0.0.1/api/health >/dev/null 2>&1') | crontab -
```

This can detect/check local app health, but it may not count as meaningful
resource utilization. Monitor Oracle notices, follow the current Always Free
terms, and keep independent backups of PostgreSQL data.

## Troubleshooting

- **SSH times out:** Check the instance's public IP, VCN route table/Internet
  Gateway, and TCP `22` ingress rule.
- **Browser cannot connect:** Check TCP `80` and `443` ingress, then run
  `sudo nginx -t` and `sudo systemctl status nginx`.
- **API health fails:** Run `sudo -u ubuntu pm2 status` and
  `sudo -u ubuntu pm2 logs nocturne-api --lines 100`. Confirm PostgreSQL is
  running with `sudo systemctl status postgresql`.
- **Database authentication fails:** Check `/etc/nocturne/setup.env` and
  `/var/www/nocturne/.env` permissions/values. Re-run `sudo bash setup.sh`
  after correcting the setup config.
- **Frontend route returns 404:** Confirm Nginx has
  `try_files $uri $uri/ /index.html;` and reload it with
  `sudo systemctl reload nginx`.
