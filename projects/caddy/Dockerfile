FROM caddy:2-alpine

# The context for this Dockerfile is the root of the runestone repo
LABEL org.opencontainers.image.source=https://github.com/RunestoneInteractive/rs

COPY projects/caddy/Caddyfile /etc/caddy/Caddyfile

# Copy the shared staticAssets so they can be served directly by Caddy
# (mirrors what projects/nginx/Dockerfile does for nginx).
COPY components/rsptx/templates/staticAssets /srv/staticAssets

# This image is an alternative to projects/nginx. It performs identical routing
# but uses Caddy so HTTPS works out of the box - automatic Let's Encrypt for a
# real domain, or a locally-trusted cert for dev. See projects/caddy/Caddyfile
# for the CADDY_SITE_ADDRESS / CADDY_ACME_EMAIL knobs.
