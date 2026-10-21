'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('guilds', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING(50), allowNull: false },
      faction: { type: Sequelize.STRING(8), allowNull: false },
      // A Discord server is connected to at most one guild.
      discord_server_id: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      officer_role_id: { type: Sequelize.STRING(20), allowNull: false },
      // A user leads at most one guild at a time. Disbanding deletes the guild, not the user.
      guild_master_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addConstraint('guilds', {
      type: 'check',
      fields: ['faction'],
      where: { faction: ['alliance', 'horde'] },
      name: 'guilds_faction_check',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('guilds');
  },
};
