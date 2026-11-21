import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auctionLimits, reserveRuleMessage, squadLimits, validSquadRange } from './auctionRules';

const limits = (squadSize: number, balance = 1000) => auctionLimits({
  budget: 5000, spent: 5000 - balance, squadSize,
  minPlayers: 11, maxPlayers: 15, basePrice: 100,
});

test('reserve covers only the minimum; extras can use the remaining purse until full', () => {
  assert.deepEqual(limits(9), { balance: 1000, slotsLeft: 6, requiredSlots: 2, reserve: 100, maxBid: 900, shortfall: 0 });
  for (const size of [10, 11, 14]) {
    assert.equal(limits(size).reserve, 0);
    assert.equal(limits(size).maxBid, 1000);
  }
  assert.equal(limits(15).maxBid, 0);
  assert.equal(limits(16).maxBid, 0);
  assert.equal(limits(11, 50).shortfall, 0);
  assert.equal(limits(11, 50).maxBid, 50);
  assert.equal(limits(11, 0).maxBid, 0);
});

test('minimum shortfall and price-correction calculation exclude the player being priced', () => {
  assert.equal(limits(9, 150).shortfall, 50);
  assert.equal(limits(9, 150).maxBid, 50);
  assert.equal(limits(10, 50).shortfall, 50);
  assert.match(reserveRuleMessage('Aces', limits(9), String), /1 other required slot/);
  assert.match(reserveRuleMessage('Aces', limits(11), String), /remaining purse/);
  assert.equal(auctionLimits({ budget: 1000, spent: 0, squadSize: 0, minPlayers: 11, maxPlayers: 15, basePrice: null }).reserve, 0);
});

test('legacy exact sizes remain unchanged and shared ranges reject invalid boundaries', () => {
  assert.deepEqual(squadLimits(7, { minSquadSize: null, maxSquadSize: null }), { minPlayers: 7, maxPlayers: 7 });
  assert.deepEqual(squadLimits(7, { minSquadSize: 11, maxSquadSize: 15 }), { minPlayers: 11, maxPlayers: 15 });
  assert.equal(auctionLimits({ budget: 1000, spent: 0, squadSize: 7, maxPlayers: 11, basePrice: 100 }).maxBid, 700);
  assert.equal(validSquadRange(11, 11), true);
  assert.equal(validSquadRange(11, 100), true);
  for (const [min, max] of [[10, 15], [11, 10], [11, 101], [11.5, 15], [11, 15.5], [null, null], ['11', 15]]) {
    assert.equal(validSquadRange(min, max), false);
  }
});
