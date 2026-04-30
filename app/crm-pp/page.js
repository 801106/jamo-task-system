'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
const ADMIN_ID = 'd53f6727-6bc7-4602-9ce0-4fc31ab3aba1'
const F = { fontFamily:"'DM Sans',-apple-system,sans-serif" }

const SEGMENTS = {
  b2b:     { label:'B2B', labelFull:'Pack Pack B2B', color:'#1d4ed8', bg:'#eff6ff' },
  b2c:     { label:'B2C', labelFull:'Pack Pack B2C', color:'#065f46', bg:'#ecfdf5' },
  zadruk:  { label:'Zadruk', labelFull:'Zadruk / Custom Print', color:'#6d28d9', bg:'#f5f3ff' },
}

const STATUSES = {
  b2b: [
    { key:'lead',     label:'Potencjalny', color:'#374151', bg:'#f3f4f6' },
    { key:'contact',  label:'W kontakcie', color:'#92400e', bg:'#fffbeb' },
    { key:'quote',    label:'Wycena',      color:'#1d4ed8', bg:'#eff6ff' },
    { key:'sample',   label:'Probka',      color:'#6d28d9', bg:'#f5f3ff' },
    { key:'active',   label:'Aktywny',     color:'#065f46', bg:'#ecfdf5' },
    { key:'inactive', label:'Nieaktywny',  color:'#9ca3af', bg:'#f9fafb' },
    { key:'lost',     label:'Utracony',    color:'#dc2626', bg:'#fef2f2' },
  ],
  b2c: [
    { key:'new',         label:'Nowy',           color:'#1d4ed8', bg:'#eff6ff' },
    { key:'returning',   label:'Powracajacy',    color:'#065f46', bg:'#ecfdf5' },
    { key:'vip',         label:'VIP',            color:'#92400e', bg:'#fffbeb' },
    { key:'problematic', label:'Problematyczny', color:'#dc2626', bg:'#fef2f2' },
  ],
  zadruk: [
    { key:'inquiry',    label:'Zapytanie',     color:'#374151', bg:'#f3f4f6' },
    { key:'design',     label:'Projekt',       color:'#1d4ed8', bg:'#eff6ff' },
    { key:'approval',   label:'Zatwierdzenie', color:'#92400e', bg:'#fffbeb' },
    { key:'production', label:'Produkcja',     color:'#6d28d9', bg:'#f5f3ff' },
    { key:'sent',       label:'Wyslany',       color:'#0e7490', bg:'#ecfeff' },
    { key:'done',       label:'Zrealizowany',  color:'#065f46', bg:'#ecfdf5' },
    { key:'vip',        label:'VIP powracajacy',color:'#92400e', bg:'#fffbeb' },
  ],
}

const SOURCES = ['google','amazon','referral','event','instagram','linkedin','allegro','other']

function statusMeta(segment, key) {
  return STATUSES[segment]?.find(s => s.key === key) || { label: key, color:'#374151', bg:'#f3f4f6' }
}

function HealthBar({ score }) {
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#dc2626'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
      <div style={{ flex:1, height:'5px', background:'#f0f0ee', borderRadius:'3px', overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:color, borderRadius:'3px' }}></div>
      </div>
      <span style={{ fontSize:'10px', fontWeight:'600', color, minWidth:'24px' }}>{score}</span>
    </div>
  )
}

function getTrend(client) {
  const avg = client.avg_days_between_orders
  const daysSince = client.days_since_last_order
  if (!avg || !daysSince || (client.order_count || 0) < 2) return null
  const ratio = daysSince / avg
  if (ratio <= 0.8) return { dir:'up', label:'Rośnie', color:'#16a34a', bg:'#f0fdf4', arrow:'↑' }
  if (ratio >= 1.3) return { dir:'down', label:'Spada', color:'#dc2626', bg:'#fef2f2', arrow:'↓' }
  return { dir:'stable', label:'Stabilny', color:'#f59e0b', bg:'#fffbeb', arrow:'→' }
}

function HealthWithTrend({ client }) {
  const score = client.health_score || 0
  const trend = getTrend(client)
  if (score === 0) return <span style={{ fontSize:'11px', color:'#d1d5db' }}>—</span>
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#dc2626'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
      <div style={{ flex:1, height:'5px', background:'#f0f0ee', borderRadius:'3px', overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:color, borderRadius:'3px' }}></div>
      </div>
      <span style={{ fontSize:'10px', fontWeight:'600', color, minWidth:'20px' }}>{score}</span>
      {trend && <span style={{ fontSize:'11px', fontWeight:'700', color:trend.color }}>{trend.arrow}</span>}
    </div>
  )
}

