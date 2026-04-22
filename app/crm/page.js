'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
const ADMIN_ID = 'd53f6727-6bc7-4602-9ce0-4fc31ab3aba1'
const F = { fontFamily:"'DM Sans',-apple-system,sans-serif" }
const SEGMENTS = {
  b2b:     { label:'B2B', labelFull:'Jamo B2B', color:'#1d4ed8', bg:'#eff6ff' },
  b2c:     { label:'B2C', labelFull:'Healthy Future B2C', color:'#065f46', bg:'#ecfdf5' },
  giftbox: { label:'GiftBox', labelFull:'GiftBox / Short Run', color:'#6d28d9', bg:'#f5f3ff' },
}
const STATUSES = {
  b2b: [
    { key:'lead',     label:'Potencjalny', labelEn:'Lead',     color:'#374151', bg:'#f3f4f6' },
    { key:'contact',  label:'W kontakcie', labelEn:'Contact',  color:'#92400e', bg:'#fffbeb' },
    { key:'quote',    label:'Wycena',      labelEn:'Quote',    color:'#1d4ed8', bg:'#eff6ff' },
    { key:'sample',   label:'Probka',      labelEn:'Sample',   color:'#6d28d9', bg:'#f5f3ff' },
    { key:'active',   label:'Aktywny',     labelEn:'Active',   color:'#065f46', bg:'#ecfdf5' },
    { key:'inactive', label:'Nieaktywny',  labelEn:'Inactive', color:'#9ca3af', bg:'#f9fafb' },
    { key:'lost',     label:'Utracony',    labelEn:'Lost',     color:'#dc2626', bg:'#fef2f2' },
  ],
  b2c: [
    { key:'new',          label:'Nowy',          labelEn:'New',          color:'#1d4ed8', bg:'#eff6ff' },
    { key:'returning',    label:'Powracajacy',   labelEn:'Returning',   color:'#065f46', bg:'#ecfdf5' },
    { key:'vip',          label:'VIP',           labelEn:'VIP',          color:'#92400e', bg:'#fffbeb' },
    { key:'problematic',  label:'Problematyczny',labelEn:'Problematic', color:'#dc2626', bg:'#fef2f2' },
    { key:'direct',       label:'Direct (WooC)', labelEn:'Direct',      color:'#6d28d9', bg:'#f5f3ff' },
  ],
  giftbox: [
    { key:'inquiry',    label:'Zapytanie',    labelEn:'Inquiry',    color:'#374151', bg:'#f3f4f6' },
    { key:'design',     label:'Projekt',      labelEn:'Design',     color:'#1d4ed8', bg:'#eff6ff' },
    { key:'approval',   label:'Zatwierdzenie',labelEn:'Approval',   color:'#92400e', bg:'#fffbeb' },
    { key:'production', label:'Produkcja',    labelEn:'Production', color:'#6d28d9', bg:'#f5f3ff' },
    { key:'sent',       label:'Wyslany',      labelEn:'Sent',       color:'#0e7490', bg:'#ecfeff' },
    { key:'done',       label:'Zrealizowany', labelEn:'Done',       color:'#065f46', bg:'#ecfdf5' },
    { key:'vip',        label:'VIP powracajacy',labelEn:'VIP',      color:'#92400e', bg:'#fffbeb' },
  ],
}
const SOURCES = ['google','amazon','referral','event','instagram','linkedin','ebay','onbuy','woocommerce','other']
const MARKETPLACES = ['amazon','ebay','onbuy','woocommerce','allegro','other']
function statusMeta(segment, key) {
  return STATUSES[segment]?.find(s => s.key === key) || { label: key, color:'#374151', bg:'#f3f4f6' }
}
function Pill({ segment, statusKey, lang }) {
  const m = statusMeta(segment, statusKey)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:'20px',
      fontSize:'11px', fontWeight:'500', background:m.bg, color:m.color }}>
      {lang==='pl' ? m.label : m.labelEn}
    </span>
  )
}
const emptyForm = { company_name:'', contact_name:'', email:'', phone:'', whatsapp:'',
  segment:'b2b', status:'lead', source:'google', marketplace:'', notes:'',
  assigned_to:'', ltv:'', last_order_date:'', workspace:'jamo_healthy', is_vip:false, is_problematic:false }
