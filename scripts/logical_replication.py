#!/usr/bin/env python3
"""Helpers for moving the Runestone database to a new Postgres server with
logical replication (e.g. the PG13 -> PG18 upgrade).

The rough plan, with the subcommand that helps at each step::

    1. check SOURCE [TARGET]       is the source ready to publish? (wal_level,
                                   tables without a primary key, unlogged
                                   tables, large objects) and, given a target,
                                   does it have the same tables, still empty?
    2. On the new server:          pg_dump --schema-only SOURCE | psql TARGET
    3. On the source:              CREATE PUBLICATION rs_upgrade FOR ALL TABLES;
       On the target:              CREATE SUBSCRIPTION rs_upgrade
                                     CONNECTION 'host=... dbname=... user=...'
                                     PUBLICATION rs_upgrade;
    4. status SOURCE TARGET        watch the initial copy finish and lag drop
    --- cutover: touch maintenance/ON (see projects/caddy/Caddyfile) ---
    5. status SOURCE TARGET        lag must be 0 bytes
    6. compare-counts SOURCE TARGET   row counts match
    7. sync-sequences SOURCE TARGET --apply
                                   sequences are NOT replicated; without this
                                   the first insert on the new server collides
    8. Point the DBURL settings at TARGET, restart services, on the target
       DROP SUBSCRIPTION rs_upgrade; then on the old server
       ALTER DATABASE <db> SET default_transaction_read_only = on;
       so a forgotten container fails loudly instead of writing to it.
    --- rm maintenance/ON ---

SOURCE and TARGET are database URLs; SQLAlchemy driver suffixes such as
``postgresql+asyncpg://`` are accepted. Nothing here changes either database
except ``sync-sequences --apply``.

Examples::

    uv run scripts/logical_replication.py check "$DEV_DBURL"
    uv run scripts/logical_replication.py status $OLD $NEW
    uv run scripts/logical_replication.py compare-counts $OLD $NEW --skip useinfo
    uv run scripts/logical_replication.py sync-sequences $OLD $NEW          # dry run
    uv run scripts/logical_replication.py sync-sequences $OLD $NEW --apply
"""

import argparse
import re
import sys

import psycopg2

# Schemas that belong to Postgres itself, never to the app.
SYSTEM_SCHEMAS = ("pg_catalog", "information_schema", "pg_toast")

USER_TABLES_SQL = """
    SELECT n.nspname, c.relname, c.relpersistence, c.relreplident,
           EXISTS (SELECT 1 FROM pg_constraint k
                   WHERE k.conrelid = c.oid AND k.contype = 'p') AS has_pk,
           c.reltuples::bigint AS est_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p')
      AND NOT c.relispartition
      AND n.nspname NOT IN %s
      AND n.nspname NOT LIKE 'pg_temp%%'
    ORDER BY 1, 2
"""

# A unique index on NOT NULL columns can serve as the replica identity in
# place of a primary key.
USABLE_UNIQUE_INDEX_SQL = """
    SELECT i.indexrelid::regclass::text
    FROM pg_index i
    WHERE i.indrelid = %s::regclass
      AND i.indisunique AND i.indimmediate AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND NOT EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
            AND NOT a.attnotnull)
    LIMIT 1
"""

SEQUENCES_SQL = """
    SELECT s.schemaname, s.sequencename, s.last_value,
           col.relname AS owner_table, col.attname AS owner_column
    FROM pg_sequences s
    LEFT JOIN LATERAL (
        SELECT t.relname, a.attname
        FROM pg_depend d
        JOIN pg_class t ON t.oid = d.refobjid
        JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
        WHERE d.objid = format('%%I.%%I', s.schemaname, s.sequencename)::regclass
          AND d.classid = 'pg_class'::regclass
          AND d.deptype IN ('a', 'i')
        LIMIT 1
    ) col ON true
    WHERE s.schemaname NOT IN %s
    ORDER BY 1, 2
"""


def connect(url):
    """Open an autocommit psycopg2 connection from a (SQLAlchemy-style) URL."""
    url = re.sub(r"^postgres(ql)?\+\w+://", "postgresql://", url)
    conn = psycopg2.connect(url)
    conn.autocommit = True
    return conn


def query(conn, sql, params=None):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def scalar(conn, sql, params=None):
    """First column of the first row, or None when there are no rows."""
    rows = query(conn, sql, params)
    return rows[0][0] if rows else None


def qname(schema, name):
    return f'"{schema}"."{name}"' if schema != "public" else f'"{name}"'


def user_tables(conn):
    return query(conn, USER_TABLES_SQL, (SYSTEM_SCHEMAS,))


class Report:
    """Collects problems so `check` can exit non-zero when any are found."""

    def __init__(self):
        self.problems = 0

    def ok(self, msg):
        print(f"  ok    {msg}")

    def warn(self, msg):
        print(f"  WARN  {msg}")

    def fail(self, msg):
        self.problems += 1
        print(f"  FAIL  {msg}")


