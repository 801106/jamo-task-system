import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

webpush.setVapidDetails(
  'mailto:presest@hotmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export async function POST(req) {
  try {
    const { user_id, title, body, url } = await req.json()

    if (!user_id) {
      return Response.json({ error: 'user_id required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)

    if (error) throw error
    if (!subs || subs.length === 0) {
      return Response.json({ sent: 0, reason: 'no subscription' })
    }

    const payload = JSON.stringify({ title, body, url: url || '/dashboard' })
    let sent = 0

    for (const sub of subs) {
      try {
        await webpush.sendNotification(sub.subscription, payload)
        sent++
      } catch (err) {
        console.error('Push failed for sub:', err.statusCode, err.message)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user_id)
        }
      }
    }

    return Response.json({ sent })
  } catch (err) {
    console.error('send-push error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
