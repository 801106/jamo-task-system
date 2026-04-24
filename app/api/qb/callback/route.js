import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin/integrations?qb=error&msg=${error}`)
  }

  if (!code) {
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin/integrations?qb=error&msg=no_code`)
  }

  try {
    // Exchange code for tokens
    const credentials = Buffer.from(
      `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
    ).toString('base64')

    const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.QB_REDIRECT_URI,
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok) {
      console.error('QB token error:', tokenData)
      return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin/integrations?qb=error&msg=token_failed`)
    }

    const { access_token, refresh_token, expires_in, x_refresh_token_expires_in, realmId } = tokenData

    // Get realmId from URL param if not in response
    const companyId = realmId || searchParams.get('realmId')

    // Get company info from QB
    let companyName = 'Jamo Packaging Solutions'
    try {
      const companyRes = await fetch(
        `https://quickbooks.api.intuit.com/v3/company/${companyId}/companyinfo/${companyId}`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Accept': 'application/json',
          }
        }
      )
      const companyData = await companyRes.json()
      companyName = companyData?.QueryResponse?.CompanyInfo?.[0]?.CompanyName || companyName
    } catch (e) {
      console.log('Could not fetch company info:', e.message)
    }

    // Save tokens to Supabase
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString()
    const refreshExpiresAt = new Date(Date.now() + x_refresh_token_expires_in * 1000).toISOString()

    await supabase.from('qb_tokens').upsert({
      id: 1,
      access_token,
      refresh_token,
      realm_id: companyId,
      company_name: companyName,
      expires_at: expiresAt,
      refresh_expires_at: refreshExpiresAt,
      workspace: 'jamo_healthy',
      connected_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin/integrations?qb=success&company=${encodeURIComponent(companyName)}`)

  } catch (err) {
    console.error('QB callback error:', err)
    return Response.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin/integrations?qb=error&msg=${err.message}`)
  }
}
