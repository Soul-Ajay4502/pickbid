'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        comment: 'Google OAuth sub',
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '',
      },
      photo: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: '',
      },
      batting_type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Right-Hand Bat',
      },
      bowling_type: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'N/A',
      },
      role: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Batter',
      },
      is_wicket_keeper: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      profile_completed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
