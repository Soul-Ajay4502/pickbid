'use strict';

/**
 * Two organizer-controlled switches over what a league's own players may do
 * with each other's cards.
 *
 * Both default to TRUE, which is exactly how every league behaved before this
 * migration: the roster is visible to everyone who can open the league, and the
 * person who created a card can delete it again. An organizer who wants a
 * closed trial — nobody sizing up the competition, nobody pulling their card
 * out the night before the auction — turns them off.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('leagues', 'roster_visible_to_players', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true,
    });
    await queryInterface.addColumn('leagues', 'players_can_delete_cards', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('leagues', 'players_can_delete_cards');
    await queryInterface.removeColumn('leagues', 'roster_visible_to_players');
  },
};
