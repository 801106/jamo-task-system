'use client'
// app/admin/encrypt-migration/page.js
// One-time migration: encrypts existing client data in Supabase
// Only accessible by admin

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_ID = 'd53f6727-6bc7-4602-9ce0-4fc31ab3aba1'
const F = { fontFamily:"'DM Sans',-apple-system,sans-serif" }
const BATCH_SIZE = 50
const ENCRYPTED_FIELDS = ['email', 'phone', 'contact_name', 'notes', 'whatsapp']

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('ENC:')
}

export default function EncryptMigration() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [progress, setProgress] = useState({ processed: 0, encrypted: 0, skipped: 0, total: 0, errors: 0 })
  const [logs, setLogs] = useState([])
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.id !== ADMIN_ID) { router.push('/dashboard'); return }
      setUser(user)
    })
  }, [])

  function addLog(msg, type = 'info') {
    setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString('pl-PL') }])
  }

  async function encryptClientViaAPI(client) {
    const response = await fetch('/api/crypto', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': process.env.NEXT_PUBLIC_CRYPTO_HEADER || '',
      },
      body: JSON.stringify({ action: 'encrypt_client', data: client })
    })
    if (!response.ok) throw new Error('Crypto API error')
    const result = await response.json()
    return result.data
  }

  async function runMigration() {
    if (!confirmed) return
    setStatus('running')
    setLogs([])
    setProgress({ processed: 0, encrypted: 0, skipped: 0, total: 0, errors: 0 })

    addLog('Rozpoczynam migracje szyfrowania...', 'info')

    // Count total
    const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true })
    const total = count || 0
    setProgress(p => ({ ...p, total }))
    addLog(`Znaleziono ${total} klientow do przetworzenia`, 'info')

    let processed = 0
    let encrypted = 0
    let skipped = 0
    let errors = 0
    let offset = 0

    while (offset < total) {
      // Fetch batch
      const { data: clients, error } = await supabase.from('clients')
        .select('id, email, phone, contact_name, notes, whatsapp, workspace')
        .range(offset, offset + BATCH_SIZE - 1)
        .order('created_at', { ascending: true })

      if (error) {
        addLog(`Blad pobierania danych: ${error.message}`, 'error')
        break
      }

      if (!clients || clients.length === 0) break

      for (const client of clients) {
        try {
          // Check if already encrypted
          const alreadyEncrypted = ENCRYPTED_FIELDS.some(f => isEncrypted(client[f]))
          if (alreadyEncrypted) {
            skipped++
            processed++
            setProgress({ processed, encrypted, skipped, total, errors })
            continue
          }

          // Check if has any data to encrypt
          const hasData = ENCRYPTED_FIELDS.some(f => client[f])
          if (!hasData) {
            skipped++
            processed++
            setProgress({ processed, encrypted, skipped, total, errors })
            continue
          }

          // Encrypt via API
          const encryptedClient = await encryptClientViaAPI(client)

          // Build update payload — only encrypted fields
          const updatePayload = {}
          for (const field of ENCRYPTED_FIELDS) {
            if (encryptedClient[field] !== client[field]) {
              updatePayload[field] = encryptedClient[field]
            }
          }

          if (Object.keys(updatePayload).length > 0) {
            const { error: updateError } = await supabase.from('clients')
              .update(updatePayload)
              .eq('id', client.id)

            if (updateError) {
              addLog(`Blad aktualizacji ${client.id}: ${updateError.message}`, 'error')
              errors++
            } else {
              encrypted++
            }
          } else {
            skipped++
          }

          processed++
          setProgress({ processed, encrypted, skipped, total, errors })

        } catch (err) {
          addLog(`Blad klienta ${client.id}: ${err.message}`, 'error')
          errors++
          processed++
          setProgress({ processed, encrypted, skipped, total, errors })
        }
      }

      // Log batch progress
      addLog(`Przetworzono ${processed}/${total} klientow (zaszyfrowano: ${encrypted}, pominieto: ${skipped})`, 'info')
      offset += BATCH_SIZE

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200))
    }

    addLog(`✅ Migracja zakonczona! Zaszyfrowano: ${encrypted}, Pominieto: ${skipped}, Bledy: ${errors}`, 'success')
    setStatus('done')
  }

  const pct = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0

  return (
    <div style={{ minHeight:'100vh', background:'#f5f5f3', padding:'32px', ...F }}>
      <div style={{ maxWidth:'800px', margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ border:'none', background:'none', cursor:'pointer', color:'#9ca3af', fontSize:'20px' }}>←</button>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:'600', color:'#111', margin:0 }}>Migracja szyfrowania danych</h1>
            <p style={{ fontSize:'13px', color:'#9ca3af', margin:0 }}>Jednorazowa operacja — szyfruje wrażliwe pola klientów (email, telefon, imię, notatki)</p>
          </div>
        </div>

        {/* Warning */}
        <div style={{ background:'#fef2f2', border:'2px solid #fecaca', borderRadius:'12px', padding:'20px', marginBottom:'20px' }}>
          <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
            <span style={{ fontSize:'24px' }}>⚠️</span>
            <div>
              <div style={{ fontSize:'14px', fontWeight:'700', color:'#dc2626', marginBottom:'8px' }}>Przed uruchomieniem — przeczytaj!</div>
              <div style={{ fontSize:'13px', color:'#374151', lineHeight:'1.7' }}>
                • Ta operacja zaszyfruje pola: <strong>email, telefon, imię kontaktowe, notatki</strong><br/>
                • Operacja jest <strong>odwracalna</strong> — możesz odszyfrować w każdej chwili<br/>
                • Po migracji wyszukiwanie po emailu/telefonie będzie działać inaczej<br/>
                • Upewnij się że <strong>ENCRYPTION_KEY jest zapisany w Bitwarden</strong><br/>
                • Supabase automatycznie tworzy backup — jesteś chroniony
              </div>
            </div>
          </div>
        </div>

        {/* Info boxes */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Pola do zaszyfrowania', val:'email, telefon, imię, notatki', color:'#1d4ed8' },
            { label:'Pola NIE szyfrowane', val:'LTV, status, segment, zamówienia', color:'#065f46' },
            { label:'Klucz zapisany w', val:'Vercel + Bitwarden', color:'#6d28d9' },
          ].map(i => (
            <div key={i.label} style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', padding:'14px' }}>
              <div style={{ fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>{i.label}</div>
              <div style={{ fontSize:'12px', fontWeight:'600', color:i.color }}>{i.val}</div>
            </div>
          ))}
        </div>

        {/* Confirmation */}
        {status === 'idle' && (
          <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'12px', padding:'24px', marginBottom:'20px' }}>
            <label style={{ display:'flex', alignItems:'flex-start', gap:'10px', cursor:'pointer' }}>
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
                style={{ marginTop:'2px', width:'16px', height:'16px', cursor:'pointer' }} />
              <span style={{ fontSize:'13px', color:'#374151', lineHeight:'1.6' }}>
                Rozumiem co robi ta operacja. Klucz szyfrowania jest zapisany w Bitwarden.
                Chcę zaszyfrować wrażliwe dane klientów.
              </span>
            </label>
            <button onClick={runMigration} disabled={!confirmed}
              style={{ marginTop:'16px', padding:'12px 24px', background:confirmed?'#dc2626':'#9ca3af', color:'white', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'600', cursor:confirmed?'pointer':'not-allowed', ...F }}>
              🔐 Uruchom szyfrowanie
            </button>
          </div>
        )}

        {/* Progress */}
        {(status === 'running' || status === 'done') && (
          <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'12px', padding:'24px', marginBottom:'20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
              <span style={{ fontSize:'13px', fontWeight:'500', color:'#111' }}>
                {status === 'running' ? `Szyfrowanie... ${progress.processed}/${progress.total}` : '✅ Zakończono!'}
              </span>
              <span style={{ fontSize:'13px', fontWeight:'600', color:'#1d4ed8' }}>{pct}%</span>
            </div>
            <div style={{ height:'8px', background:'#f0f0ee', borderRadius:'4px', overflow:'hidden', marginBottom:'16px' }}>
              <div style={{ width:`${pct}%`, height:'100%', background: status==='done'?'#16a34a':'#1d4ed8', borderRadius:'4px', transition:'width 0.3s' }}></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
              {[
                { label:'Przetworzono', val:progress.processed, color:'#111' },
                { label:'Zaszyfrowano', val:progress.encrypted, color:'#065f46' },
                { label:'Pominieto', val:progress.skipped, color:'#6b7280' },
                { label:'Bledy', val:progress.errors, color:'#dc2626' },
              ].map(s => (
                <div key={s.label} style={{ padding:'10px', background:'#fafaf9', borderRadius:'8px', textAlign:'center' }}>
                  <div style={{ fontSize:'9px', color:'#9ca3af', textTransform:'uppercase', marginBottom:'4px' }}>{s.label}</div>
                  <div style={{ fontSize:'20px', fontWeight:'600', color:s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <div style={{ background:'#111', borderRadius:'12px', padding:'16px', maxHeight:'300px', overflowY:'auto' }}>
            {logs.map((log, i) => (
              <div key={i} style={{ fontSize:'11px', fontFamily:"'DM Mono', monospace", marginBottom:'4px',
                color: log.type==='error'?'#f87171':log.type==='success'?'#4ade80':'#9ca3af' }}>
                <span style={{ color:'#6b7280', marginRight:'8px' }}>{log.time}</span>
                {log.msg}
              </div>
            ))}
          </div>
        )}

        {status === 'done' && (
          <div style={{ marginTop:'16px', display:'flex', gap:'8px' }}>
            <button onClick={() => router.push('/dashboard')}
              style={{ padding:'10px 20px', background:'#111', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer', ...F }}>
              Wróć do Dashboard
            </button>
            <button onClick={() => router.push('/crm')}
              style={{ padding:'10px 20px', background:'#f5f3ff', color:'#6d28d9', border:'1px solid #c4b5fd', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer', ...F }}>
              Sprawdź CRM
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
