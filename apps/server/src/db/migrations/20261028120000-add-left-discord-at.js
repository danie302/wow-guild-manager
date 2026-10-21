'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // When the person left the guild's Discord server; null while they're in it. The bot
      // sets and clears it from Gateway events, and on each connect for changes it missed.
      for (const table of ['members', 'registrations']) {
        await queryInterface.addColumn(
          table,
          'left_discord_at',
          { type: Sequelize.DATE, allowNull: true },
          { transaction },
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ['members', 'registrations']) {
        await queryInterface.removeColumn(table, 'left_discord_at', { transaction });
      }
    });
  },
};
