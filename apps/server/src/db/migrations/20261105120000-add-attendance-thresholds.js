'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Attendance bands in percent: Good at or above the first, At risk below the second.
      await queryInterface.addColumn(
        'guilds',
        'attendance_good_threshold',
        { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 90 },
        { transaction },
      );
      await queryInterface.addColumn(
        'guilds',
        'attendance_risk_threshold',
        { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 75 },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE guilds ADD CONSTRAINT guilds_attendance_thresholds_check CHECK (
           attendance_risk_threshold >= 0
           AND attendance_good_threshold <= 100
           AND attendance_good_threshold > attendance_risk_threshold)`,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('guilds', 'attendance_risk_threshold', { transaction });
      await queryInterface.removeColumn('guilds', 'attendance_good_threshold', { transaction });
    });
  },
};
