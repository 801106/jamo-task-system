import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/']
const SESSION_TIMEOUT_HOURS = 8

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  const path = req.nextUrl.pathname

  // Allow public routes
  if (PUBLIC_ROUTES.includes(path)) {
    if (session) return NextResponse.redirect(new URL('/dashboard', req.url))
    return res
  }

  // No session - redirect to login
  if (!session) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // Check session age - auto logout after 8 hours of inactivity
  const lastActivity = req.cookies.get('tf_last_activity')?.value
  const now = Date.now()

  if (lastActivity) {
    const diff = now - parseInt(lastActivity)
    const hours = diff / (1000 * 60 * 60)
    if (hours > SESSION_TIMEOUT_HOURS) {
      await supabase.auth.signOut()
      const response = NextResponse.redirect(new URL('/?timeout=1', req.url))
      response.cookies.delete('tf_last_activity')
      return response
    }
  }

  // Update last activity cookie
  res.cookies.set('tf_last_activity', now.toString(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24
  })

  return res
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)'],
}