export default function CRM() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [lang, setLang] = useState('pl')
  const [clients, setClients] = useState([])
  const [users, setUsers] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [segFilter, setSegFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState('note')
  const [savingNote, setSavingNote] = useState(false)
  const [showAlerts, setShowAlerts] = useState(true)
  const [viewMode, setViewMode] = useState('list')
  const [blSyncing, setBlSyncing] = useState(false)
  const [blResult, setBlResult] = useState(null)
  const [blDays, setBlDays] = useState(30)
  const [detailTab, setDetailTab] = useState('timeline')
  const [clientTasks, setClientTasks] = useState([])
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const isAdmin = user?.id === ADMIN_ID
  useEffect(() => {
    const saved = localStorage.getItem('tf_lang'); if (saved) setLang(saved)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUser(user)
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
    })
    supabase.from('profiles').select('id, full_name').then(({ data }) => setUsers(data || []))
  }, [])
  const loadClients = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('clients')
      .select('*, assigned:profiles!assigned_to(full_name)')
      .order('created_at', { ascending: false })
      .limit(5000)
    setClients(data || [])
    setLoading(false)
  }, [])
  useEffect(() => { loadClients() }, [loadClients])
  async function loadInteractions(clientId) {
    const { data } = await supabase.from('client_interactions')
      .select('*, author:profiles!created_by(full_name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setInteractions(data || [])
  }
  async function openDetail(client) {
    setSelectedClient(client)
    setShowDetail(true)
    setDetailTab('timeline')
    await loadInteractions(client.id)
    await loadClientTasks(client.id)
  }
  async function loadClientTasks(clientId) {
    const { data } = await supabase.from('tasks')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setClientTasks(data || [])
  }
  async function createTaskForClient() {
    if (!selectedClient) return
    router.push('/dashboard?client_id=' + selectedClient.id + '&client_name=' + encodeURIComponent(selectedClient.company_name || selectedClient.contact_name))
  }
  function openNew() {
    setEditingClient(null)
    setForm({ ...emptyForm, assigned_to: user?.id || '' })
    setShowModal(true)
  }
  function openEdit(client) {
    setEditingClient(client)
    setForm({
      company_name: client.company_name || '',
      contact_name: client.contact_name || '',
      email: client.email || '',
      phone: client.phone || '',
      whatsapp: client.whatsapp || '',
      segment: client.segment || 'b2b',
      status: client.status || 'lead',
      source: client.source || 'google',
      marketplace: client.marketplace || '',
      notes: client.notes || '',
      assigned_to: client.assigned_to || '',
      ltv: client.ltv || '',
      last_order_date: client.last_order_date || '',
      workspace: client.workspace || 'jamo_healthy',
      is_vip: client.is_vip || false,
      is_problematic: client.is_problematic || false,
    })
    setShowModal(true)
  }
  async function handleSave() {
    if (!form.contact_name.trim()) return
    setSaving(true)
    const payload = {
      ...form,
      ltv: form.ltv ? parseFloat(form.ltv) : 0,
      last_order_date: form.last_order_date || null,
      assigned_to: form.assigned_to || null,
      last_contact_date: new Date().toISOString().split('T')[0],
    }
    if (editingClient) {
      await supabase.from('clients').update(payload).eq('id', editingClient.id)
    } else {
      const { data: newClient } = await supabase.from('clients').insert({ ...payload, created_by: user.id }).select().single()
      if (newClient) {
        await supabase.from('client_interactions').insert({ client_id: newClient.id, type: 'note', content: `Klient dodany do CRM. Zrodlo: ${form.source}`, created_by: user.id })
      }
    }
    setSaving(false)
    setShowModal(false)
    loadClients()
  }
  async function handleDelete(id) {
    if (!confirm(lang==='pl' ? 'Usunac tego klienta? Tej operacji nie mozna cofnac.' : 'Delete this client? This cannot be undone.')) return
    await supabase.from('clients').delete().eq('id', id)
    setShowDetail(false)
    loadClients()
  }
  async function addNote() {
    if (!newNote.trim() || !selectedClient) return
    setSavingNote(true)
    await supabase.from('client_interactions').insert({ client_id: selectedClient.id, type: noteType, content: newNote.trim(), created_by: user.id })
    await supabase.from('clients').update({ last_contact_date: new Date().toISOString().split('T')[0] }).eq('id', selectedClient.id)
    setNewNote('')
    await loadInteractions(selectedClient.id)
    loadClients()
    setSavingNote(false)
  }
  async function changeStatus(clientId, status) {
    await supabase.from('clients').update({ status }).eq('id', clientId)
    loadClients()
    if (selectedClient?.id === clientId) setSelectedClient(prev => ({ ...prev, status }))
  }
  async function syncBaseLinker() {
    setBlSyncing(true)
    setBlResult(null)
    try {
      const res = await fetch('/api/baselinker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days_back: blDays })
      })
      const data = await res.json()
      setBlResult(data)
      if (data.success) loadClients()
    } catch (e) {
      setBlResult({ error: e.message })
    }
    setBlSyncing(false)
  }
  async function resetAndSync() {
    if (resetConfirmText !== 'RESET') return
    setResetting(true)
    setBlResult(null)
    setShowResetModal(false)
    setResetConfirmText('')
    try {
      const res = await fetch('/api/baselinker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days_back: blDays, reset: true })
      })
      const data = await res.json()
      setBlResult({ ...data, reset_performed: true })
      if (data.success) loadClients()
    } catch (e) {
      setBlResult({ error: e.message })
    }
    setResetting(false)
  }
  async function autoFlagInactive() {
    const toFlag = clients.filter(c => c.segment === 'b2b' && c.status === 'active' && daysSince(c.last_contact_date) >= 90)
    for (const c of toFlag) {
      await supabase.from('clients').update({ status: 'inactive' }).eq('id', c.id)
    }
    if (toFlag.length > 0) loadClients()
  }
  const filtered = clients.filter(c => {
    if (segFilter !== 'all' && c.segment !== segFilter) return false
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (c.company_name||'').toLowerCase().includes(q) ||
             (c.contact_name||'').toLowerCase().includes(q) ||
             (c.email||'').toLowerCase().includes(q)
    }
    return true
  })
  const counts = {
    all: clients.length,
    b2b: clients.filter(c => c.segment==='b2b').length,
    b2c: clients.filter(c => c.segment==='b2c').length,
    giftbox: clients.filter(c => c.segment==='giftbox').length,
    vip: clients.filter(c => c.is_vip).length,
  }
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(lang==='pl'?'pl-PL':'en-GB') : '—'
  const daysSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / (1000*60*60*24)) : null
  const alerts = clients.filter(c => {
    if (c.segment !== 'b2b' && c.segment !== 'giftbox') return false
    if (c.status === 'lost' || c.status === 'done') return false
    const days = daysSince(c.last_contact_date)
    if (c.status === 'active' && days !== null && days >= 90) return true
    if (c.status === 'quote' && days !== null && days >= 7) return true
    if (c.status === 'sample' && days !== null && days >= 10) return true
    if (c.status === 'contact' && days !== null && days >= 5) return true
    if (c.status === 'lead' && days !== null && days >= 3) return true
    return false
  }).map(c => {
    const days = daysSince(c.last_contact_date)
    const messages = {
      active: `Brak kontaktu od ${days} dni — ryzyko utraty klienta`,
      quote: `Wycena bez odpowiedzi od ${days} dni — zrob follow-up`,
      sample: `Probka wyslana ${days} dni temu — zapytaj o feedback`,
      contact: `W kontakcie od ${days} dni — wyslij wycene`,
      lead: `Nowy lead bez kontaktu od ${days} dni`,
    }
    return { client: c, message: messages[c.status] || `Brak kontaktu od ${days} dni`, days, urgent: days >= 90 || (c.status === 'quote' && days >= 14) }
  }).sort((a,b) => b.days - a.days)
  const fmtDT = (d) => d ? new Date(d).toLocaleString(lang==='pl'?'pl-PL':'en-GB', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''
  const initials = (n) => (n||'?').split(' ').map(x=>x[0]).join('').toUpperCase().substring(0,2)
  const interactionIcon = { note:'📝', call:'📞', email:'✉️', meeting:'🤝', order:'📦', complaint:'⚠️', quote:'💰' }
  const S = {
    page: { display:'flex', height:'100vh', ...F, fontSize:'14px', background:'#f5f5f3' },
    topbar: { background:'#fff', borderBottom:'1px solid #e8e8e6', padding:'0 24px', height:'56px', display:'flex', alignItems:'center', gap:'12px', flexShrink:0 },
    content: { flex:1, overflow:'auto', padding:'20px 24px' },
    card: { background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', overflow:'hidden' },
    th: { fontSize:'10px', color:'#9ca3af', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.06em' },
    input: { width:'100%', padding:'8px 11px', border:'1px solid #e8e8e6', borderRadius:'7px', fontSize:'13px', outline:'none', ...F, color:'#111', background:'#fff' },
    select: { width:'100%', padding:'8px 11px', border:'1px solid #e8e8e6', borderRadius:'7px', fontSize:'13px', outline:'none', ...F, color:'#111', background:'#fff' },
    btnPrimary: { background:'#111', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'500', cursor:'pointer', ...F },
    btnSm: (v) => ({ padding:'4px 9px', fontSize:'11px', borderRadius:'6px', cursor:'pointer', ...F, fontWeight:'500', border: v==='red'?'1px solid #fecaca': v==='green'?'1px solid #bbf7d0': v==='blue'?'1px solid #bfdbfe':'1px solid #e8e8e6', background: v==='red'?'#fef2f2': v==='green'?'#f0fdf4': v==='blue'?'#eff6ff':'#fff', color: v==='red'?'#dc2626': v==='green'?'#16a34a': v==='blue'?'#1d4ed8':'#374151' }),
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 },
    modal: (w) => ({ background:'#fff', borderRadius:'14px', width:w||'520px', maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', border:'1px solid #e8e8e6' }),
    label: { display:'block', fontSize:'12px', fontWeight:'500', marginBottom:'4px', color:'#374151' },
    grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' },
  }
  return (
    <div style={S.page}>
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
        <div style={S.topbar}>
          <button onClick={() => router.push('/dashboard')} style={{ border:'none', background:'none', cursor:'pointer', color:'#9ca3af', fontSize:'20px', lineHeight:'1', padding:'0' }}>←</button>
          <span style={{ fontSize:'15px', fontWeight:'600', letterSpacing:'-0.3px', color:'#111', flex:1 }}>CRM</span>
          <div style={{ display:'flex', gap:'6px' }}>
            {Object.entries(SEGMENTS).map(([k, v]) => (
              <button key={k} onClick={() => { setSegFilter(k); setStatusFilter('all') }}
                style={{ padding:'5px 12px', borderRadius:'7px', fontSize:'12px', fontWeight:'500', cursor:'pointer', border:'1px solid', borderColor: segFilter===k ? v.color : '#e8e8e6', background: segFilter===k ? v.bg : '#fff', color: segFilter===k ? v.color : '#6b7280', ...F }}>
                {v.label} <span style={{ marginLeft:'4px', fontWeight:'600' }}>{counts[k]}</span>
              </button>
            ))}
            <button onClick={() => setSegFilter('all')}
              style={{ padding:'5px 12px', borderRadius:'7px', fontSize:'12px', fontWeight:'500', cursor:'pointer', border:'1px solid', borderColor: segFilter==='all'?'#111':'#e8e8e6', background: segFilter==='all'?'#111':'#fff', color: segFilter==='all'?'white':'#6b7280', ...F }}>
              Wszyscy <span style={{ marginLeft:'4px' }}>{counts.all}</span>
            </button>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj klienta..." style={{ ...S.input, width:'200px' }} />
          <div style={{ display:'flex', border:'1px solid #e8e8e6', borderRadius:'8px', overflow:'hidden', flexShrink:0 }}>
            {[{key:'list',icon:'☰'},{key:'kanban',icon:'⊞'}].map(v => (
              <button key={v.key} onClick={() => setViewMode(v.key)}
                style={{ padding:'7px 11px', border:'none', background: viewMode===v.key?'#111':'#fff', color: viewMode===v.key?'white':'#6b7280', cursor:'pointer', fontSize:'13px', fontFamily:"'DM Sans',sans-serif" }}>
                {v.icon}
              </button>
            ))}
          </div>
          <button onClick={openNew} style={S.btnPrimary}>+ Nowy klient</button>
        </div>
        <div style={S.content}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px', marginBottom:'20px' }}>
            {[
              { label:'Wszyscy klienci', val:counts.all, color:'#111' },
              { label:'Jamo B2B', val:counts.b2b, color:'#1d4ed8' },
              { label:'Healthy Future', val:counts.b2c, color:'#065f46' },
              { label:'GiftBox', val:counts.giftbox, color:'#6d28d9' },
              { label:'VIP', val:counts.vip, color:'#92400e' },
            ].map(s => (
              <div key={s.label} style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', padding:'14px 16px' }}>
                <div style={{ fontSize:'10px', color:'#9ca3af', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>{s.label}</div>
                <div style={{ fontSize:'26px', fontWeight:'600', color:s.color, letterSpacing:'-0.5px' }}>{s.val}</div>
              </div>
            ))}
          </div>
          {alerts.length > 0 && showAlerts && (
            <div style={{ background:'#fff', border:'1px solid #fde68a', borderRadius:'10px', marginBottom:'14px', overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', background:'#fffbeb', borderBottom:'1px solid #fde68a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                  <span style={{ fontSize:'14px' }}>⚠️</span>
                  <span style={{ fontSize:'13px', fontWeight:'600', color:'#92400e' }}>
                    {alerts.length} {lang==='pl' ? 'klientow wymaga uwagi' : 'clients need attention'}
                  </span>
                </div>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <button onClick={autoFlagInactive} style={{ fontSize:'11px', padding:'3px 10px', background:'#92400e', color:'white', border:'none', borderRadius:'5px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    Auto-oznacz nieaktywnych
                  </button>
                  <button onClick={() => setShowAlerts(false)} style={{ fontSize:'16px', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', lineHeight:'1' }}>×</button>
                </div>
              </div>
              <div style={{ maxHeight:'200px', overflowY:'auto' }}>
                {alerts.slice(0,8).map(({ client: c, message, urgent }) => (
                  <div key={c.id} onClick={() => openDetail(c)}
                    style={{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 14px', borderBottom:'1px solid #fef9c3', cursor:'pointer', background: urgent ? '#fef2f2' : '#fff' }}
                    onMouseEnter={e => e.currentTarget.style.background = urgent ? '#fee2e2' : '#fefce8'}
                    onMouseLeave={e => e.currentTarget.style.background = urgent ? '#fef2f2' : '#fff'}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'50%', background: urgent ? '#fef2f2' : '#fffbeb', color: urgent ? '#dc2626' : '#92400e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'600', flexShrink:0 }}>
                      {(c.company_name||c.contact_name||'?').substring(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12px', fontWeight:'500', color:'#111' }}>{c.company_name || c.contact_name}</div>
                      <div style={{ fontSize:'11px', color: urgent ? '#dc2626' : '#92400e' }}>{message}</div>
                    </div>
                    <span style={{ fontSize:'10px', fontWeight:'500', padding:'2px 7px', borderRadius:'10px', background: urgent?'#fef2f2':'#fffbeb', color: urgent?'#dc2626':'#92400e', flexShrink:0 }}>
                      {(() => { const m = (STATUSES[c.segment]||[]).find(s=>s.key===c.status); return m ? (lang==='pl'?m.label:m.labelEn) : c.status })()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', padding:'12px 16px', marginBottom:'14px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <div style={{ width:'28px', height:'28px', background:'#f0f4ff', borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px' }}>🔗</div>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'600', color:'#111' }}>BaseLinker Sync</div>
                <div style={{ fontSize:'11px', color:'#9ca3af' }}>Auto-import raz dziennie — Amazon, eBay, OnBuy, WooCommerce, Shopify</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginLeft:'auto' }}>
              <select value={blDays} onChange={e => setBlDays(Number(e.target.value))}
                style={{ padding:'6px 10px', border:'1px solid #e8e8e6', borderRadius:'7px', fontSize:'12px', outline:'none', fontFamily:"'DM Sans',sans-serif" }}>
                <option value={7}>Ostatnie 7 dni</option>
                <option value={30}>Ostatnie 30 dni</option>
                <option value={90}>Ostatnie 90 dni</option>
                <option value={365}>Ostatni rok</option>
              </select>
              <button onClick={syncBaseLinker} disabled={blSyncing || resetting}
                style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 14px', background: blSyncing?'#6b7280':'#111', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor: blSyncing?'default':'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                {blSyncing ? (
                  <><div style={{ width:'12px', height:'12px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}></div> Synchronizuje...</>
                ) : resetting ? (
                  <><div style={{ width:'12px', height:'12px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}></div> Resetuje...</>
                ) : (
                  <>↻ Synchronizuj</>
                )}
              </button>
              {isAdmin && (
                <button onClick={() => setShowResetModal(true)} disabled={blSyncing || resetting}
                  style={{ padding:'7px 12px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'8px', fontSize:'12px', fontWeight:'500', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  🗑 Reset + Import
                </button>
              )}
            </div>
            {blResult && (
              <div style={{ width:'100%', padding:'8px 12px', borderRadius:'7px', background: blResult.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${blResult.error ? '#fecaca' : '#bbf7d0'}`, fontSize:'12px', color: blResult.error ? '#dc2626' : '#065f46' }}>
                {blResult.error
                  ? `Blad: ${blResult.error}`
                  : `${blResult.reset_performed ? '🗑 Reset wykonany. ' : ''}✅ Zsynchronizowano ${blResult.orders_processed} zamowien — ${blResult.clients_created} nowych klientow, ${blResult.clients_updated} zaktualizowanych`
                }
              </div>
            )}
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          {segFilter !== 'all' && (
            <div style={{ display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' }}>
              <button onClick={() => setStatusFilter('all')} style={{ ...S.btnSm(statusFilter==='all'?'blue':''), fontSize:'12px', padding:'5px 12px' }}>Wszystkie statusy</button>
              {(STATUSES[segFilter]||[]).map(s => (
                <button key={s.key} onClick={() => setStatusFilter(s.key)}
                  style={{ padding:'5px 12px', borderRadius:'20px', fontSize:'11px', fontWeight:'500', cursor:'pointer', border:'1px solid', borderColor: statusFilter===s.key ? s.color : '#e8e8e6', background: statusFilter===s.key ? s.bg : '#fff', color: statusFilter===s.key ? s.color : '#6b7280', ...F }}>
                  {lang==='pl' ? s.label : s.labelEn}
                  <span style={{ marginLeft:'5px', fontWeight:'600' }}>{clients.filter(c=>c.segment===segFilter&&c.status===s.key).length}</span>
                </button>
              ))}
            </div>
          )}
          <div style={S.card}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 120px 90px 80px 120px', padding:'10px 16px', borderBottom:'1px solid #e8e8e6', background:'#fafaf9' }}>
              {['Klient', 'Segment', 'Status', 'Przypisany', 'LTV', 'Ost. kontakt', 'Akcje'].map(h => (
                <span key={h} style={S.th}>{h}</span>
              ))}
            </div>
            {loading && <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af' }}>Ladowanie...</div>}
            {!loading && filtered.length === 0 && (
              <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>
                {clients.length === 0 ? 'Brak klientow — dodaj pierwszego!' : 'Brak wynikow dla wybranych filtrow'}
              </div>
            )}
            {filtered.map((client, i) => {
              const seg = SEGMENTS[client.segment]
              const baseBg = i%2===0 ? '#fff' : '#f7f7f5'
              return (
                <div key={client.id} onClick={() => openDetail(client)}
                  style={{ display:'grid', gridTemplateColumns:'1fr 80px 110px 120px 90px 80px 120px', padding:'12px 16px', borderBottom:'1px solid #f0f0ee', cursor:'pointer', background:baseBg, alignItems:'center' }}
                  onMouseEnter={e => e.currentTarget.style.background='#eef2ff'}
                  onMouseLeave={e => e.currentTarget.style.background=baseBg}>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'500', color:'#111' }}>{client.company_name || client.contact_name}</div>
                    <div style={{ fontSize:'11px', color:'#9ca3af', marginTop:'1px' }}>
                      {client.company_name ? client.contact_name : ''}{client.email ? ' · ' + client.email : ''}
                    </div>
                    {client.is_vip && <span style={{ fontSize:'10px', background:'#fffbeb', color:'#92400e', border:'1px solid #fde68a', borderRadius:'4px', padding:'1px 5px', marginTop:'2px', display:'inline-block' }}>⭐ VIP</span>}
                    {client.is_problematic && <span style={{ fontSize:'10px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'4px', padding:'1px 5px', marginTop:'2px', display:'inline-block', marginLeft:'4px' }}>⚠️</span>}
                  </div>
                  <div>
                    <span style={{ fontSize:'11px', fontWeight:'500', padding:'2px 7px', borderRadius:'5px', background:seg?.bg, color:seg?.color }}>{seg?.label}</span>
                  </div>
                  <div onClick={e => e.stopPropagation()}>
                    <select value={client.status} onChange={e => { e.stopPropagation(); changeStatus(client.id, e.target.value) }}
                      style={{ ...S.select, padding:'3px 6px', fontSize:'11px', width:'auto', background:statusMeta(client.segment,client.status).bg, color:statusMeta(client.segment,client.status).color, border:'1px solid '+statusMeta(client.segment,client.status).color+'40', borderRadius:'20px', appearance:'none', cursor:'pointer', fontWeight:'500' }}>
                      {(STATUSES[client.segment]||[]).map(s => <option key={s.key} value={s.key}>{lang==='pl'?s.label:s.labelEn}</option>)}
                    </select>
                  </div>
                  <div style={{ fontSize:'12px', color:'#6b7280' }}>{client.assigned?.full_name || '—'}</div>
                  <div style={{ fontSize:'12px', fontWeight:'500', color: client.ltv > 0 ? '#065f46' : '#9ca3af' }}>
                    {client.ltv > 0 ? `£${Number(client.ltv).toLocaleString()}` : '—'}
                  </div>
                  <div style={{ fontSize:'11px', color:'#9ca3af' }}>{fmtDate(client.last_contact_date)}</div>
                  <div style={{ display:'flex', gap:'4px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(client)} style={S.btnSm()}>Edytuj</button>
                    <button onClick={() => handleDelete(client.id)} style={S.btnSm('red')}>Usun</button>
                  </div>
                </div>
              )
            })}
          </div>
          {viewMode === 'kanban' && segFilter === 'b2b' && (
            <div style={{ display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'10px', marginTop:'14px' }}>
              {STATUSES.b2b.filter(s => s.key !== 'lost').map(status => {
                const colClients = filtered.filter(c => c.segment === 'b2b' && c.status === status.key)
                return (
                  <div key={status.key} style={{ minWidth:'200px', flex:'0 0 200px' }}>
                    <div style={{ padding:'8px 10px', borderRadius:'8px 8px 0 0', background:status.bg, border:`1px solid ${status.color}30`, borderBottom:'none', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:'11px', fontWeight:'600', color:status.color }}>{lang==='pl'?status.label:status.labelEn}</span>
                      <span style={{ fontSize:'11px', fontWeight:'600', color:status.color, background:'white', padding:'1px 6px', borderRadius:'10px' }}>{colClients.length}</span>
                    </div>
                    <div style={{ background:'#fafaf9', border:`1px solid ${status.color}30`, borderTop:'none', borderRadius:'0 0 8px 8px', minHeight:'100px', padding:'6px' }}>
                      {colClients.map(c => (
                        <div key={c.id} onClick={() => openDetail(c)}
                          style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'7px', padding:'9px 10px', marginBottom:'6px', cursor:'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = status.color}
                          onMouseLeave={e => e.currentTarget.style.borderColor = '#e8e8e6'}>
                          <div style={{ fontSize:'12px', fontWeight:'500', color:'#111', marginBottom:'3px' }}>{c.company_name || c.contact_name}</div>
                          {c.company_name && <div style={{ fontSize:'10px', color:'#9ca3af', marginBottom:'4px' }}>{c.contact_name}</div>}
                          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                            <span style={{ fontSize:'10px', color:'#9ca3af' }}>{c.source}</span>
                            {c.ltv > 0 && <span style={{ fontSize:'10px', fontWeight:'600', color:'#065f46' }}>£{Number(c.ltv).toLocaleString()}</span>}
                          </div>
                          {c.is_vip && <span style={{ fontSize:'9px', background:'#fffbeb', color:'#92400e', border:'1px solid #fde68a', borderRadius:'3px', padding:'1px 4px', display:'inline-block', marginTop:'3px' }}>⭐ VIP</span>}
                          {daysSince(c.last_contact_date) >= 7 && c.status !== 'active' && (
                            <div style={{ fontSize:'9px', color:'#dc2626', marginTop:'3px' }}>⚠️ {daysSince(c.last_contact_date)}d bez kontaktu</div>
                          )}
                        </div>
                      ))}
                      {colClients.length === 0 && <div style={{ textAlign:'center', color:'#d1d5db', fontSize:'11px', padding:'20px 0' }}>brak</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {viewMode === 'kanban' && segFilter !== 'b2b' && (
            <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'13px', padding:'40px', background:'#fff', borderRadius:'10px', border:'1px solid #e8e8e6', marginTop:'14px' }}>
              Widok Kanban dostepny dla segmentu B2B — wybierz filtr B2B powyzej
            </div>
          )}
        </div>
      </div>
      {showDetail && selectedClient && (
        <div style={{ width:'380px', background:'#fff', borderLeft:'1px solid #e8e8e6', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:SEGMENTS[selectedClient.segment]?.bg, color:SEGMENTS[selectedClient.segment]?.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'600', flexShrink:0 }}>
              {initials(selectedClient.contact_name)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#111', letterSpacing:'-0.2px' }}>{selectedClient.company_name || selectedClient.contact_name}</div>
              <div style={{ fontSize:'11px', color:'#9ca3af' }}>{selectedClient.company_name ? selectedClient.contact_name : ''}</div>
            </div>
            <button onClick={() => setShowDetail(false)} style={{ border:'none', background:'#f4f4f3', borderRadius:'5px', width:'24px', height:'24px', cursor:'pointer', color:'#9ca3af', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e8e6' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              {[
                { label:'Segment', val: <span style={{ fontSize:'11px', fontWeight:'500', padding:'2px 7px', borderRadius:'5px', background:SEGMENTS[selectedClient.segment]?.bg, color:SEGMENTS[selectedClient.segment]?.color }}>{SEGMENTS[selectedClient.segment]?.labelFull}</span> },
                { label:'Status', val: <Pill segment={selectedClient.segment} statusKey={selectedClient.status} lang={lang}/> },
                { label:'Email', val: selectedClient.email || '—' },
                { label:'Telefon', val: selectedClient.phone || '—' },
                { label:'WhatsApp', val: selectedClient.whatsapp || '—' },
                { label:'Zrodlo', val: selectedClient.source || '—' },
                { label:'LTV', val: selectedClient.ltv > 0 ? `£${Number(selectedClient.ltv).toLocaleString()}` : '—' },
                { label:'Ost. zamowienie', val: fmtDate(selectedClient.last_order_date) },
              ].map(item => (
                <div key={item.label} style={{ padding:'8px 10px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee' }}>
                  <div style={{ fontSize:'9px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'500', marginBottom:'3px' }}>{item.label}</div>
                  <div style={{ fontSize:'12px', color:'#111', fontWeight:'500' }}>{item.val}</div>
                </div>
              ))}
            </div>
            {selectedClient.notes && (
              <div style={{ marginTop:'8px', padding:'9px 11px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'7px', fontSize:'12px', color:'#374151' }}>
                {selectedClient.notes}
              </div>
            )}
            <div style={{ display:'flex', gap:'6px', marginTop:'10px' }}>
              <button onClick={() => openEdit(selectedClient)} style={{ ...S.btnPrimary, fontSize:'12px', padding:'6px 12px' }}>Edytuj</button>
              <button onClick={() => handleDelete(selectedClient.id)} style={{ ...S.btnSm('red'), fontSize:'12px', padding:'6px 12px' }}>Usun klienta</button>
            </div>
          </div>
          <div style={{ display:'flex', borderBottom:'1px solid #e8e8e6', flexShrink:0 }}>
            {[
              { key:'timeline', label:'Historia' },
              { key:'tasks', label:`Zadania (${clientTasks.length})` },
            ].map(tab => (
              <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                style={{ flex:1, padding:'9px', fontSize:'12px', fontWeight:'500', border:'none', background:'transparent', cursor:'pointer', color:detailTab===tab.key?'#111':'#9ca3af', borderBottom:detailTab===tab.key?'2px solid #111':'2px solid transparent', fontFamily:"'DM Sans',sans-serif" }}>
                {tab.label}
              </button>
            ))}
          </div>
          {detailTab==='timeline' && (
            <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
              <div style={{ fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:'500', marginBottom:'10px' }}>Historia interakcji</div>
              <div style={{ marginBottom:'14px', padding:'10px', background:'#fafaf9', border:'1px solid #e8e8e6', borderRadius:'9px' }}>
                <select value={noteType} onChange={e => setNoteType(e.target.value)} style={{ ...S.select, marginBottom:'7px', fontSize:'12px' }}>
                  <option value="note">📝 Notatka</option>
                  <option value="call">📞 Telefon</option>
                  <option value="email">✉️ Email</option>
                  <option value="meeting">🤝 Spotkanie</option>
                  <option value="quote">💰 Wycena</option>
                  <option value="order">📦 Zamowienie</option>
                  <option value="complaint">⚠️ Reklamacja</option>
                </select>
                <div style={{ display:'flex', gap:'6px' }}>
                  <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key==='Enter' && addNote()}
                    placeholder="Dodaj notatke... (Enter)" style={{ ...S.input, flex:1, fontSize:'12px' }} />
                  <button onClick={addNote} disabled={savingNote || !newNote.trim()} style={{ ...S.btnPrimary, fontSize:'12px', padding:'8px 12px', opacity:(!newNote.trim()||savingNote)?0.4:1 }}>+</button>
                </div>
              </div>
              {interactions.map(item => (
                <div key={item.id} style={{ marginBottom:'10px', display:'flex', gap:'8px' }}>
                  <div style={{ fontSize:'16px', flexShrink:0, marginTop:'2px' }}>{interactionIcon[item.type] || '📝'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>{item.author?.full_name} · {fmtDT(item.created_at)}</div>
                    <div style={{ fontSize:'12px', color:'#111', lineHeight:'1.5', padding:'7px 10px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee' }}>{item.content}</div>
                  </div>
                </div>
              ))}
              {interactions.length === 0 && <div style={{ fontSize:'12px', color:'#9ca3af', textAlign:'center', marginTop:'20px' }}>Brak historii — dodaj pierwsza notatke</div>}
            </div>
          )}
          {detailTab==='tasks' && (
            <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                <div style={{ fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:'500' }}>Zadania powiazane</div>
                <button onClick={createTaskForClient} style={{ fontSize:'11px', padding:'4px 10px', background:'#111', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>+ Nowe zadanie</button>
              </div>
              {clientTasks.length === 0 && (
                <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'12px', marginTop:'20px' }}>
                  <div style={{ marginBottom:'8px' }}>Brak powiazanych zadan</div>
                  <button onClick={createTaskForClient} style={{ fontSize:'12px', padding:'6px 14px', background:'#f4f4f3', color:'#374151', border:'1px solid #e8e8e6', borderRadius:'7px', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Stworz pierwsze zadanie</button>
                </div>
              )}
              {clientTasks.map(task => {
                const statusColors = { open:'#1d4ed8', inprogress:'#92400e', waiting:'#6d28d9', done:'#065f46', urgent:'#dc2626' }
                const statusBg = { open:'#eff6ff', inprogress:'#fffbeb', waiting:'#f5f3ff', done:'#ecfdf5', urgent:'#fef2f2' }
                const statusLabel = { open:'Otwarte', inprogress:'W trakcie', waiting:'Oczekuje', done:'Zamkniete', urgent:'Pilne' }
                return (
                  <div key={task.id} style={{ marginBottom:'8px', padding:'10px 12px', background:'#fafaf9', border:'1px solid #f0f0ee', borderRadius:'8px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'12px', fontWeight:'500', color:'#111', marginBottom:'3px' }}>{task.product_name}</div>
                        <div style={{ fontSize:'10px', color:'#9ca3af' }}>
                          {task.order_number && <span style={{ color:'#2563eb', fontWeight:'500', marginRight:'6px' }}>{task.order_number}</span>}
                          {task.client_name}{task.category ? ' · ' + task.category : ''}
                        </div>
                      </div>
                      <span style={{ fontSize:'10px', fontWeight:'500', padding:'2px 7px', borderRadius:'10px', background:statusBg[task.status]||'#f3f4f6', color:statusColors[task.status]||'#374151', flexShrink:0 }}>
                        {statusLabel[task.status]||task.status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
      {showModal && (
        <div style={S.overlay}>
          <div style={S.modal('560px')}>
            <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'15px', fontWeight:'600', letterSpacing:'-0.2px' }}>{editingClient ? 'Edytuj klienta' : 'Nowy klient'}</span>
              <button onClick={() => setShowModal(false)} style={{ border:'none', background:'none', fontSize:'20px', cursor:'pointer', color:'#9ca3af', lineHeight:'1' }}>×</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
                {Object.entries(SEGMENTS).map(([k,v]) => (
                  <button key={k} onClick={() => setForm(f => ({ ...f, segment:k, status: STATUSES[k][0].key }))}
                    style={{ flex:1, padding:'8px', borderRadius:'8px', border:'2px solid', borderColor: form.segment===k ? v.color : '#e8e8e6', background: form.segment===k ? v.bg : '#fafaf9', color: form.segment===k ? v.color : '#6b7280', fontSize:'12px', fontWeight:'500', cursor:'pointer', ...F }}>
                    {v.label}
                  </button>
                ))}
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Nazwa firmy</label><input value={form.company_name} onChange={e=>setForm(f=>({...f,company_name:e.target.value}))} placeholder="np. ABC Packaging Ltd" style={S.input}/></div>
                <div><label style={S.label}>Osoba kontaktowa *</label><input value={form.contact_name} onChange={e=>setForm(f=>({...f,contact_name:e.target.value}))} placeholder="Imie Nazwisko" style={S.input}/></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Email</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@firma.com" style={S.input}/></div>
                <div><label style={S.label}>Telefon</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+44 7..." style={S.input}/></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={S.select}>
                    {(STATUSES[form.segment]||[]).map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Zrodlo</label>
                  <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={S.select}>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Przypisz do</label>
                  <select value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))} style={S.select}>
                    <option value="">— Nieprzypisane —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>LTV (£)</label><input type="number" value={form.ltv} onChange={e=>setForm(f=>({...f,ltv:e.target.value}))} placeholder="0" style={S.input}/></div>
              </div>
              {form.segment==='b2c' && (
                <div style={{ marginBottom:'12px' }}>
                  <label style={S.label}>Marketplace</label>
                  <select value={form.marketplace} onChange={e=>setForm(f=>({...f,marketplace:e.target.value}))} style={S.select}>
                    <option value="">— Wybierz —</option>
                    {MARKETPLACES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom:'12px' }}>
                <label style={S.label}>Notatka</label>
                <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Dodatkowe informacje o kliencie..." style={{ ...S.input, height:'60px', resize:'vertical' }}/>
              </div>
              <div style={{ display:'flex', gap:'10px' }}>
                <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', cursor:'pointer' }}>
                  <input type="checkbox" checked={form.is_vip} onChange={e=>setForm(f=>({...f,is_vip:e.target.checked}))}/> ⭐ VIP
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', cursor:'pointer' }}>
                  <input type="checkbox" checked={form.is_problematic} onChange={e=>setForm(f=>({...f,is_problematic:e.target.checked}))}/> ⚠️ Problematyczny
                </label>
              </div>
            </div>
            <div style={{ padding:'14px 20px', borderTop:'1px solid #e8e8e6', display:'flex', justifyContent:'flex-end', gap:'8px' }}>
              <button onClick={() => setShowModal(false)} style={{ ...S.btnSm(), padding:'8px 16px', fontSize:'13px' }}>Anuluj</button>
              <button onClick={handleSave} disabled={saving || !form.contact_name.trim()} style={{ ...S.btnPrimary, opacity:saving||!form.contact_name.trim()?0.6:1 }}>
                {saving ? 'Zapisywanie...' : editingClient ? 'Zapisz zmiany' : 'Dodaj klienta'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showResetModal && isAdmin && (
        <div style={S.overlay}>
          <div style={{ background:'#fff', borderRadius:'14px', width:'440px', maxWidth:'95vw', border:'2px solid #fecaca', padding:'24px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
              <span style={{ fontSize:'24px' }}>⚠️</span>
              <div>
                <div style={{ fontSize:'15px', fontWeight:'700', color:'#dc2626' }}>Wyczysc i importuj od nowa</div>
                <div style={{ fontSize:'12px', color:'#9ca3af', marginTop:'2px' }}>Ta operacja usunie WSZYSTKICH klientow i interakcje</div>
              </div>
            </div>
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'12px', marginBottom:'16px', fontSize:'12px', color:'#dc2626', lineHeight:'1.6' }}>
              <strong>Co sie stanie:</strong><br/>
              1. Usunieci zostana wszyscy klienci ({clients.length})<br/>
              2. Usunieta zostanie cala historia interakcji<br/>
              3. Reimport z BaseLinker za ostatnie {blDays} dni<br/>
              <br/>
              <strong>Tej operacji nie mozna cofnac!</strong>
            </div>
            <div style={{ marginBottom:'16px' }}>
              <label style={{ ...S.label, color:'#dc2626' }}>Wpisz RESET zeby potwierdzic:</label>
              <input value={resetConfirmText} onChange={e => setResetConfirmText(e.target.value)}
                placeholder="Wpisz: RESET"
                style={{ ...S.input, border:'2px solid #fecaca', fontWeight:'600', letterSpacing:'1px' }}
                autoFocus />
            </div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button onClick={() => { setShowResetModal(false); setResetConfirmText('') }}
                style={{ ...S.btnSm(), padding:'9px 18px', fontSize:'13px' }}>Anuluj</button>
              <button onClick={resetAndSync} disabled={resetConfirmText !== 'RESET'}
                style={{ padding:'9px 18px', background: resetConfirmText === 'RESET' ? '#dc2626' : '#9ca3af', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor: resetConfirmText === 'RESET' ? 'pointer' : 'default', fontFamily:"'DM Sans',sans-serif" }}>
                🗑 Tak, wyczysc i importuj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
