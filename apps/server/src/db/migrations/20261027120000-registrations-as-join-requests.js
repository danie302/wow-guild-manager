'use strict';

// /register became a request to join the guild, without a character (story 018). Officers
// add characters in the web app. Nothing was released with the old table, so its rows go.
const CHARACTER_COLUMNS = [
  'name',
  'lookup',
  'faction',
  'race',
  'character_class',
  'level',
  'looked_up_at',
  'rejection_reason',
  'character_id',
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete('character_registrations', {}, { transaction });
      await queryInterface.sequelize.query(
        'DROP INDEX character_registrations_pending_name_unique',
        { transaction },
      );
      await queryInterface.removeConstraint(
        'character_registrations',
        'character_registrations_lookup_check',
        { transaction },
      );
      for (const column of CHARACTER_COLUMNS) {
        await queryInterface.removeColumn('character_registrations', column, { transaction });
      }
      await queryInterface.renameTable('character_registrations', 'registrations', {
        transaction,
      });
      // One pending request per Discord user and guild.
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX registrations_pending_user_unique
         ON registrations (guild_id, discord_user_id) WHERE status = 'pending'`,
        { transaction },
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.bulkDelete('registrations', {}, { transaction });
      await queryInterface.sequelize.query('DROP INDEX registrations_pending_user_unique', {
        transaction,
      });
      await queryInterface.renameTable('registrations', 'character_registrations', {
        transaction,
      });
      const add = (column, definition) =>
        queryInterface.addColumn('character_registrations', column, definition, { transaction });
      await add('name', { type: Sequelize.STRING(64), allowNull: false });
      await add('lookup', {
        type: Sequelize.STRING(11),
        allowNull: false,
        defaultValue: 'pending',
      });
      await add('faction', { type: Sequelize.STRING(8), allowNull: true });
      await add('race', { type: Sequelize.STRING(16), allowNull: true });
      await add('character_class', { type: Sequelize.STRING(16), allowNull: true });
      await add('level', { type: Sequelize.SMALLINT, allowNull: true });
      await add('looked_up_at', { type: Sequelize.DATE, allowNull: true });
      await add('rejection_reason', { type: Sequelize.STRING(16), allowNull: true });
      await add('character_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'characters', key: 'id' },
        onDelete: 'SET NULL',
      });
      await queryInterface.addConstraint('character_registrations', {
        type: 'check',
        fields: ['lookup'],
        where: { lookup: ['pending', 'found', 'not_found', 'unavailable'] },
        name: 'character_registrations_lookup_check',
        transaction,
      });
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX character_registrations_pending_name_unique
         ON character_registrations (guild_id, lower(name)) WHERE status = 'pending'`,
        { transaction },
      );
    });
  },
};
