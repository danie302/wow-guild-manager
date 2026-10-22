'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // When attendance was first saved, and by whom. Until then, the form is a pre-filled
      // draft and edits aren't corrections.
      await queryInterface.addColumn(
        'events',
        'attendance_recorded_at',
        { type: Sequelize.DATE, allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'events',
        'attendance_recorded_by_user_id',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        { transaction },
      );

      // One record per member and event, with the character they came with. It stays when the
      // member or character is removed from the roster, for the history.
      await queryInterface.createTable(
        'attendance',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('uuidv7()'),
          },
          event_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'events', key: 'id' },
            onDelete: 'CASCADE',
          },
          member_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'members', key: 'id' },
            onDelete: 'CASCADE',
          },
          character_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'characters', key: 'id' },
            onDelete: 'CASCADE',
          },
          status: { type: Sequelize.STRING(16), allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        },
        { transaction },
      );
      await queryInterface.addConstraint('attendance', {
        type: 'check',
        fields: ['status'],
        where: {
          status: ['present', 'late', 'left_early', 'bench', 'absent_with_notice', 'no_show'],
        },
        name: 'attendance_status_check',
        transaction,
      });
      await queryInterface.addIndex('attendance', ['event_id', 'member_id'], {
        unique: true,
        transaction,
      });
      await queryInterface.addIndex('attendance', ['member_id'], { transaction });

      // Every correction after the first save: who, the old and new status, and when.
      // `from_status` is null when a member was added to the list after the first save.
      await queryInterface.createTable(
        'attendance_changes',
        {
          id: {
            type: Sequelize.UUID,
            primaryKey: true,
            defaultValue: Sequelize.literal('uuidv7()'),
          },
          attendance_id: {
            type: Sequelize.UUID,
            allowNull: false,
            references: { model: 'attendance', key: 'id' },
            onDelete: 'CASCADE',
          },
          from_status: { type: Sequelize.STRING(16), allowNull: true },
          to_status: { type: Sequelize.STRING(16), allowNull: false },
          changed_by_user_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
          },
          created_at: { type: Sequelize.DATE, allowNull: false },
        },
        { transaction },
      );
      await queryInterface.addIndex('attendance_changes', ['attendance_id'], { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable('attendance_changes', { transaction });
      await queryInterface.dropTable('attendance', { transaction });
      await queryInterface.removeColumn('events', 'attendance_recorded_by_user_id', {
        transaction,
      });
      await queryInterface.removeColumn('events', 'attendance_recorded_at', { transaction });
    });
  },
};
