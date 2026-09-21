"""
Tests for the cached Jinja environments in the books router.

``serve_page`` used to build a fresh ``Jinja2Templates`` per request, so every
page view recompiled the whole book page -- 11ms for a median page and 44ms for
a large one, all of it synchronous work on the event loop.  Environments are now
shared and backed by an on-disk bytecode cache.

Three things have to stay true for that to be safe:

* PreTeXt and RST books keep their own delimiters, and never share bytecode
* a rebuilt book is picked up without a restart
* memory does not grow with the number of pages served
"""

import os

import pytest

from rsptx.book_server_api.routers import books


@pytest.fixture(autouse=True)
def clear_env_cache():
    books._book_templates.cache_clear()
    yield
    books._book_templates.cache_clear()


@pytest.fixture
def book_dir(tmp_path):
    """A minimal 'book' with one RST-style and one PreTeXt-style page."""
    d = tmp_path / "published" / "testbook"
    d.mkdir(parents=True)
    (d / "rst_page.html").write_text("<h1>{{ course_name }}</h1>")
    (d / "ptx_page.html").write_text("<h1>~._ course_name _.~</h1>")
    return str(d)


def test_environment_is_reused(book_dir):
    """The whole point: the same book does not get a new environment per call."""
    first = books._book_templates(book_dir, False)
    second = books._book_templates(book_dir, False)
    assert first is second


def test_pretext_and_rst_get_separate_environments(book_dir):
    rst = books._book_templates(book_dir, False)
    ptx = books._book_templates(book_dir, True)
    assert rst is not ptx
    assert rst.env.variable_start_string == "{{"
    assert ptx.env.variable_start_string == "~._"
    assert ptx.env.comment_start_string == "@@#"


def test_rst_delimiters_render(book_dir):
    env = books._book_templates(book_dir, False).env
    assert env.get_template("rst_page.html").render(course_name="fopp") == (
        "<h1>fopp</h1>"
    )


def test_pretext_delimiters_render(book_dir):
    env = books._book_templates(book_dir, True).env
    assert env.get_template("ptx_page.html").render(course_name="thinkcs") == (
        "<h1>thinkcs</h1>"
    )


def test_pretext_env_has_the_url_global(book_dir):
    env = books._book_templates(book_dir, True).env
    assert "URL" in env.globals


def test_bytecode_caches_are_per_flavor():
    """A bucket is keyed on the template's name and path but *not* on the
    environment's delimiters, so the two flavors must not share a directory or
    one would be handed bytecode lexed the wrong way.
    """
    rst = books._bytecode_cache("rst")
    ptx = books._bytecode_cache("ptx")
    assert rst is not None and ptx is not None
    assert rst.directory != ptx.directory


def test_rebuilt_book_is_picked_up(book_dir):
    """A bytecode bucket is keyed on a checksum of the source, so republishing a
    book must not serve the old page.
    """
    env = books._book_templates(book_dir, False).env
    assert env.get_template("rst_page.html").render(course_name="fopp") == (
        "<h1>fopp</h1>"
    )

    # Rebuild the page, as a book build would.
    with open(os.path.join(book_dir, "rst_page.html"), "w") as f:
        f.write("<h2>rebuilt {{ course_name }}</h2>")

    assert env.get_template("rst_page.html").render(course_name="fopp") == (
        "<h2>rebuilt fopp</h2>"
    )


def test_templates_are_not_retained_in_memory(book_dir):
    """``cache_size=0``: a compiled page retains ~1.6MB, so holding them would
    make the server's footprint scale with the books and pages it serves.  The
    bytecode cache is what makes that cheap instead.
    """
    env = books._book_templates(book_dir, False).env
    # jinja turns cache_size=0 into "no template cache at all".
    assert env.cache is None
    assert env.bytecode_cache is not None


def test_unwritable_cache_dir_degrades_gracefully(monkeypatch, tmp_path):
    """A cache we cannot write to means slower pages, never a broken server."""
    blocked = tmp_path / "nope"
    blocked.write_text("i am a file, not a directory")
    monkeypatch.setattr(books, "_BYTECODE_CACHE_ROOT", str(blocked))
    assert books._bytecode_cache("rst") is None


# ---------------------------------------------------------------------------
# The cache must never be able to break a page
# ---------------------------------------------------------------------------


def test_page_still_renders_when_the_cache_cannot_be_written(book_dir, monkeypatch):
    """A full disk means slow pages, not 500s.

    jinja re-raises out of ``dump_bytecode``, and that propagates through
    ``get_template`` straight to the user.
    """
    env = books._book_templates(book_dir, False).env

    def enospc(self, bucket):
        raise OSError(28, "No space left on device")

    # Patch the *parent* method, so the subclass's guard is what is under test.
    monkeypatch.setattr(books.FileSystemBytecodeCache, "dump_bytecode", enospc)
    books._ResilientBytecodeCache._warned = False

    assert env.get_template("rst_page.html").render(course_name="fopp") == (
        "<h1>fopp</h1>"
    )


