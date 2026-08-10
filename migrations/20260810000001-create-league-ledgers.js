'use strict';

/**
 * League ledger — one optional markdown sheet per league recording the money
 * side of running it (team/player registration income, sponsorship, ground
 * rent, trophies, …). Keyed by league_id because a league has at most one
 * ledger; leagues that never add one simply have no row here.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('league_ledgers', {
      league_id: {
        type: Sequelize.STRING, primaryKey: true,
        references: { model: 'leagues', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      content:   { type: Sequelize.TEXT,    allowNull: false, defaultValue: '' },
      // Drafts stay organizer-only; publishing is what makes the ledger
      // visible to the league's players.
      published: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      // Which organizer saved last — shown to the other organizers so a
      // co-edited ledger has an audit trail. Kept as a plain FK with SET NULL
      // so deleting a user account never deletes the league's accounts.
      updated_by: {
        type: Sequelize.STRING, allowNull: true, defaultValue: null,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      created_at: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.literal('NOW()') },
      updated_at: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.literal('NOW()') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('league_ledgers');
  },
};
