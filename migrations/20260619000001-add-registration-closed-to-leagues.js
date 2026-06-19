'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('leagues', 'registration_closed', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('leagues', 'registration_closed');
  },
};
