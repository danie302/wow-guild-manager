# Story 001: Monorepo scaffold

**Status:** Not started  
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

- [ ] `pnpm install` at the root installs every workspace without errors.
- [ ] `pnpm -r typecheck` passes.
- [ ] `apps/web` and `apps/server` both import a placeholder export from the shared package, and the import typechecks.
- [ ] `packages/shared` declares no dependencies other than `zod`.
- [ ] Importing `apps/server` code from `apps/web` fails, because pnpm only allows declared dependencies.
- [ ] `.env` files are ignored by git.
- [ ] `pnpm lint` and `pnpm format:check` run on every package and pass.

## Notes

- Package names (e.g. `@wgm/shared`) are decided in this story.

## Technical debt

None.
