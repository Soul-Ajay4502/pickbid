import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { League, Player } from './types';

// Lazy singleton — avoids URL validation at module-evaluation time (build-time)
let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

const LEAGUES_KEY = 'pcs:leagues';
const PLAYERS_KEY = 'pcs:players';

// ── Internal helpers ──────────────────────────────────────────────────────────

async function readLeagues(): Promise<League[]> {
  const data = await getRedis().get<League[]>(LEAGUES_KEY);
  return data ?? [];
}

async function writeLeagues(leagues: League[]): Promise<void> {
  await getRedis().set(LEAGUES_KEY, JSON.stringify(leagues));
}

async function readPlayers(): Promise<Player[]> {
  const data = await getRedis().get<Player[]>(PLAYERS_KEY);
  return data ?? [];
}

async function writePlayers(players: Player[]): Promise<void> {
  await getRedis().set(PLAYERS_KEY, JSON.stringify(players));
}

// ── Leagues ───────────────────────────────────────────────────────────────────

export async function getLeagues(): Promise<League[]> {
  return readLeagues();
}

export async function getLeague(id: string): Promise<League | null> {
  const leagues = await readLeagues();
  return leagues.find((l) => l.id === id) ?? null;
}

export async function createLeague(
  data: Omit<League, 'id' | 'createdAt'> & { templateId?: string; logoUrl?: string }
): Promise<League> {
  const leagues = await readLeagues();
  const league: League = {
    id: uuidv4(),
    ...data,
    templateId: data.templateId ?? 'classic-green',
    logoUrl: data.logoUrl ?? '',
    createdAt: new Date().toISOString(),
  };
  leagues.push(league);
  await writeLeagues(leagues);
  return league;
}

export async function updateLeague(
  id: string,
  data: Partial<Omit<League, 'id' | 'creatorToken' | 'createdAt'>>
): Promise<League | null> {
  const leagues = await readLeagues();
  const idx = leagues.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  leagues[idx] = { ...leagues[idx], ...data };
  await writeLeagues(leagues);
  return leagues[idx];
}

export async function deleteLeague(id: string): Promise<boolean> {
  const leagues = await readLeagues();
  const idx = leagues.findIndex((l) => l.id === id);
  if (idx === -1) return false;
  leagues.splice(idx, 1);
  await writeLeagues(leagues);
  // Cascade — remove all players in this league
  const players = (await readPlayers()).filter((p) => p.leagueId !== id);
  await writePlayers(players);
  return true;
}

// ── Players ───────────────────────────────────────────────────────────────────

export async function getPlayers(leagueId: string): Promise<Player[]> {
  const players = await readPlayers();
  return players.filter((p) => p.leagueId === leagueId);
}

export async function getPlayer(id: string): Promise<Player | null> {
  const players = await readPlayers();
  return players.find((p) => p.id === id) ?? null;
}

export async function createPlayer(data: Omit<Player, 'id' | 'createdAt'>): Promise<Player> {
  const players = await readPlayers();
  const player: Player = {
    id: uuidv4(),
    ...data,
    createdAt: new Date().toISOString(),
  };
  players.push(player);
  await writePlayers(players);
  return player;
}

export async function updatePlayer(
  id: string,
  data: Partial<Omit<Player, 'id' | 'leagueId' | 'creatorToken' | 'createdAt'>>
): Promise<Player | null> {
  const players = await readPlayers();
  const idx = players.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  players[idx] = { ...players[idx], ...data };
  await writePlayers(players);
  return players[idx];
}

export async function deletePlayer(id: string): Promise<boolean> {
  const players = await readPlayers();
  const idx = players.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  players.splice(idx, 1);
  await writePlayers(players);
  return true;
}
