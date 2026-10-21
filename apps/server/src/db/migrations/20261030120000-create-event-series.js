'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A weekly event, such as "MC every Tuesday". Its events are rows in `events`, created
      // two weeks ahead by the worker. Stopping keeps the row (stopped_at) and its past events.
      await queryInterface.createTable(
        'event_series',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('uuidv7()'),
          },
          guild_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'guilds', key: 'id' },
            onDelete: 'CASCADE',
          },
          type: { type: Sequelize.STRING(7), allowNull: false },
          name: { type: Sequelize.STRING(100), allowNull: false },
          description: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
          // Its first event, or after an edit, the next one; the rest follow every 7 days at the
          // same UTC time.
          starts_at: { type: Sequelize.DATE, allowNull: false },
          size: { type: Sequelize.SMALLINT, allowNull: false },
          tank_slots: { type: Sequelize.SMALLINT, allowNull: false },
          healer_slots: { type: Sequelize.SMALLINT, allowNull: false },
          dps_slots: { type: Sequelize.SMALLINT, allowNull: false },
          created_by_user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
          },
          stopped_at: { type: Sequelize.DATE, allowNull: true },
          stopped_by_user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
          },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE event_series
           ADD CONSTRAINT event_series_type_check CHECK (type IN ('raid', 'dungeon', 'pvp')),
           ADD CONSTRAINT event_series_slots_check CHECK (
             tank_slots >= 0 AND healer_slots >= 0 AND dps_slots >= 0
             AND tank_slots + healer_slots + dps_slots = size)`,
        { transaction },
      );
      await queryInterface.addIndex('event_series', ['guild_id'], { transaction });

      await queryInterface.addColumn(
        'events',
        'series_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'event_series', key: 'id' },
          onDelete: 'SET NULL',
        },
        { transaction },
      );
      // The worker and the API can both create a series' events; this keeps one per week.
      await queryInterface.addIndex('events', ['series_id', 'starts_at'], {
        unique: true,
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('events', 'series_id', { transaction });
      await queryInterface.dropTable('event_series', { transaction });
    });
  },
};
