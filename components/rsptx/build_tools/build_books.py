#!/usr/bin/env python3
#
# `build_books.py` - Build and deploy all of the books in the library
# ====================================================================
# Iterate over the library table and rebuild every book that is in use
# (for_classes or is_visible).  After a successful build the book is rsynced
# to each of the app servers (server1..serverN) and the last_build /
# last_deploy timestamps in the library table are updated.
#
# PreTeXt books are built in-process using ``_build_ptx_book``.  Runestone
# (legacy RST) books are built by shelling out to the ``runestone`` binary in
# a separate virtualenv (``~/.virtualenvs/buildr/bin`` by default, override
# with the RUNESTONE_BIN environment variable) since the legacy build code is
# no longer part of this repository.

import contextlib
import getpass
import io
import os
import re
import subprocess
import traceback
from collections import namedtuple
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import click
import pretext
from rich.console import Console
from rich.table import Table
from sqlalchemy import create_engine, select, update, or_, func
from sqlalchemy.orm.session import sessionmaker

from rsptx.build_tools.core import _build_ptx_book
from rsptx.build_tools.notifications import notify
from rsptx.db.models import Library, Courses
from rsptx.response_helpers.core import canonical_utcnow

console = Console()


class Config:
    def __init__(self):
        conf = os.environ.get("WEB2PY_CONFIG", "production")
        if conf == "production":
            self.dburl = os.environ.get("DBURL")
        elif conf == "development":
            self.dburl = os.environ.get("DEV_DBURL")
        elif conf == "test":
            self.dburl = os.environ.get("TEST_DBURL")
        else:
            click.echo("Incorrect WEB2PY_CONFIG")
            self.dburl = None


def runestone_binary():
    default = Path.home() / ".virtualenvs" / "buildr" / "bin" / "runestone"
    return os.environ.get("RUNESTONE_BIN", str(default))


def tool_versions() -> str:
    """
    Report the versions of the two build systems: pretext from this venv and
    runestone from the buildr venv.
    """
    rs_version = "not found"
    binary = runestone_binary()
    if Path(binary).exists():
        res = subprocess.run([binary, "--version"], capture_output=True, text=True)
        if m := re.search(r"version\s+([\d.]+)", res.stdout + res.stderr):
            rs_version = m.group(1)
    return f"PreTeXt {pretext.VERSION} | Runestone {rs_version}"


def resolve_dirs(book_path: Path, book: Library) -> tuple[Path, Path]:
    """
    Find the repository and source directories for a book.  The repo_path
    column (minus any leading /books/) is relative to BOOK_PATH; fall back to
    the basecourse name.  If source_path is set the book source lives in that
    subdirectory of the repository.
    """
    repo = book.repo_path or book.basecourse
    repo = repo.removeprefix("/books/").lstrip("/")
    repodir = book_path / repo
    workdir = repodir
    if book.source_path:
        workdir = workdir / book.source_path.strip("/")
    return repodir, workdir


def git_pull(repodir: Path) -> dict:
    """
    Pull the latest book source from github.  On failure (merge conflict,
    network, not a repo...) abort any half-done merge so the working tree is
    clean, and report -- the build proceeds with the current checkout.
    """
    res = subprocess.run(["git", "pull"], capture_output=True, text=True, cwd=repodir)
    if res.returncode == 0:
        return {"completed": True, "status": "up to date"}
    subprocess.run(["git", "merge", "--abort"], capture_output=True, cwd=repodir)
    lines = [x for x in (res.stderr + res.stdout).strip().splitlines() if x]
    reason = lines[-1] if lines else "unknown error"
    return {"completed": False, "status": f"git pull failed: {reason}"}


def run_hook(command: str, workdir: Path, label: str) -> dict:
    """
    Run a per-book pre/post build hook command (from the prebuild_hook /
    postbuild_hook library columns) with the book's work directory as cwd.
    """
    console.print(f"Running {label} hook: {command}")
    res = subprocess.run(
        command, shell=True, capture_output=True, text=True, cwd=workdir
    )
    if res.returncode != 0:
        lines = [x for x in (res.stderr + res.stdout).strip().splitlines() if x]
        reason = lines[-1] if lines else "unknown error"
        return {"completed": False, "status": f"{label} hook failed: {reason}"}
    return {"completed": True, "status": f"{label} hook succeeded"}


