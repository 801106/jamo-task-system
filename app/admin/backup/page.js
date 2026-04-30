'use client'
// app/admin/backup/page.js

import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_ID = 'd53f6727-6bc7-4602-9ce0-4fc31ab3aba1'
const F = { fontFamily:"'DM Sans',-apple-system,sans-serif" }

export default function AdminBackup() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.id !== ADMIN_ID) { router.push('/dashboard'); return }
      setUser(user)
      loadBackups()
    })
  }, [])

  async function loadBackups() {
    setLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/backup', {
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    })
    const data = await res.json()
    setBackups(data.backups || [])
    setLoading(false)
  }

  async function createBackup() {
    setCreating(true)
    setLastResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        }
      })
      const data = await res.json()
      if (data.success) {
        setLastResult({ success: true, ...data })
        await loadBackups()
      } else {
        setLastResult({ success: false, error: data.error })
      }
    } catch (err) {
      setLastResult({ success: false, error: err.message })
    }
    setCreating(false)
  }

  async function downloadBackup(filename) {
    setDownloading(filename)
    try {
      const { data, error } = await supabase.storage.from('backups').download(filename)
      if (error) throw error
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Blad pobierania: ' + err.message)
    }
    setDownloading(null)
  }

  async function deleteBackup(filename) {
    if (!confirm(`Usunac backup ${filename}?`)) return
    await supabase.storage.from('backups').remove([filename])
    await loadBackups()
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'
  const fmtSize = (bytes) => bytes ? `${Math.round(bytes / 1024)} KB` : '—'

  return (
    <div style={{ minHeight:'100vh', background:'#f5f5f3', padding:'32px', ...F }}>
      <div style={{ maxWidth:'900px', margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
          <button onClick={() => router.push('/dashboard')} style={{ border:'none', background:'none', cursor:'pointer', color:'#9ca3af', fontSize:'20px' }}>←</button>
          <div style={{ flex:1 }}>
            <h1 style={{ fontSize:'20px', fontWeight:'600', color:'#111', margin:0 }}>Kopie zapasowe</h1>
            <p style={{ fontSize:'13px', color:'#9ca3af', margin:0 }}>Eksport danych TaskFlow — automatycznie co noc + ręcznie</p>
          </div>
          <button onClick={createBackup} disabled={creating}
            style={{ padding:'10px 20px', background:creating?'#6b7280':'#111', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:creating?'default':'pointer', ...F }}>
            {creating ? '⏳ Tworzę backup...' : '+ Utwórz backup teraz'}
          </button>
        </div>

        {/* Last result */}
        {lastResult && (
          <div style={{ padding:'12px 16px', borderRadius:'10px', marginBottom:'16px', background:lastResult.success?'#ecfdf5':'#fef2f2', border:`1px solid ${lastResult.success?'#bbf7d0':'#fecaca'}` }}>
            {lastResult.success ? (
              <div style={{ fontSize:'13px', color:'#065f46', fontWeight:'500' }}>
                ✅ Backup utworzony: <strong>{lastResult.filename}</strong> · {lastResult.size_kb} KB · {lastResult.stats?.clients} klientów, {lastResult.stats?.tasks} zadań
              </div>
            ) : (
              <div style={{ fontSize:'13px', color:'#dc2626', fontWeight:'500' }}>❌ Błąd: {lastResult.error}</div>
            )}
          </div>
        )}

        {/* Info boxes */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'20px' }}>
          {[
            { label:'Automatyczny backup', val:'Co noc o 2:00 UTC', icon:'🕑', color:'#1d4ed8' },
            { label:'Przechowywanie', val:'Ostatnie 30 kopii', icon:'📦', color:'#065f46' },
            { label:'Lokalizacja', val:'Supabase Storage (EU)', icon:'🔒', color:'#6d28d9' },
          ].map(i => (
            <div key={i.label} style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', padding:'16px', display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'24px' }}>{i.icon}</span>
              <div>
                <div style={{ fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'2px' }}>{i.label}</div>
                <div style={{ fontSize:'13px', fontWeight:'600', color:i.color }}>{i.val}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Backup list */}
        <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'12px', overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #e8e8e6', background:'#fafaf9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:'13px', fontWeight:'600', color:'#111' }}>Dostępne kopie zapasowe ({backups.length})</span>
            <button onClick={loadBackups} style={{ fontSize:'11px', color:'#6b7280', border:'1px solid #e8e8e6', background:'#fff', borderRadius:'6px', padding:'4px 10px', cursor:'pointer', ...F }}>↻ Odśwież</button>
          </div>

          {loading && <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af' }}>Ładowanie...</div>}

          {!loading && backups.length === 0 && (
            <div style={{ padding:'48px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>📦</div>
              Brak kopii zapasowych — utwórz pierwszą klikając "+ Utwórz backup teraz"
            </div>
          )}

          {backups.map((backup, i) => (
            <div key={backup.name} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'14px 20px', borderBottom:'1px solid #f0f0ee', background:i%2===0?'#fff':'#f9f9f8' }}>
              <div style={{ fontSize:'24px' }}>📄</div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'13px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{backup.name}</div>
                <div style={{ fontSize:'11px', color:'#9ca3af', marginTop:'2px' }}>
                  {fmtDate(backup.created_at)} · {fmtSize(backup.metadata?.size)}
                </div>
              </div>
              <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                <button onClick={() => downloadBackup(backup.name)} disabled={downloading === backup.name}
                  style={{ padding:'5px 12px', background:'#eff6ff', color:'#1d4ed8', border:'1px solid #bfdbfe', borderRadius:'6px', fontSize:'12px', fontWeight:'500', cursor:'pointer', ...F }}>
                  {downloading === backup.name ? '⏳' : '⬇ Pobierz'}
                </button>
                <button onClick={() => deleteBackup(backup.name)}
                  style={{ padding:'5px 10px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'6px', fontSize:'12px', cursor:'pointer', ...F }}>
                  Usuń
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Cron info */}
        <div style={{ marginTop:'16px', padding:'14px 16px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'10px', fontSize:'12px', color:'#92400e' }}>
          <strong>⚡ Automatyzacja:</strong> Aby backup działał automatycznie co noc, dodaj w pliku <code>vercel.json</code> cron job:
          <code style={{ display:'block', marginTop:'8px', background:'#fff', padding:'8px 12px', borderRadius:'6px', fontFamily:'monospace', fontSize:'11px' }}>
            {`{ "crons": [{ "path": "/api/backup", "schedule": "0 2 * * *" }] }`}
          </code>
          I dodaj zmienną: <strong>CRON_SECRET</strong> w Vercel Environment Variables.
        </div>
      </div>
    </div>
  )
}
