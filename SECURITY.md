# Security Policy

Runestone Academy hosts courses for many schools, so a security bug here can expose
real students' work and grades. Thank you for taking the time to report one
responsibly.

## Reporting a vulnerability

**Please do not open a public issue, discussion, or pull request for a security
problem.**

Report it privately through GitHub instead:

1. Go to the [Security tab](https://github.com/RunestoneInteractive/rs/security) of
   this repository.
2. Click **Report a vulnerability**.

Or go straight to the
[new advisory form](https://github.com/RunestoneInteractive/rs/security/advisories/new).
Only the maintainers can see the report, and we can discuss it and work on a fix
privately with you there.

A helpful report includes:

- The affected endpoint, page, or component, with file and line references if you
  have them.
- The steps to reproduce it, including what role the attacker needs (anonymous,
  student, instructor, ...).
- What an attacker could gain from it, such as reading another course's data,
  changing grades, or taking over an account.
- Any proof-of-concept request or script.

## What to expect

Runestone is maintained by a small team. We aim to acknowledge a report within a
week, keep you updated as we work on it, and credit you in the published advisory
unless you would rather stay anonymous. Please give us a reasonable chance to fix
the problem before you disclose it publicly.

## Scope

In scope:

- The code in this repository: the book, admin, assignment, author, and dash
  servers, the shared components, and the interactive JavaScript components in
  `bases/rsptx/interactives/`.
- The hosted service at [runestone.academy](https://runestone.academy).
- The [`runestone`](https://pypi.org/project/runestone/) package on PyPI, which is
  built from the `legacy_support` branch.

Out of scope:

- Bugs in a self-hosted deployment caused by its own configuration.
- Denial of service, load testing, or volumetric attacks.
- Social engineering or phishing of staff, instructors, or students.
- Raw scanner output with no demonstrated impact.
- Vulnerabilities in third-party dependencies with no demonstrated effect on
  Runestone. Please report those upstream.

## Testing guidelines

- Test against a local install (see `docs/source/developing.rst`) whenever you can.
- If you must test against runestone.academy, use only accounts and courses you
  created yourself. Never read, change, or delete another user's data beyond the
  minimum needed to show that the problem exists, and tell us if you did.
- Do not degrade the service for other users.

If you act in good faith and follow these guidelines, we will not pursue or support
legal action against you for your research.

## Supported versions

Fixes are made on `main`, which is what runestone.academy runs. Fixes to the
interactive components that affect RST books are also ported to the
`legacy_support` branch and released in the `runestone` PyPI package. Older
releases and forks are not patched.
