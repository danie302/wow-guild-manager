# Story 006: Web client skeleton

**Status:** Not started  
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

- [ ] Opening the web URL shows the app layout.
- [ ] The status page shows the API, database, and Redis status from `GET /api/health`.
- [ ] When the `api` container is stopped, the status page shows an error state instead of a blank page.
- [ ] Requests to `/api` go through the Vite proxy, with no CORS configuration needed in development.
- [ ] `pnpm --filter web build` produces a production build without type errors.
- [ ] A component test runs with Vitest.
- [ ] The MUI theme uses the design's fonts, colors, and square corners in both themes.
- [ ] Importing `@mui/*` from a page fails the lint check. Importing it inside `src/components/ui` doesn't.
- [ ] The example compound component exposes our own props, not MUI's, and pages use it through its named parts.


## Technical debt

None.
