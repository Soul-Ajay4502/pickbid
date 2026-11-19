'use strict';

/**
 * The auction change log: one row each time an organizer writes a player's
 * auction result — a sale on the night, an unsold call, an undo, and the
 * corrections made afterwards (a price edited, a player added to or removed
 * from a team).
 *
 * It exists because those corrections exist. Once a price can be changed after
 * the hammer, "who changed it, from what, and when" is the question a team
 * owner will ask, and the players table only ever holds the latest answer.
 *
 * Names are stored as they were at the time (`player_name`, team names,
 * `actor_name`) rather than joined on read: a log has to stay readable after
 * the player card, the team or the organizer's account it mentions is gone.
 * That is also why only `league_id` is a foreign key — the log goes when the
 * league does, and survives everything else.
 *
 * Append-only. Nothing updates or deletes a row; a mistake is corrected by the
 * next row.
 */
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auction_changes', {
      id: { type: Sequelize.STRING, allowNull: false, primaryKey: true },
      league_id: {
        type: Sequelize.STRING, allowNull: false,
        references: { model: 'leagues', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE',
      },
      // sold | unsold | price | moved | added | removed | cleared | icon | reset
      action:         { type: Sequelize.STRING(16), allowNull: false },
      // auction | correction | setup — which screen the write came from
      source:         { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'other' },
      player_id:      { type: Sequelize.STRING,     allowNull: true,  defaultValue: null },
      player_name:    { type: Sequelize.STRING,     allowNull: false, defaultValue: '' },
      from_team_name: { type: Sequelize.STRING,     allowNull: true,  defaultValue: null },
      to_team_name:   { type: Sequelize.STRING,     allowNull: true,  defaultValue: null },
      from_price:     { type: Sequelize.INTEGER,    allowNull: true,  defaultValue: null },
      to_price:       { type: Sequelize.INTEGER,    allowNull: true,  defaultValue: null },
      actor_id:       { type: Sequelize.STRING,     allowNull: true,  defaultValue: null },
      actor_name:     { type: Sequelize.STRING,     allowNull: false, defaultValue: '' },
      created_at:     { type: Sequelize.DATE,       allowNull: true,  defaultValue: Sequelize.literal('NOW()') },
    });
    // The only read: one league's log, newest first
    await queryInterface.addIndex('auction_changes', ['league_id', 'created_at'], { name: 'auction_changes_league_created_idx' });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('auction_changes', 'auction_changes_league_created_idx');
    await queryInterface.dropTable('auction_changes');
  },
};
