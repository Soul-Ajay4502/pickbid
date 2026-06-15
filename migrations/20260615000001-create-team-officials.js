'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('team_officials', {
      id: { type: Sequelize.STRING, primaryKey: true },
      league_id: {
        type: Sequelize.STRING, allowNull: false,
        references: { model: 'leagues', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      team_id: {
        type: Sequelize.STRING, allowNull: false,
        references: { model: 'teams', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      name:           { type: Sequelize.STRING, allowNull: false },
      contact_number: { type: Sequelize.STRING, allowNull: true,  defaultValue: null },
      role:           { type: Sequelize.STRING, allowNull: false, defaultValue: 'Official' },
      photo:          { type: Sequelize.TEXT,   allowNull: false, defaultValue: '' },
      created_at:     { type: Sequelize.DATE,   allowNull: true,  defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.addIndex('team_officials', ['league_id'], { name: 'team_officials_league_id_idx' });
    await queryInterface.addIndex('team_officials', ['team_id'],   { name: 'team_officials_team_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('team_officials', 'team_officials_team_id_idx');
    await queryInterface.removeIndex('team_officials', 'team_officials_league_id_idx');
    await queryInterface.dropTable('team_officials');
  },
};