def check_server(conn, role, report):
    version = scalar(conn, "SHOW server_version")
    print(f"{role}: PostgreSQL {version}, database {conn.info.dbname}")
    settings = dict(
        query(
            conn,
            """SELECT name, setting FROM pg_settings WHERE name IN
               ('wal_level', 'max_replication_slots', 'max_wal_senders',
                'max_logical_replication_workers', 'max_worker_processes')""",
        )
    )
    if role == "source":
        if settings["wal_level"] == "logical":
            report.ok("wal_level = logical")
        else:
            report.fail(
                f"wal_level = {settings['wal_level']}; set wal_level = logical "
                "in postgresql.conf and restart the source"
            )
        for name in ("max_replication_slots", "max_wal_senders"):
            if int(settings[name]) < 1:
                report.fail(f"{name} = {settings[name]}; needs at least 1")
        can_replicate = scalar(
            conn,
            "SELECT rolsuper OR rolreplication FROM pg_roles WHERE rolname = current_user",
        )
        if can_replicate:
            report.ok(f"role {conn.info.user} may replicate")
        else:
            report.warn(
                f"role {conn.info.user} lacks REPLICATION; the subscription's "
                "connection must use a role that has it"
            )
    else:
        report.ok(
            "max_logical_replication_workers = "
            f"{settings['max_logical_replication_workers']}, "
            f"max_worker_processes = {settings['max_worker_processes']}"
        )


def check_tables(conn, report):
    tables = user_tables(conn)
    print(f"  {len(tables)} tables")
    for schema, name, persistence, replident, has_pk, _ in tables:
        full = qname(schema, name)
        if persistence == "u":
            report.fail(f"{full} is UNLOGGED and will not replicate")
        if has_pk or replident in ("f", "i"):
            continue
        # Without a replica identity, INSERTs replicate but an UPDATE or
        # DELETE on the source errors out (and stops the app writing).
        index = scalar(conn, USABLE_UNIQUE_INDEX_SQL, (full,))
        if index:
            fix = f"ALTER TABLE {full} REPLICA IDENTITY USING INDEX {index};"
        else:
            fix = f"ALTER TABLE {full} REPLICA IDENTITY FULL;  -- or add a primary key"
        report.fail(f"{full} has no primary key or replica identity\n          {fix}")

    large_objects = scalar(conn, "SELECT count(*) FROM pg_largeobject_metadata")
    if large_objects:
        report.fail(
            f"{large_objects} large objects; these are not replicated, "
            "copy them separately"
        )
    else:
        report.ok("no large objects")

    n_seq = scalar(
        conn,
        "SELECT count(*) FROM pg_sequences WHERE schemaname NOT IN %s",
        (SYSTEM_SCHEMAS,),
    )
    report.warn(f"{n_seq} sequences are not replicated; run sync-sequences at cutover")
    return {(s, n) for s, n, *_ in tables}


def cmd_check(args):
    report = Report()
    src = connect(args.source)
    check_server(src, "source", report)
    src_tables = check_tables(src, report)

    if args.target:
        print()
        tgt = connect(args.target)
        check_server(tgt, "target", report)
        tgt_rows = {(s, n): est for s, n, *_, est in user_tables(tgt)}
        missing = sorted(src_tables - tgt_rows.keys())
        extra = sorted(tgt_rows.keys() - src_tables)
        for s, n in missing:
            report.fail(f"{qname(s, n)} missing on target (restore the schema first)")
        for s, n in extra:
            report.warn(f"{qname(s, n)} exists only on target")
        if not missing:
            report.ok("target has every source table")
        # The subscription's initial copy appends; existing rows would
        # collide on primary keys. reltuples is only an estimate, so look.
        # Skipped once a subscription exists, since then rows are expected.
        subscribed = scalar(tgt, "SELECT count(*) FROM pg_subscription")
        if not subscribed:
            nonempty = [
                qname(s, n)
                for s, n in sorted(tgt_rows.keys() & src_tables)
                if query(tgt, f"SELECT 1 FROM {qname(s, n)} LIMIT 1")
            ]
            if nonempty:
                report.fail(
                    f"{len(nonempty)} target tables already have rows: "
                    + ", ".join(nonempty[:10])
                    + (" ..." if len(nonempty) > 10 else "")
                )
            else:
                report.ok("target tables are empty")

    print()
    if report.problems:
        print(f"{report.problems} problem(s) to fix before replicating.")
        return 1
    print("Ready to replicate.")
    return 0


