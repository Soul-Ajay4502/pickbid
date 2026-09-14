'use strict';

/**
 * Payment confirmation.
 *
 * `players.payment_proof_url` is what the *player* claims — a screenshot they
 * attached when registering. This flag is what the *organizer* verified: that
 * the entry fee actually landed. The two are deliberately independent, because
 * plenty of fees arrive in cash or over a transfer nobody screenshotted, and a
 * receipt on file is not the same thing as money received.
 *
 * Defaults to false, so every existing card starts unmarked and no league that
 * predates the register changes behaviour.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('players', 'payment_received', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('players', 'payment_received');
  },
};
