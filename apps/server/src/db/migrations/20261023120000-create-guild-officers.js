'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Who has each guild's Officer role in its Discord server. The bot keeps it in step with
    // Discord's events and resyncs it when it starts, so the API never asks Discord per request.
    await queryInterface.createTable('guild_officers', {
      guild_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'guilds', key: 'id' },
        onDelete: 'CASCADE',
      },
      discord_user_id: { type: Sequelize.STRING(20), allowNull: false, primaryKey: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    // Finding a user's guilds when they log in.
    await queryInterface.addIndex('guild_officers', ['discord_user_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('guild_officers');
  },
};