def cmd_status(args):
    src = connect(args.source)
    slots = query(
        src,
        """SELECT slot_name, active,
                  pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)::bigint
           FROM pg_replication_slots WHERE slot_type = 'logical'""",
    )
    print("source replication slots:")
    if not slots:
        print("  none (no subscription has connected yet)")
    for name, active, lag in slots:
        state = "active" if active else "INACTIVE"
        print(f"  {name:30} {state:9} lag {lag if lag is not None else '?'} bytes")

    if args.target:
        tgt = connect(args.target)
        states = query(
            tgt,
            """SELECT s.subname, r.srsubstate, count(*)
               FROM pg_subscription_rel r
               JOIN pg_subscription s ON s.oid = r.srsubid
               GROUP BY 1, 2 ORDER BY 1, 2""",
        )
        labels = {
            "i": "initializing",
            "d": "copying data",
            "f": "finished copy",
            "s": "synchronized",
            "r": "ready",
        }
        print("target subscription tables:")
        if not states:
            print("  none")
        for sub, state, n in states:
            print(f"  {sub:30} {labels.get(state, state):15} {n}")
        pending = query(
            tgt,
            """SELECT srrelid::regclass::text FROM pg_subscription_rel
               WHERE srsubstate <> 'r' ORDER BY 1""",
        )
        if pending:
            names = ", ".join(r[0] for r in pending[:10])
            print(f"  not ready yet: {names}{' ...' if len(pending) > 10 else ''}")
    return 0


def cmd_compare_counts(args):
    src = connect(args.source)
    tgt = connect(args.target)
    tables = [qname(s, n) for s, n, *_ in user_tables(src)]
    skip = set(args.skip or [])
    if args.tables:
        tables = [t for t in tables if t.strip('"') in args.tables]
    tables = [t for t in tables if t.strip('"') not in skip]
    mismatches = 0
    for table in tables:
        a = scalar(src, f"SELECT count(*) FROM {table}")
        try:
            b = scalar(tgt, f"SELECT count(*) FROM {table}")
        except psycopg2.Error as e:
            b = f"error: {e.pgerror or e}".strip()
        flag = "" if a == b else "  <-- MISMATCH"
        mismatches += bool(flag)
        if flag or args.verbose:
            print(f"{table:40} {a:>12} {b:>12}{flag}")
    print(f"{len(tables)} tables compared, {mismatches} mismatch(es)")
    return 1 if mismatches else 0


def cmd_sync_sequences(args):
    src = connect(args.source)
    tgt = connect(args.target)
    tgt_seqs = {
        (s, n): (table, col)
        for s, n, _, table, col in query(tgt, SEQUENCES_SQL, (SYSTEM_SCHEMAS,))
    }
    changed = 0
    for schema, name, last_value, _, _ in query(src, SEQUENCES_SQL, (SYSTEM_SCHEMAS,)):
        seq = qname(schema, name)
        if (schema, name) not in tgt_seqs:
            print(f"  WARN  {seq} missing on target")
            continue
        if last_value is None:
            continue  # never used on the source; leave the target at its start
        value = last_value + args.gap
        # Belt and braces: never set a sequence below rows already present
        # on the target, whatever the source said.
        table, col = tgt_seqs[(schema, name)]
        if table:
            existing = scalar(tgt, f'SELECT max("{col}") FROM {qname(schema, table)}')
            if existing is not None and existing > value:
                print(
                    f"  WARN  {seq}: target {table}.{col} already reaches "
                    f"{existing}, above source {last_value}; using {existing}"
                )
                value = existing
        current = scalar(tgt, f"SELECT last_value FROM {seq}")
        if current == value:
            continue
        changed += 1
        print(f"  {seq:50} {current:>12} -> {value}")
        if args.apply:
            query(tgt, "SELECT setval(%s, %s, true)", (seq, value))
    verb = "set" if args.apply else "would set (dry run, pass --apply)"
    print(f"{changed} sequence(s) {verb}")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description=__doc__.split("\n\n")[0],
        epilog="Run with no arguments to see the full upgrade plan.",
    )
    sub = parser.add_subparsers(dest="command")

    p = sub.add_parser("check", help="is the source (and target) ready?")
    p.add_argument("source")
    p.add_argument("target", nargs="?")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("status", help="replication slot lag and copy progress")
    p.add_argument("source")
    p.add_argument("target", nargs="?")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("compare-counts", help="exact row counts on both sides")
    p.add_argument("source")
    p.add_argument("target")
    p.add_argument("--tables", nargs="+", help="only these tables")
    p.add_argument("--skip", nargs="+", help="skip these (huge) tables")
    p.add_argument("-v", "--verbose", action="store_true", help="show every table")
    p.set_defaults(func=cmd_compare_counts)

    p = sub.add_parser("sync-sequences", help="copy sequence values to the target")
    p.add_argument("source")
    p.add_argument("target")
    p.add_argument(
        "--gap",
        type=int,
        default=0,
        help="add this much headroom to each value (default 0)",
    )
    p.add_argument("--apply", action="store_true", help="actually call setval")
    p.set_defaults(func=cmd_sync_sequences)

    args = parser.parse_args()
    if not args.command:
        print(__doc__)
        return 0
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
