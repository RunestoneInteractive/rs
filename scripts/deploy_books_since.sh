#!/usr/bin/env bash
#
# deploy_books_since.sh - rsync every book built since a given date to one server
#
# Meant for seeding a new worker: for each $BOOK_PATH/<book> whose
# build_success marker is newer than DATE, rsync
# $BOOK_PATH/<book>/published/<book> to SERVER:~/books/<book>/published, using
# the same rsync options as deploy_book() in
# components/rsptx/build_tools/build_books.py.
#
# Unlike build_books this does not touch sync_success, since that marker means
# "deployed to all workers", not just this one.
#
# Usage:
#   scripts/deploy_books_since.sh [-n] SERVER DATE
#
#   SERVER  ssh destination, e.g. server6 or user@host
#   DATE    anything find -newermt understands, e.g. 2026-11-01 or "2026-11-01 13:30"
#   -n      dry run: list the books (and what rsync would change) without copying
#
# Environment:
#   BOOK_PATH  root of the book checkouts (required)

set -uo pipefail

usage() {
    echo "Usage: $0 [-n] SERVER DATE" >&2
    echo "  e.g. $0 server6 2026-11-01   or   $0 -n server6 \"2026-11-01 13:30\"" >&2
    exit 2
}

dry_run=0
while getopts ":nh" opt; do
    case $opt in
        n) dry_run=1 ;;
        *) usage ;;
    esac
done
shift $((OPTIND - 1))
[[ $# -eq 2 ]] || usage
server=$1
since=$2

: "${BOOK_PATH:?Set BOOK_PATH}"
[[ -d $BOOK_PATH ]] || { echo "BOOK_PATH $BOOK_PATH is not a directory" >&2; exit 1; }

# Collect the books first so a bad DATE fails before anything is copied.
if ! markers=$(find "$BOOK_PATH" -mindepth 2 -maxdepth 2 -name build_success -newermt "$since" 2>&1); then
    echo "find failed (is '$since' a valid date?): $markers" >&2
    exit 1
fi

books=()
while IFS= read -r marker; do
    [[ -n $marker ]] || continue
    book=$(basename "$(dirname "$marker")")
    if [[ -d $BOOK_PATH/$book/published/$book ]]; then
        books+=("$book")
    else
        echo "skip $book: $BOOK_PATH/$book/published/$book not found" >&2
    fi
done < <(printf '%s\n' "$markers" | sort)

if [[ ${#books[@]} -eq 0 ]]; then
    echo "No books with build_success newer than $since"
    exit 0
fi

echo "${#books[@]} book(s) built since $since: ${books[*]}"

# Fail fast if the server is unreachable rather than once per book.
if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$server" true; then
    echo "Cannot ssh to $server" >&2
    exit 1
fi

rsync_opts=(--exclude __pycache__ -e ssh -rzc --delete --copy-links --perms)
if [[ $dry_run -eq 1 ]]; then
    rsync_opts+=(--dry-run --itemize-changes)
else
    rsync_opts+=(--quiet)
fi

failed=()
n=0
for book in "${books[@]}"; do
    n=$((n + 1))
    echo "[$n/${#books[@]}] Syncing $book to $server"
    if [[ $dry_run -eq 0 ]] && ! ssh "$server" "mkdir -p books/$book/published/$book"; then
        echo "  mkdir failed on $server" >&2
        failed+=("$book")
        continue
    fi
    if ! rsync "${rsync_opts[@]}" "$BOOK_PATH/$book/published/$book" "$server:~/books/$book/published"; then
        echo "  rsync failed on $server" >&2
        failed+=("$book")
    fi
done

if [[ ${#failed[@]} -gt 0 ]]; then
    echo "FAILED (${#failed[@]}): ${failed[*]}" >&2
    exit 1
fi
if [[ $dry_run -eq 1 ]]; then
    echo "Dry run: ${#books[@]} book(s) would be copied to $server"
else
    echo "Done: ${#books[@]} book(s) copied to $server"
fi
