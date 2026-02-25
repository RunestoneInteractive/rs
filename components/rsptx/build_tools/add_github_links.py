#!/usr/bin/env python3
import argparse
import os
from pathlib import Path


def build_github_url(
    owner: str, repo: str, branch: str, root: Path, file_path: Path, line: int | None
) -> str:
    # "root" should be the repository root; we build a URL
    # relative to that so it matches the layout on GitHub.
    rel = file_path.relative_to(root).as_posix()
    base = f"https://github.com/{owner}/{repo}/blob/{branch}/{rel}"
    if line is not None:
        return f"{base}#L{line}"
    return base


def is_github_source_url_line(line: str, repo: str) -> bool:
    """Return True if this line is one of *our* GitHub source <url> lines.

    These lines are local-only and never pushed to GitHub, so they must not
    be counted when computing line numbers for GitHub URLs.
    """
    stripped = line.strip()
    return (
        stripped.startswith("<url")
        and "github.com" in stripped
        and repo in stripped
        and "Source on GitHub" in stripped
    )


def find_exercise_open_line(lines: list[str], close_index: int) -> int | None:
    """
    Walk backward from close_index to find the line where the matching
    <exercise ...> tag begins. Returns a 0-based index, or None if not found.
    """
    for idx in range(close_index, -1, -1):
        stripped = lines[idx].lstrip()
        if stripped.startswith("<exercise") and not stripped.startswith("</exercise"):
            return idx
    return None


def process_file(
    path: Path, root: Path, owner: str, repo: str, branch: str, dry_run: bool
) -> int:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)

    # First pass: map physical line numbers to "virtual" GitHub line numbers,
    # ignoring any existing GitHub source <url> lines (which never exist on GitHub).
    phys_to_virtual: list[int | None] = []
    virtual_line = 0
    for line in lines:
        if is_github_source_url_line(line, repo):
            phys_to_virtual.append(None)
        else:
            virtual_line += 1
            phys_to_virtual.append(virtual_line)

    # Second pass: locate every exercise, its opening line, and any existing
    # GitHub source <url> right after it.
    exercises: list[dict] = []
    for i, line in enumerate(lines):
        if "</exercise>" not in line:
            continue

        close_idx = i
        open_idx = find_exercise_open_line(lines, close_idx)
        if open_idx is None:
            exercise_line_number = None
        else:
            exercise_line_number = phys_to_virtual[open_idx]

        # Look ahead for an existing GitHub source <url> line
        j = close_idx + 1
        while j < len(lines) and lines[j].strip() == "":
            j += 1

        existing_url_index = None
        if j < len(lines) and is_github_source_url_line(lines[j], repo):
            existing_url_index = j

        exercises.append(
            {
                "close_idx": close_idx,
                "open_idx": open_idx,
                "exercise_line_number": exercise_line_number,
                "existing_url_index": existing_url_index,
            }
        )

    if not exercises:
        return 0

    # Build fast lookup tables for rewriting.
    close_to_ex = {e["close_idx"]: e for e in exercises}
    url_to_ex = {
        e["existing_url_index"]: e
        for e in exercises
        if e["existing_url_index"] is not None
    }

    # Third pass: rebuild the file contents with corrected URLs and without
    # counting our local-only <url> lines toward GitHub line numbers.
    new_lines: list[str] = []
    insert_count = 0

    for idx, line in enumerate(lines):
        # Skip existing GitHub source URL lines; we'll reinsert/update them at
        # the matching </exercise> line.
        if idx in url_to_ex:
            continue

        if idx in close_to_ex:
            ex = close_to_ex[idx]
            # Always keep the closing </exercise> line
            new_lines.append(line)

            # Determine indentation and newline style based on this line
            stripped = line.lstrip(" \t")
            indent = line[: len(line) - len(stripped)]
            newline = "\n"
            if line.endswith("\r\n"):
                newline = "\r\n"

            exercise_line_number = ex["exercise_line_number"]
            github_url = build_github_url(
                owner, repo, branch, root, path, exercise_line_number
            )
            url_line = (
                f'{indent}<url href="{github_url}">Source on GitHub</url>{newline}'
            )

            new_lines.append(url_line)

            if ex["existing_url_index"] is None:
                insert_count += 1
        else:
            new_lines.append(line)

    if not dry_run and new_lines != lines:
        path.write_text("".join(new_lines), encoding="utf-8")

    return insert_count


def main():
    parser = argparse.ArgumentParser(
        description="Add a GitHub <url> after every </exercise> in XML files, including a line-number anchor."
    )
    parser.add_argument(
        "--root",
        type=str,
        default=".",
        help="Root of the repository (default: current directory).",
    )
    parser.add_argument(
        "--owner",
        type=str,
        default="PreTeXtBook",
        help="GitHub owner/user name (default: PreTeXtBook).",
    )
    parser.add_argument(
        "--repo",
        type=str,
        default="pretext",
        help="GitHub repository name (default: pretext).",
    )
    parser.add_argument(
        "--branch",
        type=str,
        default="master",
        help="Git branch name for links (default: master).",
    )
    parser.add_argument(
        "--file",
        type=str,
        help="Single XML file to process (relative to --root or absolute). "
        "If omitted, all XML files under --root are processed.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not modify files, just report what would change.",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()

    if args.file:
        target = Path(args.file)
        if not target.is_absolute():
            target = (root / target).resolve()
        if not target.exists():
            print(f"Error: file not found: {target}")
            return
        if target.suffix != ".xml":
            print(f"Warning: file does not have .xml suffix: {target}")

        inserts = process_file(
            target, root, args.owner, args.repo, args.branch, args.dry_run
        )
        prefix = "[DRY-RUN] " if args.dry_run else ""
        print(f"{prefix}Updated {target}: added {inserts} <url> tag(s)")
        print(
            f"Done. Files changed: {1 if inserts else 0}, <url> tags added: {inserts}"
        )
        return

    # No --file: process all XML files under root
    total_files = 0
    total_inserts = 0
    for dirpath, _, filenames in os.walk(root):
        for fname in filenames:
            if not fname.endswith(".xml"):
                continue
            fpath = Path(dirpath, fname)
            inserts = process_file(
                fpath, root, args.owner, args.repo, args.branch, args.dry_run
            )
            if inserts:
                total_files += 1
                total_inserts += inserts
                print(
                    f"{'[DRY-RUN] ' if args.dry_run else ''}Updated {fpath}: added {inserts} <url> tag(s)"
                )

    print(f"Done. Files changed: {total_files}, <url> tags added: {total_inserts}")


if __name__ == "__main__":
    main()
