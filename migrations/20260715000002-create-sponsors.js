'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sponsors', {
      id: { type: Sequelize.STRING, primaryKey: true },
      league_id: {
        type: Sequelize.STRING, allowNull: false,
        references: { model: 'leagues', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      name:       { type: Sequelize.STRING, allowNull: false },
      logo_url:   { type: Sequelize.TEXT,   allowNull: false, defaultValue: '' },
      website:    { type: Sequelize.STRING, allowNull: true,  defaultValue: null },
      created_at: { type: Sequelize.DATE,   allowNull: true,  defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.addIndex('sponsors', ['league_id'], { name: 'sponsors_league_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('sponsors', 'sponsors_league_id_idx');
    await queryInterface.dropTable('sponsors');
  },
};
