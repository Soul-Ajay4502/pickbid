'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('leagues', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      total_players: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      conducted_by: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      creator_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      template_id: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'classic-green',
      },
      logo_url: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('leagues');
  },
};
