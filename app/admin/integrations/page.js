'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

const ADMIN_ID = 'd53f6727-6bc7-4602-9ce0-4fc31ab3aba1'
const F = { fontFamily:"'DM Sans',-apple-system,sans-serif" }

function AdminIntegrationsInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState(null)
  const [qbStatus, setQbStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.id !== ADMIN_ID) { router.push('/dashboard'); return }
      setUser(user)
    })
    loadQBStatus()

    // Check for QB callback result
    const qbResult = searchParams.get('qb')
    const company = searchParams.get('company')
    const msg = searchParams.get('msg')
    if (qbResult === 'success') {
      setQbStatus({ connected: true, company_name: decodeURIComponent(company || 'Jamo TaskFlow') })
    } else if (qbResult === 'error') {
      alert(`Blad polaczenia QB: ${msg}`)
    }
  }, [])

  async function loadQBStatus() {
    setLoading(true)
    const { data } = await supabase.from('qb_tokens').select('*').eq('id', 1).single()
    setQbStatus(data || null)
    setLoading(false)
  }

  function connectQB() {
    setConnecting(true)
    const clientId = process.env.NEXT_PUBLIC_QB_CLIENT_ID
    const redirectUri = encodeURIComponent(process.env.NEXT_PUBLIC_QB_REDIRECT_URI || 'https://jamo-task-system.vercel.app/api/qb/callback')
    const scope = encodeURIComponent('com.intuit.quickbooks.accounting')
    const state = Math.random().toString(36).substring(7)

    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`
    window.location.href = authUrl
  }

  async function disconnectQB() {
    if (!confirm('Odlaczyc QuickBooks? Faktury nie beda sie synchronizowac.')) return
    await supabase.from('qb_tokens').delete().eq('id', 1)
    setQbStatus(null)
  }

  const isConnected = qbStatus?.access_token
  const connectedAt = qbStatus?.connected_at ? new Date(qbStatus.connected_at).toLocaleDateString('pl-PL') : null
  const expiresAt = qbStatus?.refresh_expires_at ? new Date(qbStatus.refresh_expires_at).toLocaleDateString('pl-PL') : null

  const S = {
    page: { minHeight:'100vh', background:'#f5f5f3', ...F, fontSize:'14px', padding:'24px' },
    header: { display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' },
    card: { background:'#fff', border:'1px solid #e8e8e6', borderRadius:'12px', padding:'24px', marginBottom:'16px' },
    label: { fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:'500', marginBottom:'4px' },
    val: { fontSize:'14px', color:'#111', fontWeight:'500' },
    btnPrimary: { background:'#111', color:'white', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'13px', fontWeight:'500', cursor:'pointer', ...F },
    btnDanger: { background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 20px', fontSize:'13px', fontWeight:'500', cursor:'pointer', ...F },
    badge: (ok) => ({ display:'inline-flex', alignItems:'center', gap:'6px', padding:'4px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:'500', background:ok?'#ecfdf5':'#f4f4f3', color:ok?'#065f46':'#9ca3af' }),
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <button onClick={() => router.push('/dashboard')}
          style={{ border:'none', background:'none', cursor:'pointer', color:'#9ca3af', fontSize:'20px', padding:'0' }}>←</button>
        <div>
          <div style={{ fontSize:'18px', fontWeight:'600', color:'#111', letterSpacing:'-0.3px' }}>Integracje</div>
          <div style={{ fontSize:'12px', color:'#9ca3af' }}>Polaczenia z zewnetrznymi systemami — tylko Jamo + Healthy Future</div>
        </div>
      </div>

      {/* QB Card */}
      <div style={S.card}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'16px' }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
              <div style={{ width:'40px', height:'40px', background:'#2CA01C', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'700', fontSize:'14px', flexShrink:0 }}>QB</div>
              <div>
                <div style={{ fontSize:'15px', fontWeight:'600', color:'#111' }}>QuickBooks Online UK</div>
                <div style={{ fontSize:'12px', color:'#9ca3af' }}>Faktury, platnosci, klienci B2B</div>
              </div>
              {!loading && (
                <span style={S.badge(isConnected)}>
                  <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:isConnected?'#16a34a':'#9ca3af', display:'inline-block' }}></span>
                  {isConnected ? 'Polaczono' : 'Niepodlaczono'}
                </span>
              )}
            </div>

            {isConnected ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginTop:'16px' }}>
                {[
                  { label:'Firma', val:qbStatus.company_name || 'Jamo Packaging Solutions' },
                  { label:'Polaczono', val:connectedAt || '—' },
                  { label:'Token wazny do', val:expiresAt || '—' },
                ].map(item => (
                  <div key={item.label} style={{ padding:'10px 12px', background:'#f9f9f8', borderRadius:'8px', border:'1px solid #f0f0ee' }}>
                    <div style={S.label}>{item.label}</div>
                    <div style={S.val}>{item.val}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ marginTop:'12px', padding:'12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', fontSize:'13px', color:'#92400e' }}>
                Polacz QuickBooks zeby moc wystawiac faktury i sledzic platnosci bezposrednio z TaskFlow.
              </div>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'8px', flexShrink:0 }}>
            {isConnected ? (
              <>
                <button onClick={() => router.push('/admin/integrations/qb-sync')} style={S.btnPrimary}>
                  Synchronizuj
                </button>
                <button onClick={disconnectQB} style={S.btnDanger}>
                  Odlacz
                </button>
              </>
            ) : (
              <button onClick={connectQB} disabled={connecting} style={{ ...S.btnPrimary, opacity:connecting?0.6:1, background:'#2CA01C' }}>
                {connecting ? 'Przekierowuje...' : '🔗 Polacz z QuickBooks'}
              </button>
            )}
          </div>
        </div>

        {/* Co umozliwia */}
        <div style={{ marginTop:'20px', borderTop:'1px solid #f0f0ee', paddingTop:'16px' }}>
          <div style={{ fontSize:'11px', color:'#9ca3af', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>Co umozliwia ta integracja</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'8px' }}>
            {[
              { icon:'🧾', text:'Wystawianie faktur z profilu klienta B2B' },
              { icon:'💰', text:'Monitoring statusow faktur (Wystawiona/Oplacona/Przeterminowana)' },
              { icon:'🔔', text:'Powiadomienie dla teamu gdy faktura zostaje oplacona' },
              { icon:'⚠️', text:'Alert gdy faktura jest przeterminowana' },
              { icon:'📊', text:'Dashboard finansowy (naleznosci, zaleglosci, przychody)' },
              { icon:'🔄', text:'Automatyczna synchronizacja klientow B2B z QB co 24h' },
            ].map(item => (
              <div key={item.text} style={{ display:'flex', gap:'8px', fontSize:'12px', color:'#374151', padding:'6px 0' }}>
                <span style={{ flexShrink:0 }}>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Responso — oczekiwanie */}
      <div style={{ ...S.card, opacity:0.6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
          <div style={{ width:'40px', height:'40px', background:'#6d28d9', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'700', fontSize:'12px', flexShrink:0 }}>RS</div>
          <div>
            <div style={{ fontSize:'15px', fontWeight:'600', color:'#111' }}>Responso</div>
            <div style={{ fontSize:'12px', color:'#9ca3af' }}>Email helpdesk — wiadomosci z Amazon, eBay, email</div>
          </div>
          <span style={{ ...S.badge(false), marginLeft:'auto' }}>⏳ Oczekiwanie na API</span>
        </div>
        <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'8px' }}>
          Czekamy na odpowiedz opiekuna Responso ws. kluczy API i webhookow. Integracja zostanie aktywowana po potwierdzeniu.
        </div>
      </div>

      {/* Vonage — oczekiwanie */}
      <div style={{ ...S.card, opacity:0.6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
          <div style={{ width:'40px', height:'40px', background:'#0e7490', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'700', fontSize:'12px', flexShrink:0 }}>VN</div>
          <div>
            <div style={{ fontSize:'15px', fontWeight:'600', color:'#111' }}>Vonage</div>
            <div style={{ fontSize:'12px', color:'#9ca3af' }}>Zakladka Calls — missed calls, historia rozmow, click-to-call</div>
          </div>
          <span style={{ ...S.badge(false), marginLeft:'auto' }}>⏳ Oczekiwanie na klucze API</span>
        </div>
        <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'8px' }}>
          Wymaga Application ID i Private Key z panelu Vonage. Tylko Jamo + Healthy Future.
        </div>
      </div>

      {/* Email — oczekiwanie */}
      <div style={{ ...S.card, opacity:0.6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
          <div style={{ width:'40px', height:'40px', background:'#1d4ed8', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'700', fontSize:'12px', flexShrink:0 }}>EM</div>
          <div>
            <div style={{ fontSize:'15px', fontWeight:'600', color:'#111' }}>Emaile z CRM</div>
            <div style={{ fontSize:'12px', color:'#9ca3af' }}>Resend.com — wysylanie emaili, szablony, historia korespondencji</div>
          </div>
          <span style={{ ...S.badge(false), marginLeft:'auto' }}>⏳ Do skonfigurowania</span>
        </div>
        <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'8px' }}>
          Wymaga zalozenia konta na Resend.com i weryfikacji domen Jamo i HF.
        </div>
      </div>

      {/* Barclays — oczekiwanie */}
      <div style={{ ...S.card, opacity:0.6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
          <div style={{ width:'40px', height:'40px', background:'#00AEEF', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'700', fontSize:'12px', flexShrink:0 }}>BC</div>
          <div>
            <div style={{ fontSize:'15px', fontWeight:'600', color:'#111' }}>Barclays Open Banking</div>
            <div style={{ fontSize:'12px', color:'#9ca3af' }}>Transakcje bankowe — powiaz przelew z faktura QB</div>
          </div>
          <span style={{ ...S.badge(false), marginLeft:'auto' }}>⏳ Do skonfigurowania</span>
        </div>
        <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'8px' }}>
          Wymaga rejestracji w Barclays Open Banking portal. Tylko Jamo + Healthy Future. Dostep tylko dla admina.
        </div>
      </div>
    </div>
  )
}

export default function AdminIntegrations() {
  return (
    <Suspense fallback={<div style={{ padding:'40px', textAlign:'center', fontFamily:"'DM Sans',sans-serif", color:'#9ca3af' }}>Ladowanie...</div>}>
      <AdminIntegrationsInner />
    </Suspense>
  )
}
