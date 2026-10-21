'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // The worker's hourly search for events that were never posted, and the bot's search
      // for failed posts on every role or channel change. Each covers only the few events
      // in that state, so they stay small however many events there are.
      await queryInterface.addIndex('events', ['starts_at'], {
        name: 'events_unposted_starts_at',
        where: { discord_message_id: null, discord_post_error: null, cancelled_at: null },
        transaction,
      });
      await queryInterface.addIndex('events', ['starts_at'], {
        name: 'events_failed_post_starts_at',
        where: { discord_post_error: { [Sequelize.Op.ne]: null }, cancelled_at: null },
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('events', 'events_failed_post_starts_at', { transaction });
      await queryInterface.removeIndex('events', 'events_unposted_starts_at', { transaction });
    });
  },
};
