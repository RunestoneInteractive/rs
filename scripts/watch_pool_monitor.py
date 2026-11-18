#!/usr/bin/env python3
"""Watch a JSON log stream and summarize db pool_monitor lines.

Reads a log file containing one JSON object per line, e.g.::

    {"container_name":"/production-book-1","source":"stdout",
     "log":"INFO - 2026-09-19 17:07:35,953 - pool_monitor - _log_summary - 267 - db pool: async 0/30 in use (peak 6 this window, 13 lifetime); sync 0/15 in use (peak 0); loop lag mean 0.3ms max 47.0ms (lifetime max 236.0ms)",
     "client_ip":"10.136.0.2","timestamp":"2026-09-19T17:07:35Z","tag":"runestone.book"}

and every ``--interval`` seconds prints the most recent async peak-this-window
and mean loop lag for each client_ip (translated to a short host name via
/etc/hosts) and container.  Every ``--json-interval`` seconds it also writes a
JSON summary of the window to ``--json-out``.

Examples::

    ./scripts/watch_pool_monitor.py /var/log/runestone.log
    ssh server1 'tail -F /var/log/runestone.log' | ./scripts/watch_pool_monitor.py -
    ./scripts/watch_pool_monitor.py --once /var/log/runestone.log
    ./scripts/watch_pool_monitor.py --no-json /var/log/runestone.log   # table only
    ./scripts/watch_pool_monitor.py /var/log/fluent/buffer.62f1a.log

A ``buffer.<hex>.log`` argument is treated as "the one buffer file in this
directory": the hex chunk id changes as buffers roll over, so the directory is
re-globbed and the new file picked up automatically.
"""

import argparse
import json
import os
import re
import sys
import tempfile
import time
from datetime import datetime, timezone

# "db pool: async 0/30 in use (peak 6 this window, 13 lifetime); sync 0/15 in
#  use (peak 0); loop lag mean 0.3ms max 47.0ms (lifetime max 236.0ms)"
POOL_RE = re.compile(
    r"db pool:\s*"
    r"async\s+(?P<async_in_use>\d+)/(?P<async_size>\d+)\s+in use\s*"
    r"\(peak\s+(?P<async_peak>\d+)\s+this window,\s*(?P<async_peak_life>\d+)\s+lifetime\)"
    r".*?"
    r"sync\s+(?P<sync_in_use>\d+)/(?P<sync_size>\d+)\s+in use\s*\(peak\s+(?P<sync_peak>\d+)\)"
    r".*?"
    r"loop lag mean\s+(?P<lag_mean>[\d.]+)ms\s+max\s+(?P<lag_max>[\d.]+)ms"
    r"(?:\s*\(lifetime max\s+(?P<lag_max_life>[\d.]+)ms\))?"
)


def load_hosts(path):
    """Return {ip: short_name} from an /etc/hosts style file."""
    hosts = {}
    try:
        with open(path) as f:
            for line in f:
                line = line.split("#", 1)[0].strip()
                if not line:
                    continue
                parts = line.split()
                ip, names = parts[0], parts[1:]
                if not names:
                    continue
                # first name wins so later duplicate-IP entries don't clobber it
                hosts.setdefault(ip, names[0].split(".")[0])
    except OSError as e:
        print(f"warning: could not read {path}: {e}", file=sys.stderr)
    return hosts


def parse_line(line):
    """Return a sample dict for a pool_monitor line, else None."""
    line = line.strip()
    if not line or "pool_monitor" not in line:
        return None
    try:
        rec = json.loads(line)
    except (ValueError, TypeError):
        return None
    if not isinstance(rec, dict):
        return None
    m = POOL_RE.search(rec.get("log") or "")
    if not m:
        return None
    d = m.groupdict()
    return {
        "client_ip": rec.get("client_ip") or "?",
        "container": (rec.get("container_name") or "?").lstrip("/"),
        "timestamp": rec.get("timestamp") or "",
        "async_in_use": int(d["async_in_use"]),
        "async_size": int(d["async_size"]),
        "async_peak": int(d["async_peak"]),
        "async_peak_life": int(d["async_peak_life"]),
        "sync_in_use": int(d["sync_in_use"]),
        "sync_size": int(d["sync_size"]),
        "sync_peak": int(d["sync_peak"]),
        "lag_mean": float(d["lag_mean"]),
        "lag_max": float(d["lag_max"]),
        "lag_max_life": float(d["lag_max_life"]) if d["lag_max_life"] else None,
    }


BUFFER_RE = re.compile(r"^buffer\.[0-9a-fA-F]+\.log$")


