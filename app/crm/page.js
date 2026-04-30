'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
const ADMIN_ID = 'd53f6727-6bc7-4602-9ce0-4fc31ab3aba1'
const F = { fontFamily:"'DM Sans',-apple-system,sans-serif" }
const SEGMENTS = {
  b2b:     { label:'B2B', labelFull:'Jamo B2B', color:'#1d4ed8', bg:'#eff6ff' },
  b2c:     { label:'B2C', labelFull:'Healthy Future B2C', color:'#065f46', bg:'#ecfdf5' },
  giftbox: { label:'Zadruk', labelFull:'Zadruk / Short Run', color:'#6d28d9', bg:'#f5f3ff' },
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

function statusMeta(segment, key) {
  return STATUSES[segment]?.find(s => s.key === key) || { label: key, color:'#374151', bg:'#f3f4f6' }
}

function Pill({ segment, statusKey, lang }) {
  const m = statusMeta(segment, statusKey)
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'2px 9px', borderRadius:'20px', fontSize:'11px', fontWeight:'500', background:m.bg, color:m.color }}>
      {lang==='pl' ? m.label : m.labelEn}
    </span>
  )
}

function HealthBar({ score }) {
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#dc2626'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
      <div style={{ flex:1, height:'5px', background:'#f0f0ee', borderRadius:'3px', overflow:'hidden' }}>
        <div style={{ width:`${score}%`, height:'100%', background:color, borderRadius:'3px', transition:'width 0.3s' }}></div>
      </div>
      <span style={{ fontSize:'10px', fontWeight:'600', color, minWidth:'24px' }}>{score}</span>
    </div>
  )
}

// TREND — porównuje days_since_last_order vs avg_days_between_orders
// Jeśli zamawia szybciej niż średnia → rośnie ↑
// Jeśli wolniej niż średnia → spada ↓
// Brak danych → neutralny →
function getTrend(client) {
  const avg = client.avg_days_between_orders
  const daysSince = client.days_since_last_order
  const orderCount = client.order_count || 0

  if (!avg || !daysSince || orderCount < 2) return null

  const ratio = daysSince / avg

  if (ratio <= 0.8) return { dir: 'up', label: 'Rośnie', color: '#16a34a', bg: '#f0fdf4', arrow: '↑' }
  if (ratio >= 1.3) return { dir: 'down', label: 'Spada', color: '#dc2626', bg: '#fef2f2', arrow: '↓' }
  return { dir: 'stable', label: 'Stabilny', color: '#f59e0b', bg: '#fffbeb', arrow: '→' }
}

function TrendBadge({ client }) {
  const trend = getTrend(client)
  if (!trend) return <span style={{ fontSize:'10px', color:'#d1d5db' }}>—</span>
  return (
    <span title={`${trend.label} · Śr. co ${Math.round(client.avg_days_between_orders)}d · Ostatnio ${client.days_since_last_order}d temu`}
      style={{ display:'inline-flex', alignItems:'center', gap:'2px', padding:'2px 6px', borderRadius:'20px', fontSize:'11px', fontWeight:'600', background:trend.bg, color:trend.color, cursor:'default' }}>
      {trend.arrow}
    </span>
  )
}

function HealthWithTrend({ client }) {
  const score = client.health_score || 0
  const trend = getTrend(client)
  if (score === 0) return <span style={{ fontSize:'11px', color:'#d1d5db' }}>—</span>
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#dc2626'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
        <div style={{ flex:1, height:'5px', background:'#f0f0ee', borderRadius:'3px', overflow:'hidden' }}>
          <div style={{ width:`${score}%`, height:'100%', background:color, borderRadius:'3px' }}></div>
        </div>
        <span style={{ fontSize:'10px', fontWeight:'600', color, minWidth:'20px' }}>{score}</span>
        {trend && (
          <span title={`${trend.label} · Śr. co ${Math.round(client.avg_days_between_orders)}d · Ostatnio ${client.days_since_last_order}d temu`}
            style={{ fontSize:'11px', fontWeight:'700', color:trend.color, cursor:'default' }}>
            {trend.arrow}
          </span>
        )}
      </div>
    </div>
  )
}

const emptyForm = {
  company_name:'', contact_name:'', email:'', phone:'', whatsapp:'',
  segment:'b2b', status:'lead', source:'google', marketplace:'', notes:'',
  assigned_to:'', ltv:'', last_order_date:'', workspace:'jamo_healthy', is_vip:false, is_problematic:false
}

