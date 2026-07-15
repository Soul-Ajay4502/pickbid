'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('leagues', 'pick_preference', {
      type: Sequelize.JSONB, allowNull: true, defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('leagues', 'pick_preference');
  },
};
