'use strict';

/**
 * Live auction state — one ephemeral JSON blob per league that the creator's
 * auction page writes on each transition and spectators poll to mirror the
 * auction in real time. Cascade-deleted with its league.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auction_live', {
      league_id: {
        type: Sequelize.STRING, primaryKey: true,
        references: { model: 'leagues', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      state:      { type: Sequelize.JSONB, allowNull: true, defaultValue: null },
      updated_at: { type: Sequelize.DATE,  allowNull: true, defaultValue: Sequelize.literal('NOW()') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auction_live');
  },
};
