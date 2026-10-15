'use strict';

/**
 * Rewards: badges and streaks.
 *
 * Neither table holds a catalog. Badge definitions (names, tiers, thresholds)
 * live in code — `src/lib/badges.ts` — so the database only records *who earned
 * what, when*. That keeps a badge read to one primary-key range scan with no
 * join, and lets a new badge ship without a migration.
 *
 * `user_badges` has one row per earned tier. The composite primary key is what
 * makes awarding idempotent: the evaluator inserts every tier a user qualifies
 * for with `ON CONFLICT DO NOTHING`, and only the rows that were genuinely new
 * come back from `RETURNING` — which is how the app knows what to celebrate,
 * exactly once, even with two tabs checking in at the same moment. `tier` is a
 * SMALLINT (1 bronze, 2 silver, 3 gold) so ordering is numeric. The secondary
 * index on (badge_id, tier) turns the hourly rarity count — "held by 8% of
 * players" — into an index-only scan instead of a full table read.
 *
 * `user_streaks` has one row per user per streak kind ('weekly' today). It
 * stores the running totals rather than an activity log, so recording a visit
 * is a single O(1) upsert however long someone has been around. `history` is a
 * bitmask of the last 52 periods (bit 0 = `last_period`) — enough to draw the
 * streak calendar without a row per week.
 *
 * Both cascade with the user: rewards mean nothing without the account.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_badges', {
      user_id: {
        type: Sequelize.STRING, allowNull: false, primaryKey: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      badge_id:  { type: Sequelize.STRING(48), allowNull: false, primaryKey: true },
      tier:      { type: Sequelize.SMALLINT,   allowNull: false, primaryKey: true },
      earned_at: { type: Sequelize.DATE,       allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE user_badges ADD CONSTRAINT user_badges_tier_positive CHECK (tier > 0)'
    );
    // Rarity: holders per badge tier, counted across every account
    await queryInterface.addIndex('user_badges', ['badge_id', 'tier'], {
      name: 'user_badges_badge_tier_idx',
    });

    await queryInterface.createTable('user_streaks', {
      user_id: {
        type: Sequelize.STRING, allowNull: false, primaryKey: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      kind:          { type: Sequelize.STRING(24), allowNull: false, primaryKey: true },
      current_count: { type: Sequelize.INTEGER,    allowNull: false, defaultValue: 0 },
      longest_count: { type: Sequelize.INTEGER,    allowNull: false, defaultValue: 0 },
      // Start of the last period counted (a Monday, for the weekly streak)
      last_period:   { type: Sequelize.DATEONLY,   allowNull: false },
      history:       { type: Sequelize.BIGINT,     allowNull: false, defaultValue: 0 },
      updated_at:    { type: Sequelize.DATE,       allowNull: true,  defaultValue: Sequelize.literal('NOW()') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_streaks');
    await queryInterface.removeIndex('user_badges', 'user_badges_badge_tier_idx');
    await queryInterface.dropTable('user_badges');
  },
};
