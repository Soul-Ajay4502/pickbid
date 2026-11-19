import { NextRequest, NextResponse } from 'next/server';
import { importPlayers } from '@/lib/store';
import { requireLeagueManager } from '@/lib/leagueAuth';
import { IMPORT_MAX_ROWS, parseImportedPlayer, type ImportedPlayer } from '@/lib/playerImport';

// Organizers only — adds the rows of a registration spreadsheet as player
// cards in one go.
//
// The sheet itself never reaches the server: the import dialog reads it in the
// browser, shows the organizer every card it would create, and posts just the
// rows they kept. So this takes plain JSON, and rebuilds each row field by
// field with the same `parseImportedPlayer` the preview is built on.
//
// Unlike the anonymous players POST next door this is gated on
// `requireLeagueManager`: it is an organizer adding cards on other people's
// behalf, which is also why — exactly like that form — it is not held to the
// league's ID or payment-receipt requirements. The register shows the gaps.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { error, status } = await requireLeagueManager(id);
    if (error !== null) return NextResponse.json({ error }, { status });

    const body = await request.json().catch(() => null);
    const list: unknown = body?.players;
    if (!Array.isArray(list) || list.length === 0) {
      return NextResponse.json({ error: 'No players to import' }, { status: 400 });
    }
    if (list.length > IMPORT_MAX_ROWS) {
      return NextResponse.json({ error: `Import at most ${IMPORT_MAX_ROWS} players at a time` }, { status: 400 });
    }

    const rows: ImportedPlayer[] = [];
    for (let i = 0; i < list.length; i++) {
      const parsed = parseImportedPlayer(list[i]);
      if (typeof parsed === 'string') {
        return NextResponse.json({ error: `Player ${i + 1} ${parsed}` }, { status: 400 });
      }
      rows.push(parsed);
    }

    const created = await importPlayers(id, rows);
    return NextResponse.json({ created }, { status: 201 });
  } catch (error) {
    console.error('Error importing players:', error);
    return NextResponse.json({ error: 'Failed to import players' }, { status: 500 });
  }
}
