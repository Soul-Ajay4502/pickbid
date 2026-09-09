'use strict';

/**
 * Identity proof.
 *
 * The document lives on the *user*, not the player card: a player uploads it
 * once while completing their profile and every league they join reads the same
 * one. `id_proof_url` is a Cloudinary URL like every other upload here.
 *
 * `leagues.id_proof_required` is opt-in and defaults to false, so every league
 * that already exists keeps working exactly as before — organizers turn it on
 * per league when they want players to submit an ID to register.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'id_proof_type', {
      type: Sequelize.STRING, allowNull: true, defaultValue: null,
    });
    await queryInterface.addColumn('users', 'id_proof_url', {
      type: Sequelize.TEXT, allowNull: true, defaultValue: null,
    });
    await queryInterface.addColumn('leagues', 'id_proof_required', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('leagues', 'id_proof_required');
    await queryInterface.removeColumn('users', 'id_proof_url');
    await queryInterface.removeColumn('users', 'id_proof_type');
  },
};
