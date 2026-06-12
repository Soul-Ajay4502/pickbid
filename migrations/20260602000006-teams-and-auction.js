'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('teams', {
      id: { type: Sequelize.STRING, primaryKey: true },
      league_id: {
        type: Sequelize.STRING, allowNull: false,
        references: { model: 'leagues', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      name:      { type: Sequelize.STRING,  allowNull: false },
      color_hex: { type: Sequelize.STRING,  allowNull: false, defaultValue: '#22c55e' },
      budget:    { type: Sequelize.INTEGER, allowNull: false, defaultValue: 10000000 },
      created_at: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.addColumn('players', 'team_id', {
      type: Sequelize.STRING, allowNull: true, defaultValue: null,
      references: { model: 'teams', key: 'id' },
      onUpdate: 'CASCADE', onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('players', 'sold_price', {
      type: Sequelize.INTEGER, allowNull: true, defaultValue: null,
    });
    await queryInterface.addColumn('players', 'is_unsold', {
      type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('players', 'is_unsold');
    await queryInterface.removeColumn('players', 'sold_price');
    await queryInterface.removeColumn('players', 'team_id');
    await queryInterface.dropTable('teams');
  },
};
