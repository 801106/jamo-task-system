'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import ChatPanel from '../components/ChatPanel'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_ID = 'd53f6727-6bc7-4602-9ce0-4fc31ab3aba1'

const WORKSPACES = [
  { key: 'jamo_healthy', label: 'Jamo + Healthy' },
  { key: 'packpack', label: 'PackPack' },
  { key: 'private', label: 'Private' },
]

const STATUS_META = {
  open:       { label:'Otwarte',    labelEn:'Open',        bg:'#eff6ff', color:'#1d4ed8', dot:'#3b82f6' },
  inprogress: { label:'W trakcie', labelEn:'In progress', bg:'#fffbeb', color:'#92400e', dot:'#f59e0b' },
  waiting:    { label:'Oczekuje',  labelEn:'Waiting',     bg:'#f5f3ff', color:'#6d28d9', dot:'#8b5cf6' },
  done:       { label:'Zamkniete', labelEn:'Closed',      bg:'#f0fdf4', color:'#166534', dot:'#22c55e' },
  urgent:     { label:'Pilne',     labelEn:'Urgent',      bg:'#fef2f2', color:'#991b1b', dot:'#ef4444' },
}
const PRIO_DOT = { high:'#ef4444', med:'#f59e0b', low:'#22c55e' }

const SUGGESTION_CATEGORIES = [
  { key:'general', label:'Ogólne', color:'#6b7280', bg:'#f3f4f6' },
  { key:'crm', label:'CRM', color:'#1d4ed8', bg:'#eff6ff' },
  { key:'taskflow', label:'TaskFlow', color:'#6d28d9', bg:'#f5f3ff' },
  { key:'bug', label:'Błąd', color:'#dc2626', bg:'#fef2f2' },
  { key:'feature', label:'Nowa funkcja', color:'#065f46', bg:'#ecfdf5' },
]

const T = {
  pl: {
    appSub:'Jamo Operations', ws:'Obszar roboczy',
    all:'Wszystkie', mine:'Moje', open:'Otwarte', urgent:'Pilne', archive:'Archiwum', suggestions:'Sugestie',
    search:'Szukaj...', newTask:'Nowe zadanie',
    live:'Polaczono — sync na zywo',
    admin:'Admin', user:'Uzytkownik', account:'Moje konto', logout:'Wyloguj',
    reports:'Raporty', adminPanel:'Panel admina',
    col1:'Nr zadania', col2:'Zadanie', col3:'Marketplace', col4:'Status', col5:'Przypisano', col6:'Prio', col7:'Termin', col8:'Akcje',
    noTasks:'Brak zadan', noArchive:'Brak zarchiwizowanych zadan',
    files:'Pliki', edit:'Edytuj', del:'Usun', move:'Przenies',
    editTask:'Edytuj zadanie', newTaskTitle:'Nowe zadanie',
    f_order:'Nr zamowienia', f_claim:'Nr reklamacji', f_product:'Nazwa produktu *',
    f_sku:'SKU', f_client:'Klient', f_cat:'Kategoria', f_prio:'Priorytet',
    f_status:'Status', f_assign:'Przypisz do', f_none:'— Nieprzypisane —',
    f_desc:'Opis / Nastepny krok', f_deadline:'Termin wykonania', f_marketplace:'Marketplace',
    cancel:'Anuluj', save:'Zapisz', saveChanges:'Zapisz zmiany', saving:'Zapisywanie...',
    high:'Wysoki', med:'Sredni', low:'Niski',
    attach:'Zalaczniki', noFiles:'Brak plikow',
    addFile:'Dodaj plik', uploading:'Wgrywanie...', download:'Pobierz',
    delConfirm:'Usunac to zadanie?', delFileConfirm:'Usunac ten plik?',
    comments:'Komentarze', addComment:'Dodaj komentarz...', send:'Wyslij',
    noComments:'Brak komentarzy', overdue:'Przeterminowane',
    moveTitle:'Przenies zadanie', moveTo:'Przenies do:',
    archiveNote:'Zamkniete zadania trafiaja do archiwum',
    notifications:'Powiadomienia', markAllRead:'Oznacz wszystkie', noNotifs:'Brak powiadomien',
    suggestionsTitle:'Sugestie i usprawnienia',
    suggestionsDesc:'Podziel sie pomyslem na ulepszenie systemu',
    addSuggestion:'Dodaj sugestie...',
    submitSuggestion:'Dodaj',
    noSuggestions:'Brak sugestii — bądź pierwszy!',
    category:'Kategoria',
  },
}

