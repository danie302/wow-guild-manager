'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // One sign-up per member and event, with one of their characters. Rows stay when the
      // member or character is removed from the roster, so attendance keeps its history.
      await queryInterface.createTable(
        'sign_ups',
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
          // tank, healer, or dps; null only for a Declined sign-up that never had a role.
          role: { type: Sequelize.STRING(6), allowNull: true },
          // confirmed, tentative, or declined.
          status: { type: Sequelize.STRING(9), allowNull: false },
          // slot or waitlist; null when Declined.
          placement: { type: Sequelize.STRING(8), allowNull: true },
          // When they signed up for this role: the waitlist's order. Changing only the status
          // or the character keeps it.
          signed_up_at: { type: Sequelize.DATE, allowNull: false },
          created_at: { type: Sequelize.DATE, allowNull: false },
          updated_at: { type: Sequelize.DATE, allowNull: false },
        },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE sign_ups
           ADD CONSTRAINT sign_ups_role_check CHECK (role IN ('tank', 'healer', 'dps')),
           ADD CONSTRAINT sign_ups_status_check
             CHECK (status IN ('confirmed', 'tentative', 'declined')),
           ADD CONSTRAINT sign_ups_placement_check CHECK (
             (status = 'declined' AND placement IS NULL)
             OR (status <> 'declined' AND placement IN ('slot', 'waitlist') AND role IS NOT NULL))`,
        { transaction },
      );
      await queryInterface.addIndex('sign_ups', ['event_id', 'member_id'], {
        unique: true,
        transaction,
      });
      await queryInterface.addIndex('sign_ups', ['member_id'], { transaction });
      await queryInterface.addIndex('sign_ups', ['character_id'], { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sign_ups');
  },
};
