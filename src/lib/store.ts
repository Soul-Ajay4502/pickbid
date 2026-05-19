import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { League, Player } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const LEAGUES_FILE = path.join(DATA_DIR, 'leagues.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readLeagues(): League[] {
  ensureDataDir();
  if (!fs.existsSync(LEAGUES_FILE)) {
    fs.writeFileSync(LEAGUES_FILE, JSON.stringify([]));
    return [];
  }
  try {
    const raw = fs.readFileSync(LEAGUES_FILE, 'utf-8');
    return JSON.parse(raw) as League[];
  } catch {
    return [];
  }
}

function writeLeagues(leagues: League[]) {
  ensureDataDir();
  fs.writeFileSync(LEAGUES_FILE, JSON.stringify(leagues, null, 2));
}

function readPlayers(): Player[] {
  ensureDataDir();
  if (!fs.existsSync(PLAYERS_FILE)) {
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify([]));
    return [];
  }
  try {
    const raw = fs.readFileSync(PLAYERS_FILE, 'utf-8');
    return JSON.parse(raw) as Player[];
  } catch {
    return [];
  }
}

function writePlayers(players: Player[]) {
  ensureDataDir();
  fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2));
}

export function getLeagues(): League[] {
  return readLeagues();
}

export function getLeague(id: string): League | null {
  const leagues = readLeagues();
  return leagues.find((l) => l.id === id) ?? null;
}

export function createLeague(data: Omit<League, 'id' | 'createdAt'> & { templateId?: string; logoUrl?: string }): League {
  const leagues = readLeagues();
  const league: League = {
    id: uuidv4(),
    ...data,
    templateId: data.templateId ?? 'classic-green',
    logoUrl: data.logoUrl ?? '',
    createdAt: new Date().toISOString(),
  };
  leagues.push(league);
  writeLeagues(leagues);
  return league;
}

export function getPlayers(leagueId: string): Player[] {
  const players = readPlayers();
  return players.filter((p) => p.leagueId === leagueId);
}

export function getPlayer(id: string): Player | null {
  const players = readPlayers();
  return players.find((p) => p.id === id) ?? null;
}

export function createPlayer(data: Omit<Player, 'id' | 'createdAt'>): Player {
  const players = readPlayers();
  const player: Player = {
    id: uuidv4(),
    ...data,
    createdAt: new Date().toISOString(),
  };
  players.push(player);
  writePlayers(players);
  return player;
}

export function updatePlayer(
  id: string,
  data: Partial<Omit<Player, 'id' | 'leagueId' | 'creatorToken' | 'createdAt'>>
): Player | null {
  const players = readPlayers();
  const idx = players.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  players[idx] = { ...players[idx], ...data };
  writePlayers(players);
  return players[idx];
}

export function deletePlayer(id: string): boolean {
  const players = readPlayers();
  const idx = players.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  players.splice(idx, 1);
  writePlayers(players);
  return true;
}

export function deleteLeague(id: string): boolean {
  const leagues = readLeagues();
  const idx = leagues.findIndex((l) => l.id === id);
  if (idx === -1) return false;
  leagues.splice(idx, 1);
  writeLeagues(leagues);
  // Remove all players belonging to this league
  const players = readPlayers().filter((p) => p.leagueId !== id);
  writePlayers(players);
  return true;
}
