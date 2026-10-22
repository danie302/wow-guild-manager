'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // How many hours before an event Tentative participants must confirm, and how many
      // hours before that deadline they get a reminder.
      await queryInterface.addColumn(
        'guilds',
        'tentative_deadline_hours',
        { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 24 },
        { transaction },
      );
      await queryInterface.addColumn(
        'guilds',
        'reminder_hours',
        { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 12 },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE guilds
           ADD CONSTRAINT guilds_tentative_deadline_hours_check
             CHECK (tentative_deadline_hours BETWEEN 1 AND 168),
           ADD CONSTRAINT guilds_reminder_hours_check CHECK (reminder_hours BETWEEN 1 AND 72)`,
        { transaction },
      );

      // An event's (and a series') own deadline, overriding the guild's; null uses the guild's.
      for (const table of ['events', 'event_series']) {
        await queryInterface.addColumn(
          table,
          'tentative_deadline_hours',
          { type: Sequelize.SMALLINT, allowNull: true },
          { transaction },
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE ${table} ADD CONSTRAINT ${table}_tentative_deadline_hours_check
             CHECK (tentative_deadline_hours BETWEEN 1 AND 168)`,
          { transaction },
        );
      }

      // When the event's Tentative deadline is. It's stored rather than worked out, because a
      // guild setting change keeps an event's deadline when the new one would have passed.
      await queryInterface.addColumn(
        'events',
        'tentative_deadline_at',
        { type: Sequelize.DATE, allowNull: true },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE events SET tentative_deadline_at = starts_at - interval '24 hours'`,
        { transaction },
      );
      await queryInterface.changeColumn(
        'events',
        'tentative_deadline_at',
        { type: Sequelize.DATE, allowNull: false },
        { transaction },
      );

      // When the participant got the Tentative reminder, so it's sent once.
      await queryInterface.addColumn(
        'sign_ups',
        'reminded_at',
        { type: Sequelize.DATE, allowNull: true },
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('sign_ups', 'reminded_at', { transaction });
      await queryInterface.removeColumn('events', 'tentative_deadline_at', { transaction });
      for (const table of ['events', 'event_series']) {
        await queryInterface.removeColumn(table, 'tentative_deadline_hours', { transaction });
      }
      await queryInterface.removeColumn('guilds', 'reminder_hours', { transaction });
      await queryInterface.removeColumn('guilds', 'tentative_deadline_hours', { transaction });
    });
  },
};
