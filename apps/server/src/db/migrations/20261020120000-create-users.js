'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      // Discord IDs are 64-bit snowflakes, too big for a JavaScript number, so they're text.
      discord_id: { type: Sequelize.STRING(20), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      // The avatar hash from Discord; null means the default avatar.
      avatar: { type: Sequelize.STRING(100), allowNull: true },
      locale: { type: Sequelize.STRING(5), allowNull: false, defaultValue: 'en' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
