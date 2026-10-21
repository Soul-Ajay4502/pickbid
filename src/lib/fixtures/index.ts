/**
 * The fixture engine: who plays whom (`generateFixtures`), whether a fixture
 * holds up (`validateFixture`), how good it is (`scoreFixture`) and when it is
 * played (`scheduleFixtures`). See `types.ts` for the shape of a config.
 *
 * Shared by the public fixture-generator tool, a league's matches screen (in
 * the browser, for the preview) and the endpoint that saves a fixture.
 */

export * from './types';
export { FIXTURE_MODES, MAX_MATCHES_PER_TEAM, MAX_TOTAL_MATCHES, parseFixtureConfig } from './config';
export { getPairKey, generatePossibleMatches, countPairings, countParticipation } from './pairs';
export { planParticipation, isGraphical, forbidsRematches } from './plan';
export { buildRounds, type Fixture, type FixtureRound } from './roundRobin';
export { generateFixtures } from './generate';
export { validateFixture } from './validate';
export { scoreFixture } from './score';
export { assignRounds } from './sequence';
export { randomSeed } from './random';
export * from './poster';
export { scheduleFixtures, isIsoDate, roundDate, formatMatchDay, type ScheduleOptions, type ScheduledMatch } from './schedule';
