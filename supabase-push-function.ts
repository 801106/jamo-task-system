import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = 'BCI4hI24IAO-huGItBsiWo-ksZvTseqrQ0VeOR79fgfJFHFBr28KqresdvZOdhyjQRGMi9YBmZG0rD-WU4JYdqk'
const VAPID_PRIVATE_KEY = 'qiVHqJhHjcTgpJtOCMWTP9Nv7Sgp7QnaEYR2Xn6ztJA'
const VAPID_SUBJECT = 'mailto:presest@hotmail.com'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function sendPushNotification(subscription, payload) {
  const endpoint = subscription.endpoint
  const keys = subscription.keys

  const now = Math.floor(Date.now() / 1000)
  const exp = now + 12 * 60 * 60

  const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const audience = new URL(endpoint).origin
  const claims = btoa(JSON.stringify({ aud: audience, exp, sub: VAPID_SUBJECT }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const privateKeyBytes = urlBase64ToUint8Array(VAPID_PRIVATE_KEY)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', privateKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, []
  ).catch(() => null)

  const body = JSON.stringify(payload)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': body.length.toString(),
      'TTL': '86400',
    },
    body,
  })

  return res.status
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { user_id, title, body, url } = await req.json()

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 })
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscription' }), { status: 200 })
    }

    let sent = 0
    for (const sub of subs) {
      try {
        await fetch(sub.subscription.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'TTL': '86400',
          },
          body: JSON.stringify({ title, body, url: url || '/dashboard' })
        })
        sent++
      } catch (e) {
        console.error('Push failed:', e)
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