def build_runestone_book(course: str, workdir: Path) -> dict:
    """
    Build a legacy Runestone (RST) book using the runestone binary from the
    buildr virtualenv, then deploy it to the published folder.
    """
    binary = runestone_binary()
    if not Path(binary).exists():
        return {"completed": False, "status": f"runestone binary not found: {binary}"}

    # This script runs inside the rs virtualenv, whose sphinx-build and
    # runestone package would shadow the buildr venv's in any subprocess.
    env = os.environ.copy()
    env["PATH"] = f"{Path(binary).parent}{os.pathsep}{env.get('PATH', '')}"
    for var in ["VIRTUAL_ENV", "PYTHONPATH", "PYTHONHOME"]:
        env.pop(var, None)

    with open(workdir / "author_build.log", "wb") as olfile:
        for cmd in [f"{binary} build --all", f"{binary} deploy"]:
            res = subprocess.run(
                cmd, shell=True, capture_output=True, cwd=workdir, env=env
            )
            olfile.write(res.stdout)
            olfile.write(b"\n====\n")
            olfile.write(res.stderr)
            if res.returncode != 0:
                return {
                    "completed": False,
                    "status": f"{cmd} failed, check author_build.log",
                }
    return {"completed": True, "status": "Build completed successfully"}


def reclaim_book_ownership(book_path: Path) -> None:
    """
    Docker-based builds can leave files under BOOK_PATH owned by root, which
    then break subsequent builds and the marker-file touches.  Reclaim them for
    the current user before building.

    Production has a passwordless sudoers entry for exactly this find command;
    ``sudo -n`` (the ``-n`` is a sudo option, not part of the matched command,
    so the sudoers rule still applies) runs it non-interactively so it fails
    fast -- and we warn and carry on -- anywhere that entry is not set up,
    instead of blocking on a password prompt.
    """
    user = getpass.getuser()
    cmd = [
        "sudo",
        "-n",
        "/usr/bin/find",
        f"{book_path}/",
        "-user",
        "root",
        "-exec",
        "chown",
        f"{user}:{user}",
        "{}",
        ";",
    ]
    console.print(f"[bold]Reclaiming root-owned files under {book_path}/[/bold]")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        reason = (res.stderr or res.stdout).strip() or "unknown error"
        console.print(
            f"[yellow]Could not reclaim ownership (continuing anyway): "
            f"{reason}[/yellow]"
        )


def touch_marker(path: Path) -> None:
    """
    Touch a build/deploy marker file (``build_success`` / ``sync_success``) that
    the author server and monitoring use to track freshness.  Writing this
    bookkeeping file is best-effort: a permission or other OS error is a warning,
    never a reason to fail an otherwise-successful build or deploy.
    """
    try:
        path.touch()
    except OSError as e:
        console.print(f"[yellow]Could not touch {path}: {e}[/yellow]")


def deploy_book(course: str, book_path: Path, num_servers: int, clean: bool) -> dict:
    """
    Rsync the published book to server1..serverN.  Returns the same
    completed/status dict shape as the build functions.
    """
    src = book_path / course / "published" / course
    if not src.exists():
        return {"completed": False, "status": f"nothing to deploy: {src} not found"}

    for i in range(1, num_servers + 1):
        server = f"server{i}"
        if clean:
            console.print(f"Cleaning {course} on {server}")
            res = subprocess.run(
                [
                    "ssh",
                    server,
                    f"rm -rf books/{course}; mkdir -p books/{course}/published/{course}",
                ],
                capture_output=True,
            )
            if res.returncode != 0:
                return {"completed": False, "status": f"clean failed on {server}"}
        console.print(f"Syncing {course} to {server}")
        res = subprocess.run(
            ["ssh", server, f"mkdir -p books/{course}/published/{course}"],
            capture_output=True,
        )
        if res.returncode != 0:
            return {"completed": False, "status": f"mkdir failed on {server}"}
        res = subprocess.run(
            [
                "rsync",
                "--quiet",
                "--exclude",
                "__pycache__",
                "-e",
                "ssh",
                "-P",
                "-rzc",
                str(src),
                f"{server}:~/books/{course}/published",
                "--delete",
                "--copy-links",
                "--perms",
            ],
            capture_output=True,
        )
        if res.returncode != 0:
            return {
                "completed": False,
                "status": f"rsync failed on {server}: {res.stderr.decode(errors='replace').strip()}",
            }

    touch_marker(book_path / course / "sync_success")
    return {"completed": True, "status": "Deployed successfully"}