def buffer_resolver(path):
    """If path looks like buffer.<hex>.log, return a callable finding the current one.

    Fluentd-style buffer files are renamed with a fresh hex chunk id, so the
    name given on the command line goes stale.  There is only ever one
    buffer.<hex>.log in the directory, so we re-glob for it.  Returns None when
    path is an ordinary log file.
    """
    directory, name = os.path.split(path)
    if not BUFFER_RE.match(name):
        return None
    directory = directory or "."

    def resolve():
        try:
            names = [n for n in os.listdir(directory) if BUFFER_RE.match(n)]
        except OSError:
            return None
        if not names:
            return None
        if len(names) > 1:  # shouldn't happen; take the one being written to
            names.sort(key=lambda n: os.stat(os.path.join(directory, n)).st_mtime)
        return os.path.join(directory, names[-1])

    return resolve


def _open_log(path, at_end):
    """Open path, optionally seeking to the end.  Returns (file, ino, dev)."""
    f = open(path, errors="replace")
    if at_end:
        f.seek(0, os.SEEK_END)
    st = os.fstat(f.fileno())
    return f, st.st_ino, st.st_dev


def follow(path, poll=0.5):
    """Yield lines forever, handling truncation, rotation and buffer renames.

    Yields None on each idle tick so the caller can report on schedule.
    """
    if path == "-":
        for line in sys.stdin:
            yield line
        return

    resolve = buffer_resolver(path)
    f = ino = dev = None
    current = None

    while True:
        if f is None:  # opening for the first time, or after the file vanished
            target = resolve() if resolve else path
            if target:
                try:
                    # a fresh buffer file is read whole; the initial file is not
                    f, ino, dev = _open_log(target, at_end=current is None)
                    current = target
                except OSError:
                    f = None
            if f is None:
                yield None
                time.sleep(poll)
                continue

        line = f.readline()
        if line:
            yield line
            continue

        yield None
        time.sleep(poll)

        if resolve:
            target = resolve()
            if target is None:
                # no buffer file at the moment; keep reading the open handle
                # until a new chunk shows up
                continue
            if target != current:  # buffer chunk rolled over
                f.close()
                f = None
                continue
        else:
            target = path

        try:
            st = os.stat(target)
        except OSError:
            continue
        if (st.st_ino, st.st_dev) != (ino, dev):  # rotated in place
            f.close()
            f, ino, dev = _open_log(target, at_end=False)
            current = target
        elif st.st_size < f.tell():  # truncated
            f.seek(0)


def read_all(path):
    if path != "-":
        resolve = buffer_resolver(path)
        path = (resolve() if resolve else path) or path
    stream = sys.stdin if path == "-" else open(path, errors="replace")
    try:
        for line in stream:
            yield line
    finally:
        if stream is not sys.stdin:
            stream.close()


def age(ts):
    """Seconds between an ISO-8601 Z timestamp and now, or None."""
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - dt).total_seconds()


DEFAULT_JSON_OUT = "~/Runestone/Dash/conns.json"


class Window:
    """Aggregates the samples seen for one key since the last JSON write."""

    def __init__(self):
        self.latest = None
        self.count = 0
        self.async_peak_max = 0
        self.async_in_use_max = 0
        self.lag_mean_max = 0.0
        self.lag_max_max = 0.0

    def add(self, s):
        self.latest = s
        self.count += 1
        self.async_peak_max = max(self.async_peak_max, s["async_peak"])
        self.async_in_use_max = max(self.async_in_use_max, s["async_in_use"])
        self.lag_mean_max = max(self.lag_mean_max, s["lag_mean"])
        self.lag_max_max = max(self.lag_max_max, s["lag_max"])

    def reset(self):
        """Drop window aggregates but keep the last known sample."""
        self.count = 0
        self.async_peak_max = 0
        self.async_in_use_max = 0
        self.lag_mean_max = 0.0
        self.lag_max_max = 0.0


def summary(latest, hosts, window_seconds, show_containers):
    """Build the JSON-serializable summary document."""
    entries = []
    for (ip, container), w in sorted(
        latest.items(), key=lambda kv: (hosts.get(kv[0][0], kv[0][0]), kv[0][1])
    ):
        s = w.latest
        fresh = w.count > 0
        e = {
            "host": hosts.get(ip, ip),
            "client_ip": ip,
            "last_sample": s["timestamp"],
            "samples_in_window": w.count,
            "async_in_use": s["async_in_use"],
            "async_size": s["async_size"],
            "async_peak": s["async_peak"],
            "async_peak_lifetime": s["async_peak_life"],
            "async_peak_window_max": w.async_peak_max if fresh else None,
            "async_in_use_window_max": w.async_in_use_max if fresh else None,
            "sync_in_use": s["sync_in_use"],
            "sync_size": s["sync_size"],
            "sync_peak": s["sync_peak"],
            "lag_mean_ms": s["lag_mean"],
            "lag_max_ms": s["lag_max"],
            "lag_lifetime_max_ms": s["lag_max_life"],
            "lag_mean_window_max_ms": w.lag_mean_max if fresh else None,
            "lag_max_window_max_ms": w.lag_max_max if fresh else None,
        }
        if show_containers:
            e["container"] = container
        entries.append(e)

    return {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "window_seconds": window_seconds,
        "hosts": entries,
    }


