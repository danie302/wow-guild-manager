'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A character registered from Discord with /register, waiting for an Officer. The Discord
      // profile is copied so approving can add someone who isn't on the roster yet.
      await queryInterface.createTable(
        'character_registrations',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('uuidv7()'),
          },
          guild_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'guilds', key: 'id' },
            onDelete: 'CASCADE',
          },
          discord_user_id: { type: Sequelize.STRING(20), allowNull: false },
          discord_name: { type: Sequelize.STRING(100), allowNull: false },
          discord_avatar: { type: Sequelize.STRING(100), allowNull: true },
          // The language they used /register in, for the direct message about the result.
          locale: { type: Sequelize.STRING(5), allowNull: true },
          name: { type: Sequelize.STRING(64), allowNull: false },
          // pending until the worker looks the character up; then found, not_found, or
          // unavailable (no Battle.net client, or it failed).
          lookup: { type: Sequelize.STRING(11), allowNull: false, defaultValue: 'pending' },
          // Filled in when the lookup finds the character.
          faction: { type: Sequelize.STRING(8), allowNull: true },
          race: { type: Sequelize.STRING(16), allowNull: true },
          character_class: { type: Sequelize.STRING(16), allowNull: true },
          level: { type: Sequelize.SMALLINT, allowNull: true },
          // When the game data was read (it only updates after the player logs out).
          looked_up_at: { type: Sequelize.DATE, allowNull: true },
          status: { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'pending' },
          // Why it was rejected automatically (wrong_faction); null when an Officer rejects it.
          rejection_reason: { type: Sequelize.STRING(16), allowNull: true },
          // Null for automatic rejections, or when the reviewer's account no longer exists.
          reviewed_by_user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
          },
          reviewed_at: { type: Sequelize.DATE, allowNull: true },
          // The character an approval created.
          character_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'characters', key: 'id' },
            onDelete: 'SET NULL',
          },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        },
        { transaction },
      );
      await queryInterface.addConstraint('character_registrations', {
        type: 'check',
        fields: ['status'],
        where: { status: ['pending', 'approved', 'rejected'] },
        name: 'character_registrations_status_check',
        transaction,
      });
      await queryInterface.addConstraint('character_registrations', {
        type: 'check',
        fields: ['lookup'],
        where: { lookup: ['pending', 'found', 'not_found', 'unavailable'] },
        name: 'character_registrations_lookup_check',
        transaction,
      });
      // One pending registration per character name in a guild.
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX character_registrations_pending_name_unique
         ON character_registrations (guild_id, lower(name)) WHERE status = 'pending'`,
        { transaction },
      );
      await queryInterface.addIndex('character_registrations', ['guild_id', 'status'], {
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('character_registrations');
  },
};