def test_page_still_renders_when_a_bucket_is_corrupt(book_dir):
    """A truncated cache file recompiles rather than raising."""
    env = books._book_templates(book_dir, False).env
    env.get_template("rst_page.html")  # populate the cache

    cache_dir = env.bytecode_cache.directory
    written = [f for f in os.listdir(cache_dir) if f.startswith("__jinja2_")]
    assert written, "expected the render above to write a bucket"
    for name in written:
        with open(os.path.join(cache_dir, name), "wb") as f:
            f.write(b"j2\x00\x00garbage")

    assert env.get_template("rst_page.html").render(course_name="fopp") == (
        "<h1>fopp</h1>"
    )


def test_a_rebuild_overwrites_rather_than_accumulates(book_dir):
    """Growth is bounded by pages served, not by how often books are rebuilt."""
    env = books._book_templates(book_dir, False).env
    env.get_template("rst_page.html")
    cache_dir = env.bytecode_cache.directory

    def buckets():
        return [f for f in os.listdir(cache_dir) if f.startswith("__jinja2_")]

    before = len(buckets())
    for i in range(5):
        with open(os.path.join(book_dir, "rst_page.html"), "w") as f:
            f.write(f"<h1>build {i} {{{{ course_name }}}}</h1>")
        env.get_template("rst_page.html")

    assert len(buckets()) == before


# ---------------------------------------------------------------------------
# Pruning
# ---------------------------------------------------------------------------


@pytest.fixture
def cache_root(tmp_path, monkeypatch):
    """Point the bytecode cache at a scratch directory with known contents."""
    root = tmp_path / "bytecode"
    monkeypatch.setattr(books, "_BYTECODE_CACHE_ROOT", str(root))
    for flavor in ("rst", "ptx"):
        (root / flavor).mkdir(parents=True)
    return root


def write_bucket(cache_root, flavor, name, size, mtime):
    p = cache_root / flavor / f"__jinja2_{name}.cache"
    p.write_bytes(b"x" * size)
    os.utime(p, (mtime, mtime))
    return p


def buckets_in(cache_root):
    return {
        p.name
        for flavor in ("rst", "ptx")
        for p in (cache_root / flavor).iterdir()
        if p.name.startswith("__jinja2_")
    }


def test_prune_is_a_no_op_under_budget(cache_root):
    write_bucket(cache_root, "rst", "a", 1000, 1000)
    assert books.prune_bytecode_cache(10_000) is None
    assert len(buckets_in(cache_root)) == 1


def test_prune_evicts_oldest_first(cache_root):
    write_bucket(cache_root, "rst", "oldest", 1000, 1000)
    write_bucket(cache_root, "rst", "middle", 1000, 2000)
    write_bucket(cache_root, "rst", "newest", 1000, 3000)

    removed, freed, kept = books.prune_bytecode_cache(2000)

    assert (removed, freed, kept) == (1, 1000, 2000)
    assert buckets_in(cache_root) == {
        "__jinja2_middle.cache",
        "__jinja2_newest.cache",
    }


def test_prune_spans_both_flavors(cache_root):
    """One budget covers the whole cache, not one directory each."""
    write_bucket(cache_root, "rst", "old_rst", 1000, 1000)
    write_bucket(cache_root, "ptx", "new_ptx", 1000, 5000)

    removed, freed, kept = books.prune_bytecode_cache(1000)

    assert (removed, kept) == (1, 1000)
    assert buckets_in(cache_root) == {"__jinja2_new_ptx.cache"}


def test_prune_leaves_foreign_files_alone(cache_root):
    """Only files jinja wrote are ours to delete."""
    write_bucket(cache_root, "rst", "a", 5000, 1000)
    stranger = cache_root / "rst" / "important.txt"
    stranger.write_bytes(b"y" * 5000)
    os.utime(stranger, (500, 500))  # older than the bucket

    books.prune_bytecode_cache(1000)

    assert stranger.exists()
    assert buckets_in(cache_root) == set()


def test_prune_survives_a_missing_directory(tmp_path, monkeypatch):
    monkeypatch.setattr(books, "_BYTECODE_CACHE_ROOT", str(tmp_path / "nope"))
    assert books.prune_bytecode_cache(1000) is None


def test_prune_tolerates_a_file_vanishing(cache_root, monkeypatch):
    """Workers in a container share the directory and race each other."""
    write_bucket(cache_root, "rst", "a", 1000, 1000)
    write_bucket(cache_root, "rst", "b", 1000, 2000)

    real_remove = os.remove

    def racy_remove(path):
        real_remove(path)
        raise FileNotFoundError(path)  # as if another worker had won

    monkeypatch.setattr(books.os, "remove", racy_remove)

    removed, freed, kept = books.prune_bytecode_cache(0)
    # Both files are gone, but neither counts as freed by us.
    assert removed == 0
    assert buckets_in(cache_root) == set()


# The only async test in this module, so it needs the session loop explicitly --
# see test_rsproxy.py for what happens to the database tests otherwise.
@pytest.mark.asyncio(loop_scope="session")
async def test_prune_loop_is_disabled_by_a_zero_budget(monkeypatch):
    monkeypatch.setattr(books.settings, "book_template_cache_mb", 0)
    called = False

    def should_not_run(budget):
        nonlocal called
        called = True

    monkeypatch.setattr(books, "prune_bytecode_cache", should_not_run)
    await books.prune_bytecode_cache_loop()  # returns immediately
    assert not called
