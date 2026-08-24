#!/usr/bin/env python3
"""Report the latest published version of each GitHub Container Registry package.

Mirrors the listing at
https://github.com/orgs/RunestoneInteractive/packages?repo_name=rs
but reads the GitHub API instead of scraping HTML, so it also gets the exact
publish timestamp of the newest version of every package.

Auth: uses the `gh` CLI if it is installed and logged in (needs the
`read:packages` scope); otherwise falls back to $GITHUB_TOKEN / $GH_TOKEN.

Examples:
    python scripts/list_package_versions.py
    python scripts/list_package_versions.py --repo '' --org RunestoneInteractive
    python scripts/list_package_versions.py --json
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

API_ROOT = "https://api.github.com"


class ApiError(RuntimeError):
    pass


def _gh_available():
    return shutil.which("gh") is not None


def _get_via_gh(path):
    proc = subprocess.run(
        ["gh", "api", "-H", "Accept: application/vnd.github+json", path],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise ApiError(proc.stderr.strip() or f"gh api {path} failed")
    return json.loads(proc.stdout)


def _get_via_token(path, token):
    req = urllib.request.Request(
        API_ROOT + path,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise ApiError(
            f"{exc.code} {exc.reason} for {path}: {exc.read().decode()[:200]}"
        )


def make_fetcher():
    """Return a callable that GETs an API path and returns parsed JSON."""
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if _gh_available():
        return _get_via_gh
    if token:
        return lambda path: _get_via_token(path, token)
    raise ApiError(
        "No credentials: install/login the `gh` CLI or set GITHUB_TOKEN "
        "(needs the read:packages scope)."
    )


def list_packages(fetch, org, package_type):
    packages, page = [], 1
    while True:
        batch = fetch(
            f"/orgs/{org}/packages?package_type={package_type}&per_page=100&page={page}"
        )
        if not batch:
            break
        packages.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return packages


def latest_version(fetch, org, package_type, name):
    """Newest version of a package, preferring whatever carries the `latest` tag."""
    versions = fetch(
        f"/orgs/{org}/packages/{package_type}/{urllib.parse.quote(name, safe='')}"
        "/versions?per_page=100&page=1"
    )
    if not versions:
        return None
    versions.sort(key=lambda v: v.get("created_at") or "", reverse=True)
    tagged = [
        v
        for v in versions
        if "latest" in (v.get("metadata", {}).get("container", {}).get("tags") or [])
    ]
    return (tagged or versions)[0]


def version_label(version):
    tags = version.get("metadata", {}).get("container", {}).get("tags") or []
    named = [t for t in tags if t != "latest"]
    if named:
        return ", ".join(sorted(named))
    if tags:
        return tags[0]
    return (version.get("name") or "")[:19] + "  (untagged)"


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--org", default="RunestoneInteractive", help="GitHub organization"
    )
    parser.add_argument(
        "--repo",
        default="rs",
        help="only packages linked to this repo; pass '' for every package in the org",
    )
    parser.add_argument(
        "--package-type", default="container", help="container, npm, maven, ..."
    )
    parser.add_argument("--json", action="store_true", dest="as_json", help="emit JSON")
    args = parser.parse_args(argv)

    try:
        fetch = make_fetcher()
        packages = list_packages(fetch, args.org, args.package_type)
    except ApiError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if args.repo:
        packages = [
            p for p in packages if (p.get("repository") or {}).get("name") == args.repo
        ]
    packages.sort(key=lambda p: p["name"])

    rows = []
    for pkg in packages:
        try:
            version = latest_version(fetch, args.org, args.package_type, pkg["name"])
        except ApiError as exc:
            print(f"warning: {pkg['name']}: {exc}", file=sys.stderr)
            continue
        if version is None:
            continue
        rows.append(
            {
                "package": pkg["name"],
                "version": version_label(version),
                "published": version.get("created_at", ""),
                "digest": version.get("name", ""),
                "url": pkg.get("html_url", ""),
            }
        )

    if args.as_json:
        print(json.dumps(rows, indent=2))
        return 0

    if not rows:
        print("no packages found")
        return 0

    w_name = max(len(r["package"]) for r in rows + [{"package": "PACKAGE"}])
    w_ver = max(len(r["version"]) for r in rows + [{"version": "VERSION"}])
    print(f"{'PACKAGE':<{w_name}}  {'VERSION':<{w_ver}}  PUBLISHED")
    for r in rows:
        published = r["published"].replace("T", " ").replace("Z", " UTC")
        print(f"{r['package']:<{w_name}}  {r['version']:<{w_ver}}  {published}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
