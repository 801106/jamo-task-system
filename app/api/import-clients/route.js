import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ADMIN_ID = 'd53f6727-6bc7-4602-9ce0-4fc31ab3aba1'

export async function POST(req) {
  try {
    // Verify admin
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user || user.id !== ADMIN_ID) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { clients, clear_first } = body

    if (!clients || !Array.isArray(clients)) {
      return Response.json({ error: 'Invalid data' }, { status: 400 })
    }

    // Optionally clear existing clients
    if (clear_first) {
      const { data: existing } = await supabase.from('clients').select('id')
      if (existing && existing.length > 0) {
        const ids = existing.map(c => c.id)
        await supabase.from('client_interactions').delete().in('client_id', ids)
        await supabase.from('clients').delete().in('id', ids)
      }
    }

    // Import in batches of 50
    let created = 0
    let updated = 0
    let errors = 0

    for (let i = 0; i < clients.length; i += 50) {
      const batch = clients.slice(i, i + 50)

      for (const c of batch) {
        try {
          // Check if client exists by email
          const { data: existing } = await supabase
            .from('clients')
            .select('id, ltv, order_count')
            .eq('email', c.email)
            .single()

          if (existing) {
            // Update existing
            await supabase.from('clients').update({
              ltv: c.ltv,
              last_order_date: c.last_order_date,
              last_contact_date: c.last_order_date,
              is_vip: c.is_vip,
              status: c.status,
              notes: c.notes,
              company_name: c.company_name || null,
              phone: c.phone || null,
            }).eq('id', existing.id)
            updated++
          } else {
            // Create new
            const { data: newClient } = await supabase.from('clients').insert({
              contact_name: c.contact_name || c.email.split('@')[0],
              company_name: c.company_name || null,
              email: c.email,
              phone: c.phone || null,
              segment: c.segment,
              workspace: 'jamo_healthy',
              status: c.status,
              source: 'baselinker_import',
              marketplace: c.segment === 'b2b' ? 'shopify' : 'woocommerce',
              ltv: c.ltv,
              last_order_date: c.last_order_date,
              last_contact_date: c.last_order_date,
              is_vip: c.is_vip,
              notes: c.notes,
            }).select().single()

            if (newClient) {
              // Add initial interaction
              await supabase.from('client_interactions').insert({
                client_id: newClient.id,
                type: 'order',
                content: `Import BaseLinker — ${c.order_count} zamówień, LTV: £${c.ltv}. Pierwszy zakup: ${c.first_order_date}. Ostatni: ${c.last_order_date}.${c.avg_days_between_orders ? ` Średnio co ${c.avg_days_between_orders} dni.` : ''}`,
              })
              created++
            }
          }
        } catch (e) {
          errors++
          console.error('Error importing client:', c.email, e.message)
        }
      }
    }

    return Response.json({
      success: true,
      created,
      updated,
      errors,
      total: clients.length
    })
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}
