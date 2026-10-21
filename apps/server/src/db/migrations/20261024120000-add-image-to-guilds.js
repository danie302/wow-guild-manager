'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // The guild image's key in file storage; null when the guild has no image. A new upload gets
    // a new key, so image URLs change and browsers never show a stale cached one.
    await queryInterface.addColumn('guilds', 'image_key', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('guilds', 'image_key');
  },
};
