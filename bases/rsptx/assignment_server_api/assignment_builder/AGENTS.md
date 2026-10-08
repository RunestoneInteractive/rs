# assignment_builder — agent guide

The instructor-facing React + TypeScript app: the assignment builder, the grader and
gradebook, and the exception scheduler. Vite, Redux Toolkit (RTK Query for server
calls), Mantine UI. It has its own npm project; run every command below from this
directory. See the root `AGENTS.md` for the rest of the repo.

## Commands

```bash
npm install
npm start                      # Vite dev server on :5173; proxies /ns and /assignment to http://localhost
npx vitest run                 # unit tests once (`npm test` is watch mode, with coverage)
npx vitest run src/hooks/useJwtUser.spec.ts
npm run test:eslint            # eslint, --max-warnings=0
npx prettier --check src       # .prettierrc: printWidth 100, double quotes, no trailing commas
npx tsc -p tsconfig.build.json # type check (the build runs this first)
npm run build                  # type check + production bundle into ../react
npm run test:e2e:smoke         # Playwright, @p0 tests only; see e2e/ below
```

## How the build reaches the server

- `npm run build` writes to `bases/rsptx/assignment_server_api/react/` (gitignored),
  including `.vite/manifest.json`. The server never serves the built `index.html`: the
  `/assignment/instructor/builder`, `/grader` and `/except` routes in
  `routers/instructor.py` render the Jinja template
  `components/rsptx/templates/assignment/instructor/builder.html`, which reads the
  manifest (`get_react_imports`) to find the hashed JS/CSS.
- `uv run build` runs this app's vitest suite (if `node_modules` exists) but does
  **not** run `npm run build`. After changing app code, run `npm run build`, then
  `uv run build -s assignment dev` so the new bundle is in the container.
- Client routes live in `src/App.tsx` under the `/assignment/instructor` basename. A
  new **top-level** route also needs a matching `@router.get` in
  `routers/instructor.py`, or a reload/deep link to it 404s.

## Code layout

| Path | What's there |
|---|---|
| `src/components/routes/AssignmentBuilder/`, `src/components/routes/Grader/` | The two main screens, each with its own `components/`, `hooks/` |
| `src/components/ui/` | Shared UI pieces (DataGrid, notify, pickers, ...) |
| `src/store/<feature>/` | Current Redux code: `<feature>.logic.ts` (slice) and `<feature>.logic.api.ts` (RTK Query `createApi` using `store/baseQuery.ts`) |
| `src/state/` | Older per-component slices (activecode, multiple choice, preview, ...); still live |
| `src/renderers/` | Older JSX components for the question editors and preview |
| `src/utils/`, `src/types/` | Helpers and shared types |

- **The live store is `src/state/store.ts`** (imported by `src/index.tsx`). It
  combines the old `state/` slices and the `store/` slices and APIs. A new RTK Query
  API must be added there to **both** the reducer map and the middleware list. Also
  add it to `src/store/rootReducer.ts` and `src/store/store.ts`, which tests use.
- New server calls go in a `store/<feature>/*.logic.api.ts` file; don't call `fetch`
  from components. Put new code in TypeScript under `store/` and
  `components/`, not `state/` or `renderers/`.
- Import with the path aliases `@/`, `@store/` and `@components/`.

## Traps

- **Interactive previews depend on where the app is running.** The Runestone
  components (`window.component_factory`, used by `src/componentFuncs.js` and the
  grader's previews) come from the page, not this bundle. Served by the assignment
  server, `builder.html` loads them from the course's book:
  `/ns/books/published/<course>/_static/`. Under `npm start`, `index.html` loads
  the copy committed in `public/runestone/`, last updated in 2024. Component behaviour
  seen in the dev server can differ from production; check the real page.
- **Datetimes go to the server as naive UTC.** Use `convertDateToISO` and
  `parseUTCDate` in `src/utils/date.ts`. Date pickers work in the browser's timezone,
  which may not be the course's (`src/utils/courseTimezone.ts` warns instructors).
- **No `border-radius` on an embedded activity's `<iframe>`.** Doenet then fails to
  boot and shows a blank frame. Round the wrapper instead; see the comment in
  `Grader/components/questionTypes/AnswerViews.module.css`.
- **SPLICE/Doenet/`iframe` questions** have no `component_factory` entry, so the
  grader renders them with their own view, replaying the student's saved state. Without
  that replay the activity loads the *instructor's* own attempt.

## Tests

- Unit tests are `src/**/*.spec.ts(x)` (or `*.test.*`), next to the code, run in
  jsdom with globals. Render components with `src/test/renderWithMantine.tsx`; mocks
  are in `src/spec/mock/`.
- e2e tests live in `e2e/<area>/`, tagged `@p0` (smoke) and `@p1`. By default they
  target the Vite dev server (`npm start`) with the Docker stack on :80;
  `npm run test:e2e:docker` runs the `e2e/grader` tests against the built app in the
  container instead. `e2e/global.setup.ts` logs in once through `/admin/auth/login`
  and saves the session to `e2e/.auth/` (gitignored) for the other tests.
