'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const column of ['min_squad_size', 'max_squad_size']) {
        await queryInterface.addColumn('leagues', column, {
          type: Sequelize.INTEGER, allowNull: true, defaultValue: null,
        }, { transaction });
      }
      await queryInterface.sequelize.query(`
        ALTER TABLE leagues ADD CONSTRAINT leagues_squad_range CHECK (
          (min_squad_size IS NULL AND max_squad_size IS NULL) OR
          (min_squad_size IS NOT NULL AND max_squad_size IS NOT NULL
            AND min_squad_size >= 11 AND max_squad_size >= min_squad_size AND max_squad_size <= 100)
        )
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeConstraint('leagues', 'leagues_squad_range', { transaction });
      await queryInterface.removeColumn('leagues', 'max_squad_size', { transaction });
      await queryInterface.removeColumn('leagues', 'min_squad_size', { transaction });
    });
  },
};
