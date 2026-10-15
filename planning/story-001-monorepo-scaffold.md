# Story 001: Monorepo scaffold

**Status:** Done with debt  
**Phase:** Foundation  
**Depends on:** None

## Goal

Create the pnpm monorepo skeleton so every later story has a place for its code.

## Scope

- Initialize the git repository with a `.gitignore` (`node_modules`, build output, `.env`, `.DS_Store`).
- Root `package.json`, `pnpm-workspace.yaml`, and `tsconfig.base.json`.
- Empty packages: `apps/web`, `apps/server`, and `packages/shared`, each with its own `package.json` and `tsconfig.json`.
- Pin the Node.js LTS version (`.nvmrc` and `engines`).
- A root `typecheck` script that checks every package.
- ESLint (with TypeScript rules) and Prettier, with root `lint` and `format` scripts.

## Out of scope

- Docker (story 002).
- Any application code.

## Acceptance criteria

- [x] `pnpm install` at the root installs every workspace without errors.
- [x] `pnpm -r typecheck` passes.
- [x] `apps/web` and `apps/server` both import a placeholder export from the shared package, and the import typechecks.
- [x] `packages/shared` declares no dependencies other than `zod`.
- [x] Importing `apps/server` code from `apps/web` fails, because pnpm only allows declared dependencies.
- [x] `.env` files are ignored by git.
- [x] `pnpm lint` and `pnpm format:check` run on every package and pass.

## Notes

- Package names are `@wgm/web`, `@wgm/server`, and `@wgm/shared`.
- Node.js 24 LTS is pinned in `.nvmrc` and `engines` (`>=24 <25`). pnpm is pinned with the `packageManager` field and installed through corepack.
- TypeScript is pinned to 6.0, because typescript-eslint doesn't support TypeScript 7 yet.
- `@wgm/shared` has no build step. It exports its TypeScript source, which Vite and the server's TypeScript tooling read directly.
- Prettier formats code and config files, not Markdown.

## Technical debt

- Upgrade to TypeScript 7 once typescript-eslint supports it.
- `@wgm/shared` exports TypeScript source. The production server image (multi-stage build, see `docs/tech-decisions.md`) must either compile it or run with a TypeScript-aware runtime. Decide this when production deployment is planned.
