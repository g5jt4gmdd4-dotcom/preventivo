import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Pagine e risorse pubbliche a cui TUTTI possono accedere
const publicPaths = ['/login', '/api/auth', '/logo.png', '/favicon.ico'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Esclusioni: Pagine pubbliche e file statici (CSS, Immagini)
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next')
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth_token')?.value;

  if (!token) {
    // Nessun token: reindirizza al login
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'fallback_secret_must_be_changed_in_prod_12345'
    );
    // Verifica la validità e la firma del Token
    await jwtVerify(token, secret);
    
    // Token ok, prosegui
    return NextResponse.next();
  } catch (err) {
    // Token scaduto o manomesso: caccia l'utente al login e digli di rimettere la pwd
    const response = NextResponse.redirect(new URL('/login', req.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

export const config = {
  // Il middleware si attiverà per tutte le pagine eccetto alcuni pattern interni
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
