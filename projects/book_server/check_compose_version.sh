#!/bin/sh
# Preflight check run by the `preflight` service in docker-compose.yml.
#
# The compose file declares the schema version it provides via the
# COMPOSE_SCHEMA_VERSION environment variable; this image bakes in the minimum
# version it requires via REQUIRED_COMPOSE_SCHEMA_VERSION (see
# projects/book_server/Dockerfile). If the user's docker-compose.yml is older
# than the image needs, stop the stack here with an actionable message instead
# of letting it fail in confusing ways at runtime.
set -eu

have="${COMPOSE_SCHEMA_VERSION:-0}"
need="${REQUIRED_COMPOSE_SCHEMA_VERSION:-0}"

# Treat empty / non-numeric values as 0 (e.g. a pre-versioning compose file).
case "$have" in *[!0-9]* | "") have=0 ;; esac
case "$need" in *[!0-9]* | "") need=0 ;; esac

if [ "$have" -lt "$need" ]; then
	echo "============================================================" >&2
	echo "ERROR: your docker-compose.yml is out of date." >&2
	echo >&2
	echo "  This image requires compose schema version >= $need" >&2
	echo "  but your docker-compose.yml provides version $have." >&2
	echo >&2
	echo "  Update your docker-compose.yml with:" >&2
	echo "      ./init_runestone.sh update" >&2
	echo "  then bring the stack up again:" >&2
	echo "      docker compose up -d" >&2
	echo "============================================================" >&2
	exit 1
fi

echo "compose schema check OK (file provides $have, image requires $need)"
exit 0
