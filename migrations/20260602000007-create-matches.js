'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('matches', {
      id: { type: Sequelize.STRING, primaryKey: true },
      league_id: {
        type: Sequelize.STRING, allowNull: false,
        references: { model: 'leagues', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      team1_id:       { type: Sequelize.STRING, allowNull: false },
      team2_id:       { type: Sequelize.STRING, allowNull: false },
      team1_score:    { type: Sequelize.STRING, allowNull: true },
      team2_score:    { type: Sequelize.STRING, allowNull: true },
      winner_team_id: { type: Sequelize.STRING, allowNull: true },
      match_date:     { type: Sequelize.DATEONLY, allowNull: true },
      created_at:     { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.literal('NOW()') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('matches');
  },
};
