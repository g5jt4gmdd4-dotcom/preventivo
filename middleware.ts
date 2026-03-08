import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Pagine e risorse pubbliche a cui TUTTI possono accedere
const publicPaths = ['/login', '/api/auth', '/logo.png', '/favicon.ico'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Esclusioni Statiche: Pagine pubbliche e file di sistema (Next.js internals, immagini)
  if (
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.includes('favicon.ico')
  ) {
    return NextResponse.next();
  }

  // 2. Controllo del Token
  const token = req.cookies.get('auth_token')?.value;

  if (!token) {
    // 3A. Nessun token: reindirizza al login
    const loginUrl = new URL('/login', req.url);
    const response = NextResponse.redirect(loginUrl);
    
    // Header che forza il browser a NON usare cache per queste pagine protette
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  // 3B. Token presente: verifica crittografica
  try {
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'fallback_secret_must_be_changed_in_prod_12345'
    );
    await jwtVerify(token, secret);
    
    // Token ok, passa la richiesta aggiungendo header anti-cache sulle pagine protette 
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (err) {
    // 3C. Token alterato o scaduto: caccia l'utente al login rimuovendo il cookie fantasma
    const loginUrl = new URL('/login', req.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth_token');
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }
}

// Intercettiamo TUTTO tranne le cartelle statiche base base, 
// la logica vera e propria ora la controlla l'If dentro la funzione principale (che è garantito funzionare al 100%)
export const config = {
  matcher: '/:path*',
};
