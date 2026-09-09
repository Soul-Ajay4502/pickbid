'use strict';

/**
 * Payment proof.
 *
 * Unlike the identity document, this one lives on the *player card*, not the
 * user: an entry fee is paid to one specific league, so a receipt for the Onam
 * Cup says nothing about whether the same person paid for the Independence Cup.
 *
 * `leagues.payment_proof_required` is opt-in and defaults to false, so every
 * league that already exists keeps working exactly as before.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('players', 'payment_proof_url', {
      type: Sequelize.TEXT, allowNull: true, defaultValue: null,
    });
    await queryInterface.addColumn('leagues', 'payment_proof_required', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('leagues', 'payment_proof_required');
    await queryInterface.removeColumn('players', 'payment_proof_url');
  },
};
