import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/crm', '/messages', '/reports', '/account']
const ADMIN_PATHS = ['/admin', '/import']

export async function middleware(req) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const path = req.nextUrl.pathname

  const isProtected = PROTECTED_PATHS.some((p) => path.startsWith(p))
  const isAdminOnly = ADMIN_PATHS.some((p) => path.startsWith(p))

  // 🔐 BLOCK NOT LOGGED USERS
  if ((isProtected || isAdminOnly) && !session) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  // 🔐 ADMIN CHECK
  if (isAdminOnly && session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon\\.ico|icon-|manifest|sw\\.js|privacy|eula).*)',
  ],
}
