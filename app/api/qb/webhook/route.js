import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('intuit-signature')

    // Verify webhook signature
    if (process.env.QB_WEBHOOK_TOKEN && signature) {
      const hash = crypto
        .createHmac('sha256', process.env.QB_WEBHOOK_TOKEN)
        .update(body)
        .digest('base64')

      if (hash !== signature) {
        console.error('QB webhook signature mismatch')
        return new Response('Unauthorized', { status: 401 })
      }
    }

    const payload = JSON.parse(body)
    const events = payload?.eventNotifications || []

    for (const event of events) {
      const realmId = event.realmId
      const entities = event.dataChangeEvent?.entities || []

      for (const entity of entities) {
        const { name, id, operation, lastUpdated } = entity

        if (name === 'Invoice') {
          await handleInvoiceChange(realmId, id, operation)
        } else if (name === 'Payment') {
          await handlePaymentCreated(realmId, id)
        }
      }
    }

    return new Response('OK', { status: 200 })

  } catch (err) {
    console.error('QB webhook error:', err)
    return new Response('Error', { status: 500 })
  }
}

async function getQBToken() {
  const { data } = await supabase.from('qb_tokens').select('*').eq('id', 1).single()
  if (!data) return null

  // Check if token needs refresh
  const expiresAt = new Date(data.expires_at)
  if (expiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
    return await refreshQBToken(data)
  }
  return data
}

async function refreshQBToken(tokenData) {
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenData.refresh_token,
    }),
  })

  const newTokens = await res.json()
  if (!res.ok) return tokenData

  const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
  const refreshExpiresAt = new Date(Date.now() + newTokens.x_refresh_token_expires_in * 1000).toISOString()

  await supabase.from('qb_tokens').update({
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_at: expiresAt,
    refresh_expires_at: refreshExpiresAt,
  }).eq('id', 1)

  return { ...tokenData, access_token: newTokens.access_token }
}

async function handleInvoiceChange(realmId, invoiceId, operation) {
  try {
    const tokenData = await getQBToken()
    if (!tokenData) return

    const baseUrl = process.env.QB_ENV === 'sandbox'
      ? 'https://sandbox-quickbooks.api.intuit.com'
      : 'https://quickbooks.api.intuit.com'

    const res = await fetch(
      `${baseUrl}/v3/company/${realmId}/invoice/${invoiceId}`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
        }
      }
    )

    const data = await res.json()
    const invoice = data?.Invoice
    if (!invoice) return

    const status = getInvoiceStatus(invoice)
    const clientEmail = invoice.BillEmail?.Address || invoice.CustomerRef?.name

    // Find client in CRM
    let clientId = null
    if (clientEmail) {
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('email', clientEmail.toLowerCase())
        .single()
      clientId = client?.id
    }

    // Upsert invoice in our DB
    await supabase.from('qb_invoices').upsert({
      qb_invoice_id: invoiceId,
      qb_realm_id: realmId,
      client_id: clientId,
      client_name: invoice.CustomerRef?.name,
      client_email: clientEmail,
      invoice_number: invoice.DocNumber,
      amount: parseFloat(invoice.TotalAmt || 0),
      balance: parseFloat(invoice.Balance || 0),
      status,
      due_date: invoice.DueDate,
      created_date: invoice.TxnDate,
      currency: invoice.CurrencyRef?.value || 'GBP',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'qb_invoice_id' })

    // If invoice just got paid — send notifications
    if (status === 'paid' && operation === 'Update') {
      await sendPaymentNotification(invoice, clientId)
    }

  } catch (err) {
    console.error('handleInvoiceChange error:', err)
  }
}

async function handlePaymentCreated(realmId, paymentId) {
  // Payment created = something got paid
  // We'll refresh the related invoices
  console.log('Payment created:', paymentId)
}

function getInvoiceStatus(invoice) {
  if (parseFloat(invoice.Balance || 0) === 0 && parseFloat(invoice.TotalAmt || 0) > 0) {
    return 'paid'
  }
  if (invoice.DueDate && new Date(invoice.DueDate) < new Date() && parseFloat(invoice.Balance || 0) > 0) {
    return 'overdue'
  }
  return 'pending'
}

async function sendPaymentNotification(invoice, clientId) {
  // Get all user IDs to notify
  const { data: profiles } = await supabase.from('profiles').select('id, full_name')

  if (!profiles || profiles.length === 0) return

  const amount = parseFloat(invoice.TotalAmt || 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })
  const clientName = invoice.CustomerRef?.name || 'Klient'
  const invoiceNum = invoice.DocNumber

  const notifications = profiles.map(p => ({
    user_id: p.id,
    type: 'payment_received',
    title: `💰 Faktura oplacona!`,
    body: `${clientName} oplacil fakture ${invoiceNum} — ${amount}`,
    task_id: null,
    read: false,
  }))

  await supabase.from('notifications').insert(notifications)
}
