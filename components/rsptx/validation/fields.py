"""
Validation helpers for user-supplied text fields on HTML forms.

These exist because several forms accepted values that are technically strings but
are not usable data: a name consisting of a single space, a "password" of six
spaces, or an institution long enough to overflow its database column. The rules
here are deliberately permissive about *what* characters a value may contain --
names come in every script -- and strict only about a value being present,
meaningful, and short enough to store.
"""

# Text columns on auth_user and courses are String(512).
DEFAULT_MAX_LENGTH = 512


def clean_text(value: str | None) -> str:
    """Strip surrounding whitespace from a submitted field.

    Spreadsheet copy/paste and mobile keyboards routinely add it, and it is never
    meaningful in the fields this is used on.
    """
    return (value or "").strip()


def validate_text_field(
    value: str,
    label: str,
    max_length: int = DEFAULT_MAX_LENGTH,
    required: bool = True,
) -> str | None:
    """Validate one already-cleaned text field.

    Returns an error message suitable for showing to the person filling in the
    form, or None if the value is acceptable.

    A value must contain at least one letter or digit. ``str.isalnum`` is
    Unicode-aware, so this accepts names in any script -- José, 王, Ólafsdóttir --
    while rejecting values made up entirely of punctuation or emoji, which are
    not names and make rosters unusable for instructors.
    """
    if not value:
        if required:
            return f"{label} is required."
        return None
    if len(value) > max_length:
        return f"{label} must be {max_length} characters or fewer."
    if not any(char.isalnum() for char in value):
        return f"{label} must contain at least one letter or number."
    return None


def validate_password(password: str, min_length: int = 6) -> str | None:
    """Validate a password without altering it.

    Passwords are deliberately not stripped -- leading or trailing spaces can be
    a legitimate part of a passphrase -- but a password consisting only of
    whitespace is always a mistake.
    """
    if not password.strip():
        return "Password is required."
    if len(password) < min_length:
        return f"Password must be at least {min_length} characters."
    return None
