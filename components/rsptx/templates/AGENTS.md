# templates — agent guide

Shared Jinja templates and static files for every FastAPI server. Templates live in a
folder named after the server that renders them (`admin/`, `assignment/`, `book/`,
`author/`); `_base.html`, `_navbar.html` and `common/` are shared. Static files are in
`staticAssets/`, served at `/staticAssets/` by Caddy in deployment and by each server's
own `StaticFiles` mount in development. The root `AGENTS.md` already covers datetimes
(`course_datetime_tag` plus the per-page `localize_times.html` include), `| safe` on
JSON in `<script>` tags, and rebuilding caddy after changing `staticAssets`.

## Getting a template environment

- Use `get_shared_templates()` or `get_jinja_templates(book_path)` from `core.py`.
  Don't construct `Jinja2Templates(...)` yourself: only these two run
  `install_filters`, so a hand-built environment has no `course_datetime_tag` or
  `course_datetime`, and fails as soon as a page uses them.
- Both are `lru_cache`d and must stay that way: building an environment throws away
  its compiled-template cache.
- Book *content* pages are rendered by a separate environment in
  `bases/rsptx/book_server_api/routers/books.py`. It has no shared globals, and PreTeXt
  books use different delimiters there (`~._ var _.~`, because `{{` collides with
  LaTeX). Nothing in this folder is rendered with it.

## The book's `_base.html` wins on some pages

`get_jinja_templates` puts the book's directory **before** this folder. PreTeXt books
ship their own `_base.html`, so on the pages rendered this way (`doAssignment.html`,
`chooseAssignment.html`, `book/course/current_course.html`) `{% extends "_base.html" %}`
gets the **book's** base, not ours. That base:

- defines only the `title`, `css`, `content` and `js` blocks: no `navbar` block;
- does not load `rs-core.css` or `nav.js`;
- always loads its own jQuery and ignores `needs_jquery`.

So these pages must link everything they need in their own `css`/`js` blocks, and a
fix made to `_base.html` alone never reaches them for PreTeXt courses. Test them with a
PreTeXt course, not just the shared fallback.

## Context variables can be missing

Many routes don't put `settings` (or other shared objects) in the context, so a shared
partial can't assume they exist. Attribute access on a missing variable raises before
any filter runs, so `{{ settings.foo | default('x') }}` doesn't protect you. Write
`{{ settings.foo if settings is defined else 'x' }}` (see `_navbar.html`). The opposite
case fails silently: a missing *attribute* on an object that *is* present renders as an
empty string.

## CSS and JS

- **No Bootstrap.** `staticAssets/css/rs-core.css` implements just the Bootstrap 4
  classes the templates use, and `staticAssets/js/nav.js` replaces Bootstrap's JS. If
  you need a Bootstrap class that isn't there, add it to `rs-core.css`; don't load
  Bootstrap from a CDN.
- **jQuery is opt-in.** `_base.html` loads it only when the page sets
  `{% set needs_jquery = true %}` at the top level, outside any block. Any page that loads a published
  book bundle needs it, because the bundles declare jQuery as a webpack external and
  expect a global.
- **`nav.js` holds compatibility shims for book bundles:** `$.fn.modal` (the activecode
  feedback dialog), `data-toggle="tab"` / `shown.bs.tab` (tabbedStuff), and Bootstrap 3
  `.open` dropdowns. Don't remove one without checking that bundles no longer use it.
- **Colors come from tokens.** The `--rs-color-*` custom properties in the `:root`
  block of `rs-core.css` are WCAG AA checked. Use them instead of literal hex values,
  and make sure `rs-core.css` loads before any stylesheet that uses them; standalone
  pages (e.g. `admin/auth/_auth_base.html`, the LTI pages) link it themselves.
- **Never remove the focus ring.** One `:focus-visible` rule in `rs-core.css` draws it
  for every control. Don't add `outline: none` / `outline: 0` to an interactive
  element; a missing focus indicator fails WCAG 2.4.7 (Level A).
- **Show times on the reader's clock.** Any new time display should match
  `localize-times.js`: browser-local with the zone label visible, and the course
  timezone in the tooltip.
