'use client'
import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_ID = 'd53f6727-6bc7-4602-9ce0-4fc31ab3aba1'

export default function ImportPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('idle') // idle, loading, running, done, error
  const [progress, setProgress] = useState({ current: 0, total: 0, created: 0, updated: 0, errors: 0 })
  const [log, setLog] = useState([])
  const [clientsData, setClientsData] = useState(null)
  const fileRef = useRef(null)

  const addLog = (msg, type = 'info') => {
    setLog(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString('pl-PL') }])
  }

  useState(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.id !== ADMIN_ID) {
        router.push('/dashboard')
        return
      }
      setUser(user)
    })
  })

  async function handleFileLoad(e) {
    const file = e.target.files[0]
    if (!file) return
    setStatus('loading')
    setLog([])
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      setClientsData(data)
      setStatus('ready')
      addLog(`✅ Plik wczytany — ${data.length} klientów gotowych do importu`, 'success')

      // Stats
      const b2b = data.filter(c => c.segment === 'b2b').length
      const b2c = data.filter(c => c.segment === 'b2c').length
      const vip = data.filter(c => c.is_vip).length
      const active = data.filter(c => c.churn_status === 'active').length
      addLog(`📊 B2B: ${b2b} | B2C: ${b2c} | VIP: ${vip} | Aktywni: ${active}`, 'info')
    } catch (err) {
      setStatus('error')
      addLog(`❌ Błąd wczytywania pliku: ${err.message}`, 'error')
    }
  }

  async function runImport(clearFirst = false) {
    if (!clientsData || !user) return
    setStatus('running')
    setProgress({ current: 0, total: clientsData.length, created: 0, updated: 0, errors: 0 })

    // Get session token
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      addLog('❌ Brak sesji — zaloguj się ponownie', 'error')
      setStatus('error')
      return
    }

    addLog(`🚀 Rozpoczynam import ${clientsData.length} klientów...`, 'info')
    if (clearFirst) addLog('🗑 Czyszczenie istniejących klientów...', 'info')

    // Send in batches of 200
    const batchSize = 200
    let totalCreated = 0
    let totalUpdated = 0
    let totalErrors = 0

    for (let i = 0; i < clientsData.length; i += batchSize) {
      const batch = clientsData.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      const totalBatches = Math.ceil(clientsData.length / batchSize)

      try {
        const res = await fetch('/api/import-clients', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            clients: batch,
            clear_first: clearFirst && i === 0 // only clear on first batch
          })
        })

        const result = await res.json()

        if (result.error) {
          addLog(`❌ Batch ${batchNum}/${totalBatches}: ${result.error}`, 'error')
          totalErrors += batch.length
        } else {
          totalCreated += result.created || 0
          totalUpdated += result.updated || 0
          totalErrors += result.errors || 0
          addLog(`✅ Batch ${batchNum}/${totalBatches}: +${result.created} nowych, ~${result.updated} zaktualizowanych`, 'success')
        }

        setProgress({
          current: Math.min(i + batchSize, clientsData.length),
          total: clientsData.length,
          created: totalCreated,
          updated: totalUpdated,
          errors: totalErrors
        })

      } catch (err) {
        addLog(`❌ Batch ${batchNum}/${totalBatches}: ${err.message}`, 'error')
        totalErrors += batch.length
      }
    }

    addLog(`\n🎉 Import zakończony!`, 'success')
    addLog(`📊 Utworzono: ${totalCreated} | Zaktualizowano: ${totalUpdated} | Błędy: ${totalErrors}`, 'info')
    setStatus('done')
    setProgress(prev => ({ ...prev, created: totalCreated, updated: totalUpdated, errors: totalErrors }))
  }

  const F = { fontFamily:"'DM Sans',-apple-system,sans-serif" }

  return (
    <div style={{ minHeight:'100vh', background:'#f5f5f3', ...F, fontSize:'14px' }}>
      {/* Topbar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #e8e8e6', padding:'0 32px', height:'56px', display:'flex', alignItems:'center', gap:'12px' }}>
        <button onClick={() => router.push('/dashboard')} style={{ border:'none', background:'none', cursor:'pointer', color:'#9ca3af', fontSize:'20px' }}>←</button>
        <span style={{ fontSize:'15px', fontWeight:'600', color:'#111' }}>Import klientów z BaseLinker</span>
        <span style={{ background:'#fef2f2', color:'#dc2626', fontSize:'11px', padding:'2px 8px', borderRadius:'5px', fontWeight:'500' }}>ADMIN ONLY</span>
      </div>

      <div style={{ maxWidth:'800px', margin:'0 auto', padding:'32px 24px' }}>

        {/* Step 1 - Load file */}
        <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'12px', padding:'24px', marginBottom:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
            <div style={{ width:'28px', height:'28px', background:'#111', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'13px', fontWeight:'600' }}>1</div>
            <span style={{ fontSize:'15px', fontWeight:'600', color:'#111' }}>Wczytaj plik clients_import.json</span>
          </div>
          <p style={{ fontSize:'13px', color:'#6b7280', marginBottom:'16px' }}>
            Pobierz plik <code style={{ background:'#f4f4f3', padding:'2px 6px', borderRadius:'4px', fontSize:'12px' }}>clients_import.json</code> z poprzedniej wiadomości Claude i wgraj go tutaj.
          </p>
          <input ref={fileRef} type="file" accept=".json" style={{ display:'none' }} onChange={handleFileLoad} />
          <button onClick={() => fileRef.current?.click()}
            style={{ padding:'10px 20px', background:'#111', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer', ...F }}>
            📁 Wybierz plik JSON
          </button>
          {status === 'ready' && (
            <span style={{ marginLeft:'12px', color:'#16a34a', fontSize:'13px', fontWeight:'500' }}>✓ Plik wczytany</span>
          )}
        </div>

        {/* Step 2 - Import options */}
        {(status === 'ready' || status === 'running' || status === 'done') && (
          <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'12px', padding:'24px', marginBottom:'16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
              <div style={{ width:'28px', height:'28px', background:'#111', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'13px', fontWeight:'600' }}>2</div>
              <span style={{ fontSize:'15px', fontWeight:'600', color:'#111' }}>Wybierz opcję importu</span>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
              {/* Option A - Add/Update */}
              <div style={{ padding:'16px', border:'1px solid #e8e8e6', borderRadius:'10px', background:'#fafaf9' }}>
                <div style={{ fontSize:'13px', fontWeight:'600', color:'#111', marginBottom:'6px' }}>➕ Dodaj / Zaktualizuj</div>
                <div style={{ fontSize:'12px', color:'#6b7280', marginBottom:'12px' }}>
                  Dodaje nowych klientów i aktualizuje istniejących (po emailu). Bezpieczna opcja.
                </div>
                <button onClick={() => runImport(false)} disabled={status === 'running'}
                  style={{ width:'100%', padding:'9px', background:'#111', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor: status === 'running' ? 'default' : 'pointer', opacity: status === 'running' ? 0.5 : 1, ...F }}>
                  {status === 'running' ? '⏳ Importuje...' : 'Uruchom import'}
                </button>
              </div>

              {/* Option B - Reset + Import */}
              <div style={{ padding:'16px', border:'2px solid #fecaca', borderRadius:'10px', background:'#fef2f2' }}>
                <div style={{ fontSize:'13px', fontWeight:'600', color:'#dc2626', marginBottom:'6px' }}>🗑 Reset + Import</div>
                <div style={{ fontSize:'12px', color:'#dc2626', marginBottom:'12px' }}>
                  Usuwa WSZYSTKICH klientów i importuje od nowa. Nie można cofnąć!
                </div>
                <button onClick={() => {
                  if (confirm('UWAGA: Usunie wszystkich klientów i ich historię. Kontynuować?')) {
                    runImport(true)
                  }
                }} disabled={status === 'running'}
                  style={{ width:'100%', padding:'9px', background: status === 'running' ? '#9ca3af' : '#dc2626', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor: status === 'running' ? 'default' : 'pointer', ...F }}>
                  {status === 'running' ? '⏳ Importuje...' : '🗑 Reset i importuj'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progress */}
        {(status === 'running' || status === 'done') && (
          <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'12px', padding:'24px', marginBottom:'16px' }}>
            <div style={{ fontSize:'14px', fontWeight:'600', color:'#111', marginBottom:'12px' }}>
              Postęp: {progress.current} / {progress.total}
            </div>
            <div style={{ background:'#f4f4f3', borderRadius:'8px', height:'8px', marginBottom:'16px', overflow:'hidden' }}>
              <div style={{ background: status === 'done' ? '#16a34a' : '#2563eb', height:'100%', borderRadius:'8px', width: `${progress.total ? (progress.current/progress.total*100) : 0}%`, transition:'width 0.3s' }}></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
              {[
                { label:'Nowi klienci', val: progress.created, color:'#16a34a' },
                { label:'Zaktualizowani', val: progress.updated, color:'#2563eb' },
                { label:'Błędy', val: progress.errors, color:'#dc2626' },
              ].map(s => (
                <div key={s.label} style={{ padding:'12px', background:'#fafaf9', borderRadius:'8px', border:'1px solid #f0f0ee', textAlign:'center' }}>
                  <div style={{ fontSize:'22px', fontWeight:'600', color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:'11px', color:'#9ca3af', marginTop:'3px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div style={{ background:'#111', borderRadius:'12px', padding:'20px', fontFamily:"'DM Mono', monospace", fontSize:'12px' }}>
            <div style={{ color:'#9ca3af', marginBottom:'10px', fontSize:'11px', fontFamily:"'DM Sans',sans-serif", fontWeight:'500' }}>LOG</div>
            {log.map((entry, i) => (
              <div key={i} style={{ marginBottom:'4px', color: entry.type === 'error' ? '#f87171' : entry.type === 'success' ? '#4ade80' : '#9ca3af' }}>
                <span style={{ color:'#4b5563', marginRight:'8px' }}>{entry.time}</span>
                {entry.msg}
              </div>
            ))}
          </div>
        )}

        {/* Done - go to CRM */}
        {status === 'done' && (
          <div style={{ marginTop:'16px', textAlign:'center' }}>
            <button onClick={() => router.push('/crm')}
              style={{ padding:'12px 32px', background:'#16a34a', color:'white', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer', ...F }}>
              🎉 Przejdź do CRM →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
