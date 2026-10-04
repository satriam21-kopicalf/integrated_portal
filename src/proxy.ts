import { NextResponse, type NextRequest } from 'next/server';

// Optimistic check before a page renders: without a session cookie the visitor
// goes straight to /login. The backend still validates every request (the
// cookie may be expired or revoked); src/lib/auth.tsx handles that case.
const SESSION_COOKIE = 'portal_session';

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // pages only: not the login page, the /api proxy, Next.js internals or static files
  matcher: ['/((?!login|api|_next|assets|icon\\.svg|favicon\\.ico|.*\\..*).*)'],
};
