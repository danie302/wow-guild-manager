'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // The Discord role that missing-role alerts mention; null mentions nobody.
    await queryInterface.addColumn('guilds', 'member_role_id', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('guilds', 'member_role_id');
  },
};
