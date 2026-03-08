import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS quotes (
      client_name TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      status TEXT DEFAULT 'preventivo',
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `;
  
  // Aggiungi la colonna 'status' se la tabella esiste già ma non la ha
  try {
    await sql`ALTER TABLE quotes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'preventivo';`;
  } catch (e) {
    // Ignora errore se la colonna esiste già od errore sintassi minore
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
  } catch (error: any) {
    console.error('Error in POST /api/history:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'preventivo';
    const mode = searchParams.get('mode');

    let rows;
    if (mode === 'stay') {
      const result = await sql`
        SELECT client_name, data, status, updated_at 
        FROM quotes 
        WHERE (${status} = 'all' OR status = ${status})
        AND (data->>'mode' = 'stay' OR data->>'mode' IS NULL)
        ORDER BY updated_at DESC
        LIMIT 50;
      `;
      rows = result.rows;
    } else if (mode === 'flight') {
      const result = await sql`
        SELECT client_name, data, status, updated_at 
        FROM quotes 
        WHERE (${status} = 'all' OR status = ${status})
        AND data->>'mode' = 'flight'
        ORDER BY updated_at DESC
        LIMIT 50;
      `;
      rows = result.rows;
    } else {
      const result = await sql`
        SELECT client_name, data, status, updated_at 
        FROM quotes 
        WHERE (${status} = 'all' OR status = ${status})
        ORDER BY updated_at DESC
        LIMIT 50;
      `;
      rows = result.rows;
    }
    
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error in GET /api/history:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
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
  } catch (error: any) {
    console.error('Error in DELETE /api/history:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
