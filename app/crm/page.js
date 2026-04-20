'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

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

  // Filters
  const [segFilter, setSegFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Modals
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [noteType, setNoteType] = useState('note')
  const [savingNote, setSavingNote] = useState(false)

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
    await loadInteractions(client.id)
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
      {/* TOPBAR */}
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
          <button onClick={openNew} style={S.btnPrimary}>+ Nowy klient</button>
        </div>

        <div style={S.content}>
          {/* STATS */}
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

          {/* STATUS FILTER BAR */}
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

          {/* TABLE */}
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
        </div>
      </div>

      {/* DETAIL PANEL */}
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

          {/* TIMELINE */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
            <div style={{ fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:'500', marginBottom:'10px' }}>Historia interakcji</div>

            {/* Add note */}
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
                  <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>
                    {item.author?.full_name} · {fmtDT(item.created_at)}
                  </div>
                  <div style={{ fontSize:'12px', color:'#111', lineHeight:'1.5', padding:'7px 10px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee' }}>
                    {item.content}
                  </div>
                </div>
              </div>
            ))}
            {interactions.length === 0 && <div style={{ fontSize:'12px', color:'#9ca3af', textAlign:'center', marginTop:'20px' }}>Brak historii — dodaj pierwsza notatke</div>}
          </div>
        </div>
      )}

      {/* NEW/EDIT MODAL */}
      {showModal && (
        <div style={S.overlay}>
          <div style={S.modal('560px')}>
            <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'15px', fontWeight:'600', letterSpacing:'-0.2px' }}>{editingClient ? 'Edytuj klienta' : 'Nowy klient'}</span>
              <button onClick={() => setShowModal(false)} style={{ border:'none', background:'none', fontSize:'20px', cursor:'pointer', color:'#9ca3af', lineHeight:'1' }}>×</button>
            </div>
            <div style={{ padding:'18px 20px' }}>
              {/* Segment selector */}
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
    </div>
  )
}
