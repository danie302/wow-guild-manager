'use strict';

const id = (Sequelize) => ({
  type: Sequelize.UUID,
  primaryKey: true,
  defaultValue: Sequelize.literal('uuidv7()'),
});
const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false },
  updated_at: { type: Sequelize.DATE, allowNull: false },
});

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // A Discord user on a guild's roster. Removing a member keeps the row (removed_at), so
      // past sign-ups and attendance stay intact and adding them back restores it.
      await queryInterface.createTable(
        'members',
        {
          id: id(Sequelize),
          guild_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'guilds', key: 'id' },
            onDelete: 'CASCADE',
          },
          discord_user_id: { type: Sequelize.STRING(20), allowNull: false },
          // The Discord display name and avatar, kept current by the bot.
          discord_name: { type: Sequelize.STRING(100), allowNull: false },
          discord_avatar: { type: Sequelize.STRING(100), allowNull: true },
          // Raider or Member, set in the app. Guild Master and Officer are worked out from the
          // guild and from guild_officers.
          rank: { type: Sequelize.STRING(6), allowNull: false },
          // The language of the member's most recent interaction with the bot, for DMs.
          locale: { type: Sequelize.STRING(5), allowNull: true },
          removed_at: { type: Sequelize.DATE, allowNull: true },
          ...timestamps(Sequelize),
        },
        { transaction },
      );
      // One record per Discord user and guild, removed or not, so adding back restores it.
      await queryInterface.addIndex('members', ['guild_id', 'discord_user_id'], {
        unique: true,
        transaction,
      });
      await queryInterface.addConstraint('members', {
        type: 'check',
        fields: ['rank'],
        where: { rank: ['raider', 'member'] },
        name: 'members_rank_check',
        transaction,
      });

      await queryInterface.createTable(
        'characters',
        {
          id: id(Sequelize),
          member_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'members', key: 'id' },
            onDelete: 'CASCADE',
          },
          name: { type: Sequelize.STRING(64), allowNull: false },
          faction: { type: Sequelize.STRING(8), allowNull: false },
          race: { type: Sequelize.STRING(16), allowNull: false },
          character_class: { type: Sequelize.STRING(16), allowNull: false },
          level: { type: Sequelize.SMALLINT, allowNull: false },
          professions: {
            type: Sequelize.ARRAY(Sequelize.STRING(16)),
            allowNull: false,
            defaultValue: [],
          },
          is_main: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
          removed_at: { type: Sequelize.DATE, allowNull: true },
          ...timestamps(Sequelize),
        },
        { transaction },
      );
      await queryInterface.addConstraint('characters', {
        type: 'check',
        fields: ['level'],
        where: { level: { [Sequelize.Op.between]: [1, 60] } },
        name: 'characters_level_check',
        transaction,
      });
      // Names are unique across the game among active characters (there are no realms), which
      // also keeps a character in one guild at a time. Removed characters don't count.
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX characters_active_name_unique ON characters (lower(name))
         WHERE removed_at IS NULL`,
        { transaction },
      );
      // At most one main per member; the domain makes the first character the main.
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX characters_one_main_per_member ON characters (member_id)
         WHERE is_main AND removed_at IS NULL`,
        { transaction },
      );

      // Every rank a member has had. changed_by_user_id is null for changes from Discord
      // (gaining or losing the Officer role).
      await queryInterface.createTable(
        'rank_changes',
        {
          id: id(Sequelize),
          member_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'members', key: 'id' },
            onDelete: 'CASCADE',
          },
          from_rank: { type: Sequelize.STRING(12), allowNull: true },
          to_rank: { type: Sequelize.STRING(12), allowNull: false },
          changed_by_user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
          },
          source: { type: Sequelize.STRING(7), allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false },
        },
        { transaction },
      );
      await queryInterface.addIndex('rank_changes', ['member_id', 'created_at'], { transaction });

      await queryInterface.createTable(
        'officer_notes',
        {
          id: id(Sequelize),
          member_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'members', key: 'id' },
            onDelete: 'CASCADE',
          },
          author_user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
          },
          text: { type: Sequelize.TEXT, allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false },
        },
        { transaction },
      );
      await queryInterface.addIndex('officer_notes', ['member_id', 'created_at'], { transaction });

      // Every guild's Guild Master is on its roster, as a Raider underneath.
      await queryInterface.sequelize.query(
        `INSERT INTO members (guild_id, discord_user_id, discord_name, discord_avatar, rank,
                              created_at, updated_at)
         SELECT g.id, u.discord_id, u.name, u.avatar, 'raider', now(), now()
         FROM guilds g JOIN users u ON u.id = g.guild_master_user_id`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `INSERT INTO rank_changes (member_id, from_rank, to_rank, source, created_at)
         SELECT id, NULL, 'guild_master', 'app', now() FROM members`,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const table of ['officer_notes', 'rank_changes', 'characters', 'members']) {
        await queryInterface.dropTable(table, { transaction });
      }
    });
  },
};
