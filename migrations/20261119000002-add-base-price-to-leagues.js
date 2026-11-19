'use strict';

/**
 * The auction's base price moves onto the league.
 *
 * It used to live only in the auctioneer's browser (localStorage, defaulting to
 * 100), so the reserve-per-slot rule was computed from whatever that one device
 * happened to hold, and the server could not enforce it at all. Storing it here
 * gives every organizer's screen and `assignPlayerToTeam` the same number.
 *
 * NULL means "never set": the reserve rule is off, which is exactly how the
 * server behaved for every league before this migration.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('leagues', 'base_price', {
      type: Sequelize.INTEGER, allowNull: true, defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('leagues', 'base_price');
  },
};
