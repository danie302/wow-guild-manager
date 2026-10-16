# Database

The server talks to PostgreSQL through Sequelize 6. The reasons for these choices are in [`docs/tech-decisions.md`](../../../../docs/tech-decisions.md).

| File | What it does |
|---|---|
| `sequelize.ts` | `createSequelize()` connects and registers every model. It also turns on CLS. |
| `cls.ts` | The CLS namespace (built on `AsyncLocalStorage`) that lets queries join the current transaction. |
| `models/` | One file per model, plus `index.ts`, which registers them all. |
| `migrations/` | Hand-written migrations, in CommonJS because `sequelize-cli` only loads that. |
| `config.cjs` | The `sequelize-cli` connection settings (it reads `DATABASE_URL`). |

## Transactions

CLS is on, so every query inside `sequelize.transaction(async () => { … })` joins the transaction without passing `{ transaction }`:

```ts
await sequelize.transaction(async () => {
  const event = await Event.findByPk(eventId, { lock: Transaction.LOCK.UPDATE });
  // …count the slots, then create the sign-up. Everything rolls back if anything throws.
  await SignUp.create({ eventId, characterId, role });
});
```

Always use the callback form. `sequelize.transaction()` without a callback returns an unmanaged transaction that CLS doesn't track.

## Typed models

Every model follows the same pattern. This example shows each part (it isn't a real table):

```ts
// models/note.ts
import {
  DataTypes,
  Model,
  type CreationOptional,
  type ForeignKey,
  type InferAttributes,
  type InferCreationAttributes,
  type NonAttribute,
  type Sequelize,
} from 'sequelize';

import type { Guild } from './guild.js';

export class Note extends Model<InferAttributes<Note>, InferCreationAttributes<Note>> {
  // `declare` adds the type without creating a class field that would hide Sequelize's getter.
  declare id: CreationOptional<number>; // CreationOptional: the database fills it in.
  declare text: string;
  declare pinned: CreationOptional<boolean>; // Has a default value.
  declare removedAt: Date | null;
  declare guildId: ForeignKey<Guild['id']>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Loaded with `include`. NonAttribute keeps it out of the attribute types.
  declare guild?: NonAttribute<Guild>;

  static initModel(sequelize: Sequelize): void {
    Note.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        text: { type: DataTypes.TEXT, allowNull: false },
        pinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        removedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      { sequelize, tableName: 'notes' },
    );
  }

  static associate(): void {
    Note.belongsTo(Guild, { foreignKey: 'guildId', as: 'guild' });
  }
}
```

Then register it in `models/index.ts`: call every `initModel` first, then every `associate`.

```ts
export function initModels(sequelize: Sequelize): void {
  Note.initModel(sequelize);
  Note.associate();
}
```

Rules:
- Models use `underscored: true` (set in `createSequelize`), so `guildId` is the `guild_id` column. Migrations use the snake_case names.
- Input validation lives in Zod schemas in `packages/shared`. Model options only add database guarantees, like `allowNull: false`.
- Every model change needs a migration in the same change.

## Migrations

Run these inside the `api` container (`docker compose exec api …`):

```sh
pnpm --filter @wgm/server db:migration:create --name create-notes   # new file in migrations/
pnpm --filter @wgm/server db:migrate                                 # apply pending migrations
pnpm --filter @wgm/server db:migrate:undo                            # revert the last one
```

The `api` container applies pending migrations every time it starts, before it listens. `bot` and `worker` never run them, so they can't race with `api`. The test setup applies them to the test database on every run.

A migration file looks like this:

```js
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notes', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      guild_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'guilds', key: 'id' },
      },
      text: { type: Sequelize.TEXT, allowNull: false },
      pinned: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      removed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notes');
  },
};
```
