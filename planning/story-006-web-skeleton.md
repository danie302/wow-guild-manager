# Story 006: Web client skeleton

**Status:** Done  
**Phase:** Foundation  
**Depends on:** [Story 004](story-004-api-skeleton.md)

## Goal

Have a running React app that talks to the API.

## Scope

- Vite, React, TypeScript, React Router, and TanStack Query.
- An app layout with navigation placeholders.
- A status page that shows the result of `GET /api/health`.
- A Vite dev proxy from `/api` to the `api` container.
- Material UI with a theme built from the design tokens in `docs/design/` (Archivo, square corners, dark and light palettes).
- The `src/components/ui` folder, where our own compound components wrap MUI, with one first example (e.g. the app layout or a `Tabs` component).
- An ESLint rule that blocks `@mui/*` imports outside `src/components/ui`.

## Out of scope

- Login (story 010).
- Real pages.

## Acceptance criteria

- [x] Opening the web URL shows the app layout.
- [x] The status page shows the API, database, and Redis status from `GET /api/health`.
- [x] When the `api` container is stopped, the status page shows an error state instead of a blank page.
- [x] Requests to `/api` go through the Vite proxy, with no CORS configuration needed in development.
- [x] `pnpm --filter web build` produces a production build without type errors.
- [x] A component test runs with Vitest.
- [x] The MUI theme uses the design's fonts, colors, and square corners in both themes.
- [x] Importing `@mui/*` from a page fails the lint check. Importing it inside `src/components/ui` doesn't.
- [x] The example compound component exposes our own props, not MUI's, and pages use it through its named parts.

## Notes

- Versions: React 19, React Router 8 (library mode, `createBrowserRouter`), TanStack Query 5, and Material UI 9.
- The UI kit (`src/components/ui`) has `AppShell`, `Page`, and `StatusList` as compound components, plus `Notice`, `Loading`, `Icon`, and `UiProvider`. Pages import them from `src/components/ui/index.ts`.
- The design tokens live in `src/components/ui/tokens.ts`. They become CSS variables (`--bg`, `--ac`, …) under `[data-theme="dark"]` and `[data-theme="light"]`, as in the prototype, and the MUI palette uses the same values. MUI's `nativeColor` option lets it work with the `oklch()` colors.
- Dark is the default. There's no theme switch yet: story 011 adds the user setting (MUI's `useColorScheme` switches the scheme).
- Archivo is self-hosted with `@fontsource-variable/archivo` instead of loaded from Google Fonts.
- Icons are the prototype's SVG paths in `Icon.tsx`, not an icon package.
- The navigation and page titles are placeholder English text. Story 035 moves every existing text to the translation files.
- Vite forwards `/api` to `API_PROXY_TARGET` (`http://api:3000` in Docker, `http://localhost:3000` by default).
- ESLint adds `eslint-plugin-react-hooks`. `eslint-plugin-react` doesn't support ESLint 10 yet, so it isn't used.
- `apps/web/tsconfig.json` includes Node types for `vite.config.ts`. An ESLint rule blocks `process` in `src`, where it doesn't exist at runtime.

## Technical debt

None.
