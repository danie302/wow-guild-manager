'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // How many hours before an event its one missing-role check runs, chosen per event and
      // per series (which passes it to its events). Existing ones get the default.
      for (const table of ['events', 'event_series']) {
        await queryInterface.addColumn(
          table,
          'missing_role_alert_hours',
          { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 24 },
          { transaction },
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE ${table} ADD CONSTRAINT ${table}_missing_role_alert_hours_check
             CHECK (missing_role_alert_hours BETWEEN 1 AND 72)`,
          { transaction },
        );
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ['events', 'event_series']) {
        await queryInterface.removeColumn(table, 'missing_role_alert_hours', { transaction });
      }
    });
  },
};
