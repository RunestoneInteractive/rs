import pytest

from rsptx.validation.fields import (
    clean_text,
    validate_password,
    validate_text_field,
)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("  Ada  ", "Ada"),
        ("Ada\n", "Ada"),
        ("   ", ""),
        ("", ""),
        (None, ""),
    ],
)
def test_clean_text(raw, expected):
    assert clean_text(raw) == expected


def test_required_field_rejects_empty():
    assert validate_text_field("", "First name") == "First name is required."


def test_optional_field_allows_empty():
    assert validate_text_field("", "Institution", required=False) is None


@pytest.mark.parametrize(
    "name", ["Ada", "José", "王", "Ólafsdóttir", "O'Brien", "X Æ 12"]
)
def test_accepts_real_names(name):
    assert validate_text_field(name, "First name") is None


@pytest.mark.parametrize("name", ["🎉", "🎉🎉🎉", "!!!", "---", "..."])
def test_rejects_values_with_no_letters_or_digits(name):
    assert (
        validate_text_field(name, "First name")
        == "First name must contain at least one letter or number."
    )


def test_rejects_over_length():
    assert (
        validate_text_field("e" * 513, "Institution")
        == "Institution must be 512 characters or fewer."
    )


def test_accepts_exactly_max_length():
    assert validate_text_field("e" * 512, "Institution") is None


@pytest.mark.parametrize("password", ["      ", " ", "\t\n"])
def test_password_rejects_whitespace_only(password):
    assert validate_password(password) == "Password is required."


def test_password_rejects_short():
    assert validate_password("abc") == "Password must be at least 6 characters."


@pytest.mark.parametrize("password", ["correct horse", "abcdef", "  pad  d  "])
def test_password_accepts_valid(password):
    """Passwords are not stripped -- internal and edge spaces are legitimate."""
    assert validate_password(password) is None
