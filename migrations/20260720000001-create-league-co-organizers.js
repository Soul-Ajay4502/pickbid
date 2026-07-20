'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('league_co_organizers', {
      id: { type: Sequelize.STRING, primaryKey: true },
      league_id: {
        type: Sequelize.STRING, allowNull: false,
        references: { model: 'leagues', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.STRING, allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      added_by: {
        type: Sequelize.STRING, allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.literal('NOW()') },
    });

    // A user can only co-organize a league once
    await queryInterface.addIndex('league_co_organizers', ['league_id', 'user_id'], {
      name: 'league_co_organizers_league_user_uniq', unique: true,
    });
    // "Leagues I co-organize" lookups filter by user
    await queryInterface.addIndex('league_co_organizers', ['user_id'], {
      name: 'league_co_organizers_user_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('league_co_organizers', 'league_co_organizers_user_id_idx');
    await queryInterface.removeIndex('league_co_organizers', 'league_co_organizers_league_user_uniq');
    await queryInterface.dropTable('league_co_organizers');
  },
};
