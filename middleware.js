import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

export async function middleware(req) {
  const res = NextResponse.next()
  const path = req.nextUrl.pathname

  // Skip middleware for API routes and static files
  if (path.startsWith('/api') || path.startsWith('/_next') || path === '/sw.js') {
    return res
  }

  try {
    const supabase = createMiddlewareClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()

    // Protected routes - redirect to login if no session
    const protectedRoutes = ['/dashboard', '/crm', '/admin', '/reports', '/account', '/messages']
    const isProtected = protectedRoutes.some(r => path.startsWith(r))

    if (isProtected && !session) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Check session timeout only for protected routes
    if (isProtected && session) {
      const lastActivity = req.cookies.get('tf_last_activity')?.value
      const now = Date.now()

      if (lastActivity) {
        const hours = (now - parseInt(lastActivity)) / (1000 * 60 * 60)
        if (hours > 8) {
          await supabase.auth.signOut()
          const response = NextResponse.redirect(new URL('/?timeout=1', req.url))
          response.cookies.delete('tf_last_activity')
          return response
        }
      }

      res.cookies.set('tf_last_activity', now.toString(), {
        httpOnly: true, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24
      })
    }

    return res
  } catch (e) {
    // If middleware fails for any reason, let the request through
    console.error('Middleware error:', e)
    return res
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js).*)'],
}
