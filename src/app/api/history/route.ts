import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

function logDbError(context: string, error: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const hasConnection = /connection|ECONNREFUSED|connect|POSTGRES_|DATABASE_URL/i.test(err.message);
  const hasTable = /relation.*does not exist|table.*not found/i.test(err.message);
  console.error(`[history/${context}]`, err.name, err.message);
  if (hasConnection) console.error('[history] Probabile problema di connessione DB (verificare variabili POSTGRES_* / DATABASE_URL).');
  if (hasTable) console.error('[history] Tabella mancante o schema non inizializzato.');
}

async function initDb(): Promise<void> {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS quotes (
        client_name TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        status TEXT DEFAULT 'preventivo',
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    try {
      await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'preventivo';`;
    } catch (e) {
      // Colonna già presente o errore minore
    }
  } catch (e) {
    console.error('[history/initDb] Fallito init tabella:', e instanceof Error ? e.message : String(e));
    throw e;
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { clientName, quoteData, status = 'preventivo' } = body;

    if (!clientName) {
      return NextResponse.json({ error: 'Client name is required per salvare il preventivo.' }, { status: 400 });
    }

    await sql`
      INSERT INTO quotes (client_name, data, status, updated_at)
      VALUES (${clientName}, ${JSON.stringify(quoteData)}::jsonb, ${status}, NOW())
      ON CONFLICT (client_name) 
      DO UPDATE SET data = EXCLUDED.data, status = EXCLUDED.status, updated_at = NOW();
    `;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logDbError('POST', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const hasPostgresEnv = !!(
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    (process.env as Record<string, string>).POSTGRES_PRISMA_URL
  );
  console.log('[history/GET] Richiesta ricevuta. Env DB presente:', hasPostgresEnv);

  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'preventivo';
    const modeParam = searchParams.get('mode');

    // status='all' → tutti i record, nessun filtro mode. Record senza mode (vecchi dati) inclusi.
    const statusFilter = statusParam === 'all';
    let rows: { client_name: string; data: unknown; status: string; updated_at: string }[];

    if (statusFilter) {
      // Nessun filtro per status né per mode: restituisci tutto
      const result = await sql`
        SELECT client_name, data, status, updated_at
        FROM quotes
        ORDER BY updated_at DESC
        LIMIT 100;
      `;
      rows = result.rows as typeof rows;
      console.log('[history/GET] Query "all", righe:', rows.length);
    } else if (modeParam === 'stay') {
      const result = await sql`
        SELECT client_name, data, status, updated_at
        FROM quotes
        WHERE status = ${statusParam}
        AND (data->>'mode' = 'stay' OR data->>'mode' IS NULL)
        ORDER BY updated_at DESC
        LIMIT 100;
      `;
      rows = result.rows as typeof rows;
      console.log('[history/GET] Query stay (inclusi senza mode), righe:', rows.length);
    } else if (modeParam === 'flight') {
      const result = await sql`
        SELECT client_name, data, status, updated_at
        FROM quotes
        WHERE status = ${statusParam}
        AND data->>'mode' = 'flight'
        ORDER BY updated_at DESC
        LIMIT 100;
      `;
      rows = result.rows as typeof rows;
      console.log('[history/GET] Query flight, righe:', rows.length);
    } else {
      const result = await sql`
        SELECT client_name, data, status, updated_at
        FROM quotes
        WHERE status = ${statusParam}
        ORDER BY updated_at DESC
        LIMIT 100;
      `;
      rows = result.rows as typeof rows;
      console.log('[history/GET] Query default, righe:', rows.length);
    }

    return NextResponse.json(rows);
  } catch (error: unknown) {
    logDbError('GET', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    let clientName = searchParams.get('client_name');
    if (!clientName) {
      try {
        const body = await request.json();
        clientName = body.client_name ?? body.clientName ?? null;
      } catch {
        // no body or invalid JSON
      }
    }
    if (!clientName) {
      return NextResponse.json(
        { error: 'client_name is required per eliminare un record.' },
        { status: 400 }
      );
    }
    await sql`DELETE FROM quotes WHERE client_name = ${clientName}`;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logDbError('DELETE', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
