#!/usr/bin/env bash
set -euo pipefail

CURRENT=$(alembic current | awk '{print $1}')
HEAD=$(alembic heads | awk '{print $1}')

if [ "$CURRENT" != "$HEAD" ]; then
    echo "Database migration required:"
    echo "  current: $CURRENT"
    echo "  head:    $HEAD"
    CMD="alembic upgrade head"
    echo "I can run '$CMD' to update the database schema."
    read -r -p "Run migrations now? [y/N] " REPLY

    if [[ "$REPLY" =~ ^[Yy]$ ]]; then
        $CMD
        exit 0
    fi

    exit 1
fi

echo "Database schema is up to date."