def stamp(session_maker, course: str, **vals):
    stmt = update(Library).where(Library.basecourse == course).values(**vals)
    with session_maker.begin() as session:
        session.execute(stmt)


# A picklable snapshot of the library row -- passed to worker processes, which
# cannot receive the detached SQLAlchemy ORM instance safely.
BookSpec = namedtuple(
    "BookSpec",
    "basecourse repo_path source_path prebuild_hook postbuild_hook "
    "build_system target",
)

# The invocation-wide options every book build needs.  Picklable so it can be
# handed to worker processes.
BuildCtx = namedtuple(
    "BuildCtx",
    "book_path config generate deploy_only no_deploy num_servers clean",
)


def to_spec(lib: Library) -> BookSpec:
    return BookSpec(
        basecourse=lib.basecourse,
        repo_path=lib.repo_path,
        source_path=lib.source_path,
        prebuild_hook=lib.prebuild_hook,
        postbuild_hook=lib.postbuild_hook,
        build_system=lib.build_system,
        target=lib.target,
    )


def _notify_build_failure(course: str, status: str) -> None:
    """
    Send an immediate push notification for a single failed book build, so a
    failure is visible without waiting for the whole run to finish.  A failed
    notification must never take down the build itself.
    """
    try:
        notify("book build failed", f"{course}: {status}", 1)
    except Exception as e:
        print(f"notification for {course} failed: {e}")


def process_one_book(spec: BookSpec, ctx: BuildCtx, session_maker=None) -> tuple:
    """
    Pull, build, deploy and timestamp a single book.  Returns the
    (course, pulled, built, deployed, status) summary tuple.  Everything here
    is process-local (it changes the cwd and drives the PreTeXt logger), so it
    is safe to run in parallel across separate processes.  When ``session_maker``
    is None a private engine is created for the DB timestamp writes (the case
    for worker processes, which cannot share the parent's engine).
    """
    own_engine = None
    if session_maker is None:
        own_engine = create_engine(ctx.config.dburl.replace("+asyncpg", ""))
        session_maker = sessionmaker(bind=own_engine)
    try:
        course = spec.basecourse
        repodir, workdir = resolve_dirs(ctx.book_path, spec)

        pulled = None  # None means the pull was skipped (--deploy-only)
        pull_msg = ""
        build_res = {"completed": True, "status": "Build skipped (--deploy-only)"}
        if not ctx.deploy_only:
            if not workdir.is_dir():
                status = f"missing directory {workdir}"
                _notify_build_failure(course, status)
                return (course, False, False, False, status)
            pull_res = git_pull(repodir)
            pulled = pull_res["completed"]
            if not pulled:
                pull_msg = f"{pull_res['status']}; "
                console.print(
                    f"[yellow]{pull_res['status']} -- "
                    f"building {course} from the current checkout[/yellow]"
                )
            os.chdir(workdir)
            if spec.prebuild_hook:
                build_res = run_hook(spec.prebuild_hook, workdir, "prebuild")
            if build_res["completed"]:
                if spec.build_system == "PTX":
                    try:
                        build_res = _build_ptx_book(
                            ctx.config,
                            ctx.generate,
                            "runestone-manifest.xml",
                            course,
                            target=spec.target,
                        )
                    except Exception as e:
                        build_res = {"completed": False, "status": f"build error: {e}"}
                else:
                    build_res = build_runestone_book(course, workdir)
            if build_res["completed"] and spec.postbuild_hook:
                build_res = run_hook(spec.postbuild_hook, workdir, "postbuild")

            if not build_res["completed"]:
                status = pull_msg + build_res["status"]
                _notify_build_failure(course, status)
                return (course, pulled, False, False, status)
            stamp(session_maker, course, last_build=canonical_utcnow())
            touch_marker(ctx.book_path / course / "build_success")

        if ctx.no_deploy:
            return (
                course,
                pulled,
                True,
                False,
                pull_msg + "Deploy skipped (--no-deploy)",
            )
        deploy_res = deploy_book(course, ctx.book_path, ctx.num_servers, ctx.clean)
        if deploy_res["completed"]:
            stamp(session_maker, course, last_deploy=canonical_utcnow())
        return (
            course,
            pulled,
            build_res["completed"],
            deploy_res["completed"],
            pull_msg
            + (
                deploy_res["status"]
                if deploy_res["completed"]
                else f"{build_res['status']} / {deploy_res['status']}"
            ),
        )
    finally:
        if own_engine is not None:
            own_engine.dispose()


