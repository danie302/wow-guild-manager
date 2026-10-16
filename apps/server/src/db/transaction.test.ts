import {
  DataTypes,
  Model,
  type CreationOptional,
  type InferAttributes,
  type InferCreationAttributes,
  type Sequelize,
} from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSequelize } from './sequelize.js';

// A table that only exists in this test, written with the typed model pattern.
class Probe extends Model<InferAttributes<Probe>, InferCreationAttributes<Probe>> {
  declare id: CreationOptional<number>;
  declare label: string;
}

describe('transactions with CLS', () => {
  let sequelize: Sequelize;

  beforeAll(async () => {
    sequelize = createSequelize(process.env.DATABASE_URL ?? '');
    Probe.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        label: { type: DataTypes.STRING, allowNull: false },
      },
      { sequelize, tableName: 'cls_probes', timestamps: false },
    );
    await Probe.sync();
  });

  beforeEach(async () => {
    await Probe.truncate();
  });

  afterAll(async () => {
    await Probe.drop();
    await sequelize.close();
  });

  it('rolls back queries that were not passed { transaction } when the transaction fails', async () => {
    await expect(
      sequelize.transaction(async () => {
        await Probe.create({ label: 'inside' });
        throw new Error('fail the transaction');
      }),
    ).rejects.toThrow('fail the transaction');

    expect(await Probe.count()).toBe(0);
  });

  it('commits them when the transaction succeeds', async () => {
    await sequelize.transaction(async () => {
      await Probe.create({ label: 'inside' });
    });

    expect(await Probe.count()).toBe(1);
  });

  it('runs them inside the transaction, so other connections do not see them yet', async () => {
    let seenFromOutside: number | undefined;

    await sequelize.transaction(async () => {
      await Probe.create({ label: 'inside' });
      // A query with transaction: null opts out of CLS, like a query from another request.
      seenFromOutside = await Probe.count({ transaction: null });
    });

    expect(seenFromOutside).toBe(0);
  });
});
