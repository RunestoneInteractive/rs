#!/usr/bin/env bash
set -euo pipefail

CURRENT=$(alembic current | awk '{print $1}')
HEAD=$(alembic heads | awk '{print $1}')

if [ "$CURRENT" != "$HEAD" ]; then
    echo "Database migration required:"
    echo "  current: $CURRENT"
    echo "  head:    $HEAD"
    echo "Please run 'docker compose run --rm rsmanage alembic upgrade head' to update the database schema."
    exit 1
fi

echo "Database schema is up to date."