def _build_worker(spec: BookSpec, ctx: BuildCtx) -> tuple:
    """
    Worker-process entry point: run one book build with all of its output
    captured, so the parent can print each book's log as a clean block instead
    of interleaving lines from concurrent builds.  Returns (result, output).
    """
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
            result = process_one_book(spec, ctx)
    except Exception as e:
        buf.write(traceback.format_exc())
        result = (spec.basecourse, None, False, False, f"worker crashed: {e}")
    return result, buf.getvalue()


@click.command()
@click.option(
    "--book",
    multiple=True,
    help="Build only the given basecourse (may be repeated); default is all in-use books",
)
@click.option(
    "--exclude",
    multiple=True,
    help="Skip the given basecourse (may be repeated), even if --book names it",
)
@click.option("--clean", is_flag=True, help="Remove the remote book before syncing")
@click.option("--no-deploy", is_flag=True, help="Build only, do not rsync to servers")
@click.option(
    "--deploy-only", is_flag=True, help="Skip builds, just rsync the published books"
)
@click.option(
    "--dry-run", is_flag=True, help="Show what would be built/deployed and exit"
)
@click.option(
    "--gen",
    is_flag=True,
    help="Force PreTeXt to (re)generate assets, regardless of GENERATE_ASSETS",
)
@click.option(
    "--skip-chown",
    is_flag=True,
    help="Skip reclaiming root-owned files under BOOK_PATH before building",
)
@click.option(
    "-j",
    "--parallel",
    type=int,
    default=4,
    show_default=True,
    help="Build up to this many books at once (1 = sequential)",
)
def build_books(
    book, exclude, clean, no_deploy, deploy_only, dry_run, gen, skip_chown, parallel
):
    """
    Build every book in the library where for_classes or is_visible is true,
    then rsync each successfully built book to server1..serverN.
    """
    book_path = os.environ.get("BOOK_PATH")
    if not book_path:
        click.echo("You must set the BOOK_PATH environment variable")
        exit(1)
    book_path = Path(book_path).expanduser()

    num_servers = 0
    if not no_deploy:
        if "NUM_SERVERS" not in os.environ:
            click.echo("Set variable NUM_SERVERS (or use --no-deploy)")
            exit(1)
        num_servers = int(os.environ["NUM_SERVERS"])

    config = Config()
    if not config.dburl:
        click.echo("No database URL configured, check WEB2PY_CONFIG and DBURL")
        exit(1)

    versions = tool_versions()
    console.print(f"[bold]Build tools:[/bold] {versions}")

    engine = create_engine(config.dburl.replace("+asyncpg", ""))
    Session = sessionmaker(bind=engine)

    # Count how many courses derive from each base course so we can build the
    # most-used books first (a failure there affects the most students).
    course_count = (
        select(func.count(Courses.id))
        .where(Courses.base_course == Library.basecourse)
        .scalar_subquery()
    )
    query = (
        select(Library)
        .where(
            or_(Library.for_classes == True, Library.is_visible == True)  # noqa: E712
        )
        .order_by(course_count.desc(), Library.basecourse)
    )
    if book:
        query = select(Library).where(Library.basecourse.in_(book))
    with Session() as session:
        books = session.scalars(query).all()
        session.expunge_all()

    if not books:
        click.echo("No matching books found in the library table")
        exit(1)

    generate = gen or bool(os.environ.get("GENERATE_ASSETS", False))
    specs = [to_spec(lib) for lib in books]
    if exclude:
        excluded = set(exclude)
        skipped = [s.basecourse for s in specs if s.basecourse in excluded]
        specs = [s for s in specs if s.basecourse not in excluded]
        if skipped:
            console.print(f"[yellow]Excluding: {', '.join(skipped)}[/yellow]")
        missing = excluded - set(skipped)
        if missing:
            console.print(
                f"[yellow]--exclude names not in the build set: "
                f"{', '.join(sorted(missing))}[/yellow]"
            )
        if not specs:
            click.echo("All matching books were excluded")
            exit(1)

    ctx = BuildCtx(
        book_path=book_path,
        config=config,
        generate=generate,
        deploy_only=deploy_only,
        no_deploy=no_deploy,
        num_servers=num_servers,
        clean=clean,
    )

    reclaim = not deploy_only and not skip_chown

    if dry_run:
        if reclaim:
            click.echo(f"Would reclaim root-owned files under {book_path}/")
        for spec in specs:
            repodir, workdir = resolve_dirs(book_path, spec)
            console.rule(f"[bold]{spec.basecourse}")
            hooks = ""
            if spec.prebuild_hook:
                hooks += f" [prebuild: {spec.prebuild_hook}]"
            if spec.postbuild_hook:
                hooks += f" [postbuild: {spec.postbuild_hook}]"
            click.echo(
                f"Would pull {repodir} then build {spec.basecourse} "
                f"({spec.build_system}) in {workdir}{hooks} then sync to "
                f"{num_servers} servers"
            )
        return

    if reclaim:
        reclaim_book_ownership(book_path)

    results = []
    workers = max(1, min(parallel, len(specs)))
    if workers == 1:
        # Sequential: build in this process so output streams live.
        for spec in specs:
            console.rule(f"[bold]{spec.basecourse}")
            results.append(process_one_book(spec, ctx, session_maker=Session))
    else:
        # Parallel: each book builds in its own process (PreTeXt builds rely on
        # the process cwd and a global logger, so they cannot share one).  Each
        # worker captures its output; we print it as a block when it finishes.
        console.print(f"[bold]Building {len(specs)} books, {workers} at a time[/bold]")
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(_build_worker, spec, ctx): spec for spec in specs}
            for fut in as_completed(futures):
                result, output = fut.result()
                console.rule(f"[bold]{result[0]}")
                if output:
                    # Already-rendered plain text -- print verbatim so status
                    # strings aren't reinterpreted as rich markup.
                    print(output, end="")
                results.append(result)

    # Parallel builds finish out of order; report them in the build order.
    order = {spec.basecourse: i for i, spec in enumerate(specs)}
    results.sort(key=lambda r: order.get(r[0], len(order)))

    table = Table(title="Build and Deploy Summary", caption=versions)
    table.add_column("Book")
    table.add_column("Pulled")
    table.add_column("Built")
    table.add_column("Deployed")
    table.add_column("Status")
    failures = 0
    pull_failures = 0
    for course, pulled, built, deployed, status in results:
        # a failed pull is a warning, not a failure -- we built anyway
        if pulled is False:
            pull_failures += 1
        if not (built and (deployed or no_deploy)):
            failures += 1
        table.add_row(
            course,
            (
                "-"
                if pulled is None
                else "[green]yes[/green]" if pulled else "[yellow]no[/yellow]"
            ),
            "[green]yes[/green]" if built else "[red]no[/red]",
            "[green]yes[/green]" if deployed else "[red]no[/red]",
            status,
        )
    console.print(table)
    if pull_failures:
        console.print(
            f"[yellow]Warning: {pull_failures} book(s) could not be pulled "
            f"from github and were built from their current checkout[/yellow]"
        )

    pull_note = f" ({pull_failures} pull failures)" if pull_failures else ""
    if failures:
        notify(
            "build_books failed",
            f"{failures} of {len(results)} books failed{pull_note}",
            1,
        )
        exit(1)
    notify("build_books finished", f"All {len(results)} books succeeded{pull_note}", 0)


if __name__ == "__main__":
    build_books()