const S = {
  sidebar: { width:'224px', background:'#fff', borderRight:'1px solid #e8e8e6', display:'flex', flexDirection:'column', flexShrink:0 },
  sidebarTop: { padding:'18px 16px 14px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' },
  sidebarSection: { padding:'10px 12px', borderBottom:'1px solid #e8e8e6' },
  sidebarLabel: { fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'6px', fontWeight:'500' },
  sidebarBottom: { padding:'14px 16px', borderTop:'1px solid #e8e8e6' },
  navBtn: (active) => ({ display:'flex', alignItems:'center', width:'100%', textAlign:'left', padding:'7px 9px', borderRadius:'7px', fontSize:'13px', cursor:'pointer', border:'none', background:active?'#f4f4f3':'transparent', color:active?'#111':'#6b7280', fontWeight:active?'500':'400', marginBottom:'2px' }),
  wsBtn: (active) => ({ display:'block', width:'100%', textAlign:'left', padding:'6px 9px', borderRadius:'7px', fontSize:'13px', cursor:'pointer', border:'none', background:active?'#111':'transparent', color:active?'#fff':'#6b7280', fontWeight:active?'500':'400', marginBottom:'3px' }),
  badge: (red, blue) => ({ marginLeft:'auto', fontSize:'11px', background: red?'#fef2f2':blue?'#eff6ff':'#f4f4f3', color: red?'#dc2626':blue?'#2563eb':'#9ca3af', padding:'1px 7px', borderRadius:'10px', fontWeight:'500' }),
  topbar: { background:'#fff', borderBottom:'1px solid #e8e8e6', padding:'0 24px', height:'56px', display:'flex', alignItems:'center', gap:'12px' },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#f5f5f3' },
  liveBanner: { background:'#f0fdf4', borderBottom:'1px solid #bbf7d0', padding:'5px 24px', fontSize:'11px', color:'#166534', display:'flex', alignItems:'center', gap:'6px' },
  statsGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', padding:'16px 24px 0' },
  statCard: { background:'#fff', borderRadius:'10px', padding:'16px 18px', border:'1px solid #e8e8e6' },
  tableWrap: { background:'#fff', borderRadius:'10px', border:'1px solid #e8e8e6', overflow:'hidden' },
  th: { fontSize:'10px', color:'#9ca3af', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.06em' },
  searchInput: { padding:'9px 13px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', width:'220px', outline:'none', background:'#fafaf9', color:'#111', fontFamily:"'DM Sans', sans-serif" },
  btnPrimary: { background:'#111', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'13px', fontWeight:'500', cursor:'pointer', whiteSpace:'nowrap', fontFamily:"'DM Sans', sans-serif" },
  btnSm: (variant) => ({
    padding:'4px 9px', fontSize:'11px', borderRadius:'6px', cursor:'pointer', fontFamily:"'DM Sans', sans-serif", fontWeight:'500',
    ...(variant==='green' ? { border:'1px solid #bbf7d0', background:'#f0fdf4', color:'#16a34a' }
      : variant==='red' ? { border:'1px solid #fecaca', background:'#fef2f2', color:'#dc2626' }
      : variant==='indigo' ? { border:'1px solid #c7d2fe', background:'#eef2ff', color:'#4f46e5' }
      : { border:'1px solid #e8e8e6', background:'#fff', color:'#374151' })
  }),
  modalOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 },
  modal: (w) => ({ background:'#fff', borderRadius:'14px', width:w||'540px', maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto', border:'1px solid #e8e8e6' }),
  modalHeader: { padding:'20px 22px 16px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' },
  modalBody: { padding:'20px 22px' },
  modalFooter: { padding:'16px 22px', borderTop:'1px solid #e8e8e6', display:'flex', justifyContent:'flex-end', gap:'8px' },
  label: { display:'block', fontSize:'12px', fontWeight:'500', marginBottom:'5px', color:'#374151' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', outline:'none', fontFamily:"'DM Sans', sans-serif", color:'#111', background:'#fff' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', outline:'none', fontFamily:"'DM Sans', sans-serif", color:'#111', background:'#fff' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' },
  pill: (status) => ({ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'500', background:STATUS_META[status]?.bg||'#f4f4f3', color:STATUS_META[status]?.color||'#374151' }),
  metaItem: { padding:'10px 13px', background:'#fafaf9', borderRadius:'8px', border:'1px solid #f0f0ee' },
  metaLabel: { fontSize:'10px', color:'#9ca3af', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'500' },
}

function FormField({ label, children }) {
  return <div><label style={S.label}>{label}</label>{children}</div>
}

function UserMultiSelect({ users, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  const toggle = (id) => onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  const selectedUsers = users.filter(u => selected.includes(u.id))
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={() => setOpen(v => !v)} style={{ ...S.input, cursor:'pointer', display:'flex', alignItems:'center', flexWrap:'wrap', gap:'4px', minHeight:'40px', padding:'6px 12px' }}>
        {selectedUsers.length === 0 && <span style={{ color:'#9ca3af', fontSize:'13px' }}>— Wybierz osoby —</span>}
        {selectedUsers.map(u => (
          <span key={u.id} style={{ background:'#eff6ff', color:'#1d4ed8', fontSize:'11px', padding:'2px 8px', borderRadius:'20px', fontWeight:'500', display:'flex', alignItems:'center', gap:'4px' }}>
            {u.full_name}
            <span onClick={e => { e.stopPropagation(); toggle(u.id) }} style={{ cursor:'pointer', fontSize:'14px', color:'#93c5fd' }}>×</span>
          </span>
        ))}
        <span style={{ marginLeft:'auto', color:'#9ca3af', fontSize:'12px' }}>▾</span>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1px solid #e8e8e6', borderRadius:'8px', zIndex:100, maxHeight:'180px', overflowY:'auto', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', marginTop:'2px' }}>
          {users.map(u => (
            <div key={u.id} onClick={() => toggle(u.id)}
              style={{ display:'flex', alignItems:'center', gap:'8px', padding:'9px 12px', cursor:'pointer', background: selected.includes(u.id)?'#eff6ff':'transparent' }}>
              <div style={{ width:'22px', height:'22px', borderRadius:'50%', background: selected.includes(u.id)?'#dbeafe':'#f0f0ee', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:'600', color: selected.includes(u.id)?'#1d4ed8':'#6b7280' }}>
                {(u.full_name||'?').substring(0,2).toUpperCase()}
              </div>
              <span style={{ fontSize:'13px', color:'#111', flex:1 }}>{u.full_name}</span>
              {selected.includes(u.id) && <span style={{ color:'#1d4ed8' }}>✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NotificationBell({ notifications, onMarkRead, onMarkAllRead, onClickNotif }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const unread = notifications.filter(n => !n.read).length
  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  const notifIcon = { task_assigned:'👤', comment_added:'💬', file_added:'📎', status_changed:'🔄', message:'📨' }
  const fmtTime = (d) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'przed chwila'
    if (mins < 60) return `${mins} min temu`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h temu`
    return new Date(d).toLocaleDateString('pl-PL')
  }
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(v => !v)} style={{ position:'relative', width:'38px', height:'38px', background: open?'#f4f4f3':'#fff', border:'1px solid #e8e8e6', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'17px' }}>
        🔔
        {unread > 0 && <span style={{ position:'absolute', top:'-5px', right:'-5px', width:'18px', height:'18px', background:'#dc2626', color:'white', borderRadius:'50%', fontSize:'10px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center' }}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, width:'360px', background:'#fff', border:'1px solid #e8e8e6', borderRadius:'12px', boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:200 }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:'13px', fontWeight:'600', color:'#111' }}>Powiadomienia {unread > 0 && <span style={{ background:'#dc2626', color:'white', fontSize:'10px', padding:'1px 6px', borderRadius:'10px', marginLeft:'4px' }}>{unread}</span>}</span>
            {unread > 0 && <button onClick={onMarkAllRead} style={{ fontSize:'11px', color:'#2563eb', border:'none', background:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Oznacz wszystkie</button>}
          </div>
          <div style={{ maxHeight:'380px', overflowY:'auto' }}>
            {notifications.length === 0 && <div style={{ padding:'32px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>Brak powiadomien 🎉</div>}
            {notifications.slice(0, 20).map(n => (
              <div key={n.id} onClick={() => { onMarkRead(n.id); onClickNotif(n); setOpen(false) }}
                style={{ display:'flex', gap:'10px', padding:'12px 16px', borderBottom:'1px solid #f0f0ee', cursor:'pointer', background: n.read?'#fff':'#fafbff' }}>
                <div style={{ fontSize:'18px', flexShrink:0 }}>{notifIcon[n.type] || '🔔'}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'12px', fontWeight: n.read?'400':'600', color:'#111', marginBottom:'2px' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize:'11px', color:'#6b7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.body}</div>}
                  <div style={{ fontSize:'10px', color:'#9ca3af', marginTop:'3px' }}>{fmtTime(n.created_at)}</div>
                </div>
                {!n.read && <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#2563eb', flexShrink:0, marginTop:'5px' }}></div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// SUGGESTIONS PANEL
function SuggestionsPanel({ user, profile, users }) {
  const [suggestions, setSuggestions] = useState([])
  const [newText, setNewText] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [filterCat, setFilterCat] = useState('all')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [comments, setComments] = useState([])
  const [sendingCmt, setSendingCmt] = useState(false)
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { loadSuggestions() }, [])

  async function loadSuggestions() {
    setLoading(true)
    const { data } = await supabase.from('suggestions')
      .select('*, author:profiles!author_id(full_name)')
      .order('created_at', { ascending: false })
    setSuggestions(data || [])
    setLoading(false)
  }

  async function addSuggestion() {
    if (!newText.trim() || !user) return
    setSaving(true)
    await supabase.from('suggestions').insert({ content: newText.trim(), category: newCategory, author_id: user.id })
    setNewText('')
    setNewCategory('general')
    await loadSuggestions()
    setSaving(false)
  }

  async function deleteSuggestion(id) {
    if (!confirm('Usunac te sugestie?')) return
    await supabase.from('suggestions').delete().eq('id', id)
    if (selected?.id === id) setSelected(null)
    await loadSuggestions()
  }

  async function openDetail(s) {
    setSelected(s)
    await loadComments(s.id)
    await loadFiles(s.id)
  }

  async function loadComments(suggId) {
    const { data } = await supabase.from('suggestion_comments')
      .select('*, author:profiles!author_id(full_name)')
      .eq('suggestion_id', suggId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function loadFiles(suggId) {
    const { data } = await supabase.storage.from('task-files').list(`suggestions/${suggId}`)
    setFiles(data || [])
  }

  async function sendComment() {
    if (!newComment.trim() || !selected || !user) return
    setSendingCmt(true)
    await supabase.from('suggestion_comments').insert({ suggestion_id: selected.id, author_id: user.id, content: newComment.trim() })
    setNewComment('')
    await loadComments(selected.id)
    setSendingCmt(false)
  }

  async function uploadFile(e) {
    const file = e.target.files[0]; if (!file || !selected) return
    setUploading(true)
    await supabase.storage.from('task-files').upload(`suggestions/${selected.id}/${Date.now()}_${file.name}`, file)
    await loadFiles(selected.id)
    setUploading(false)
    e.target.value = ''
  }

  async function getFileUrl(name) {
    const { data } = await supabase.storage.from('task-files').createSignedUrl(`suggestions/${selected.id}/${name}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const fmtDT = (d) => d ? new Date(d).toLocaleString('pl-PL', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : ''
  const initials = (n) => (n||'?').split(' ').map(x=>x[0]).join('').toUpperCase().substring(0,2)
  const catMeta = (key) => SUGGESTION_CATEGORIES.find(c => c.key === key) || SUGGESTION_CATEGORIES[0]

  const filtered = filterCat === 'all' ? suggestions : suggestions.filter(s => s.category === filterCat)

  return (
    <div style={{ flex:1, overflow:'hidden', display:'flex' }}>
      {/* LEFT — list */}
      <div style={{ flex:1, overflow:'auto', padding:'20px 24px' }}>
        {/* Header + form */}
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e8e8e6', padding:'20px 24px', marginBottom:'16px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
            <span style={{ fontSize:'20px' }}>💡</span>
            <div>
              <div style={{ fontSize:'15px', fontWeight:'600', color:'#111' }}>Sugestie i usprawnienia</div>
              <div style={{ fontSize:'12px', color:'#9ca3af' }}>Podziel się pomysłem — każdy może dodać i skomentować</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
            <div style={{ flex:1 }}>
              <textarea value={newText} onChange={e => setNewText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && addSuggestion()}
                placeholder="Opisz co chcesz ulepszyć... (Ctrl+Enter żeby wysłać)"
                style={{ ...S.input, height:'64px', resize:'vertical', marginBottom:'8px' }} />
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {SUGGESTION_CATEGORIES.map(cat => (
                  <button key={cat.key} onClick={() => setNewCategory(cat.key)}
                    style={{ padding:'3px 9px', borderRadius:'20px', fontSize:'11px', fontWeight:'500', cursor:'pointer', border:'1px solid', borderColor: newCategory===cat.key?cat.color:'#e8e8e6', background: newCategory===cat.key?cat.bg:'#fff', color: newCategory===cat.key?cat.color:'#6b7280', fontFamily:"'DM Sans',sans-serif" }}>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={addSuggestion} disabled={saving || !newText.trim()}
              style={{ ...S.btnPrimary, opacity: saving||!newText.trim()?0.5:1, marginTop:'2px', flexShrink:0 }}>
              {saving ? 'Dodaje...' : '+ Dodaj'}
            </button>
          </div>
        </div>

        {/* Filter stats — KLIKALNE */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'8px', marginBottom:'16px' }}>
          {[{ key:'all', label:'Wszystkie', val:suggestions.length, color:'#111', bg:'#f4f4f3' },
            ...SUGGESTION_CATEGORIES.map(c => ({ key:c.key, label:c.label, val:suggestions.filter(s=>s.category===c.key).length, color:c.color, bg:c.bg }))
          ].map(s => (
            <div key={s.key} onClick={() => setFilterCat(s.key)}
              style={{ background: filterCat===s.key ? s.bg : '#fff', border:`${filterCat===s.key?2:1}px solid ${filterCat===s.key?s.color:'#e8e8e6'}`, borderRadius:'8px', padding:'10px 14px', cursor:'pointer', transition:'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = s.bg; e.currentTarget.style.borderColor = s.color }}
              onMouseLeave={e => { e.currentTarget.style.background = filterCat===s.key?s.bg:'#fff'; e.currentTarget.style.borderColor = filterCat===s.key?s.color:'#e8e8e6' }}>
              <div style={{ fontSize:'9px', color: filterCat===s.key?s.color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px', fontWeight:'500' }}>{s.label}</div>
              <div style={{ fontSize:'20px', fontWeight:'600', color:s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* List */}
        <div style={{ background:'#fff', borderRadius:'12px', border:'1px solid #e8e8e6', overflow:'hidden' }}>
          {filterCat !== 'all' && (
            <div style={{ padding:'8px 16px', background: catMeta(filterCat).bg, borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'12px', fontWeight:'500', color: catMeta(filterCat).color }}>Filtr: {catMeta(filterCat).label} ({filtered.length})</span>
              <button onClick={() => setFilterCat('all')} style={{ fontSize:'11px', color:'#9ca3af', border:'none', background:'none', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>× Wyczysc</button>
            </div>
          )}
          {loading && <div style={{ padding:'40px', textAlign:'center', color:'#9ca3af' }}>Ladowanie...</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding:'48px', textAlign:'center', color:'#9ca3af', fontSize:'13px' }}>
              <div style={{ fontSize:'32px', marginBottom:'10px' }}>💡</div>
              Brak sugestii w tej kategorii
            </div>
          )}
          {filtered.map((s, i) => {
            const cat = catMeta(s.category)
            const isOwn = s.author_id === user?.id
            const isAdmin = user?.id === ADMIN_ID
            const isActive = selected?.id === s.id
            return (
              <div key={s.id} onClick={() => openDetail(s)}
                style={{ padding:'14px 20px', borderBottom:'1px solid #f0f0ee', background: isActive?'#eff6ff':i%2===0?'#fff':'#f9f9f8', cursor:'pointer', borderLeft: isActive?'3px solid #2563eb':'3px solid transparent' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f4f4f3' }}
                onMouseLeave={e => { e.currentTarget.style.background = isActive?'#eff6ff':i%2===0?'#fff':'#f9f9f8' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
                  <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:'600', color:'#1d4ed8', flexShrink:0 }}>
                    {initials(s.author?.full_name)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'4px', flexWrap:'wrap' }}>
                      <span style={{ fontSize:'12px', fontWeight:'600', color:'#111' }}>{s.author?.full_name || 'Nieznany'}</span>
                      <span style={{ fontSize:'10px', color:'#9ca3af' }}>{fmtDT(s.created_at)}</span>
                      <span style={{ fontSize:'10px', fontWeight:'500', padding:'2px 7px', borderRadius:'20px', background:cat.bg, color:cat.color }}>{cat.label}</span>
                    </div>
                    <div style={{ fontSize:'13px', color:'#374151', lineHeight:'1.5', overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{s.content}</div>
                  </div>
                  {(isOwn || isAdmin) && (
                    <button onClick={e => { e.stopPropagation(); deleteSuggestion(s.id) }} style={{ ...S.btnSm('red'), flexShrink:0, opacity:0.6 }}>Usun</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* RIGHT — detail panel */}
      {selected && (
        <div style={{ width:'380px', background:'#fff', borderLeft:'1px solid #e8e8e6', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'600', color:'#1d4ed8', flexShrink:0 }}>
              {initials(selected.author?.full_name)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'13px', fontWeight:'600', color:'#111' }}>{selected.author?.full_name}</div>
              <div style={{ fontSize:'11px', color:'#9ca3af' }}>{fmtDT(selected.created_at)}</div>
            </div>
            <span style={{ fontSize:'10px', fontWeight:'500', padding:'2px 8px', borderRadius:'20px', background:catMeta(selected.category).bg, color:catMeta(selected.category).color }}>{catMeta(selected.category).label}</span>
            <button onClick={() => setSelected(null)} style={{ border:'none', background:'#f4f4f3', borderRadius:'5px', width:'24px', height:'24px', cursor:'pointer', color:'#9ca3af', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid #e8e8e6' }}>
            <div style={{ fontSize:'13px', color:'#374151', lineHeight:'1.7', whiteSpace:'pre-wrap' }}>{selected.content}</div>
          </div>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #e8e8e6' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
              <span style={{ fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'500' }}>Pliki ({files.length})</span>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...S.btnSm('green'), fontSize:'11px', padding:'3px 9px' }}>
                {uploading ? 'Wgrywanie...' : '+ Dodaj plik'}
              </button>
              <input ref={fileRef} type="file" style={{ display:'none' }} onChange={uploadFile} />
            </div>
            {files.length === 0 && <div style={{ fontSize:'12px', color:'#d1d5db', fontStyle:'italic' }}>Brak plikow</div>}
            {files.map(file => (
              <div key={file.name} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'6px 10px', border:'1px solid #e8e8e6', borderRadius:'7px', marginBottom:'5px', background:'#fafaf9' }}>
                <span style={{ fontSize:'12px', color:'#374151', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.name.replace(/^\d+_/, '')}</span>
                <button onClick={() => getFileUrl(file.name)} style={S.btnSm()}>↓</button>
              </div>
            ))}
          </div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
            <div style={{ fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'500', marginBottom:'10px' }}>Komentarze ({comments.length})</div>
            {comments.length === 0 && <div style={{ fontSize:'12px', color:'#9ca3af', fontStyle:'italic', marginBottom:'10px' }}>Brak komentarzy</div>}
            {comments.map(c => (
              <div key={c.id} style={{ marginBottom:'10px', display:'flex', gap:'8px' }}>
                <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:'#eff6ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:'600', color:'#1d4ed8', flexShrink:0 }}>
                  {initials(c.author?.full_name)}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'2px' }}>{c.author?.full_name} · {fmtDT(c.created_at)}</div>
                  <div style={{ fontSize:'12px', color:'#111', lineHeight:'1.5', padding:'7px 10px', background:'#fafaf9', borderRadius:'7px', border:'1px solid #f0f0ee' }}>{c.content}</div>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:'6px', marginTop:'8px' }}>
              <input value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendComment()}
                placeholder="Dodaj komentarz... (Enter)"
                style={{ ...S.input, flex:1, fontSize:'12px' }} />
              <button onClick={sendComment} disabled={sendingCmt || !newComment.trim()}
                style={{ ...S.btnPrimary, fontSize:'12px', padding:'8px 12px', opacity:(!newComment.trim()||sendingCmt)?0.4:1 }}>+</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const [lang] = useState('pl')
  const t = T[lang]
  const statusLabel = (s) => STATUS_META[s]?.label

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [workspace, setWorkspace] = useState('jamo_healthy')
  const [filter, setFilter] = useState('all')
  const [showArchive, setShowArchive] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [highlightedTaskId, setHighlightedTaskId] = useState(null)
  const [taskFiles, setTaskFiles] = useState([])
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sendingCmt, setSendingCmt] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [moveTarget, setMoveTarget] = useState('')
  const [showChat, setShowChat] = useState(false)
  const [chatUsers, setChatUsers] = useState([])
  const [chatSelected, setChatSelected] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatText, setChatText] = useState('')
  const [chatUnread, setChatUnread] = useState({})
  const [chatTaskObj, setChatTaskObj] = useState(null)
  const [chatTaskRef, setChatTaskRef] = useState('')
  const [showChatTaskPicker, setShowChatTaskPicker] = useState(false)
  const [chatTaskSearch, setChatTaskSearch] = useState('')
  const [chatAllTasks, setChatAllTasks] = useState([])
  const [chatSending, setChatSending] = useState(false)
  const [notifications, setNotifications] = useState([])
  const chatEndRef = useRef(null)
  const chatFileRef = useRef(null)
  const chatInputRef = useRef(null)
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    order_number:'', claim_number:'', product_name:'', sku:'', client_name:'',
    marketplace:'Amazon UK', category:'Reklamacja', description:'', status:'open',
    priority:'med', assigned_to:'', assigned_users:[], deadline:'', client_id:''
  })
  const [crmClients, setCrmClients] = useState([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUser(user)
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
    })
    supabase.from('profiles').select('id, full_name').then(({ data }) => setUsers(data || []))
    supabase.from('clients').select('id, company_name, contact_name, segment').order('company_name').then(({ data }) => setCrmClients(data || []))
  }, [])

  const loadNotifications = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    setNotifications(data || [])
  }, [user])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('notifs-rt')
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${user.id}` }, () => loadNotifications())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user, loadNotifications])

  async function markNotifRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function markAllNotifsRead() {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleClickNotif(notif) {
    if (notif.task_id) {
      const task = tasks.find(t2 => t2.id === notif.task_id)
      if (task) { setHighlightedTaskId(notif.task_id); await openPreview(task); setTimeout(() => setHighlightedTaskId(null), 3000) }
    } else if (notif.type === 'message') { setShowChat(true) }
  }

  async function createNotification(userIds, type, title, body, taskId = null, messageId = null) {
    if (!userIds || userIds.length === 0) return
    const records = userIds.map(uid => ({ user_id:uid, type, title, body, task_id:taskId||null, message_id:messageId||null, read:false }))
    await supabase.from('notifications').insert(records)
  }

  const loadTasks = useCallback(async () => {
    const { data } = await supabase.from('tasks').select('*, assigned_profile:profiles!assigned_to(full_name)').eq('area', workspace).order('created_at', { ascending: false })
    setTasks(data || [])
  }, [workspace])

  useEffect(() => { loadTasks() }, [loadTasks])
  useEffect(() => {
    const ch = supabase.channel('rt').on('postgres_changes', { event:'*', schema:'public', table:'tasks' }, loadTasks).subscribe()
    return () => supabase.removeChannel(ch)
  }, [workspace, loadTasks])

  async function loadFiles(id) { const { data } = await supabase.storage.from('task-files').list(id); setTaskFiles(data||[]) }
  async function loadComments(id) {
    const { data } = await supabase.from('comments').select('*, author:profiles!author_id(full_name)').eq('task_id', id).order('created_at', { ascending: true })
    setComments(data||[])
  }

  async function uploadFile(e) {
    const file = e.target.files[0]; if (!file||!selectedTask) return
    setUploading(true)
    await supabase.storage.from('task-files').upload(`${selectedTask.id}/${Date.now()}_${file.name}`, file)
    await loadFiles(selectedTask.id)
    const assignedUsers = [...new Set([...(selectedTask.assigned_users||[]), ...(selectedTask.assigned_to?[selectedTask.assigned_to]:[])])].filter(uid => uid !== user.id)
    if (assignedUsers.length > 0) await createNotification(assignedUsers, 'file_added', `📎 ${profile?.full_name} dodal plik`, `${file.name} → ${selectedTask.product_name}`, selectedTask.id)
    setUploading(false)
  }

  async function deleteFile(name) {
    if (!confirm(t.delFileConfirm)) return
    await supabase.storage.from('task-files').remove([`${selectedTask.id}/${name}`]); await loadFiles(selectedTask.id)
  }

  async function getFileUrl(name) {
    const { data } = await supabase.storage.from('task-files').createSignedUrl(`${selectedTask.id}/${name}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl,'_blank')
  }

  async function sendComment() {
    if (!newComment.trim()||!selectedTask||!user) return
    setSendingCmt(true)
    await supabase.from('comments').insert({ task_id:selectedTask.id, author_id:user.id, content:newComment.trim() })
    const toNotify = [...new Set([...(selectedTask.assigned_users||[]), ...(selectedTask.assigned_to?[selectedTask.assigned_to]:[])])].filter(uid => uid !== user.id)
    if (toNotify.length > 0) await createNotification(toNotify, 'comment_added', `💬 ${profile?.full_name} dodal komentarz`, `"${newComment.trim().substring(0,60)}" → ${selectedTask.product_name}`, selectedTask.id)
    setNewComment(''); await loadComments(selectedTask.id); setSendingCmt(false)
  }

  async function logout() { await supabase.auth.signOut(); router.push('/') }

  function openNew() {
    setEditingTask(null)
    setForm({ order_number:'', claim_number:'', product_name:'', sku:'', client_name:'', marketplace:'Amazon UK', category:'Reklamacja', description:'', status:'open', priority:'med', assigned_to:'', assigned_users:[], deadline:'', client_id:'' })
    setShowModal(true)
  }

  function openEdit(task) {
    setEditingTask(task)
    setForm({ order_number:task.order_number||'', claim_number:task.claim_number||'', product_name:task.product_name||'', sku:task.sku||'', client_name:task.client_name||'', marketplace:task.marketplace||'Amazon UK', category:task.category||'Reklamacja', description:task.description||'', status:task.status||'open', priority:task.priority||'med', assigned_to:task.assigned_to||'', assigned_users:task.assigned_users||[], deadline:task.deadline?task.deadline.split('T')[0]:'', client_id:task.client_id||'' })
    setShowModal(true)
  }

  async function openDetail(task) { setSelectedTask(task); setShowDetail(true); await loadFiles(task.id); await loadComments(task.id) }
  async function openPreview(task) { setSelectedTask(task); setShowPreview(true); await loadComments(task.id); await loadFiles(task.id) }

  function openMove(task) {
    setSelectedTask(task)
    const avail = WORKSPACES.filter(w=>w.key!==workspace&&(profile?.role==='admin'||(profile?.areas||[]).includes(w.key)))
    setMoveTarget(avail[0]?.key||''); setShowMove(true)
  }

  async function doMove() {
    if (!moveTarget||!selectedTask) return
    await supabase.from('tasks').update({ area:moveTarget }).eq('id',selectedTask.id)
    setShowMove(false); loadTasks()
  }

  async function handleSave() {
    if (!form.product_name) return
    setSaving(true)
    const allAssigned = [...new Set([...(form.assigned_users||[]), ...(form.assigned_to?[form.assigned_to]:[])])]
    const payload = { ...form, assigned_to:form.assigned_to||(allAssigned[0]||null), assigned_users:allAssigned, deadline:form.deadline||null, client_id:form.client_id||null }

    if (editingTask) {
      await supabase.from('tasks').update(payload).eq('id', editingTask.id)
      const prevAssigned = [...new Set([...(editingTask.assigned_users||[]), ...(editingTask.assigned_to?[editingTask.assigned_to]:[])])]
      const newlyAssigned = allAssigned.filter(uid => !prevAssigned.includes(uid) && uid !== user.id)
      if (newlyAssigned.length > 0) await createNotification(newlyAssigned, 'task_assigned', `👤 ${profile?.full_name} przypisal Ci zadanie`, form.product_name, editingTask.id)
      if (form.status !== editingTask.status) {
        const toNotify = allAssigned.filter(uid => uid !== user.id)
        if (toNotify.length > 0) await createNotification(toNotify, 'status_changed', `🔄 Status zmieniony: ${statusLabel(form.status)}`, form.product_name, editingTask.id)
      }
    } else {
      const { data: newTask } = await supabase.from('tasks').insert({ ...payload, area:workspace, created_by:user.id }).select().single()
      if (newTask && allAssigned.length > 0) {
        const toNotify = allAssigned.filter(uid => uid !== user.id)
        if (toNotify.length > 0) await createNotification(toNotify, 'task_assigned', `👤 ${profile?.full_name} przypisal Ci nowe zadanie`, form.product_name, newTask.id)
      }
    }
    setSaving(false); setShowModal(false); setEditingTask(null); loadTasks()
  }

  async function deleteTask(id) { if (!confirm(t.delConfirm)) return; await supabase.from('tasks').delete().eq('id',id); loadTasks() }

  async function changeStatus(id, status, task) {
    await supabase.from('tasks').update({ status }).eq('id', id)
    const toNotify = [...new Set([...(task.assigned_users||[]), ...(task.assigned_to?[task.assigned_to]:[])])].filter(uid => uid !== user.id)
    if (toNotify.length > 0) await createNotification(toNotify, 'status_changed', `🔄 ${profile?.full_name} zmienil status`, `${statusLabel(status)} → ${task.product_name}`, id)
    loadTasks()
  }

  // CHAT
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('id, full_name').neq('id', user.id).then(({data}) => setChatUsers(data||[]))
    supabase.from('tasks').select('id, product_name, order_number').order('created_at',{ascending:false}).limit(50).then(({data}) => setChatAllTasks(data||[]))
  }, [user])

  useEffect(() => { if (user) loadChatUnread() }, [user])

  async function loadChatUnread() {
    const {data} = await supabase.from('messages').select('sender_id').eq('receiver_id', user.id).eq('read', false)
    const c = {}; (data||[]).forEach(m => { c[m.sender_id] = (c[m.sender_id]||0)+1 }); setChatUnread(c)
  }

  const loadChatMsgs = useCallback(async () => {
    if (!user||!chatSelected) return
    const {data} = await supabase.from('messages')
      .select('*, sender:profiles!sender_id(full_name)')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${chatSelected.id}),and(sender_id.eq.${chatSelected.id},receiver_id.eq.${user.id})`)
      .order('created_at',{ascending:true})
    setChatMessages(data||[])
    await supabase.from('messages').update({read:true}).eq('sender_id',chatSelected.id).eq('receiver_id',user.id).eq('read',false)
    loadChatUnread()
  }, [user, chatSelected])

  useEffect(() => { loadChatMsgs() }, [loadChatMsgs])

  useEffect(() => {
    if (!user) return
    const ch = supabase.channel('chat-rt')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'}, () => { loadChatMsgs(); loadChatUnread() })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user, chatSelected, loadChatMsgs])

  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [chatMessages])

  async function sendChatMsg() {
    if (!chatText.trim()||!chatSelected||!user) return
    setChatSending(true)
    await supabase.from('messages').insert({ sender_id:user.id, receiver_id:chatSelected.id, content:chatText.trim(), task_id:chatTaskObj?.id||null, task_ref:chatTaskObj?`#${chatTaskObj.order_number||chatTaskObj.id.substring(0,6).toUpperCase()} · ${chatTaskObj.product_name}`:null })
    await createNotification([chatSelected.id], 'message', `📨 ${profile?.full_name}`, chatText.trim().substring(0,80), chatTaskObj?.id||null)
    await fetch('/api/send-push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:chatSelected.id,title:`💬 ${profile?.full_name}`,body:chatText.trim(),url:'/dashboard'})})
    setChatText(''); setChatTaskObj(null); setChatTaskRef(''); setChatSending(false)
    chatInputRef.current?.focus()
  }

  async function sendChatFile(e) {
    const file = e.target.files[0]; if (!file||!chatSelected||!user) return
    const path = `messages/${user.id}/${Date.now()}_${file.name}`
    const {error} = await supabase.storage.from('task-files').upload(path, file)
    if (!error) {
      const {data:u} = await supabase.storage.from('task-files').createSignedUrl(path, 86400*30)
      await supabase.from('messages').insert({sender_id:user.id,receiver_id:chatSelected.id,file_url:u?.signedUrl,file_name:file.name,file_size:file.size,task_id:chatTaskObj?.id||null})
      await createNotification([chatSelected.id], 'message', `📎 ${profile?.full_name} wyslal plik`, file.name, chatTaskObj?.id||null)
      setChatTaskObj(null); setChatTaskRef('')
    }
    e.target.value=''
  }

  function isOverdue(task) { return task.deadline && task.status!=='done' && new Date(task.deadline)<new Date() }

  const active = tasks.filter(t2=>t2.status!=='done')
  const archived = tasks.filter(t2=>t2.status==='done')
  const filtered = active.filter(t2 => {
    if (filter==='urgent' && t2.status!=='urgent') return false
    if (filter==='open' && !['open','inprogress','waiting'].includes(t2.status)) return false
    if (filter==='mine' && t2.assigned_to!==user?.id && !(t2.assigned_users||[]).includes(user?.id)) return false
    if (search) { const q=search.toLowerCase(); return (t2.order_number||'').toLowerCase().includes(q)||(t2.product_name||'').toLowerCase().includes(q)||(t2.client_name||'').toLowerCase().includes(q)||(t2.claim_number||'').toLowerCase().includes(q) }
    return true
  })

  const counts = { all:active.length, open:active.filter(t2=>['open','inprogress','waiting'].includes(t2.status)).length, urgent:active.filter(t2=>t2.status==='urgent').length, mine:active.filter(t2=>t2.assigned_to===user?.id||(t2.assigned_users||[]).includes(user?.id)).length, archive:archived.length }
  const [suggestionsCount, setSuggestionsCount] = useState(0)
  useEffect(() => {
    supabase.from('suggestions').select('id', { count:'exact', head:true }).then(({ count }) => setSuggestionsCount(count || 0))
  }, [showSuggestions])
  const availWS = WORKSPACES.filter(w=>w.key!==workspace&&(profile?.role==='admin'||(profile?.areas||[]).includes(w.key)))
  const cols = '100px 1fr 100px 120px 120px 70px 80px 140px'
  const fmtDate = (d) => d?new Date(d).toLocaleDateString('pl-PL'):''
  const fmtDT = (d) => d?new Date(d).toLocaleString('pl-PL',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''
  const fileIcon = (n) => n.match(/\.(jpg|jpeg|png|gif|webp)$/i)?'IMG':n.match(/\.pdf$/i)?'PDF':n.match(/\.docx?$/i)?'DOC':n.match(/\.xlsx?$/i)?'XLS':'FILE'
  const initials = (name) => (name||'?').substring(0,2).toUpperCase()
  const totalUnread = Object.values(chatUnread).reduce((a,b)=>a+b,0)

  const TaskRow = ({ task, isArchived=false, index=0 }) => {
    const baseBg = highlightedTaskId===task.id ? '#fffbeb' : (index%2===0?'#ffffff':'#f7f7f5')
    const assignedUsersList = [...new Set([...(task.assigned_users||[]), ...(task.assigned_to?[task.assigned_to]:[])])]
    const assignedProfiles = users.filter(u => assignedUsersList.includes(u.id))
    return (
      <div onClick={()=>openPreview(task)}
        style={{...S.row, gridTemplateColumns:cols, opacity:isArchived?0.65:1, background:baseBg, transition:'background 0.5s', display:'grid', padding:'12px 18px', borderBottom:'1px solid #f0f0ee', alignItems:'center', cursor:'pointer'}}
        onMouseEnter={e=>{ if(highlightedTaskId!==task.id) e.currentTarget.style.background='#eef2ff' }}
        onMouseLeave={e=>{ e.currentTarget.style.background=baseBg }}>
        <div>
          <div style={{fontSize:'12px', fontWeight:'500', color:'#2563eb', fontFamily:"'DM Mono', monospace"}}>{task.order_number||'—'}</div>
          <div style={{fontSize:'10px', color:'#9ca3af'}}>{task.claim_number||''}</div>
        </div>
        <div>
          <div style={{fontSize:'13px', fontWeight:'500', color:'#111'}}>{task.product_name}</div>
          <div style={{fontSize:'12px', color:'#9ca3af'}}>{task.client_name}{task.category?' · '+task.category:''}</div>
        </div>
        <div style={{fontSize:'12px', color:'#6b7280'}}>{task.marketplace||'—'}</div>
        <div onClick={e=>e.stopPropagation()}>
          {isArchived
            ? <span style={S.pill('done')}>{statusLabel('done')}</span>
            : <select value={task.status} onChange={e=>{e.stopPropagation();changeStatus(task.id,e.target.value,task)}}
                style={{...S.pill(task.status), border:'none', cursor:'pointer', outline:'none', appearance:'none', fontFamily:"'DM Sans', sans-serif"}}>
                {Object.keys(STATUS_META).map(k=><option key={k} value={k}>{statusLabel(k)}</option>)}
              </select>
          }
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'3px', flexWrap:'wrap'}}>
          {assignedProfiles.length===0 && <span style={{color:'#d1d5db', fontSize:'12px'}}>—</span>}
          {assignedProfiles.slice(0,3).map(u => (
            <div key={u.id} title={u.full_name} style={{width:'22px',height:'22px',borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:'600',color:'#2563eb',border:'1px solid #bfdbfe'}}>
              {initials(u.full_name)}
            </div>
          ))}
          {assignedProfiles.length > 3 && <span style={{fontSize:'10px',color:'#9ca3af'}}>+{assignedProfiles.length-3}</span>}
        </div>
        <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
          <span style={{width:'7px',height:'7px',borderRadius:'50%',background:PRIO_DOT[task.priority],display:'inline-block'}}></span>
          <span style={{fontSize:'11px',color:'#9ca3af'}}>{task.priority==='high'?'Wysoki':task.priority==='med'?'Sredni':'Niski'}</span>
        </div>
        <div>
          {task.deadline
            ? <span style={{fontSize:'11px',fontWeight:'500',color:isOverdue(task)?'#dc2626':'#374151',background:isOverdue(task)?'#fef2f2':'transparent',padding:isOverdue(task)?'2px 6px':'0',borderRadius:'5px'}}>{fmtDate(task.deadline)}</span>
            : <span style={{color:'#d1d5db',fontSize:'11px'}}>—</span>}
        </div>
        {!isArchived
          ? <div style={{display:'flex',gap:'4px'}} onClick={e=>e.stopPropagation()}>
              <button onClick={()=>openDetail(task)} style={S.btnSm('green')}>{t.files}</button>
              <button onClick={()=>openEdit(task)} style={S.btnSm()}>{t.edit}</button>
              {availWS.length>0&&<button onClick={()=>openMove(task)} style={S.btnSm('indigo')}>{t.move}</button>}
              <button onClick={()=>deleteTask(task.id)} style={S.btnSm('red')}>{t.del}</button>
            </div>
          : <div style={{fontSize:'11px',color:'#9ca3af',fontStyle:'italic'}}>Archiwum</div>}
      </div>
    )
  }

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:"'DM Sans', -apple-system, sans-serif",fontSize:'14px'}}>
      {/* SIDEBAR */}
      <div style={S.sidebar}>
        <div style={S.sidebarTop}>
          <div style={{display:'flex',alignItems:'center',gap:'9px'}}>
            <div style={{width:'28px',height:'28px',background:'#111',borderRadius:'7px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <div style={{width:'11px',height:'11px',border:'2px solid white',borderRadius:'2px'}}></div>
            </div>
            <div>
              <div style={{fontWeight:'600',fontSize:'14px',letterSpacing:'-0.3px',color:'#111'}}>TaskFlow</div>
              <div style={{fontSize:'10px',color:'#9ca3af'}}>{t.appSub}</div>
            </div>
          </div>
        </div>

        <div style={S.sidebarSection}>
          <div style={S.sidebarLabel}>{t.ws}</div>
          {WORKSPACES.filter(ws=>profile?.role==='admin'||(profile?.areas||[]).includes(ws.key)).map(ws=>(
            <button key={ws.key} onClick={()=>{setWorkspace(ws.key);setFilter('all');setShowArchive(false);setShowSuggestions(false)}} style={S.wsBtn(workspace===ws.key&&!showSuggestions)}>
              {ws.label}
            </button>
          ))}
        </div>

        <nav style={{padding:'10px 8px',flex:1}}>
          {[
            {key:'all',label:t.all,count:counts.all},
            {key:'mine',label:t.mine,count:counts.mine,blue:true},
            {key:'open',label:t.open,count:counts.open},
            {key:'urgent',label:t.urgent,count:counts.urgent,red:true},
          ].map(item=>(
            <button key={item.key} onClick={()=>{setFilter(item.key);setShowArchive(false);setShowSuggestions(false)}} style={S.navBtn(filter===item.key&&!showArchive&&!showSuggestions)}>
              {item.label}
              <span style={S.badge(item.red&&item.count>0, item.blue&&item.count>0)}>{item.count}</span>
            </button>
          ))}
          <div style={{borderTop:'1px solid #f0f0ee',marginTop:'8px',paddingTop:'8px'}}>
            <button onClick={()=>{setShowArchive(true);setFilter('all');setShowSuggestions(false)}} style={S.navBtn(showArchive)}>
              📦 {t.archive}
              <span style={S.badge(false,false)}>{counts.archive}</span>
            </button>
            <button onClick={()=>{setShowSuggestions(true);setShowArchive(false)}} style={S.navBtn(showSuggestions)}>
              💡 {t.suggestions}
              {suggestionsCount > 0 && <span style={S.badge(false, false)}>{suggestionsCount}</span>}
            </button>
          </div>
        </nav>

        <div style={S.sidebarBottom}>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#111',marginBottom:'2px'}}>{profile?.full_name||user?.email?.split('@')[0]}</div>
          <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'10px'}}>{profile?.role==='admin'?t.admin:t.user}</div>
          <button onClick={()=>router.push('/messages')} style={{display:'block',fontSize:'11px',color:'#2563eb',border:'none',background:'none',cursor:'pointer',padding:'0',marginBottom:'5px',fontWeight:'500',fontFamily:"'DM Sans', sans-serif"}}>Wiadomosci</button>
          <button onClick={()=>router.push('/reports')} style={{display:'block',fontSize:'11px',color:'#16a34a',border:'none',background:'none',cursor:'pointer',padding:'0',marginBottom:'5px',fontWeight:'500',fontFamily:"'DM Sans', sans-serif"}}>{t.reports}</button>
          <button onClick={()=>router.push('/account')} style={{display:'block',fontSize:'11px',color:'#6b7280',border:'none',background:'none',cursor:'pointer',padding:'0',marginBottom:'5px',fontFamily:"'DM Sans', sans-serif"}}>{t.account}</button>
          {profile?.role==='admin'&&<button onClick={()=>router.push('/admin')} style={{display:'block',fontSize:'11px',color:'#7c3aed',border:'none',background:'none',cursor:'pointer',padding:'0',marginBottom:'5px',fontWeight:'500',fontFamily:"'DM Sans', sans-serif"}}>{t.adminPanel}</button>}
          <button onClick={logout} style={{display:'block',fontSize:'11px',color:'#9ca3af',border:'none',background:'none',cursor:'pointer',padding:'0',fontFamily:"'DM Sans', sans-serif"}}>{t.logout}</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        <div style={{...S.main,flex:1}}>
          <div style={S.liveBanner}>
            <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#16a34a',display:'inline-block'}}></span>
            {t.live}
          </div>

          {/* SUGGESTIONS VIEW */}
          {showSuggestions ? (
            <>
              <div style={S.topbar}>
                <span style={{fontSize:'15px',fontWeight:'600',letterSpacing:'-0.3px',color:'#111'}}>💡 Sugestie i usprawnienia</span>
                <span style={{flex:1}}/>
                <NotificationBell notifications={notifications} onMarkRead={markNotifRead} onMarkAllRead={markAllNotifsRead} onClickNotif={handleClickNotif}/>
                <button onClick={()=>setShowChat(v=>!v)} style={{position:'relative',display:'flex',alignItems:'center',gap:'6px',padding:'7px 13px',background:showChat?'#111':'#fff',color:showChat?'white':'#374151',border:'1px solid #e8e8e6',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:'500',fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>
                  💬 Czat
                  {totalUnread>0&&<span style={{position:'absolute',top:'-5px',right:'-5px',width:'16px',height:'16px',background:'#2563eb',color:'white',borderRadius:'50%',fontSize:'9px',fontWeight:'700',display:'flex',alignItems:'center',justifyContent:'center'}}>{totalUnread>9?'9+':totalUnread}</span>}
                </button>
              </div>
              <SuggestionsPanel user={user} profile={profile} users={users} />
            </>
          ) : (
            <>
              <div style={S.topbar}>
                <span style={{fontSize:'15px',fontWeight:'600',letterSpacing:'-0.3px',color:'#111'}}>
                  {WORKSPACES.find(w=>w.key===workspace)?.label}
                  {showArchive&&<span style={{fontSize:'13px',color:'#9ca3af',fontWeight:'400',marginLeft:'8px'}}>· {t.archive}</span>}
                </span>
                <button onClick={()=>router.push(workspace==='packpack'?'/crm-pp':'/crm')} style={{display:'flex',alignItems:'center',gap:'6px',padding:'6px 13px',borderRadius:'8px',border:'1px solid #e9d5ff',background:'#f5f3ff',color:'#6d28d9',fontSize:'13px',fontWeight:'500',cursor:'pointer',fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 7h6M2 11h8" stroke="#6d28d9" strokeWidth="1.3" strokeLinecap="round"/></svg>
                  {workspace==='packpack'?'CRM PP':'CRM'}
                </button>
                <span style={{flex:1}}/>
                {!showArchive&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.search} style={S.searchInput}/>}
                {!showArchive&&<button onClick={openNew} style={S.btnPrimary}>{t.newTask}</button>}
                <NotificationBell notifications={notifications} onMarkRead={markNotifRead} onMarkAllRead={markAllNotifsRead} onClickNotif={handleClickNotif}/>
                <button onClick={()=>setShowChat(v=>!v)} style={{position:'relative',display:'flex',alignItems:'center',gap:'6px',padding:'7px 13px',background:showChat?'#111':'#fff',color:showChat?'white':'#374151',border:'1px solid #e8e8e6',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:'500',fontFamily:"'DM Sans',sans-serif",flexShrink:0}}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7c0 2.8-2.2 5-5 5l-3 1.5.5-2C3 10.4 2 8.8 2 7c0-2.8 2.2-5 5-5s5 2.2 5 5z" stroke={showChat?'white':'#374151'} strokeWidth="1.3" strokeLinejoin="round"/></svg>
                  Czat
                  {totalUnread>0&&<span style={{position:'absolute',top:'-5px',right:'-5px',width:'16px',height:'16px',background:'#2563eb',color:'white',borderRadius:'50%',fontSize:'9px',fontWeight:'700',display:'flex',alignItems:'center',justifyContent:'center'}}>{totalUnread>9?'9+':totalUnread}</span>}
                </button>
              </div>

              {!showArchive&&(
                <div style={S.statsGrid}>
                  {[
                    {label:t.all,val:counts.all,color:'#111',action:()=>{setFilter('all');setShowArchive(false)}},
                    {label:t.mine,val:counts.mine,color:'#2563eb',action:()=>{setFilter('mine');setShowArchive(false)}},
                    {label:t.urgent,val:counts.urgent,color:'#dc2626',action:()=>{setFilter('urgent');setShowArchive(false)}},
                    {label:t.archive,val:counts.archive,color:'#9ca3af',action:()=>{setShowArchive(true);setFilter('all')}},
                  ].map(s=>{
                    const isActive = s.label===t.archive?showArchive:(filter===(s.label===t.all?'all':s.label===t.mine?'mine':'urgent')&&!showArchive)
                    return (
                      <div key={s.label} onClick={s.action} style={{...S.statCard,cursor:'pointer',border:isActive?`2px solid ${s.color}`:'1px solid #e8e8e6'}}>
                        <div style={{fontSize:'10px',color:'#9ca3af',marginBottom:'6px',fontWeight:'500',letterSpacing:'0.06em',textTransform:'uppercase'}}>{s.label}</div>
                        <div style={{fontSize:'28px',fontWeight:'600',color:s.color,letterSpacing:'-0.5px',lineHeight:'1'}}>{s.val}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div style={{flex:1,overflow:'auto',padding:'14px 24px 24px'}}>
                <div style={S.tableWrap}>
                  {showArchive&&<div style={{padding:'12px 20px',borderBottom:'1px solid #e8e8e6',background:'#fafaf9',display:'flex',alignItems:'center',gap:'8px'}}><span style={{fontSize:'13px',fontWeight:'500',color:'#6b7280'}}>📦 {t.archive}</span><span style={{fontSize:'12px',color:'#9ca3af'}}>— {t.archiveNote}</span></div>}
                  <div style={{display:'grid',gridTemplateColumns:cols,padding:'10px 16px',borderBottom:'1px solid #e8e8e6',background:'#fafaf9'}}>
                    {[t.col1,t.col2,t.col3,t.col4,t.col5,t.col6,t.col7,showArchive?'':t.col8].map((h,i)=>(
                      <span key={i} style={S.th}>{h}</span>
                    ))}
                  </div>
                  {showArchive
                    ? archived.length===0?<div style={{padding:'40px',textAlign:'center',color:'#9ca3af',fontSize:'13px'}}>{t.noArchive}</div>:archived.map((task,i)=><TaskRow key={task.id} task={task} isArchived={true} index={i}/>)
                    : filtered.length===0?<div style={{padding:'40px',textAlign:'center',color:'#9ca3af',fontSize:'13px'}}>{t.noTasks}</div>:filtered.map((task,i)=><TaskRow key={task.id} task={task} index={i}/>)
                  }
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showChat&&<ChatPanel user={user} profile={profile} lang={lang} chatUsers={chatUsers} chatSelected={chatSelected} setChatSelected={setChatSelected} chatMessages={chatMessages} chatText={chatText} setChatText={setChatText} chatUnread={chatUnread} chatTaskObj={chatTaskObj} setChatTaskObj={setChatTaskObj} chatTaskRef={chatTaskRef} setChatTaskRef={setChatTaskRef} showChatTaskPicker={showChatTaskPicker} setShowChatTaskPicker={setShowChatTaskPicker} chatTaskSearch={chatTaskSearch} setChatTaskSearch={setChatTaskSearch} chatAllTasks={chatAllTasks} chatSending={chatSending} chatEndRef={chatEndRef} chatFileRef={chatFileRef} chatInputRef={chatInputRef} sendChatMsg={sendChatMsg} sendChatFile={sendChatFile} onClose={()=>setShowChat(false)}/>}

      {/* PREVIEW MODAL */}
      {showPreview&&selectedTask&&(
        <div style={S.modalOverlay}>
          <div style={S.modal('620px')}>
            <div style={S.modalHeader}>
              <div>
                <div style={{fontSize:'15px',fontWeight:'600',color:'#111'}}>{selectedTask.product_name}</div>
                <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'3px'}}>
                  {selectedTask.order_number}{selectedTask.client_name?' · '+selectedTask.client_name:''}
                  {isOverdue(selectedTask)&&<span style={{marginLeft:'8px',background:'#fef2f2',color:'#dc2626',fontSize:'10px',padding:'2px 7px',borderRadius:'5px',fontWeight:'500'}}>{t.overdue}</span>}
                </div>
              </div>
              <button onClick={()=>setShowPreview(false)} style={{border:'none',background:'none',fontSize:'20px',cursor:'pointer',color:'#9ca3af'}}>×</button>
            </div>
            <div style={S.modalBody}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
                {[
                  {label:t.col4, val:<span style={S.pill(selectedTask.status)}>{statusLabel(selectedTask.status)}</span>},
                  {label:t.col6, val:<span style={{display:'flex',alignItems:'center',gap:'5px'}}><span style={{width:'8px',height:'8px',borderRadius:'50%',background:PRIO_DOT[selectedTask.priority],display:'inline-block'}}></span>{selectedTask.priority==='high'?'Wysoki':selectedTask.priority==='med'?'Sredni':'Niski'}</span>},
                  {label:t.col5, val:users.filter(u=>[...(selectedTask.assigned_users||[]),...(selectedTask.assigned_to?[selectedTask.assigned_to]:[])].includes(u.id)).map(u=>u.full_name).join(', ')||'—'},
                  {label:t.col7, val:selectedTask.deadline?fmtDate(selectedTask.deadline):'—'},
                  {label:t.col3, val:selectedTask.marketplace||'—'},
                  {label:'SKU', val:selectedTask.sku||'—'},
                ].map(item=>(
                  <div key={item.label} style={S.metaItem}>
                    <div style={S.metaLabel}>{item.label}</div>
                    <div style={{fontSize:'13px',color:'#111',fontWeight:'500'}}>{item.val}</div>
                  </div>
                ))}
              </div>
              {selectedTask.description&&<div style={{padding:'12px 14px',background:'#fafaf9',borderRadius:'8px',border:'1px solid #f0f0ee',fontSize:'13px',color:'#374151',lineHeight:'1.6',marginBottom:'16px'}}>{selectedTask.description}</div>}
              {taskFiles.length>0&&(
                <div style={{marginBottom:'16px'}}>
                  <div style={{...S.metaLabel,marginBottom:'8px'}}>{t.attach} ({taskFiles.length})</div>
                  {taskFiles.map(file=>(
                    <div key={file.name} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',border:'1px solid #e8e8e6',borderRadius:'8px',marginBottom:'6px',background:'#fafaf9'}}>
                      <div style={{width:'30px',height:'30px',borderRadius:'6px',background:'#f0f0ee',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:'600',color:'#6b7280'}}>{fileIcon(file.name)}</div>
                      <span style={{flex:1,fontSize:'13px',color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file.name.replace(/^\d+_/,'')}</span>
                      <button onClick={()=>getFileUrl(file.name)} style={S.btnSm()}>{t.download}</button>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <div style={{...S.metaLabel,marginBottom:'8px'}}>{t.comments} ({comments.length})</div>
                {comments.length===0&&<div style={{fontSize:'13px',color:'#9ca3af',fontStyle:'italic',marginBottom:'8px'}}>{t.noComments}</div>}
                {comments.map(c=>(
                  <div key={c.id} style={{marginBottom:'10px',padding:'10px 12px',background:'#fafaf9',borderRadius:'8px',border:'1px solid #f0f0ee'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'5px'}}>
                      <div style={{width:'22px',height:'22px',borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:'600',color:'#2563eb'}}>{initials(c.author?.full_name)}</div>
                      <span style={{fontSize:'12px',fontWeight:'500',color:'#374151'}}>{c.author?.full_name||'?'}</span>
                      <span style={{fontSize:'11px',color:'#9ca3af'}}>{fmtDT(c.created_at)}</span>
                    </div>
                    <div style={{fontSize:'13px',color:'#111',lineHeight:'1.5',paddingLeft:'29px'}}>{c.content}</div>
                  </div>
                ))}
                <div style={{display:'flex',gap:'8px',marginTop:'10px'}}>
                  <input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendComment()} placeholder={t.addComment} style={{...S.input,flex:1}}/>
                  <button onClick={sendComment} disabled={sendingCmt||!newComment.trim()} style={{...S.btnPrimary,opacity:(!newComment.trim()||sendingCmt)?0.5:1}}>{t.send}</button>
                </div>
              </div>
            </div>
            <div style={S.modalFooter}>
              {!showArchive&&<button onClick={()=>{setShowPreview(false);openDetail(selectedTask)}} style={{...S.btnSm('green'),padding:'8px 14px',fontSize:'13px'}}>📎 {t.files}</button>}
              {!showArchive&&<button onClick={()=>{setShowPreview(false);openEdit(selectedTask)}} style={S.btnPrimary}>{t.edit}</button>}
              <button onClick={()=>setShowPreview(false)} style={{...S.btnSm(),padding:'8px 16px',fontSize:'13px'}}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE MODAL */}
      {showMove&&selectedTask&&(
        <div style={S.modalOverlay}>
          <div style={S.modal('340px')}>
            <div style={S.modalHeader}>
              <span style={{fontSize:'15px',fontWeight:'600'}}>{t.moveTitle}</span>
              <button onClick={()=>setShowMove(false)} style={{border:'none',background:'none',fontSize:'20px',cursor:'pointer',color:'#9ca3af'}}>×</button>
            </div>
            <div style={S.modalBody}>
              <div style={{fontSize:'13px',color:'#374151',marginBottom:'14px',fontWeight:'500'}}>{selectedTask.product_name}</div>
              <FormField label={t.moveTo}>
                <select value={moveTarget} onChange={e=>setMoveTarget(e.target.value)} style={{...S.select,marginBottom:'20px'}}>
                  {availWS.map(w=><option key={w.key} value={w.key}>{w.label}</option>)}
                </select>
              </FormField>
              <div style={{display:'flex',justifyContent:'flex-end',gap:'8px'}}>
                <button onClick={()=>setShowMove(false)} style={{...S.btnSm(),padding:'8px 16px',fontSize:'13px'}}>{t.cancel}</button>
                <button onClick={doMove} style={{...S.btnPrimary,background:'#4f46e5'}}>{t.move}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILES MODAL */}
      {showDetail&&selectedTask&&(
        <div style={S.modalOverlay}>
          <div style={S.modal('560px')}>
            <div style={S.modalHeader}>
              <div>
                <div style={{fontSize:'15px',fontWeight:'600'}}>{selectedTask.product_name}</div>
                <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'2px'}}>{selectedTask.order_number}{selectedTask.client_name?' · '+selectedTask.client_name:''}</div>
              </div>
              <button onClick={()=>setShowDetail(false)} style={{border:'none',background:'none',fontSize:'20px',cursor:'pointer',color:'#9ca3af'}}>×</button>
            </div>
            <div style={S.modalBody}>
              <div style={{marginBottom:'18px'}}>
                <div style={{marginBottom:'10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{...S.metaLabel,marginBottom:'0'}}>{t.attach} ({taskFiles.length})</div>
                  <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{...S.btnSm('green'),padding:'5px 10px',fontSize:'12px'}}>{uploading?t.uploading:t.addFile}</button>
                  <input ref={fileRef} type="file" style={{display:'none'}} onChange={uploadFile} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp"/>
                </div>
                {taskFiles.length===0&&<div style={{padding:'16px',textAlign:'center',color:'#9ca3af',fontSize:'13px',border:'1px dashed #e8e8e6',borderRadius:'8px',background:'#fafaf9'}}>{t.noFiles}</div>}
                {taskFiles.map(file=>(
                  <div key={file.name} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 12px',border:'1px solid #e8e8e6',borderRadius:'8px',marginBottom:'6px',background:'#fafaf9'}}>
                    <div style={{width:'32px',height:'32px',borderRadius:'6px',background:'#f0f0ee',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:'600',color:'#6b7280'}}>{fileIcon(file.name)}</div>
                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:'13px',fontWeight:'500',color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{file.name.replace(/^\d+_/,'')}</div></div>
                    <button onClick={()=>getFileUrl(file.name)} style={S.btnSm()}>{t.download}</button>
                    <button onClick={()=>deleteFile(file.name)} style={S.btnSm('red')}>{t.del}</button>
                  </div>
                ))}
              </div>
              <div>
                <div style={{...S.metaLabel,marginBottom:'10px'}}>{t.comments} ({comments.length})</div>
                {comments.length===0&&<div style={{padding:'16px',textAlign:'center',color:'#9ca3af',fontSize:'13px',border:'1px dashed #e8e8e6',borderRadius:'8px',background:'#fafaf9',marginBottom:'10px'}}>{t.noComments}</div>}
                {comments.map(c=>(
                  <div key={c.id} style={{marginBottom:'8px',padding:'10px 12px',background:'#fafaf9',borderRadius:'8px',border:'1px solid #f0f0ee'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'7px',marginBottom:'4px'}}>
                      <div style={{width:'20px',height:'20px',borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:'600',color:'#2563eb'}}>{initials(c.author?.full_name)}</div>
                      <span style={{fontSize:'12px',fontWeight:'500',color:'#374151'}}>{c.author?.full_name||'?'}</span>
                      <span style={{fontSize:'11px',color:'#9ca3af'}}>{fmtDT(c.created_at)}</span>
                    </div>
                    <div style={{fontSize:'13px',color:'#111',lineHeight:'1.5',paddingLeft:'27px'}}>{c.content}</div>
                  </div>
                ))}
                <div style={{display:'flex',gap:'8px',marginTop:'10px'}}>
                  <input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendComment()} placeholder={t.addComment} style={{...S.input,flex:1}}/>
                  <button onClick={sendComment} disabled={sendingCmt||!newComment.trim()} style={{...S.btnPrimary,opacity:(!newComment.trim()||sendingCmt)?0.5:1}}>{t.send}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW/EDIT MODAL */}
      {showModal&&(
        <div style={S.modalOverlay}>
          <div style={S.modal()}>
            <div style={S.modalHeader}>
              <span style={{fontSize:'15px',fontWeight:'600'}}>{editingTask?t.editTask:t.newTaskTitle}</span>
              <button onClick={()=>setShowModal(false)} style={{border:'none',background:'none',fontSize:'20px',cursor:'pointer',color:'#9ca3af'}}>×</button>
            </div>
            <div style={S.modalBody}>
              <div style={S.grid2}>
                <FormField label={t.f_order}><input value={form.order_number} onChange={e=>setForm({...form,order_number:e.target.value})} placeholder="ORD-2026-001" style={S.input}/></FormField>
                <FormField label={t.f_claim}><input value={form.claim_number} onChange={e=>setForm({...form,claim_number:e.target.value})} placeholder="CLM-001" style={S.input}/></FormField>
              </div>
              <div style={{marginBottom:'12px'}}>
                <FormField label={t.f_product}><input value={form.product_name} onChange={e=>setForm({...form,product_name:e.target.value})} placeholder="np. Strawberry Slices 100g" style={S.input}/></FormField>
              </div>
              <div style={S.grid2}>
                <FormField label={t.f_sku}><input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="HF-STR-100" style={S.input}/></FormField>
                <FormField label={t.f_client}><input value={form.client_name} onChange={e=>setForm({...form,client_name:e.target.value})} placeholder="Nazwa klienta" style={S.input}/></FormField>
              </div>
              <div style={S.grid2}>
                <FormField label={t.f_marketplace}>
                  <select value={form.marketplace} onChange={e=>setForm({...form,marketplace:e.target.value})} style={S.select}>
                    {['Amazon UK','eBay UK','Sklep wlasny','Allegro','OnBuy','Inne'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </FormField>
                <FormField label={t.f_cat}>
                  <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})} style={S.select}>
                    {['Reklamacja','Zwrot','Uszkodzenie','Brak dostawy','Inne'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </FormField>
              </div>
              <div style={S.grid2}>
                <FormField label={t.f_prio}>
                  <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} style={S.select}>
                    <option value="high">Wysoki</option>
                    <option value="med">Sredni</option>
                    <option value="low">Niski</option>
                  </select>
                </FormField>
                <FormField label={t.f_status}>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={S.select}>
                    {Object.entries(STATUS_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                  </select>
                </FormField>
              </div>
              <div style={{marginBottom:'12px'}}>
                <FormField label={`${t.f_assign} (mozna wybrac wiele)`}>
                  <UserMultiSelect
                    users={users}
                    selected={[...new Set([...(form.assigned_users||[]),...(form.assigned_to?[form.assigned_to]:[])])]}
                    onChange={(ids)=>setForm({...form,assigned_users:ids,assigned_to:ids[0]||''})}
                  />
                </FormField>
              </div>
              <div style={{marginBottom:'12px'}}>
                <FormField label={t.f_deadline}><input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})} style={S.input}/></FormField>
              </div>
              {crmClients.length>0&&(
                <div style={{marginBottom:'12px'}}>
                  <FormField label="Klient CRM (opcjonalnie)">
                    <select value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value})} style={S.select}>
                      <option value="">— Brak powiazania —</option>
                      {crmClients.map(c=><option key={c.id} value={c.id}>{c.company_name||c.contact_name}</option>)}
                    </select>
                  </FormField>
                </div>
              )}
              <FormField label={t.f_desc}>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder={t.f_desc} style={{...S.input,height:'72px',resize:'vertical'}}/>
              </FormField>
            </div>
            <div style={S.modalFooter}>
              <button onClick={()=>setShowModal(false)} style={{...S.btnSm(),padding:'9px 16px',fontSize:'13px'}}>{t.cancel}</button>
              <button onClick={handleSave} disabled={saving} style={{...S.btnPrimary,opacity:saving?0.7:1}}>
                {saving?t.saving:editingTask?t.saveChanges:t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