function AIAssistant({ clients, onFilterResults, lang }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: '👋 Cześć! Jestem Twoim asystentem CRM.\n\nPrzykłady:\n• "Pokaż klientów którzy nie zamawiali od 3 miesięcy"\n• "Kto ma najwyższe LTV?"\n• "Znajdź klientów z ryzykiem odejścia"\n• "Którzy klienci zamówili tylko raz?"\n• "Pokaż VIP-ów B2B"\n• "Klienci z health score powyżej 70"'
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  const now = new Date()

  function buildClientSummary(clients) {
    const today = new Date()
    const sorted = [...clients].sort((a, b) => new Date(b.last_order_date || 0) - new Date(a.last_order_date || 0))
    return sorted.slice(0, 500).map(c => ({
      id: c.id,
      name: c.company_name || c.contact_name,
      segment: c.segment,
      status: c.status,
      ltv: c.ltv || 0,
      days_since_last_order: c.last_order_date ? Math.floor((today - new Date(c.last_order_date)) / 86400000) : 999,
      order_count: c.order_count || 1,
      avg_order_value: c.avg_order_value || 0,
      health_score: c.health_score || 0,
      customer_age_days: c.customer_age_days || 0,
      repeat_customer: c.repeat_customer || false,
      is_vip: c.is_vip,
      top_product: c.top_products?.[0]?.name?.substring(0, 40) || null,
      trend: getTrend(c)?.dir || null,
    }))
  }

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    try {
      const clientSummary = buildClientSummary(clients)
      const stats = {
        total: clients.length,
        b2b: clients.filter(c => c.segment === 'b2b').length,
        b2c: clients.filter(c => c.segment === 'b2c').length,
        vip: clients.filter(c => c.is_vip).length,
        active: clientSummary.filter(c => c.days_since_last_order <= 90).length,
        at_risk: clientSummary.filter(c => c.days_since_last_order > 90 && c.days_since_last_order <= 180).length,
        churned: clientSummary.filter(c => c.days_since_last_order > 180).length,
        avg_health: Math.round(clients.reduce((a, c) => a + (c.health_score || 0), 0) / clients.length),
        avg_ltv: Math.round(clients.reduce((a, c) => a + (c.ltv || 0), 0) / clients.length),
        trend_up: clientSummary.filter(c => c.trend === 'up').length,
        trend_down: clientSummary.filter(c => c.trend === 'down').length,
      }
      const systemPrompt = `Jesteś asystentem CRM dla Jamo Packaging Solutions (UK).
STATYSTYKI: ${stats.total} klientów, B2B:${stats.b2b}, B2C:${stats.b2c}, VIP:${stats.vip}, Aktywni:${stats.active}, At risk:${stats.at_risk}, Churned:${stats.churned}, Avg health:${stats.avg_health}, Avg LTV:£${stats.avg_ltv}, Trend rosnacy:${stats.trend_up}, Trend spadkowy:${stats.trend_down}
DANE KLIENTÓW (500 najnowszych wg ostatniego zamówienia): ${JSON.stringify(clientSummary, null, 0)}
ZASADY:
1. Odpowiadaj po polsku, konkretnie
2. Dzisiejsza data: ${now.toISOString().split('T')[0]}
3. Trend: up=zamawia szybciej niz srednia, down=wolniej, stable=normalnie
4. Jesli pytanie wymaga pokazania konkretnych klientow, dodaj NA SAMYM KONCU odpowiedzi TYLKO te linie (nic wiecej po niej):
FILTER_IDS:["id1","id2"]
5. ABSOLUTNIE ZAKAZ uzywania tagow XML, FILTER_RESULT, ani zadnych innych tagow
6. Segmenty: Active<=90dni, AtRisk=90-180dni, Churned>180dni`

      const response = await fetch('/api/ai-crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: [
            ...messages.filter((m, i) => i > 0).slice(-4),
            { role: 'user', content: userMsg }
          ]
        })
      })
      const data = await response.json()
      const aiText = data.content?.[0]?.text || 'Przepraszam, blad zapytania.'
      const lastFilterIdx = aiText.lastIndexOf('FILTER_IDS:[')
      let cleanText = aiText
      let filterIds = null
      if (lastFilterIdx !== -1) {
        const beforeFilter = aiText.substring(0, lastFilterIdx).trim()
        const filterPart = aiText.substring(lastFilterIdx)
        const arrEnd = filterPart.indexOf(']')
        if (arrEnd !== -1) {
          try { filterIds = JSON.parse(filterPart.substring('FILTER_IDS:'.length, arrEnd + 1)) } catch(e) {}
        }
        cleanText = beforeFilter
      }
      cleanText = cleanText.replace(/<FILTER_RESULT[\s\S]*$/g, '').replace(/FILTER_IDS:\[[\s\S]*?\]/g, '').trim()
      if (filterIds && filterIds.length > 0) {
        onFilterResults(filterIds, userMsg)
        cleanText += `\n\n✅ Pokazuję ${filterIds.length} klientów w tabeli poniżej.`
      }
      setMessages(prev => [...prev, { role: 'assistant', content: cleanText }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Błąd: ${err.message}` }])
    }
    setLoading(false)
  }

  const suggestions = ['Kto nie zamawiał od 3 miesięcy?','Pokaż VIP-ów B2B','Klienci z trendem rosnącym','Kto powinien wkrótce zamówić?','Top 10 LTV','Jednorazowi klienci B2B']

  return (
    <div style={{ marginBottom:'14px' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ display:'flex', alignItems:'center', gap:'8px', width:'100%', padding:'12px 16px', background: open ? '#111' : '#fff', border:`1px solid ${open ? '#111' : '#e8e8e6'}`, borderRadius:'10px', cursor:'pointer', ...F }}>
        <span style={{ fontSize:'16px' }}>🤖</span>
        <div style={{ textAlign:'left', flex:1 }}>
          <div style={{ fontSize:'13px', fontWeight:'600', color: open ? 'white' : '#111' }}>AI Asystent CRM</div>
          <div style={{ fontSize:'11px', color: open ? '#9ca3af' : '#6b7280' }}>Zapytaj o klientów w języku naturalnym</div>
        </div>
        <span style={{ fontSize:'12px', color: open ? 'white' : '#9ca3af' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderTop:'none', borderRadius:'0 0 10px 10px', overflow:'hidden' }}>
          <div style={{ height:'260px', overflowY:'auto', padding:'14px', display:'flex', flexDirection:'column', gap:'8px', background:'#fafaf9' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display:'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth:'85%', padding:'9px 13px', borderRadius:'12px', fontSize:'13px', lineHeight:'1.6', background: msg.role === 'user' ? '#111' : '#fff', color: msg.role === 'user' ? 'white' : '#111', border: msg.role === 'user' ? 'none' : '1px solid #e8e8e6', whiteSpace:'pre-wrap' }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex' }}>
                <div style={{ padding:'9px 13px', borderRadius:'12px', background:'#fff', border:'1px solid #e8e8e6', display:'flex', gap:'4px', alignItems:'center' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#9ca3af', animation:`bounce 1s ${i*0.2}s infinite` }}></div>)}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding:'8px 14px', borderTop:'1px solid #f0f0ee', display:'flex', gap:'5px', flexWrap:'wrap' }}>
            {suggestions.map(s => (
              <button key={s} onClick={() => setInput(s)} style={{ padding:'3px 9px', background:'#f4f4f3', border:'1px solid #e8e8e6', borderRadius:'20px', fontSize:'11px', cursor:'pointer', color:'#374151', ...F }}>{s}</button>
            ))}
          </div>
          <div style={{ padding:'10px 14px', borderTop:'1px solid #f0f0ee', display:'flex', gap:'8px' }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Zapytaj o klientów... (Enter)" style={{ flex:1, padding:'8px 12px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', outline:'none', ...F }} />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              style={{ padding:'8px 14px', background: loading || !input.trim() ? '#9ca3af' : '#111', color:'white', border:'none', borderRadius:'8px', cursor: loading || !input.trim() ? 'default' : 'pointer', fontSize:'13px', fontWeight:'500', ...F }}>Wyślij</button>
            <button onClick={() => { onFilterResults(null, ''); setMessages([messages[0]]) }}
              style={{ padding:'8px 11px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'8px', cursor:'pointer', fontSize:'12px', ...F }}>Reset</button>
          </div>
        </div>
      )}
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  )
}

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
  const [aiFilterIds, setAiFilterIds] = useState(null)
  const [aiFilterLabel, setAiFilterLabel] = useState('')
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
  const [blSyncing, setBlSyncing] = useState(false)
  const [blResult, setBlResult] = useState(null)
  const [blDays, setBlDays] = useState(30)
  const [detailTab, setDetailTab] = useState('timeline')
  const [clientTasks, setClientTasks] = useState([])
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 200
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
      .limit(10000)
    setClients(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadClients() }, [loadClients])

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  function SortIcon({ col }) {
    if (sortKey !== col) return <span style={{ color:'#d1d5db', marginLeft:'3px' }}>↕</span>
    return <span style={{ color:'#2563eb', marginLeft:'3px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  async function loadInteractions(clientId) {
    const { data } = await supabase.from('client_interactions').select('*, author:profiles!created_by(full_name)').eq('client_id', clientId).order('created_at', { ascending: false })
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

  async function createTaskForClient() {
    if (!selectedClient) return
    router.push('/dashboard?client_id=' + selectedClient.id + '&client_name=' + encodeURIComponent(selectedClient.company_name || selectedClient.contact_name))
  }

  function openNew() { setEditingClient(null); setForm({ ...emptyForm, assigned_to: user?.id || '' }); setShowModal(true) }

  function openEdit(client) {
    setEditingClient(client)
    setForm({ company_name:client.company_name||'', contact_name:client.contact_name||'', email:client.email||'', phone:client.phone||'', whatsapp:client.whatsapp||'', segment:client.segment||'b2b', status:client.status||'lead', source:client.source||'google', marketplace:client.marketplace||'', notes:client.notes||'', assigned_to:client.assigned_to||'', ltv:client.ltv||'', last_order_date:client.last_order_date||'', workspace:client.workspace||'jamo_healthy', is_vip:client.is_vip||false, is_problematic:client.is_problematic||false })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.contact_name.trim()) return
    setSaving(true)
    const payload = { ...form, ltv:form.ltv?parseFloat(form.ltv):0, last_order_date:form.last_order_date||null, assigned_to:form.assigned_to||null, last_contact_date:new Date().toISOString().split('T')[0] }
    if (editingClient) {
      await supabase.from('clients').update(payload).eq('id', editingClient.id)
    } else {
      const { data: newClient } = await supabase.from('clients').insert({ ...payload, created_by:user.id }).select().single()
      if (newClient) await supabase.from('client_interactions').insert({ client_id:newClient.id, type:'note', content:`Klient dodany do CRM. Zrodlo: ${form.source}`, created_by:user.id })
    }
    setSaving(false); setShowModal(false); loadClients()
  }

  async function handleDelete(id) {
    if (!confirm('Usunac tego klienta? Tej operacji nie mozna cofnac.')) return
    await supabase.from('clients').delete().eq('id', id)
    setShowDetail(false); loadClients()
  }

  async function addNote() {
    if (!newNote.trim() || !selectedClient) return
    setSavingNote(true)
    await supabase.from('client_interactions').insert({ client_id:selectedClient.id, type:noteType, content:newNote.trim(), created_by:user.id })
    await supabase.from('clients').update({ last_contact_date:new Date().toISOString().split('T')[0] }).eq('id', selectedClient.id)
    setNewNote(''); await loadInteractions(selectedClient.id); loadClients(); setSavingNote(false)
  }

  async function changeStatus(clientId, status) {
    await supabase.from('clients').update({ status }).eq('id', clientId)
    loadClients()
    if (selectedClient?.id === clientId) setSelectedClient(prev => ({ ...prev, status }))
  }

  async function syncBaseLinker() {
    setBlSyncing(true); setBlResult(null)
    try {
      const res = await fetch('/api/baselinker', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ days_back:blDays }) })
      const data = await res.json(); setBlResult(data); if (data.success) loadClients()
    } catch (e) { setBlResult({ error:e.message }) }
    setBlSyncing(false)
  }

  async function resetAndSync() {
    if (resetConfirmText !== 'RESET') return
    setResetting(true); setBlResult(null); setShowResetModal(false); setResetConfirmText('')
    try {
      const res = await fetch('/api/baselinker', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ days_back:blDays, reset:true }) })
      const data = await res.json(); setBlResult({ ...data, reset_performed:true }); if (data.success) loadClients()
    } catch (e) { setBlResult({ error:e.message }) }
    setResetting(false)
  }

  async function autoFlagInactive() {
    const toFlag = clients.filter(c => c.segment==='b2b' && c.status==='active' && daysSince(c.last_contact_date)>=90)
    for (const c of toFlag) await supabase.from('clients').update({ status:'inactive' }).eq('id', c.id)
    if (toFlag.length > 0) loadClients()
  }

  function handleAIFilter(ids, label) {
    setAiFilterIds(ids); setAiFilterLabel(label); setPage(0)
    if (ids) { setSegFilter('all'); setStatusFilter('all'); setSearch('') }
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
      case 'last_order_date': return c.last_order_date || ''
      case 'status': return c.status || ''
      case 'segment': return c.segment || ''
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
  const counts = { all:clients.length, b2b:clients.filter(c=>c.segment==='b2b').length, b2c:clients.filter(c=>c.segment==='b2c').length, giftbox:clients.filter(c=>c.segment==='giftbox').length, vip:clients.filter(c=>c.is_vip).length }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pl-PL') : '—'
  const fmtDT = (d) => d ? new Date(d).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''
  const initials = (n) => (n||'?').split(' ').map(x=>x[0]).join('').toUpperCase().substring(0,2)
  const interactionIcon = { note:'📝', call:'📞', email:'✉️', meeting:'🤝', order:'📦', complaint:'⚠️', quote:'💰' }

  const alerts = clients.filter(c => {
    if (c.segment!=='b2b'&&c.segment!=='giftbox') return false
    if (c.status==='lost'||c.status==='done') return false
    const days = daysSince(c.last_contact_date)
    return (c.status==='active'&&days>=90)||(c.status==='quote'&&days>=7)||(c.status==='sample'&&days>=10)||(c.status==='contact'&&days>=5)||(c.status==='lead'&&days>=3)
  }).map(c => {
    const days = daysSince(c.last_contact_date)
    const messages = { active:`Brak kontaktu od ${days} dni`, quote:`Wycena bez odpowiedzi ${days} dni`, sample:`Probka ${days} dni temu`, contact:`W kontakcie ${days} dni`, lead:`Lead bez kontaktu ${days} dni` }
    return { client:c, message:messages[c.status]||`Brak kontaktu ${days} dni`, days, urgent:days>=90||(c.status==='quote'&&days>=14) }
  }).sort((a,b)=>b.days-a.days)

  const S = {
    page: { display:'flex', height:'100vh', ...F, fontSize:'14px', background:'#f5f5f3' },
    topbar: { background:'#fff', borderBottom:'1px solid #e8e8e6', padding:'0 24px', height:'56px', display:'flex', alignItems:'center', gap:'12px', flexShrink:0 },
    content: { flex:1, overflow:'auto', padding:'20px 24px' },
    card: { background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', overflow:'hidden' },
    th: (col) => ({ fontSize:'10px', color:sortKey===col?'#2563eb':'#9ca3af', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.06em', cursor:'pointer', userSelect:'none', display:'flex', alignItems:'center' }),
    input: { width:'100%', padding:'8px 11px', border:'1px solid #e8e8e6', borderRadius:'7px', fontSize:'13px', outline:'none', ...F, color:'#111', background:'#fff' },
    select: { width:'100%', padding:'8px 11px', border:'1px solid #e8e8e6', borderRadius:'7px', fontSize:'13px', outline:'none', ...F, color:'#111', background:'#fff' },
    btnPrimary: { background:'#111', color:'white', border:'none', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', fontWeight:'500', cursor:'pointer', ...F },
    btnSm: (v) => ({ padding:'4px 9px', fontSize:'11px', borderRadius:'6px', cursor:'pointer', ...F, fontWeight:'500', border:v==='red'?'1px solid #fecaca':v==='green'?'1px solid #bbf7d0':v==='blue'?'1px solid #bfdbfe':'1px solid #e8e8e6', background:v==='red'?'#fef2f2':v==='green'?'#f0fdf4':v==='blue'?'#eff6ff':'#fff', color:v==='red'?'#dc2626':v==='green'?'#16a34a':v==='blue'?'#1d4ed8':'#374151' }),
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 },
    modal: (w) => ({ background:'#fff', borderRadius:'14px', width:w||'520px', maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', border:'1px solid #e8e8e6' }),
    label: { display:'block', fontSize:'12px', fontWeight:'500', marginBottom:'4px', color:'#374151' },
    grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' },
  }

  const cols = '1fr 70px 100px 90px 70px 70px 90px 110px'
  const headers = [
    { key:'name', label:'Klient' },{ key:'segment', label:'Seg.' },{ key:'status', label:'Status' },
    { key:'ltv', label:'LTV' },{ key:'order_count', label:'Zam.' },{ key:'avg_order_value', label:'AOV' },
    { key:'health_score', label:'Health / Trend' },{ key:'last_contact_date', label:'Ost. kontakt' },
  ]

  return (
    <div style={S.page}>
      <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
        <div style={S.topbar}>
          <button onClick={() => router.push('/dashboard')} style={{ border:'none', background:'none', cursor:'pointer', color:'#9ca3af', fontSize:'20px', lineHeight:'1', padding:'0' }}>←</button>
          <span style={{ fontSize:'15px', fontWeight:'600', letterSpacing:'-0.3px', color:'#111', flex:1 }}>CRM</span>
          <div style={{ display:'flex', gap:'6px' }}>
            {Object.entries(SEGMENTS).map(([k,v]) => (
              <button key={k} onClick={() => { setSegFilter(k); setStatusFilter('all'); setAiFilterIds(null); setPage(0) }}
                style={{ padding:'5px 12px', borderRadius:'7px', fontSize:'12px', fontWeight:'500', cursor:'pointer', border:'1px solid', borderColor:segFilter===k&&!aiFilterIds?v.color:'#e8e8e6', background:segFilter===k&&!aiFilterIds?v.bg:'#fff', color:segFilter===k&&!aiFilterIds?v.color:'#6b7280', ...F }}>
                {v.label} <span style={{ marginLeft:'4px', fontWeight:'600' }}>{counts[k]}</span>
              </button>
            ))}
            <button onClick={() => { setSegFilter('all'); setAiFilterIds(null); setPage(0) }}
              style={{ padding:'5px 12px', borderRadius:'7px', fontSize:'12px', fontWeight:'500', cursor:'pointer', border:'1px solid', borderColor:segFilter==='all'&&!aiFilterIds?'#111':'#e8e8e6', background:segFilter==='all'&&!aiFilterIds?'#111':'#fff', color:segFilter==='all'&&!aiFilterIds?'white':'#6b7280', ...F }}>
              Wszyscy <span style={{ marginLeft:'4px' }}>{counts.all}</span>
            </button>
          </div>
          <input value={search} onChange={e => { setSearch(e.target.value); setAiFilterIds(null); setPage(0) }} placeholder="Szukaj klienta..." style={{ ...S.input, width:'200px' }} />
          <button onClick={openNew} style={S.btnPrimary}>+ Nowy klient</button>
        </div>

        <div style={S.content}>
          {/* STATS BOXES */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px', marginBottom:'16px' }}>
            {[
              {label:'Wszyscy',val:counts.all,color:'#111',action:()=>{setSegFilter('all');setAiFilterIds(null);setPage(0)}},
              {label:'Jamo B2B',val:counts.b2b,color:'#1d4ed8',action:()=>{setSegFilter('b2b');setStatusFilter('all');setAiFilterIds(null);setPage(0)}},
              {label:'Healthy Future',val:counts.b2c,color:'#065f46',action:()=>{setSegFilter('b2c');setStatusFilter('all');setAiFilterIds(null);setPage(0)}},
              {label:'Zadruk',val:counts.giftbox,color:'#6d28d9',action:()=>{setSegFilter('giftbox');setStatusFilter('all');setAiFilterIds(null);setPage(0)}},
              {label:'VIP',val:counts.vip,color:'#92400e',action:()=>handleAIFilter(clients.filter(c=>c.is_vip).map(c=>c.id),'VIP')},
            ].map(s => (
              <div key={s.label} onClick={s.action} style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', padding:'12px 16px', cursor:'pointer' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=s.color;e.currentTarget.style.background='#fafaf9'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='#e8e8e6';e.currentTarget.style.background='#fff'}}>
                <div style={{ fontSize:'10px', color:'#9ca3af', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>{s.label}</div>
                <div style={{ fontSize:'24px', fontWeight:'600', color:s.color, letterSpacing:'-0.5px' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* TREND LEGENDA */}
          <div style={{ display:'flex', gap:'12px', marginBottom:'12px', padding:'8px 14px', background:'#fff', border:'1px solid #e8e8e6', borderRadius:'8px', alignItems:'center' }}>
            <span style={{ fontSize:'11px', color:'#9ca3af', fontWeight:'500' }}>Trend zamówień:</span>
            {[{arrow:'↑',color:'#16a34a',bg:'#f0fdf4',label:'Rośnie (zamawia szybciej niż średnia)'},{arrow:'→',color:'#f59e0b',bg:'#fffbeb',label:'Stabilny'},{arrow:'↓',color:'#dc2626',bg:'#fef2f2',label:'Spada (zamawia wolniej niż średnia)'}].map(t => (
              <span key={t.arrow} style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:'#6b7280' }}>
                <span style={{ padding:'1px 6px', borderRadius:'20px', background:t.bg, color:t.color, fontWeight:'700', fontSize:'12px' }}>{t.arrow}</span>
                {t.label}
              </span>
            ))}
          </div>

          <AIAssistant clients={clients} onFilterResults={handleAIFilter} lang={lang} />

          {aiFilterIds && (
            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'8px', padding:'9px 14px', marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span>🤖</span>
              <span style={{ fontSize:'13px', color:'#1d4ed8', fontWeight:'500', flex:1 }}>AI filtr aktywny — {filtered.length} klientów</span>
              <button onClick={() => { setAiFilterIds(null); setAiFilterLabel('') }} style={{ fontSize:'11px', padding:'3px 10px', background:'#1d4ed8', color:'white', border:'none', borderRadius:'5px', cursor:'pointer', ...F }}>Resetuj filtr</button>
            </div>
          )}

          {alerts.length > 0 && showAlerts && !aiFilterIds && (
            <div style={{ background:'#fff', border:'1px solid #fde68a', borderRadius:'10px', marginBottom:'12px', overflow:'hidden' }}>
              <div style={{ padding:'9px 14px', background:'#fffbeb', borderBottom:'1px solid #fde68a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'13px', fontWeight:'600', color:'#92400e' }}>⚠️ {alerts.length} klientow wymaga uwagi</span>
                <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                  <button onClick={autoFlagInactive} style={{ fontSize:'11px', padding:'3px 10px', background:'#92400e', color:'white', border:'none', borderRadius:'5px', cursor:'pointer', ...F }}>Auto-oznacz nieaktywnych</button>
                  <button onClick={() => setShowAlerts(false)} style={{ fontSize:'16px', background:'none', border:'none', cursor:'pointer', color:'#9ca3af' }}>×</button>
                </div>
              </div>
              <div style={{ maxHeight:'160px', overflowY:'auto' }}>
                {alerts.slice(0,6).map(({ client:c, message, urgent }) => (
                  <div key={c.id} onClick={() => openDetail(c)}
                    style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 14px', borderBottom:'1px solid #fef9c3', cursor:'pointer', background:urgent?'#fef2f2':'#fff' }}
                    onMouseEnter={e => e.currentTarget.style.background=urgent?'#fee2e2':'#fefce8'}
                    onMouseLeave={e => e.currentTarget.style.background=urgent?'#fef2f2':'#fff'}>
                    <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:urgent?'#fef2f2':'#fffbeb', color:urgent?'#dc2626':'#92400e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'600', flexShrink:0 }}>
                      {(c.company_name||c.contact_name||'?').substring(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12px', fontWeight:'500', color:'#111' }}>{c.company_name||c.contact_name}</div>
                      <div style={{ fontSize:'11px', color:urgent?'#dc2626':'#92400e' }}>{message}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BASELINKER SYNC */}
          <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', padding:'10px 16px', marginBottom:'12px', display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontSize:'16px' }}>🔗</span>
              <div>
                <div style={{ fontSize:'13px', fontWeight:'600', color:'#111' }}>BaseLinker Sync</div>
                <div style={{ fontSize:'11px', color:'#9ca3af' }}>Auto-import raz dziennie</div>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginLeft:'auto' }}>
              <select value={blDays} onChange={e => setBlDays(Number(e.target.value))} style={{ padding:'6px 10px', border:'1px solid #e8e8e6', borderRadius:'7px', fontSize:'12px', outline:'none', ...F }}>
                <option value={7}>7 dni</option><option value={30}>30 dni</option><option value={90}>90 dni</option><option value={365}>Rok</option>
              </select>
              <button onClick={syncBaseLinker} disabled={blSyncing||resetting} style={{ padding:'7px 14px', background:blSyncing?'#6b7280':'#111', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:blSyncing?'default':'pointer', ...F }}>
                {blSyncing?'⏳ Synchronizuje...':'↻ Synchronizuj'}
              </button>
              {isAdmin && <button onClick={() => setShowResetModal(true)} disabled={blSyncing||resetting} style={{ padding:'7px 12px', background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', borderRadius:'8px', fontSize:'12px', fontWeight:'500', cursor:'pointer', ...F }}>🗑 Reset + Import</button>}
              {isAdmin && <button onClick={() => router.push('/import')} style={{ padding:'7px 12px', background:'#f0fdf4', color:'#16a34a', border:'1px solid #bbf7d0', borderRadius:'8px', fontSize:'12px', fontWeight:'500', cursor:'pointer', ...F }}>📥 Import XML</button>}
            </div>
            {blResult && (
              <div style={{ width:'100%', padding:'7px 12px', borderRadius:'7px', background:blResult.error?'#fef2f2':'#f0fdf4', border:`1px solid ${blResult.error?'#fecaca':'#bbf7d0'}`, fontSize:'12px', color:blResult.error?'#dc2626':'#065f46' }}>
                {blResult.error?`Blad: ${blResult.error}`:`✅ ${blResult.clients_created} nowych, ${blResult.clients_updated} zaktualizowanych`}
              </div>
            )}
          </div>

          {segFilter !== 'all' && !aiFilterIds && (
            <div style={{ display:'flex', gap:'6px', marginBottom:'12px', flexWrap:'wrap' }}>
              <button onClick={() => setStatusFilter('all')} style={{ ...S.btnSm(statusFilter==='all'?'blue':''), fontSize:'12px', padding:'5px 12px' }}>Wszystkie</button>
              {(STATUSES[segFilter]||[]).map(s => (
                <button key={s.key} onClick={() => setStatusFilter(s.key)}
                  style={{ padding:'5px 12px', borderRadius:'20px', fontSize:'11px', fontWeight:'500', cursor:'pointer', border:'1px solid', borderColor:statusFilter===s.key?s.color:'#e8e8e6', background:statusFilter===s.key?s.bg:'#fff', color:statusFilter===s.key?s.color:'#6b7280', ...F }}>
                  {s.label} <span style={{ marginLeft:'4px', fontWeight:'600' }}>{clients.filter(c=>c.segment===segFilter&&c.status===s.key).length}</span>
                </button>
              ))}
            </div>
          )}

          <div style={S.card}>
            <div style={{ display:'grid', gridTemplateColumns:cols, padding:'9px 16px', borderBottom:'1px solid #e8e8e6', background:'#fafaf9', gap:'8px' }}>
              {headers.map(h => (
                <div key={h.key} onClick={() => handleSort(h.key)} style={S.th(h.key)}>{h.label}<SortIcon col={h.key} /></div>
              ))}
              <div style={{ fontSize:'10px', color:'#9ca3af', fontWeight:'500', textTransform:'uppercase' }}>Akcje</div>
            </div>
            {loading && <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af' }}>Ladowanie...</div>}
            {!loading && filtered.length === 0 && <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>{clients.length===0?'Brak klientow — dodaj pierwszego!':'Brak wynikow'}</div>}
            {filtered.map((client, i) => {
              const seg = SEGMENTS[client.segment]
              const baseBg = i%2===0?'#fff':'#f7f7f5'
              return (
                <div key={client.id} onClick={() => openDetail(client)}
                  style={{ display:'grid', gridTemplateColumns:cols, padding:'10px 16px', borderBottom:'1px solid #f0f0ee', cursor:'pointer', background:baseBg, alignItems:'center', gap:'8px' }}
                  onMouseEnter={e => e.currentTarget.style.background='#eef2ff'}
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
                  {/* HEALTH + TREND */}
                  <div style={{ minWidth:'70px' }}>
                    <HealthWithTrend client={client} />
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

          <div style={{ padding:'8px 16px', fontSize:'12px', color:'#9ca3af', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span>Pokazuję {page*PAGE_SIZE+1}-{Math.min((page+1)*PAGE_SIZE, filteredAll.length)} z {filteredAll.length} klientów ({clients.length} łącznie)
              {sortKey !== 'created_at' && <span> · Sortowanie: {headers.find(h=>h.key===sortKey)?.label} {sortDir==='asc'?'↑':'↓'}</span>}
            </span>
            {totalPages > 1 && (
              <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                <button onClick={()=>setPage(0)} disabled={page===0} style={{ padding:'3px 8px', border:'1px solid #e8e8e6', borderRadius:'5px', background:'#fff', cursor:page===0?'default':'pointer', color:page===0?'#d1d5db':'#374151', fontSize:'11px', ...F }}>«</button>
                <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ padding:'3px 8px', border:'1px solid #e8e8e6', borderRadius:'5px', background:'#fff', cursor:page===0?'default':'pointer', color:page===0?'#d1d5db':'#374151', fontSize:'11px', ...F }}>‹</button>
                {Array.from({length:Math.min(5,totalPages)}, (_,i)=>{
                  const p = Math.max(0, Math.min(totalPages-5, page-2)) + i
                  return <button key={p} onClick={()=>setPage(p)} style={{ padding:'3px 8px', border:'1px solid', borderColor:p===page?'#111':'#e8e8e6', borderRadius:'5px', background:p===page?'#111':'#fff', color:p===page?'white':'#374151', fontSize:'11px', cursor:'pointer', ...F }}>{p+1}</button>
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
        <div style={{ width:'400px', background:'#fff', borderLeft:'1px solid #e8e8e6', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:SEGMENTS[selectedClient.segment]?.bg, color:SEGMENTS[selectedClient.segment]?.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'600', flexShrink:0 }}>
              {initials(selectedClient.contact_name)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#111' }}>{selectedClient.company_name||selectedClient.contact_name}</div>
              <div style={{ fontSize:'11px', color:'#9ca3af' }}>{selectedClient.company_name?selectedClient.contact_name:''}</div>
            </div>
            <button onClick={() => setShowDetail(false)} style={{ border:'none', background:'#f4f4f3', borderRadius:'5px', width:'24px', height:'24px', cursor:'pointer', color:'#9ca3af', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e8e6', overflowY:'auto', flex:'0 0 auto', maxHeight:'60%' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px', marginBottom:'10px' }}>
              {[
                { label:'LTV', val:selectedClient.ltv>0?`£${Number(selectedClient.ltv).toLocaleString()}`:'—', color:'#065f46' },
                { label:'Zamówień', val:selectedClient.order_count||'—', color:'#1d4ed8' },
                { label:'AOV', val:selectedClient.avg_order_value>0?`£${Math.round(selectedClient.avg_order_value)}`:'—', color:'#6d28d9' },
                { label:'Śr. co', val:selectedClient.avg_days_between_orders?`${Math.round(selectedClient.avg_days_between_orders)}d`:'—', color:'#92400e' },
                { label:'Wiek klienta', val:selectedClient.customer_age_days?`${Math.round(selectedClient.customer_age_days/30)}mies`:'—', color:'#0e7490' },
                { label:'Repeat', val:selectedClient.repeat_customer?'✅ Tak':'❌ Nie', color:selectedClient.repeat_customer?'#065f46':'#dc2626' },
              ].map(m => (
                <div key={m.label} style={{ padding:'7px 9px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee' }}>
                  <div style={{ fontSize:'9px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>{m.label}</div>
                  <div style={{ fontSize:'12px', fontWeight:'600', color:m.color }}>{m.val}</div>
                </div>
              ))}
            </div>

            {/* HEALTH + TREND w profilu */}
            {selectedClient.health_score > 0 && (
              <div style={{ padding:'10px 12px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee', marginBottom:'8px' }}>
                <div style={{ fontSize:'9px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Health Score & Trend</div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ flex:1 }}>
                    <HealthBar score={selectedClient.health_score} />
                  </div>
                  {(() => {
                    const trend = getTrend(selectedClient)
                    if (!trend) return null
                    return (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                        <span style={{ fontSize:'18px', fontWeight:'700', color:trend.color }}>{trend.arrow}</span>
                        <span style={{ fontSize:'9px', color:trend.color, fontWeight:'500' }}>{trend.label}</span>
                      </div>
                    )
                  })()}
                </div>
                {selectedClient.avg_days_between_orders && selectedClient.days_since_last_order && (
                  <div style={{ fontSize:'10px', color:'#9ca3af', marginTop:'6px' }}>
                    Średnio co {Math.round(selectedClient.avg_days_between_orders)} dni · Ostatnio {selectedClient.days_since_last_order} dni temu
                  </div>
                )}
              </div>
            )}

            {selectedClient.top_products && selectedClient.top_products.length > 0 && (
              <div style={{ padding:'8px 10px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee', marginBottom:'8px' }}>
                <div style={{ fontSize:'9px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Top Produkty</div>
                {selectedClient.top_products.slice(0,3).map((p, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'3px' }}>
                    <span style={{ color:'#374151', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'200px' }}>{p.name?.substring(0,45)}</span>
                    <span style={{ color:'#065f46', fontWeight:'500', flexShrink:0, marginLeft:'8px' }}>£{p.revenue}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'8px' }}>
              {[
                { label:'Email', val:selectedClient.email||'—' },
                { label:'Telefon', val:selectedClient.phone||'—' },
                { label:'Segment', val:SEGMENTS[selectedClient.segment]?.labelFull },
                { label:'Status', val:<Pill segment={selectedClient.segment} statusKey={selectedClient.status} lang={lang}/> },
                { label:'Pierwsze zam.', val:fmtDate(selectedClient.first_order_date) },
                { label:'Ostatnie zam.', val:fmtDate(selectedClient.last_order_date) },
              ].map(item => (
                <div key={item.label} style={{ padding:'7px 9px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee' }}>
                  <div style={{ fontSize:'9px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'2px' }}>{item.label}</div>
                  <div style={{ fontSize:'11px', color:'#111', fontWeight:'500' }}>{item.val}</div>
                </div>
              ))}
            </div>
            {selectedClient.notes && <div style={{ padding:'8px 10px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'7px', fontSize:'12px', color:'#374151', marginBottom:'8px' }}>{selectedClient.notes}</div>}
            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={() => openEdit(selectedClient)} style={{ ...S.btnPrimary, fontSize:'12px', padding:'6px 12px' }}>Edytuj</button>
              <button onClick={() => handleDelete(selectedClient.id)} style={{ ...S.btnSm('red'), fontSize:'12px', padding:'6px 12px' }}>Usun</button>
            </div>
          </div>

          <div style={{ display:'flex', borderBottom:'1px solid #e8e8e6', flexShrink:0 }}>
            {[{ key:'timeline', label:'Historia' },{ key:'tasks', label:`Zadania (${clientTasks.length})` }].map(tab => (
              <button key={tab.key} onClick={() => setDetailTab(tab.key)}
                style={{ flex:1, padding:'9px', fontSize:'12px', fontWeight:'500', border:'none', background:'transparent', cursor:'pointer', color:detailTab===tab.key?'#111':'#9ca3af', borderBottom:detailTab===tab.key?'2px solid #111':'2px solid transparent', ...F }}>
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
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                <span style={{ fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:'500' }}>Zadania powiazane</span>
                <button onClick={createTaskForClient} style={{ fontSize:'11px', padding:'4px 10px', background:'#111', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', ...F }}>+ Nowe</button>
              </div>
              {clientTasks.length===0&&<div style={{ textAlign:'center', color:'#9ca3af', fontSize:'12px', marginTop:'20px' }}>Brak zadan</div>}
              {clientTasks.map(task => {
                const statusColors={open:'#1d4ed8',inprogress:'#92400e',waiting:'#6d28d9',done:'#065f46',urgent:'#dc2626'}
                const statusBg={open:'#eff6ff',inprogress:'#fffbeb',waiting:'#f5f3ff',done:'#ecfdf5',urgent:'#fef2f2'}
                const statusLabel={open:'Otwarte',inprogress:'W trakcie',waiting:'Oczekuje',done:'Zamkniete',urgent:'Pilne'}
                return (
                  <div key={task.id} style={{ marginBottom:'8px', padding:'9px 12px', background:'#fafaf9', border:'1px solid #f0f0ee', borderRadius:'8px' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'12px', fontWeight:'500', color:'#111', marginBottom:'2px' }}>{task.product_name}</div>
                        <div style={{ fontSize:'10px', color:'#9ca3af' }}>{task.order_number&&<span style={{ color:'#2563eb', fontWeight:'500', marginRight:'6px' }}>{task.order_number}</span>}{task.client_name}</div>
                      </div>
                      <span style={{ fontSize:'10px', fontWeight:'500', padding:'2px 7px', borderRadius:'10px', background:statusBg[task.status]||'#f3f4f6', color:statusColors[task.status]||'#374151', flexShrink:0 }}>{statusLabel[task.status]||task.status}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {showModal && (
        <div style={S.overlay}>
          <div style={S.modal('560px')}>
            <div style={{ padding:'18px 20px 14px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'15px', fontWeight:'600' }}>{editingClient?'Edytuj klienta':'Nowy klient'}</span>
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
                <div><label style={S.label}>Nazwa firmy</label><input value={form.company_name} onChange={e=>setForm(f=>({...f,company_name:e.target.value}))} placeholder="ABC Packaging Ltd" style={S.input}/></div>
                <div><label style={S.label}>Osoba kontaktowa *</label><input value={form.contact_name} onChange={e=>setForm(f=>({...f,contact_name:e.target.value}))} placeholder="Imie Nazwisko" style={S.input}/></div>
              </div>
              <div style={S.grid2}>
                <div><label style={S.label}>Email</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="email@firma.com" style={S.input}/></div>
                <div><label style={S.label}>Telefon</label><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+44 7..." style={S.input}/></div>
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
                <div><label style={S.label}>LTV (£)</label><input type="number" value={form.ltv} onChange={e=>setForm(f=>({...f,ltv:e.target.value}))} placeholder="0" style={S.input}/></div>
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
                {saving?'Zapisywanie...':editingClient?'Zapisz zmiany':'Dodaj klienta'}
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
                <div style={{ fontSize:'12px', color:'#9ca3af' }}>Usunie WSZYSTKICH klientow i interakcje</div>
              </div>
            </div>
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'12px', marginBottom:'16px', fontSize:'12px', color:'#dc2626', lineHeight:'1.6' }}>
              Usunieci: {clients.length} klientow + historia interakcji.<br/><strong>Tej operacji nie mozna cofnac!</strong>
            </div>
            <div style={{ marginBottom:'16px' }}>
              <label style={{ ...S.label, color:'#dc2626' }}>Wpisz RESET:</label>
              <input value={resetConfirmText} onChange={e=>setResetConfirmText(e.target.value)} placeholder="RESET" style={{ ...S.input, border:'2px solid #fecaca', fontWeight:'600', letterSpacing:'1px' }} autoFocus/>
            </div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button onClick={() => { setShowResetModal(false); setResetConfirmText('') }} style={{ ...S.btnSm(), padding:'9px 18px', fontSize:'13px' }}>Anuluj</button>
              <button onClick={resetAndSync} disabled={resetConfirmText!=='RESET'}
                style={{ padding:'9px 18px', background:resetConfirmText==='RESET'?'#dc2626':'#9ca3af', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:resetConfirmText==='RESET'?'pointer':'default', ...F }}>
                🗑 Tak, wyczysc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
