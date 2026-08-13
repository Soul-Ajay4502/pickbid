'use strict';

/**
 * Participation certificates. A single nullable timestamp carries both facts we
 * need: NULL means the organizers haven't released certificates yet, and a
 * non-null value is the issue date printed on the certificate itself.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('leagues', 'certificates_released_at', {
      type: Sequelize.DATE, allowNull: true, defaultValue: null,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('leagues', 'certificates_released_at');
  },
};
