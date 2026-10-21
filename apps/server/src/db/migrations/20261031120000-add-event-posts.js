'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Where the bot posts events (null until the Guild Master chooses one), and the
      // language of the guild's public Discord messages.
      await queryInterface.addColumn(
        'guilds',
        'events_channel_id',
        { type: Sequelize.STRING(20), allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'guilds',
        'discord_locale',
        { type: Sequelize.STRING(2), allowNull: false, defaultValue: 'en' },
        { transaction },
      );
      await queryInterface.addConstraint('guilds', {
        type: 'check',
        fields: ['discord_locale'],
        where: { discord_locale: ['en', 'es'] },
        name: 'guilds_discord_locale_check',
        transaction,
      });

      // The event's Discord post (null until the worker posts it), and why the last attempt
      // failed, if it did. The worker keeps them current (jobs/handlers/event-posts.ts).
      for (const column of ['discord_channel_id', 'discord_message_id']) {
        await queryInterface.addColumn(
          'events',
          column,
          { type: Sequelize.STRING(20), allowNull: true },
          { transaction },
        );
      }
      await queryInterface.addColumn(
        'events',
        'discord_post_error',
        { type: Sequelize.STRING(30), allowNull: true },
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const column of ['discord_channel_id', 'discord_message_id', 'discord_post_error']) {
        await queryInterface.removeColumn('events', column, { transaction });
      }
      await queryInterface.removeColumn('guilds', 'discord_locale', { transaction });
      await queryInterface.removeColumn('guilds', 'events_channel_id', { transaction });
    });
  },
};
