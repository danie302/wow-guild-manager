'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // IANA name, e.g. America/Bogota. Existing users get UTC until they pick one.
    await queryInterface.addColumn('users', 'time_zone', {
      type: Sequelize.STRING(64),
      allowNull: false,
      defaultValue: 'UTC',
    });
    await queryInterface.addColumn('users', 'theme', {
      type: Sequelize.STRING(5),
      allowNull: false,
      defaultValue: 'dark',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'theme');
    await queryInterface.removeColumn('users', 'time_zone');
  },
};
