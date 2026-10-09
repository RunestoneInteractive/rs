from click.testing import CliRunner

from rsptx.build_tools.process_manifest import cli

MANIFEST = """<?xml version="1.0" encoding="UTF-8"?>
<manifest><library-metadata publisher="pretext">
<document-id edition="2">PTXSB</document-id></library-metadata></manifest>"""


def test_refuses_a_manifest_for_another_book(tmp_path):
    (tmp_path / "runestone-manifest.xml").write_text(MANIFEST)
    result = CliRunner().invoke(cli, ["thinkcspy", "--manifest", str(tmp_path)])
    assert result.exit_code == 1
    assert "is for PTXSB, not thinkcspy" in result.output


def test_default_manifest_is_the_published_book(tmp_path, monkeypatch):
    monkeypatch.setenv("BOOK_PATH", str(tmp_path))
    result = CliRunner().invoke(cli, ["PTXSB"])
    assert result.exit_code == 1
    expected = tmp_path / "PTXSB" / "published" / "PTXSB" / "runestone-manifest.xml"
    assert f"{expected} does not exist" in result.output
