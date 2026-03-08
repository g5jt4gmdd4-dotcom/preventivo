import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';

export async function POST(req: NextRequest) {
  try {
    const { password, rememberMe } = await req.json();

    const correctPassword = process.env.APP_PASSWORD;
    
    if (!correctPassword) {
      console.error('APP_PASSWORD non configurata su Vercel/env');
      return NextResponse.json(
        { error: 'Sistema non configurato correttamente.' },
        { status: 500 }
      );
    }

    if (password !== correctPassword) {
      return NextResponse.json(
        { error: 'Password errata' },
        { status: 401 }
      );
    }

    // Costruisci JWT
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'fallback_secret_must_be_changed_in_prod_12345'
    );
    
    // Se "rememberMe" è true scade in 30 giorni, altrimenti in 12 ore
    const expirationTime = rememberMe ? '30d' : '12h';
    
    const token = await new SignJWT({ user: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expirationTime)
      .sign(secret);

    const response = NextResponse.json({ success: true });
    
    // Imposta il blocco Cookie Httponly
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // maxAge determina per quanto tempo il browser tiene il cookie vivo
      // 30 giorni = 2592000 secondi
      ...(rememberMe && { maxAge: 30 * 24 * 60 * 60 })
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Si è verificato un errore.' },
      { status: 500 }
    );
  }
}
