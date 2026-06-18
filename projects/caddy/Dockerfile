# Build a Caddy binary that includes the transform-encoder plugin, which lets us
# emit access logs in the exact single-line format the old nginx config used
# (see the `log` block in Caddyfile). Stock Caddy only ships json/console.
FROM caddy:2-builder-alpine AS builder
RUN xcaddy build --with github.com/caddyserver/transform-encoder

FROM caddy:2-alpine

# The context for this Dockerfile is the root of the runestone repo
LABEL org.opencontainers.image.source=https://github.com/RunestoneInteractive/rs

# Use the custom-built binary (with transform-encoder) instead of the stock one.
COPY --from=builder /usr/bin/caddy /usr/bin/caddy

COPY projects/caddy/Caddyfile /etc/caddy/Caddyfile

# Copy the shared staticAssets so they can be served directly by Caddy
# (mirrors what projects/nginx/Dockerfile does for nginx).
COPY components/rsptx/templates/staticAssets /srv/staticAssets

# This image is an alternative to projects/nginx. It performs identical routing
# but uses Caddy so HTTPS works out of the box - automatic Let's Encrypt for a
# real domain, or a locally-trusted cert for dev. See projects/caddy/Caddyfile
# for the CADDY_SITE_ADDRESS / CADDY_ACME_EMAIL knobs.
