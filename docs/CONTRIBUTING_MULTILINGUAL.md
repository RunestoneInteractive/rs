# Proposal: multilingual Runestone book contributions

This note is a discussion starter for contributors who want to make a
Runestone book usable in an additional language, including right-to-left (RTL)
languages such as Arabic. It does not prescribe a translation framework or
replace a book's existing authoring workflow.

## Start with a book and its maintainers

1. Choose a maintained book and open an issue describing the target language,
   the chapters you propose to translate, and the intended reviewer(s).
2. Confirm the source format (typically reStructuredText or PreTeXt), the
   repository that owns the book, and the process for publishing a preview.
3. Keep the first contribution small: one introductory section or chapter is
   easier to review than a full-book translation.

## Translation workflow

1. Preserve directives, component identifiers, assessment metadata, code, and
   URLs unless a maintainer asks for a localized equivalent. Translate learner-
   facing prose, captions, alt text, and feedback strings.
2. Record terminology choices (for example, the preferred translations of
   "function", "variable", and "test") in the book's contribution notes so
   later chapters are consistent.
3. Use Unicode source files and verify that the book build preserves the target
   language's text. Do not use transliteration as a substitute for native
   script when native-script content is the goal.
4. For Arabic and other RTL languages, inspect the generated HTML in a browser:
   headings, numbered lists, tables, inline code, mathematical expressions,
   embedded interactives, and mixed RTL/LTR text all need visual review.

## Review and validation

- Ask for review by a fluent speaker and, where possible, an instructor who
  teaches the subject in the target language.
- Build the translated book using its normal book-building workflow and check
  that interactive components, code execution, and assessment feedback still
  work.
- Include screenshots or a preview URL for RTL changes, especially where an
  interactive component contains both localized text and source code.
- Keep translations in separate, focused pull requests. This makes it possible
  to correct terminology or layout issues without blocking unrelated content.

## Relationship to Runestone components

Runestone already maintains internationalization work for interactive
components (recorded in the project changelog as `rsi18n`). Book translations
should therefore be coordinated with component localization: if a learner-
facing interactive string is still English, identify it in the issue or pull
request rather than silently working around it in book prose.

Maintainers can use feedback on an initial language contribution to decide
whether a book-specific glossary, translation directory convention, or shared
localization tooling is warranted.