def write_json(path, doc):
    """Write doc to path atomically so readers never see a partial file."""
    path = os.path.expanduser(path)
    directory = os.path.dirname(path) or "."
    try:
        os.makedirs(directory, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=directory, prefix=".conns-", suffix=".json")
        try:
            with os.fdopen(fd, "w") as f:
                json.dump(doc, f, indent=2)
                f.write("\n")
            os.chmod(tmp, 0o644)  # mkstemp defaults to 0600; dashboards need to read it
            os.replace(tmp, path)
        except Exception:
            os.unlink(tmp)
            raise
    except OSError as e:
        print(f"warning: could not write {path}: {e}", file=sys.stderr)


def report(latest, hosts, show_all):
    now = datetime.now().strftime("%H:%M:%S")
    if not latest:
        print(f"== {now} == no db pool samples yet")
        sys.stdout.flush()
        return

    rows = []
    for (ip, container), w in sorted(
        latest.items(), key=lambda kv: (hosts.get(kv[0][0], kv[0][0]), kv[0][1])
    ):
        s = w.latest
        secs = age(s["timestamp"])
        rows.append(
            {
                "host": hosts.get(ip, ip),
                "container": container,
                "async": f"{s['async_peak']}/{s['async_size']}",
                "in_use": f"{s['async_in_use']}",
                "lag": f"{s['lag_mean']:.1f}",
                "lag_max": f"{s['lag_max']:.1f}",
                "age": "-" if secs is None else f"{secs:.0f}s",
            }
        )

    cols = [
        ("host", "host"),
        ("container", "container"),
        ("in_use", "inuse"),
        ("async", "peak/size"),
        ("lag", "lag mean"),
        ("lag_max", "lag max"),
        ("age", "age"),
    ]
    if not show_all:
        cols = [c for c in cols if c[0] != "container"]
    widths = {key: max(len(head), max(len(r[key]) for r in rows)) for key, head in cols}

    print(f"\n== {now} == async peak this window / mean loop lag (ms)")
    print("  ".join(head.ljust(widths[key]) for key, head in cols))
    print("  ".join("-" * widths[key] for key, _ in cols))
    for r in rows:
        print("  ".join(r[key].ljust(widths[key]) for key, _ in cols))
    sys.stdout.flush()


def main():
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument(
        "logfile",
        help="JSON log file to watch, or - for stdin; a buffer.<hex>.log name "
        "tracks whichever buffer file is currently in that directory",
    )
    p.add_argument(
        "-i",
        "--interval",
        type=float,
        default=30.0,
        help="seconds between reports (default 30)",
    )
    p.add_argument(
        "--hosts",
        default="/etc/hosts",
        help="hosts file for ip -> name (default /etc/hosts)",
    )
    p.add_argument(
        "--once",
        action="store_true",
        help="read the whole file, print one report, exit",
    )
    p.add_argument(
        "--containers",
        action="store_true",
        help="show a row per container instead of per host",
    )
    p.add_argument(
        "--json-out",
        default=DEFAULT_JSON_OUT,
        help=f"JSON summary file (default {DEFAULT_JSON_OUT})",
    )
    p.add_argument(
        "--json-interval",
        type=float,
        default=300.0,
        help="seconds between JSON writes (default 300)",
    )
    p.add_argument(
        "--no-json", action="store_true", help="do not write the JSON summary"
    )
    args = p.parse_args()

    hosts = load_hosts(args.hosts)
    latest = {}

    def record(line):
        s = parse_line(line)
        if s:
            key = (s["client_ip"], s["container"] if args.containers else "")
            latest.setdefault(key, Window()).add(s)

    if args.once:
        for line in read_all(args.logfile):
            record(line)
        report(latest, hosts, args.containers)
        if not args.no_json:
            write_json(args.json_out, summary(latest, hosts, None, args.containers))
        return

    now = time.monotonic()
    next_report = now + args.interval
    next_json = now + args.json_interval
    try:
        for line in follow(args.logfile):
            if line is not None:
                record(line)
            now = time.monotonic()
            if now >= next_report:
                report(latest, hosts, args.containers)
                next_report = now + args.interval
            if not args.no_json and now >= next_json:
                write_json(
                    args.json_out,
                    summary(latest, hosts, args.json_interval, args.containers),
                )
                for w in latest.values():
                    w.reset()
                next_json = now + args.json_interval
    except KeyboardInterrupt:
        print()


if __name__ == "__main__":
    main()
