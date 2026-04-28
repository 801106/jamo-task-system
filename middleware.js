import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = req.nextUrl

  // Publiczne strony - dostępne bez logowania
  const publicPaths = ['/', '/privacy', '/eula']
  if (publicPaths.includes(pathname)) return res

  // API routes - nie dotykamy
  if (pathname.startsWith('/api/')) return res

  // Reszta wymaga logowania
  if (!session) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
