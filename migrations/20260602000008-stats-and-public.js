'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('players', 'stats_matches',  { type: Sequelize.INTEGER, allowNull: true, defaultValue: null });
    await queryInterface.addColumn('players', 'stats_runs',     { type: Sequelize.INTEGER, allowNull: true, defaultValue: null });
    await queryInterface.addColumn('players', 'stats_wickets',  { type: Sequelize.INTEGER, allowNull: true, defaultValue: null });
    await queryInterface.addColumn('players', 'stats_average',  { type: Sequelize.FLOAT,   allowNull: true, defaultValue: null });
    await queryInterface.addColumn('players', 'stats_sr',       { type: Sequelize.FLOAT,   allowNull: true, defaultValue: null });

    await queryInterface.addColumn('leagues', 'is_public', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await queryInterface.addColumn('leagues', 'join_code',  { type: Sequelize.STRING(8), allowNull: true, defaultValue: null });
    await queryInterface.addIndex('leagues', ['join_code'], { unique: true, name: 'leagues_join_code_unique', where: { join_code: { [Sequelize.Op.ne]: null } } });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('leagues', 'leagues_join_code_unique');
    await queryInterface.removeColumn('leagues', 'join_code');
    await queryInterface.removeColumn('leagues', 'is_public');
    await queryInterface.removeColumn('players', 'stats_sr');
    await queryInterface.removeColumn('players', 'stats_average');
    await queryInterface.removeColumn('players', 'stats_wickets');
    await queryInterface.removeColumn('players', 'stats_runs');
    await queryInterface.removeColumn('players', 'stats_matches');
  },
};
