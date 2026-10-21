'use strict';

/**
 * Live ball-by-ball scoring: one scorecard per match.
 *
 * The row stores the scoring *log*, not a score. `setup` is what the match is
 * played under (rules, both playing squads, the toss) and `events` is every
 * ball and decision in order; the scoring engine (`src/lib/scoring`) replays
 * them to produce the score, the scorecard and the result. Undo is dropping
 * the last event, so a correction can never leave a stale total behind.
 *
 * `version` is the optimistic-concurrency token: a write names the version it
 * was built on and the UPDATE matches on it, so two scorers on two phones
 * can't silently overwrite each other — the second gets a conflict.
 *
 * `summary` and `player_lines` are caches the writer derives from the log on
 * every save, so the match list, points table (NRR) and league stats can read
 * a few hundred bytes per match instead of replaying every log. They are never
 * written from anywhere else; `events` stays the source of truth.
 *
 * `phase` is denormalised from the summary for the one cheap question asked
 * of many rows at once: is anything being scored right now.
 *
 * Cascades with the match (deleting a fixture deletes its scorecard) and with
 * the league.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('match_scorecards', {
      match_id: {
        type: Sequelize.STRING, allowNull: false, primaryKey: true,
        references: { model: 'matches', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      league_id: {
        type: Sequelize.STRING, allowNull: false,
        references: { model: 'leagues', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      setup:        { type: Sequelize.JSONB,      allowNull: false },
      events:       { type: Sequelize.JSONB,      allowNull: false, defaultValue: Sequelize.literal("'[]'::jsonb") },
      version:      { type: Sequelize.INTEGER,    allowNull: false, defaultValue: 0 },
      phase:        { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'pre' },
      summary:      { type: Sequelize.JSONB,      allowNull: true,  defaultValue: null },
      player_lines: { type: Sequelize.JSONB,      allowNull: true,  defaultValue: null },
      updated_by:   { type: Sequelize.STRING,     allowNull: true,  defaultValue: null },
      created_at:   { type: Sequelize.DATE,       allowNull: true,  defaultValue: Sequelize.literal('NOW()') },
      updated_at:   { type: Sequelize.DATE,       allowNull: true,  defaultValue: Sequelize.literal('NOW()') },
    });
    // Every league-level read (match list badges, NRR, stats) filters on this
    await queryInterface.addIndex('match_scorecards', ['league_id'], { name: 'match_scorecards_league_id_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('match_scorecards', 'match_scorecards_league_id_idx');
    await queryInterface.dropTable('match_scorecards');
  },
};
