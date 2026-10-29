'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A channel per event type, used instead of the default events channel when set.
      for (const column of ['raid_channel_id', 'dungeon_channel_id', 'pvp_channel_id']) {
        await queryInterface.addColumn(
          'guilds',
          column,
          { type: Sequelize.STRING(20), allowNull: true },
          { transaction },
        );
      }
      // A series' own channel, used instead of its type's or the default one when set.
      await queryInterface.addColumn(
        'event_series',
        'channel_id',
        { type: Sequelize.STRING(20), allowNull: true },
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('event_series', 'channel_id', { transaction });
      for (const column of ['raid_channel_id', 'dungeon_channel_id', 'pvp_channel_id']) {
        await queryInterface.removeColumn('guilds', column, { transaction });
      }
    });
  },
};
