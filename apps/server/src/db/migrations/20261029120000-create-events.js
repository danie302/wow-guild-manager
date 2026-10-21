'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A raid, dungeon, or PvP event of a guild. Cancelling keeps the row (cancelled_at), so
      // it stays listed as cancelled.
      await queryInterface.createTable(
        'events',
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
          // raid, dungeon, or pvp; fixed once created.
          type: { type: Sequelize.STRING(7), allowNull: false },
          name: { type: Sequelize.STRING(100), allowNull: false },
          description: { type: Sequelize.TEXT, allowNull: false, defaultValue: '' },
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
          cancelled_at: { type: Sequelize.DATE, allowNull: true },
          cancelled_by_user_id: {
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
      await queryInterface.addConstraint('events', {
        type: 'check',
        fields: ['type'],
        where: { type: ['raid', 'dungeon', 'pvp'] },
        name: 'events_type_check',
        transaction,
      });
      // The rules per type are checked in the app; the database keeps the slots consistent.
      await queryInterface.sequelize.query(
        `ALTER TABLE events ADD CONSTRAINT events_slots_check CHECK (
           tank_slots >= 0 AND healer_slots >= 0 AND dps_slots >= 0
           AND tank_slots + healer_slots + dps_slots = size)`,
        { transaction },
      );
      await queryInterface.addIndex('events', ['guild_id', 'starts_at'], { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('events');
  },
};
