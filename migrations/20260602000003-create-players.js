'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('players', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      league_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: { model: 'leagues', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      photo: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      batting_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      bowling_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      role: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      is_wicket_keeper: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      creator_token: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('players');
  },
};
