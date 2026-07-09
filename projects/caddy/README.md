# Caddy reverse proxy

This is a drop-in alternative to the `nginx` service. It performs the exact same
routing as `projects/nginx/runestone` (see `Caddyfile`), but uses
[Caddy](https://caddyserver.com/) so that HTTPS works with little to no setup.

## Choosing how it listens

The listen address is controlled by `CADDY_SITE_ADDRESS` in your `.env`:

| Value | Behavior |
|-------|----------|
| _unset_ / `:80` | HTTP only — parity with the nginx container |
| `https://localhost` | Local-dev HTTPS using Caddy's **internal CA** (see trust step below) |
| `https://your.domain` | Automatic, publicly-trusted **Let's Encrypt** certificate |

After changing `.env`, recreate the container so it picks up the new value:

```bash
docker compose up -d caddy
```

## Local HTTPS: trusting the cert (`https://localhost`)

With `CADDY_SITE_ADDRESS=https://localhost`, Caddy serves HTTPS using a
certificate signed by its own local root CA. Your browser doesn't know that root
yet, so you'll get a security warning (and with HSTS, some browsers refuse to let
you click through at all). Install Caddy's root certificate once to fix this:

### macOS

```bash
# Pull Caddy's local root CA out of the container...
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt /tmp/caddy-root.crt

# ...and add it to the System keychain as a trusted root.
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain /tmp/caddy-root.crt
```

Then fully quit and reopen your browser and reload `https://localhost`.

### Linux (Debian/Ubuntu)

```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt \
  /usr/local/share/ca-certificates/caddy-local-root.crt
sudo update-ca-certificates
```

Firefox keeps its own trust store — import the `root.crt` under
*Settings → Privacy & Security → Certificates → View Certificates → Authorities*.

### Notes

- The root cert lives in the `caddy_data` named volume, so it survives restarts.
  If you remove that volume (`docker compose down -v` or deleting it), Caddy
  generates a new root and you'll need to trust it again.
- Don't want to install anything? Just click through the browser warning — the
  connection is still encrypted, it's only the trust chain that's unverified.

## Public HTTPS (real domain)

Set `CADDY_SITE_ADDRESS=https://your.domain` and make sure ports **80 and 443**
are reachable from the internet. Caddy will obtain and auto-renew a Let's Encrypt
certificate — no warnings, no manual trust. To receive expiry notices, add a
global `email you@example.com` option block at the top of the `Caddyfile`.
