import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const BL_KEY = process.env.BASELINKER_API_KEY

async function blCall(method, params = {}) {
  const body = new URLSearchParams()
  body.append('token', BL_KEY)
  body.append('method', method)
  body.append('parameters', JSON.stringify(params))
  const res = await fetch('https://api.baselinker.com/connector.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  return res.json()
}

function detectMarketplace(source) {
  if (!source) return 'other'
  const s = source.toLowerCase()
  if (s.includes('amazon')) return 'amazon'
  if (s.includes('ebay')) return 'ebay'
  if (s.includes('onbuy')) return 'onbuy'
  if (s.includes('shopify')) return 'shopify'
  if (s.includes('woocommerce') || s.includes('woo') || s.includes('healthy')) return 'woocommerce'
  if (s.includes('allegro')) return 'allegro'
  return 'other'
}

function detectWorkspace(source) {
  if (!source) return 'jamo_healthy'
  const s = source.toLowerCase()
  if (s.includes('pp.pl') || s.includes('packpack') || s.includes('allegro')) return 'packpack'
  return 'jamo_healthy'
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}))
    const days_back = body.days_back || 7
    const dateFrom = Math.floor((Date.now() - days_back * 24 * 60 * 60 * 1000) / 1000)

    const data = await blCall('getOrders', {
      date_confirmed_from: dateFrom,
      get_unconfirmed_orders: false,
    })

    if (data.status !== 'SUCCESS') {
      return Response.json({ error: 'BaseLinker error', details: data.error_message }, { status: 400 })
    }

    const orders = data.orders || []
    let created = 0, updated = 0, skipped = 0

    for (const order of orders) {
      if (!order.email) { skipped++; continue }

      const email = order.email.toLowerCase().trim()
      const marketplace = detectMarketplace(order.order_source)
      const workspace = detectWorkspace(order.order_source)
      const orderValue = parseFloat(order.payment_done || order.price_brutto || 0)
      const orderDate = new Date(order.date_confirmed * 1000).toISOString().split('T')[0]

      const { data: existing } = await supabase
        .from('clients').select('id, ltv, last_order_date').eq('email', email).single()

      if (existing) {
        const newLtv = (parseFloat(existing.ltv) || 0) + orderValue
        const shouldUpdate = !existing.last_order_date || new Date(orderDate) > new Date(existing.last_order_date)
        await supabase.from('clients').update({
          ltv: newLtv,
          last_order_date: shouldUpdate ? orderDate : existing.last_order_date,
          last_contact_date: shouldUpdate ? orderDate : existing.last_order_date,
          marketplace,
          status: newLtv >= 500 ? 'vip' : 'returning',
          is_vip: newLtv >= 500,
        }).eq('id', existing.id)
        await supabase.from('client_interactions').insert({
          client_id: existing.id, type: 'order',
          content: `Zamowienie #${order.order_id} — ${marketplace} — £${orderValue.toFixed(2)}`,
        })
        updated++
      } else {
        const contactName = order.delivery_fullname || order.invoice_fullname || email.split('@')[0]
        const { data: newClient } = await supabase.from('clients').insert({
          contact_name: contactName,
          company_name: order.invoice_company || null,
          email, phone: order.delivery_phone || null,
          segment: 'b2c', workspace, status: 'new',
          source: marketplace, marketplace,
          ltv: orderValue, last_order_date: orderDate, last_contact_date: orderDate,
        }).select().single()
        if (newClient) {
          await supabase.from('client_interactions').insert({
            client_id: newClient.id, type: 'order',
            content: `Pierwsze zamowienie #${order.order_id} — ${marketplace} — £${orderValue.toFixed(2)}. Auto-import BaseLinker.`,
          })
          created++
        }
      }
    }

    return Response.json({ success: true, orders_processed: orders.length, clients_created: created, clients_updated: updated, skipped })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    const data = await blCall('getOrders', {
      date_confirmed_from: Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000),
      get_unconfirmed_orders: false,
    })
    if (data.status !== 'SUCCESS') {
      return Response.json({ connected: false, error: data.error_message }, { status: 400 })
    }
    return Response.json({ connected: true, orders_last_24h: (data.orders || []).length })
  } catch (error) {
    return Response.json({ connected: false, error: error.message }, { status: 500 })
  }
}
