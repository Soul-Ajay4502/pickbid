'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Remove matches referencing teams that no longer exist so the FKs can be added
    await queryInterface.sequelize.query(`
      DELETE FROM matches
      WHERE team1_id NOT IN (SELECT id FROM teams)
         OR team2_id NOT IN (SELECT id FROM teams)
    `);
    await queryInterface.sequelize.query(`
      UPDATE matches SET winner_team_id = NULL
      WHERE winner_team_id IS NOT NULL
        AND winner_team_id NOT IN (SELECT id FROM teams)
    `);

    // A match is meaningless without its teams → CASCADE; a winner ref can be cleared
    await queryInterface.addConstraint('matches', {
      fields: ['team1_id'], type: 'foreign key', name: 'matches_team1_id_fkey',
      references: { table: 'teams', field: 'id' },
      onUpdate: 'CASCADE', onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('matches', {
      fields: ['team2_id'], type: 'foreign key', name: 'matches_team2_id_fkey',
      references: { table: 'teams', field: 'id' },
      onUpdate: 'CASCADE', onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('matches', {
      fields: ['winner_team_id'], type: 'foreign key', name: 'matches_winner_team_id_fkey',
      references: { table: 'teams', field: 'id' },
      onUpdate: 'CASCADE', onDelete: 'SET NULL',
    });

    // Indexes on the foreign keys the app filters by
    await queryInterface.addIndex('players', ['league_id'], { name: 'players_league_id_idx' });
    await queryInterface.addIndex('players', ['team_id'],   { name: 'players_team_id_idx' });
    await queryInterface.addIndex('players', ['user_id'],   { name: 'players_user_id_idx' });
    await queryInterface.addIndex('teams',   ['league_id'], { name: 'teams_league_id_idx' });
    await queryInterface.addIndex('matches', ['league_id'], { name: 'matches_league_id_idx' });
    await queryInterface.addIndex('leagues', ['creator_id'], { name: 'leagues_creator_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('leagues', 'leagues_creator_id_idx');
    await queryInterface.removeIndex('matches', 'matches_league_id_idx');
    await queryInterface.removeIndex('teams', 'teams_league_id_idx');
    await queryInterface.removeIndex('players', 'players_user_id_idx');
    await queryInterface.removeIndex('players', 'players_team_id_idx');
    await queryInterface.removeIndex('players', 'players_league_id_idx');
    await queryInterface.removeConstraint('matches', 'matches_winner_team_id_fkey');
    await queryInterface.removeConstraint('matches', 'matches_team2_id_fkey');
    await queryInterface.removeConstraint('matches', 'matches_team1_id_fkey');
  },
};
