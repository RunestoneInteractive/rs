# ****************************************************************
# |docname| - load a PreTeXt book's runestone-manifest.xml into the DB
# ****************************************************************
# The ``process_manifest`` command: the last step of a book build on its own,
# for a book that has already been built. It fills the chapters, sub_chapters
# and questions tables (including each question's ``question_json``) from the
# manifest, using the database selected by ``SERVER_CONFIG``.
#
#   process_manifest thinkcspy
#   process_manifest PTXSB --manifest ~/books/PTXSB/published/PTXSB
#
import logging
import os
from pathlib import Path

import click
import lxml.etree as ET
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from rsptx.build_tools.core import get_dburl, manifest_data_to_db
from rsptx.logging import rslogger

MANIFEST = "runestone-manifest.xml"


def _default_manifest(course):
    book_path = os.environ.get("BOOK_PATH")
    if not book_path:
        raise click.UsageError("Set BOOK_PATH or pass --manifest.")
    return Path(book_path) / course / "published" / course / MANIFEST


def _check_document_id(manifest, course):
    """Like a book build, refuse a manifest for some other book."""
    docid = ET.parse(str(manifest)).findtext("./library-metadata/document-id")
    if docid and docid.strip() != course:
        raise click.ClickException(f"{manifest} is for {docid.strip()}, not {course}.")


def _check_course(dburl, course):
    """Fail early with a clear message instead of deep in manifest_data_to_db."""
    engine = create_engine(dburl)
    with engine.connect() as conn:
        if not conn.execute(
            text("select 1 from courses where course_name = :c"), {"c": course}
        ).first():
            raise click.ClickException(
                f"There is no course named {course}; add the book first."
            )
        if not conn.execute(
            text("select 1 from book_author where book = :c"), {"c": course}
        ).first():
            raise click.ClickException(
                f"{course} has no row in book_author; add its author first."
            )


@click.command()
@click.argument("course")
@click.option(
    "--manifest",
    type=click.Path(exists=True, path_type=Path),
    help=f"The {MANIFEST} file, or the directory holding it. "
    f"Default: $BOOK_PATH/<course>/published/<course>/{MANIFEST}",
)
@click.option(
    "-v",
    "--verbose",
    count=True,
    help="-v logs each question; -vv also says why a question got no question_json.",
)
def cli(course, manifest, verbose):
    """Load COURSE's runestone-manifest.xml into the database.

    COURSE is the base course, which must match the book's document-id.
    """
    level = [logging.WARNING, logging.INFO, logging.DEBUG][min(verbose, 2)]
    rslogger.setLevel(level)
    for handler in rslogger.handlers:
        handler.setLevel(level)

    if manifest is None:
        manifest = _default_manifest(course)
    elif manifest.is_dir():
        manifest = manifest / MANIFEST
    if not manifest.is_file():
        raise click.ClickException(f"{manifest} does not exist.")

    _check_document_id(manifest, course)
    dburl = get_dburl()
    url = make_url(dburl)
    click.echo(f"Loading {manifest}")
    click.echo(f"into {url.database} on {url.host or 'localhost'} for {course}")
    _check_course(dburl, course)

    stats = manifest_data_to_db(course, str(manifest))

    click.echo("\nquestion_json stored:")
    for qtype in sorted({qtype for qtype, _ in stats}):
        stored = stats[qtype, True]
        total = stored + stats[qtype, False]
        click.echo(f"  {qtype:<16} {stored:>6} of {total:>6}")
    click.echo("Done.")


if __name__ == "__main__":
    cli()