const emptyForm = {
  company_name:'', contact_name:'', email:'', phone:'',
  segment:'b2b', status:'lead', source:'google', notes:'',
  assigned_to:'', ltv:'', last_order_date:'', workspace:'packpack', is_vip:false, is_problematic:false
}

export default function CRMPackPack() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [clients, setClients] = useState([])
  const [users, setUsers] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [segFilter, setSegFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [aiFilterIds, setAiFilterIds] = useState(null)
  const [sortKey, setSortKey] = useState('created_at')
  const [sortDir, setSortDir] = useState('desc')
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
  const [detailTab, setDetailTab] = useState('timeline')
  const [clientTasks, setClientTasks] = useState([])
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 200

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      // Tylko admin ma dostep do PP CRM
      if (user.id !== ADMIN_ID) { router.push('/dashboard'); return }
      setUser(user)
    })
    supabase.from('profiles').select('id, full_name').then(({ data }) => setUsers(data || []))
  }, [])

  const loadClients = useCallback(async () => {
    setLoading(true)
    // TYLKO workspace packpack — nigdy nie dotykamy jamo_healthy
    const { data } = await supabase.from('clients')
      .select('*, assigned:profiles!assigned_to(full_name)')
      .eq('workspace', 'packpack')
      .order('created_at', { ascending: false })
      .limit(10000)
    setClients(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { if (user) loadClients() }, [user, loadClients])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span style={{ color:'#d1d5db', marginLeft:'3px' }}>↕</span>
    return <span style={{ color:'#7c3aed', marginLeft:'3px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  async function loadInteractions(clientId) {
    const { data } = await supabase.from('client_interactions')
      .select('*, author:profiles!created_by(full_name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    setInteractions(data || [])
  }

  async function openDetail(client) {
    setSelectedClient(client); setShowDetail(true); setDetailTab('timeline')
    await loadInteractions(client.id); await loadClientTasks(client.id)
  }

  async function loadClientTasks(clientId) {
    const { data } = await supabase.from('tasks').select('*').eq('client_id', clientId).order('created_at', { ascending: false })
    setClientTasks(data || [])
  }

  function openNew() { setEditingClient(null); setForm({ ...emptyForm, assigned_to: user?.id || '' }); setShowModal(true) }

  function openEdit(client) {
    setEditingClient(client)
    setForm({
      company_name:client.company_name||'', contact_name:client.contact_name||'',
      email:client.email||'', phone:client.phone||'',
      segment:client.segment||'b2b', status:client.status||'lead',
      source:client.source||'google', notes:client.notes||'',
      assigned_to:client.assigned_to||'', ltv:client.ltv||'',
      last_order_date:client.last_order_date||'',
      workspace:'packpack', is_vip:client.is_vip||false, is_problematic:client.is_problematic||false
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.contact_name.trim()) return
    setSaving(true)
    // Zawsze workspace: packpack — nigdy nie zmieniamy
    const payload = {
      ...form,
      workspace: 'packpack',
      ltv: form.ltv ? parseFloat(form.ltv) : 0,
      last_order_date: form.last_order_date || null,
      assigned_to: form.assigned_to || null,
      last_contact_date: new Date().toISOString().split('T')[0]
    }
    if (editingClient) {
      await supabase.from('clients').update(payload).eq('id', editingClient.id).eq('workspace', 'packpack')
    } else {
      const { data: newClient } = await supabase.from('clients').insert({ ...payload, created_by: user.id }).select().single()
      if (newClient) await supabase.from('client_interactions').insert({ client_id: newClient.id, type:'note', content:`Klient dodany do Pack Pack CRM. Zrodlo: ${form.source}`, created_by: user.id })
    }
    setSaving(false); setShowModal(false); loadClients()
  }

  async function handleDelete(id) {
    if (!confirm('Usunac tego klienta z Pack Pack? Tej operacji nie mozna cofnac.')) return
    // Podwojne zabezpieczenie — usuwamy TYLKO z packpack
    await supabase.from('clients').delete().eq('id', id).eq('workspace', 'packpack')
    setShowDetail(false); loadClients()
  }

  async function addNote() {
    if (!newNote.trim() || !selectedClient) return
    setSavingNote(true)
    await supabase.from('client_interactions').insert({ client_id: selectedClient.id, type: noteType, content: newNote.trim(), created_by: user.id })
    await supabase.from('clients').update({ last_contact_date: new Date().toISOString().split('T')[0] }).eq('id', selectedClient.id).eq('workspace', 'packpack')
    setNewNote(''); await loadInteractions(selectedClient.id); loadClients(); setSavingNote(false)
  }

  async function changeStatus(clientId, status) {
    await supabase.from('clients').update({ status }).eq('id', clientId).eq('workspace', 'packpack')
    loadClients()
    if (selectedClient?.id === clientId) setSelectedClient(prev => ({ ...prev, status }))
  }

  const daysSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null

  const sortVal = (c) => {
    switch(sortKey) {
      case 'name': return (c.company_name || c.contact_name || '').toLowerCase()
      case 'ltv': return c.ltv || 0
      case 'health_score': return c.health_score || 0
      case 'order_count': return c.order_count || 0
      case 'avg_order_value': return c.avg_order_value || 0
      case 'last_contact_date': return c.last_contact_date || ''
      default: return c.created_at || ''
    }
  }

  const filteredAll = clients
    .filter(c => {
      if (aiFilterIds) return aiFilterIds.includes(c.id)
      if (segFilter !== 'all' && c.segment !== segFilter) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (c.company_name||'').toLowerCase().includes(q) || (c.contact_name||'').toLowerCase().includes(q) || (c.email||'').toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      const av = sortVal(a), bv = sortVal(b)
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const filtered = filteredAll.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filteredAll.length / PAGE_SIZE)
  const counts = {
    all: clients.length,
    b2b: clients.filter(c => c.segment === 'b2b').length,
    b2c: clients.filter(c => c.segment === 'b2c').length,
    zadruk: clients.filter(c => c.segment === 'zadruk').length,
    vip: clients.filter(c => c.is_vip).length,
  }

  const alerts = clients.filter(c => {
    if (c.status === 'lost' || c.status === 'done') return false
    const days = daysSince(c.last_contact_date)
    return (c.status==='active'&&days>=90)||(c.status==='quote'&&days>=7)||(c.status==='sample'&&days>=10)||(c.status==='contact'&&days>=5)||(c.status==='lead'&&days>=3)
  }).map(c => {
    const days = daysSince(c.last_contact_date)
    const msgs = { active:`Brak kontaktu od ${days} dni`, quote:`Wycena bez odpowiedzi ${days} dni`, sample:`Probka ${days} dni temu`, contact:`W kontakcie ${days} dni`, lead:`Lead bez kontaktu ${days} dni` }
    return { client:c, message:msgs[c.status]||`Brak kontaktu ${days} dni`, days, urgent:days>=90||(c.status==='quote'&&days>=14) }
  }).sort((a,b) => b.days - a.days)

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pl-PL') : '—'
  const fmtDT = (d) => d ? new Date(d).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''
  const initials = (n) => (n||'?').split(' ').map(x=>x[0]).join('').toUpperCase().substring(0,2)
  const interactionIcon = { note:'📝', call:'📞', email:'✉️', meeting:'🤝', order:'📦', complaint:'⚠️', quote:'💰' }

  const S = {
    page: { display:'flex', height:'100vh', ...F, fontSize:'14px', background:'#f5f3ff' },
    topbar: { background:'#fff', borderBottom:'1px solid #e8e8e6', padding:'0 24px', height:'56px', display:'flex', alignItems:'center', gap:'12px', flexShrink:0 },
    content: { flex:1, overflow:'auto', padding:'20px 24px' },
    card: { background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', overflow:'hidden' },
    th: (col) => ({ fontSize:'10px', color:sortKey===col?'#7c3aed':'#9ca3af', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.06em', cursor:'pointer', userSelect:'none', display:'flex', alignItems:'center' }),
    input: { width:'100%', padding:'8px 11px', border:'1px solid #e8e8e6', borderRadius:'7px', fontSize:'13px', outline:'none', ...F, color:'#111', background:'#fff' },
    select: { width:'100%', padding:'8px 11px', border:'1px solid #e8e8e6', borderRadius:'7px', fontSize:'13px', outline:'none', ...F, color:'#111', background:'#fff' },
    btnPrimary: { background:'#6d28d9', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'500', cursor:'pointer', ...F },
    btnSm: (v) => ({ padding:'4px 9px', fontSize:'11px', borderRadius:'6px', cursor:'pointer', ...F, fontWeight:'500', border:v==='red'?'1px solid #fecaca':v==='green'?'1px solid #bbf7d0':v==='purple'?'1px solid #c4b5fd':'1px solid #e8e8e6', background:v==='red'?'#fef2f2':v==='green'?'#f0fdf4':v==='purple'?'#f5f3ff':'#fff', color:v==='red'?'#dc2626':v==='green'?'#16a34a':v==='purple'?'#6d28d9':'#374151' }),
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 },
    modal: (w) => ({ background:'#fff', borderRadius:'14px', width:w||'520px', maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', border:'1px solid #e8e8e6' }),
    label: { display:'block', fontSize:'12px', fontWeight:'500', marginBottom:'4px', color:'#374151' },
    grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' },
  }

  const cols = '1fr 80px 110px 90px 70px 70px 90px 110px'
  const headers = [
    { key:'name', label:'Klient' },
    { key:'segment', label:'Seg.' },
    { key:'status', label:'Status' },
    { key:'ltv', label:'LTV' },
    { key:'order_count', label:'Zam.' },
    { key:'avg_order_value', label:'AOV' },
    { key:'health_score', label:'Health/Trend' },
    { key:'last_contact_date', label:'Ost. kontakt' },
  ]

  return (
    <div style={S.page}>
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
        {/* TOPBAR */}
        <div style={S.topbar}>
          <button onClick={() => router.push('/dashboard')} style={{ border:'none', background:'none', cursor:'pointer', color:'#9ca3af', fontSize:'20px', lineHeight:'1', padding:'0' }}>←</button>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1 }}>
            <div style={{ width:'28px', height:'28px', background:'#6d28d9', borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'white', fontSize:'12px', fontWeight:'700' }}>PP</span>
            </div>
            <span style={{ fontSize:'15px', fontWeight:'600', letterSpacing:'-0.3px', color:'#111' }}>Pack Pack CRM</span>
            <span style={{ fontSize:'11px', background:'#f5f3ff', color:'#6d28d9', border:'1px solid #c4b5fd', padding:'2px 8px', borderRadius:'20px', fontWeight:'500' }}>Tylko Pack Pack</span>
          </div>
          <div style={{ display:'flex', gap:'6px' }}>
            {Object.entries(SEGMENTS).map(([k,v]) => (
              <button key={k} onClick={() => { setSegFilter(k); setStatusFilter('all'); setAiFilterIds(null); setPage(0) }}
                style={{ padding:'5px 12px', borderRadius:'7px', fontSize:'12px', fontWeight:'500', cursor:'pointer', border:'1px solid', borderColor:segFilter===k?v.color:'#e8e8e6', background:segFilter===k?v.bg:'#fff', color:segFilter===k?v.color:'#6b7280', ...F }}>
                {v.label} <span style={{ marginLeft:'4px', fontWeight:'600' }}>{counts[k]}</span>
              </button>
            ))}
            <button onClick={() => { setSegFilter('all'); setAiFilterIds(null); setPage(0) }}
              style={{ padding:'5px 12px', borderRadius:'7px', fontSize:'12px', fontWeight:'500', cursor:'pointer', border:'1px solid', borderColor:segFilter==='all'?'#6d28d9':'#e8e8e6', background:segFilter==='all'?'#6d28d9':'#fff', color:segFilter==='all'?'white':'#6b7280', ...F }}>
              Wszyscy <span style={{ marginLeft:'4px' }}>{counts.all}</span>
            </button>
          </div>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Szukaj klienta PP..." style={{ ...S.input, width:'200px' }} />
          <button onClick={openNew} style={S.btnPrimary}>+ Nowy klient PP</button>
        </div>

        <div style={S.content}>
          {/* STATS */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px', marginBottom:'16px' }}>
            {[
              {label:'Wszyscy PP',val:counts.all,color:'#6d28d9',action:()=>{setSegFilter('all');setPage(0)}},
              {label:'B2B',val:counts.b2b,color:'#1d4ed8',action:()=>{setSegFilter('b2b');setPage(0)}},
              {label:'B2C',val:counts.b2c,color:'#065f46',action:()=>{setSegFilter('b2c');setPage(0)}},
              {label:'Zadruk',val:counts.zadruk,color:'#6d28d9',action:()=>{setSegFilter('zadruk');setPage(0)}},
              {label:'VIP',val:counts.vip,color:'#92400e',action:()=>setAiFilterIds(clients.filter(c=>c.is_vip).map(c=>c.id))},
            ].map(s => (
              <div key={s.label} onClick={s.action} style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', padding:'12px 16px', cursor:'pointer' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=s.color;e.currentTarget.style.background='#fafaf9'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='#e8e8e6';e.currentTarget.style.background='#fff'}}>
                <div style={{ fontSize:'10px', color:'#9ca3af', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>{s.label}</div>
                <div style={{ fontSize:'24px', fontWeight:'600', color:s.color, letterSpacing:'-0.5px' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* ALERT IZOLACJI */}
          <div style={{ background:'#f5f3ff', border:'1px solid #c4b5fd', borderRadius:'8px', padding:'8px 14px', marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
            <span>🔒</span>
            <span style={{ fontSize:'12px', color:'#6d28d9', fontWeight:'500' }}>Pack Pack CRM — izolowana baza. Dane Jamo i Healthy Future są całkowicie oddzielone.</span>
          </div>

          {/* ALERTS */}
          {alerts.length > 0 && showAlerts && (
            <div style={{ background:'#fff', border:'1px solid #fde68a', borderRadius:'10px', marginBottom:'12px', overflow:'hidden' }}>
              <div style={{ padding:'9px 14px', background:'#fffbeb', borderBottom:'1px solid #fde68a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'13px', fontWeight:'600', color:'#92400e' }}>⚠️ {alerts.length} klientow PP wymaga uwagi</span>
                <button onClick={() => setShowAlerts(false)} style={{ fontSize:'16px', background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>×</button>
              </div>
              <div style={{ maxHeight:'140px', overflowY:'auto' }}>
                {alerts.slice(0,5).map(({ client:c, message, urgent }) => (
                  <div key={c.id} onClick={() => openDetail(c)}
                    style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 14px', borderBottom:'1px solid #fef9c3', cursor:'pointer', background:urgent?'#fef2f2':'#fff' }}>
                    <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'#f5f3ff', color:'#6d28d9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'600', flexShrink:0 }}>
                      {(c.company_name||c.contact_name||'?').substring(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'12px', fontWeight:'500', color:'#111' }}>{c.company_name||c.contact_name}</div>
                      <div style={{ fontSize:'11px', color:urgent?'#dc2626':'#92400e' }}>{message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STATUS FILTER */}
          {segFilter !== 'all' && (
            <div style={{ display:'flex', gap:'6px', marginBottom:'12px', flexWrap:'wrap' }}>
              <button onClick={() => setStatusFilter('all')} style={{ ...S.btnSm(statusFilter==='all'?'purple':''), fontSize:'12px', padding:'5px 12px' }}>Wszystkie</button>
              {(STATUSES[segFilter]||[]).map(s => (
                <button key={s.key} onClick={() => setStatusFilter(s.key)}
                  style={{ padding:'5px 12px', borderRadius:'20px', fontSize:'11px', fontWeight:'500', cursor:'pointer', border:'1px solid', borderColor:statusFilter===s.key?s.color:'#e8e8e6', background:statusFilter===s.key?s.bg:'#fff', color:statusFilter===s.key?s.color:'#6b7280', ...F }}>
                  {s.label} <span style={{ marginLeft:'4px', fontWeight:'600' }}>{clients.filter(c=>c.segment===segFilter&&c.status===s.key).length}</span>
                </button>
              ))}
            </div>
          )}

          {/* TABLE */}
          <div style={S.card}>
            <div style={{ display:'grid', gridTemplateColumns:cols, padding:'9px 16px', borderBottom:'1px solid #e8e8e6', background:'#fafaf9', gap:'8px' }}>
              {headers.map(h => (
                <div key={h.key} onClick={() => handleSort(h.key)} style={S.th(h.key)}>{h.label}<SortIcon col={h.key} /></div>
              ))}
              <div style={{ fontSize:'10px', color:'#9ca3af', fontWeight:'500', textTransform:'uppercase' }}>Akcje</div>
            </div>
            {loading && <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af' }}>Ladowanie Pack Pack...</div>}
            {!loading && filtered.length === 0 && (
              <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>
                {clients.length===0 ? 'Brak klientow Pack Pack — dodaj pierwszego!' : 'Brak wynikow'}
              </div>
            )}
            {filtered.map((client, i) => {
              const seg = SEGMENTS[client.segment]
              const baseBg = i%2===0?'#fff':'#f7f7f5'
              return (
                <div key={client.id} onClick={() => openDetail(client)}
                  style={{ display:'grid', gridTemplateColumns:cols, padding:'10px 16px', borderBottom:'1px solid #f0f0ee', cursor:'pointer', background:baseBg, alignItems:'center', gap:'8px' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f5f3ff'}
                  onMouseLeave={e => e.currentTarget.style.background=baseBg}>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'500', color:'#111' }}>{client.company_name||client.contact_name}</div>
                    <div style={{ fontSize:'11px', color:'#9ca3af', marginTop:'1px' }}>{client.company_name?client.contact_name:''}{client.email?' · '+client.email:''}</div>
                    {client.is_vip && <span style={{ fontSize:'9px', background:'#fffbeb', color:'#92400e', border:'1px solid #fde68a', borderRadius:'4px', padding:'1px 5px', display:'inline-block', marginTop:'2px' }}>⭐ VIP</span>}
                  </div>
                  <div><span style={{ fontSize:'10px', fontWeight:'500', padding:'2px 6px', borderRadius:'5px', background:seg?.bg, color:seg?.color }}>{seg?.label}</span></div>
                  <div onClick={e => e.stopPropagation()}>
                    <select value={client.status} onChange={e => { e.stopPropagation(); changeStatus(client.id, e.target.value) }}
                      style={{ ...S.select, padding:'3px 6px', fontSize:'10px', width:'auto', background:statusMeta(client.segment,client.status).bg, color:statusMeta(client.segment,client.status).color, border:'1px solid '+statusMeta(client.segment,client.status).color+'40', borderRadius:'20px', appearance:'none', cursor:'pointer', fontWeight:'500' }}>
                      {(STATUSES[client.segment]||[]).map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                  <div style={{ fontSize:'12px', fontWeight:'500', color:client.ltv>0?'#065f46':'#9ca3af' }}>{client.ltv>0?`£${Number(client.ltv).toLocaleString()}`:'—'}</div>
                  <div style={{ fontSize:'12px', color:'#374151', fontWeight:'500' }}>{client.order_count||'—'}</div>
                  <div style={{ fontSize:'11px', color:'#6b7280' }}>{client.avg_order_value>0?`£${Math.round(client.avg_order_value)}`:'—'}</div>
                  <div style={{ minWidth:'70px' }}><HealthWithTrend client={client} /></div>
                  <div style={{ fontSize:'11px', color:'#9ca3af' }}>{fmtDate(client.last_contact_date)}</div>
                  <div style={{ display:'flex', gap:'4px' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(client)} style={S.btnSm()}>Edytuj</button>
                    <button onClick={() => handleDelete(client.id)} style={S.btnSm('red')}>Usun</button>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ padding:'8px 16px', fontSize:'12px', color:'#9ca3af', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Pack Pack: {filteredAll.length} klientów ({clients.length} łącznie)</span>
            {totalPages > 1 && (
              <div style={{ display:'flex', gap:'4px' }}>
                <button onClick={()=>setPage(0)} disabled={page===0} style={{ padding:'3px 8px', border:'1px solid #e8e8e6', borderRadius:'5px', background:'#fff', cursor:page===0?'default':'pointer', color:page===0?'#d1d5db':'#374151', fontSize:'11px', ...F }}>«</button>
                <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ padding:'3px 8px', border:'1px solid #e8e8e6', borderRadius:'5px', background:'#fff', cursor:page===0?'default':'pointer', color:page===0?'#d1d5db':'#374151', fontSize:'11px', ...F }}>‹</button>
                {Array.from({length:Math.min(5,totalPages)}, (_,i)=>{
                  const p = Math.max(0, Math.min(totalPages-5, page-2)) + i
                  return <button key={p} onClick={()=>setPage(p)} style={{ padding:'3px 8px', border:'1px solid', borderColor:p===page?'#6d28d9':'#e8e8e6', borderRadius:'5px', background:p===page?'#6d28d9':'#fff', color:p===page?'white':'#374151', fontSize:'11px', cursor:'pointer', ...F }}>{p+1}</button>
                })}
                <button onClick={()=>setPage(p=>Math.min(totalPages-1,p+1))} disabled={page===totalPages-1} style={{ padding:'3px 8px', border:'1px solid #e8e8e6', borderRadius:'5px', background:'#fff', cursor:page===totalPages-1?'default':'pointer', color:page===totalPages-1?'#d1d5db':'#374151', fontSize:'11px', ...F }}>›</button>
                <button onClick={()=>setPage(totalPages-1)} disabled={page===totalPages-1} style={{ padding:'3px 8px', border:'1px solid #e8e8e6', borderRadius:'5px', background:'#fff', cursor:page===totalPages-1?'default':'pointer', color:page===totalPages-1?'#d1d5db':'#374151', fontSize:'11px', ...F }}>»</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAIL PANEL */}
      {showDetail && selectedClient && (
        <div style={{ width:'380px', background:'#fff', borderLeft:'1px solid #e8e8e6', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#f5f3ff', color:'#6d28d9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'600', flexShrink:0 }}>
              {initials(selectedClient.contact_name)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#111' }}>{selectedClient.company_name||selectedClient.contact_name}</div>
              <div style={{ fontSize:'11px', color:'#9ca3af' }}>{selectedClient.company_name?selectedClient.contact_name:''}</div>
            </div>
            <button onClick={() => setShowDetail(false)} style={{ border:'none', background:'#f4f4f3', borderRadius:'5px', width:'24px', height:'24px', cursor:'pointer', color:'#9ca3af', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>

          <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e8e6', overflowY:'auto' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginBottom:'10px' }}>
              {[
                { label:'LTV', val:selectedClient.ltv>0?`£${Number(selectedClient.ltv).toLocaleString()}`:'—', color:'#065f46' },
                { label:'Zamówień', val:selectedClient.order_count||'—', color:'#1d4ed8' },
                { label:'AOV', val:selectedClient.avg_order_value>0?`£${Math.round(selectedClient.avg_order_value)}`:'—', color:'#6d28d9' },
                { label:'Email', val:selectedClient.email||'—', color:'#374151' },
                { label:'Telefon', val:selectedClient.phone||'—', color:'#374151' },
                { label:'Segment', val:SEGMENTS[selectedClient.segment]?.label||'—', color:'#6d28d9' },
              ].map(m => (
                <div key={m.label} style={{ padding:'7px 9px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee' }}>
                  <div style={{ fontSize:'9px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>{m.label}</div>
                  <div style={{ fontSize:'11px', fontWeight:'600', color:m.color, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.val}</div>
                </div>
              ))}
            </div>

            {selectedClient.health_score > 0 && (
              <div style={{ padding:'10px 12px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee', marginBottom:'8px' }}>
                <div style={{ fontSize:'9px', color:'#9ca3af', textTransform:'uppercase', marginBottom:'6px' }}>Health & Trend</div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ flex:1 }}><HealthBar score={selectedClient.health_score} /></div>
                  {(() => {
                    const trend = getTrend(selectedClient)
                    if (!trend) return null
                    return <div style={{ textAlign:'center' }}>
                      <span style={{ fontSize:'18px', fontWeight:'700', color:trend.color }}>{trend.arrow}</span>
                      <div style={{ fontSize:'9px', color:trend.color }}>{trend.label}</div>
                    </div>
                  })()}
                </div>
              </div>
            )}

            {selectedClient.notes && <div style={{ padding:'8px 10px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'7px', fontSize:'12px', color:'#374151', marginBottom:'8px' }}>{selectedClient.notes}</div>}

            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={() => openEdit(selectedClient)} style={{ ...S.btnPrimary, fontSize:'12px', padding:'6px 12px' }}>Edytuj</button>
              <button onClick={() => handleDelete(selectedClient.id)} style={{ ...S.btnSm('red'), fontSize:'12px', padding:'6px 12px' }}>Usun</button>
            </div>
          </div>

          <div style={{ display:'flex', borderBottom:'1px solid #e8e8e6', flexShrink:0 }}>
            {[{ key:'timeline', label:'Historia' },{ key:'tasks', label:`Zadania (${clientTasks.length})` }].map(tab => (
              <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                style={{ flex:1, padding:'9px', fontSize:'12px', fontWeight:'500', border:'none', background:'transparent', cursor:'pointer', color:detailTab===tab.key?'#6d28d9':'#9ca3af', borderBottom:detailTab===tab.key?'2px solid #6d28d9':'2px solid transparent', ...F }}>
                {tab.label}
              </button>
            ))}
          </div>

          {detailTab==='timeline' && (
            <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
              <div style={{ marginBottom:'12px', padding:'10px', background:'#fafaf9', border:'1px solid #e8e8e6', borderRadius:'9px' }}>
                <select value={noteType} onChange={e => setNoteType(e.target.value)} style={{ ...S.select, marginBottom:'7px', fontSize:'12px' }}>
                  <option value="note">📝 Notatka</option><option value="call">📞 Telefon</option><option value="email">✉️ Email</option>
                  <option value="meeting">🤝 Spotkanie</option><option value="quote">💰 Wycena</option><option value="order">📦 Zamowienie</option><option value="complaint">⚠️ Reklamacja</option>
                </select>
                <div style={{ display:'flex', gap:'6px' }}>
                  <input value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key==='Enter'&&addNote()} placeholder="Dodaj notatke... (Enter)" style={{ ...S.input, flex:1, fontSize:'12px' }} />
                  <button onClick={addNote} disabled={savingNote||!newNote.trim()} style={{ ...S.btnPrimary, fontSize:'12px', padding:'8px 12px', opacity:(!newNote.trim()||savingNote)?0.4:1 }}>+</button>
                </div>
              </div>
              {interactions.map(item => (
                <div key={item.id} style={{ marginBottom:'10px', display:'flex', gap:'8px' }}>
                  <div style={{ fontSize:'16px', flexShrink:0, marginTop:'2px' }}>{interactionIcon[item.type]||'📝'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>{item.author?.full_name} · {fmtDT(item.created_at)}</div>
                    <div style={{ fontSize:'12px', color:'#111', lineHeight:'1.5', padding:'7px 10px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee' }}>{item.content}</div>
                  </div>
                </div>
              ))}
              {interactions.length===0 && <div style={{ fontSize:'12px', color:'#9ca3af', textAlign:'center', marginTop:'20px' }}>Brak historii</div>}
            </div>
          )}

          {detailTab==='tasks' && (
            <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
              {clientTasks.length===0&&<div style={{ textAlign:'center', color:'#9ca3af', fontSize:'12px', marginTop:'20px' }}>Brak zadan</div>}
              {clientTasks.map(task => {
                const sColors={open:'#1d4ed8',inprogress:'#92400e',waiting:'#6d28d9',done:'#065f46',urgent:'#dc2626'}
                const sBg={open:'#eff6ff',inprogress:'#fffbeb',waiting:'#f5f3ff',done:'#ecfdf5',urgent:'#fef2f2'}
                const sLabel={open:'Otwarte',inprogress:'W trakcie',waiting:'Oczekuje',done:'Zamkniete',urgent:'Pilne'}
                return (
                  <div key={task.id} style={{ marginBottom:'8px', padding:'9px 12px', background:'#fafaf9', border:'1px solid #f0f0ee', borderRadius:'8px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'12px', fontWeight:'500', color:'#111', marginBottom:'2px' }}>{task.product_name}</div>
                        <div style={{ fontSize:'10px', color:'#9ca3af' }}>{task.order_number&&<span style={{ color:'#7c3aed', fontWeight:'500', marginRight:'6px' }}>{task.order_number}</span>}{task.client_name}</div>
                      </div>
                      <span style={{ fontSize:'10px', fontWeight:'500', padding:'2px 7px', borderRadius:'10px', background:sBg[task.status]||'#f3f4f6', color:sColors[task.status]||'#374151', flexShrink:0 }}>{sLabel[task.status]||task.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* NEW/EDIT MODAL */}
      {showModal && (
        <div style={S.overlay}>
          <div style={S.modal('520px')}>
            <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <span style={{ fontSize:'15px', fontWeight:'600' }}>{editingClient?'Edytuj klienta PP':'Nowy klient Pack Pack'}</span>
                <span style={{ marginLeft:'8px', fontSize:'11px', background:'#f5f3ff', color:'#6d28d9', border:'1px solid #c4b5fd', padding:'2px 7px', borderRadius:'10px' }}>Pack Pack only</span>
              </div>
              <button onClick={() => setShowModal(false)} style={{ border:'none', background:'none', fontSize:'20px', cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
                {Object.entries(SEGMENTS).map(([k,v]) => (
                  <button key={k} onClick={() => setForm(f => ({ ...f, segment:k, status:STATUSES[k][0].key }))}
                    style={{ flex:1, padding:'8px', borderRadius:'8px', border:'2px solid', borderColor:form.segment===k?v.color:'#e8e8e6', background:form.segment===k?v.bg:'#fafaf9', color:form.segment===k?v.color:'#6b7280', fontSize:'12px', fontWeight:'500', cursor:'pointer', ...F }}>
                    {v.label}
                  </button>
                ))}
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Nazwa firmy</label><input value={form.company_name} onChange={e=>setForm(f=>({...f,company_name:e.target.value}))} placeholder="ABC Sp. z o.o." style={S.input}/></div>
                <div><label style={S.label}>Osoba kontaktowa *</label><input value={form.contact_name} onChange={e=>setForm(f=>({...f,contact_name:e.target.value}))} placeholder="Imie Nazwisko" style={S.input}/></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Email</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@firma.pl" style={S.input}/></div>
                <div><label style={S.label}>Telefon</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+48 ..." style={S.input}/></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={S.select}>
                    {(STATUSES[form.segment]||[]).map(s=><option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Zrodlo</label>
                  <select value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} style={S.select}>
                    {SOURCES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Przypisz do</label>
                  <select value={form.assigned_to} onChange={e=>setForm(f=>({...f,assigned_to:e.target.value}))} style={S.select}>
                    <option value="">— Nieprzypisane —</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>LTV (PLN)</label><input type="number" value={form.ltv} onChange={e=>setForm(f=>({...f,ltv:e.target.value}))} placeholder="0" style={S.input}/></div>
              </div>
              <div style={{ marginBottom:'12px' }}>
                <label style={S.label}>Notatka</label>
                <textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Dodatkowe informacje..." style={{ ...S.input, height:'60px', resize:'vertical' }}/>
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
              <button onClick={handleSave} disabled={saving||!form.contact_name.trim()} style={{ ...S.btnPrimary, opacity:saving||!form.contact_name.trim()?0.6:1 }}>
                {saving?'Zapisywanie...':editingClient?'Zapisz zmiany':'Dodaj do Pack Pack'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
