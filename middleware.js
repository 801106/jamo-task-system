import { NextResponse } from 'next/server'

export async function middleware(req) {
  const { pathname } = req.nextUrl

  // Publiczne - bez logowania
  if (pathname === '/' || 
      pathname === '/privacy' || 
      pathname === '/eula' ||
      pathname.startsWith('/api/') ||
      pathname.startsWith('/_next/')) {
    return NextResponse.next()
  }

  // Sprawdź token Supabase w cookies
  const token = req.cookies.get('sb-rewjvzuuhbqeacexpmwv-auth-token')
  
  if (!token) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
