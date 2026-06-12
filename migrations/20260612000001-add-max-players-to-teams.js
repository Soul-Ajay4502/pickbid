'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('teams', 'max_players', {
      type: Sequelize.INTEGER, allowNull: false, defaultValue: 11,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('teams', 'max_players');
  },
};
