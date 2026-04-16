'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

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

const T = {
  pl: {
    appSub:'Jamo Operations', ws:'Obszar roboczy',
    all:'Wszystkie', mine:'Moje', open:'Otwarte', urgent:'Pilne', archive:'Archiwum',
    search:'Szukaj...', newTask:'Nowe zadanie',
    live:'Polaczono — sync na zywo',
    admin:'Admin', user:'Uzytkownik', account:'Moje konto', logout:'Wyloguj',
    reports:'Raporty', adminPanel:'Panel admina',
    col1:'Nr zam.', col2:'Zadanie', col3:'Marketplace', col4:'Status', col5:'Przypisano', col6:'Prio', col7:'Termin', col8:'Akcje',
    noTasks:'Brak zadan', noArchive:'Brak zarchiwizowanych zadan',
    files:'Pliki', edit:'Edytuj', del:'Usun', move:'Przenies',
    editTask:'Edytuj zadanie', newTaskTitle:'Nowe zadanie',
    f_order:'Nr zamowienia', f_claim:'Nr reklamacji', f_product:'Nazwa produktu *',
    f_sku:'SKU', f_client:'Klient', f_cat:'Kategoria', f_prio:'Priorytet',
    f_status:'Status', f_assign:'Przypisz do', f_none:'— Nieprzypisane —',
    f_desc:'Opis / Nastepny krok', f_deadline:'Termin wykonania', f_marketplace:'Marketplace',
    cancel:'Anuluj', save:'Zapisz', saveChanges:'Zapisz zmiany', saving:'Zapisywanie...',
    high:'Wysoki', med:'Sredni', low:'Niski',
    attach:'Zalaczniki', noFiles:'Brak plikow — kliknij Dodaj plik',
    addFile:'Dodaj plik', uploading:'Wgrywanie...', download:'Pobierz',
    delConfirm:'Usunac to zadanie?', delFileConfirm:'Usunac ten plik?',
    comments:'Komentarze', addComment:'Dodaj komentarz...', send:'Wyslij',
    noComments:'Brak komentarzy', overdue:'Przeterminowane',
    moveTitle:'Przenies zadanie', moveTo:'Przenies do:',
    archiveNote:'Zamkniete zadania trafiaja do archiwum',
    notifOn:'Powiadomienia wlaczone', notifOff:'Wlacz powiadomienia', notifBlocked:'Powiadomienia zablokowane',
    descLabel:'Opis',
  },
  en: {
    appSub:'Jamo Operations', ws:'Workspace',
    all:'All', mine:'Mine', open:'Open', urgent:'Urgent', archive:'Archive',
    search:'Search...', newTask:'New task',
    live:'Connected — live sync',
    admin:'Admin', user:'User', account:'My account', logout:'Logout',
    reports:'Reports', adminPanel:'Admin panel',
    col1:'Order no.', col2:'Task', col3:'Marketplace', col4:'Status', col5:'Assigned', col6:'Prio', col7:'Deadline', col8:'Actions',
    noTasks:'No tasks', noArchive:'No archived tasks',
    files:'Files', edit:'Edit', del:'Delete', move:'Move',
    editTask:'Edit task', newTaskTitle:'New task',
    f_order:'Order number', f_claim:'Claim number', f_product:'Product name *',
    f_sku:'SKU', f_client:'Client', f_cat:'Category', f_prio:'Priority',
    f_status:'Status', f_assign:'Assign to', f_none:'— Unassigned —',
    f_desc:'Description / Next step', f_deadline:'Deadline', f_marketplace:'Marketplace',
    cancel:'Cancel', save:'Save', saveChanges:'Save changes', saving:'Saving...',
    high:'High', med:'Medium', low:'Low',
    attach:'Attachments', noFiles:'No files — click Add file',
    addFile:'Add file', uploading:'Uploading...', download:'Download',
    delConfirm:'Delete this task?', delFileConfirm:'Delete this file?',
    comments:'Comments', addComment:'Add a comment...', send:'Send',
    noComments:'No comments yet', overdue:'Overdue',
    moveTitle:'Move task', moveTo:'Move to:',
    archiveNote:'Closed tasks go to archive',
    notifOn:'Notifications on', notifOff:'Enable notifications', notifBlocked:'Notifications blocked',
    descLabel:'Description',
  }
}

function urlBase64ToUint8Array(b) {
  const p = '='.repeat((4 - b.length % 4) % 4)
  const s = (b + p).replace(/-/g,'+').replace(/_/g,'/')
  const r = window.atob(s)
  const o = new Uint8Array(r.length)
  for (let i=0;i<r.length;++i) o[i]=r.charCodeAt(i)
  return o
}

const S = {
  sidebar: { width:'224px', background:'#fff', borderRight:'1px solid #e8e8e6', display:'flex', flexDirection:'column', flexShrink:0 },
  sidebarTop: { padding:'18px 16px 14px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' },
  sidebarSection: { padding:'10px 12px', borderBottom:'1px solid #e8e8e6' },
  sidebarLabel: { fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'6px', fontWeight:'500' },
  sidebarBottom: { padding:'14px 16px', borderTop:'1px solid #e8e8e6' },
  navBtn: (active) => ({ display:'flex', alignItems:'center', width:'100%', textAlign:'left', padding:'7px 9px', borderRadius:'7px', fontSize:'13px', cursor:'pointer', border:'none', background:active?'#f4f4f3':'transparent', color:active?'#111':'#6b7280', fontWeight:active?'500':'400', marginBottom:'2px', transition:'all 0.1s' }),
  wsBtn: (active) => ({ display:'block', width:'100%', textAlign:'left', padding:'6px 9px', borderRadius:'7px', fontSize:'13px', cursor:'pointer', border:'none', background:active?'#111':'transparent', color:active?'#fff':'#6b7280', fontWeight:active?'500':'400', marginBottom:'3px', transition:'all 0.12s' }),
  badge: (red, blue) => ({ marginLeft:'auto', fontSize:'11px', background: red?'#fef2f2':blue?'#eff6ff':'#f4f4f3', color: red?'#dc2626':blue?'#2563eb':'#9ca3af', padding:'1px 7px', borderRadius:'10px', fontWeight:'500' }),
  topbar: { background:'#fff', borderBottom:'1px solid #e8e8e6', padding:'0 24px', height:'56px', display:'flex', alignItems:'center', gap:'12px' },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'#f5f5f3' },
  liveBanner: { background:'#f0fdf4', borderBottom:'1px solid #bbf7d0', padding:'5px 24px', fontSize:'11px', color:'#166534', display:'flex', alignItems:'center', gap:'6px', letterSpacing:'0.01em' },
  statsGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', padding:'16px 24px 0' },
  statCard: { background:'#fff', borderRadius:'10px', padding:'16px 18px', border:'1px solid #e8e8e6' },
  tableWrap: { background:'#fff', borderRadius:'10px', border:'1px solid #e8e8e6', overflow:'hidden' },
  th: { fontSize:'10px', color:'#9ca3af', fontWeight:'500', textTransform:'uppercase', letterSpacing:'0.06em' },
  searchInput: { padding:'9px 13px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', width:'220px', outline:'none', background:'#fafaf9', color:'#111', fontFamily:"'DM Sans', sans-serif", transition:'border-color 0.15s' },
  btnPrimary: { background:'#111', color:'white', border:'none', borderRadius:'8px', padding:'9px 18px', fontSize:'13px', fontWeight:'500', cursor:'pointer', whiteSpace:'nowrap', fontFamily:"'DM Sans', sans-serif", letterSpacing:'-0.1px', transition:'opacity 0.15s' },
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
  label: { display:'block', fontSize:'12px', fontWeight:'500', marginBottom:'5px', color:'#374151', letterSpacing:'0.01em' },
  input: { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', outline:'none', fontFamily:"'DM Sans', sans-serif", color:'#111', background:'#fff', transition:'border-color 0.15s' },
  select: { width:'100%', padding:'9px 12px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', outline:'none', fontFamily:"'DM Sans', sans-serif", color:'#111', background:'#fff' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' },
  row: { display:'grid', padding:'12px 18px', borderBottom:'1px solid #f0f0ee', alignItems:'center', cursor:'pointer', transition:'background 0.1s' },
  pill: (status) => ({ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:'500', background:STATUS_META[status]?.bg||'#f4f4f3', color:STATUS_META[status]?.color||'#374151' }),
  metaItem: { padding:'10px 13px', background:'#fafaf9', borderRadius:'8px', border:'1px solid #f0f0ee' },
  metaLabel: { fontSize:'10px', color:'#9ca3af', marginBottom:'5px', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'500' },
}

function FormField({ label, children }) {
  return <div><label style={S.label}>{label}</label>{children}</div>
}

export default function Dashboard() {
  const router = useRouter()
  const [lang, setLang] = useState('pl')
  const t = T[lang]
  const sl = (l) => ({ open:T[l].col4==='Status'?'Open':'Otwarte', inprogress:l==='en'?'In progress':'W trakcie', waiting:l==='en'?'Waiting':'Oczekuje', done:l==='en'?'Closed':'Zamkniete', urgent:l==='en'?'Urgent':'Pilne' })
  const statusLabel = (s) => lang==='en' ? STATUS_META[s]?.labelEn : STATUS_META[s]?.label

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [workspace, setWorkspace] = useState('jamo_healthy')
  const [filter, setFilter] = useState('all')
  const [showArchive, setShowArchive] = useState(false)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [taskFiles, setTaskFiles] = useState([])
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sendingCmt, setSendingCmt] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [moveTarget, setMoveTarget] = useState('')
  const [notifStatus, setNotifStatus] = useState('default')
  const fileRef = useRef(null)
  const [form, setForm] = useState({ order_number:'', claim_number:'', product_name:'', sku:'', client_name:'', marketplace:'Amazon UK', category:'Reklamacja', description:'', status:'open', priority:'med', assigned_to:'', deadline:'' })

  useEffect(() => {
    const saved = localStorage.getItem('tf_lang'); if (saved) setLang(saved)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUser(user)
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
    })
    supabase.from('profiles').select('id, full_name').then(({ data }) => setUsers(data || []))
    if ('Notification' in window) setNotifStatus(Notification.permission)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{})
  }, [])

  function toggleLang() { const n=lang==='pl'?'en':'pl'; setLang(n); localStorage.setItem('tf_lang',n) }

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
  async function loadComments(id) { const { data } = await supabase.from('comments').select('*, author:profiles!author_id(full_name)').eq('task_id', id).order('created_at',{ascending:true}); setComments(data||[]) }

  async function uploadFile(e) {
    const file = e.target.files[0]; if (!file||!selectedTask) return
    setUploading(true)
    await supabase.storage.from('task-files').upload(`${selectedTask.id}/${Date.now()}_${file.name}`, file)
    await loadFiles(selectedTask.id); setUploading(false)
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
    setNewComment(''); await loadComments(selectedTask.id); setSendingCmt(false)
  }
  async function logout() { await supabase.auth.signOut(); router.push('/') }

  function openNew() {
    setEditingTask(null)
    setForm({ order_number:'', claim_number:'', product_name:'', sku:'', client_name:'', marketplace:'Amazon UK', category:'Reklamacja', description:'', status:'open', priority:'med', assigned_to:'', deadline:'' })
    setShowModal(true)
  }
  function openEdit(task) {
    setEditingTask(task)
    setForm({ order_number:task.order_number||'', claim_number:task.claim_number||'', product_name:task.product_name||'', sku:task.sku||'', client_name:task.client_name||'', marketplace:task.marketplace||'Amazon UK', category:task.category||'Reklamacja', description:task.description||'', status:task.status||'open', priority:task.priority||'med', assigned_to:task.assigned_to||'', deadline:task.deadline?task.deadline.split('T')[0]:'' })
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
    const payload = { ...form, assigned_to:form.assigned_to||null, deadline:form.deadline||null }
    if (editingTask) {
      if (form.assigned_to && form.assigned_to!==editingTask.assigned_to) {
        await fetch('/api/send-push', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user_id:form.assigned_to, title:'Nowe zadanie przypisane', body:`Przypisano Ci: ${form.product_name}`, url:'/dashboard' }) })
      }
      await supabase.from('tasks').update(payload).eq('id', editingTask.id)
    } else {
      await supabase.from('tasks').insert({ ...payload, area:workspace, created_by:user.id })
      if (form.assigned_to && form.assigned_to!==user.id) {
        await fetch('/api/send-push', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user_id:form.assigned_to, title:'Nowe zadanie przypisane', body:`Przypisano Ci: ${form.product_name}`, url:'/dashboard' }) })
      }
    }
    setSaving(false); setShowModal(false); setEditingTask(null); loadTasks()
  }
  async function deleteTask(id) { if (!confirm(t.delConfirm)) return; await supabase.from('tasks').delete().eq('id',id); loadTasks() }
  async function changeStatus(id, status) { await supabase.from('tasks').update({ status }).eq('id',id); loadTasks() }

  async function enableNotifications() {
    if (!('Notification' in window)||!('serviceWorker' in navigator)) return
    const perm = await Notification.requestPermission(); setNotifStatus(perm)
    if (perm!=='granted') return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('push_subscriptions').upsert({ user_id:user.id, subscription:sub.toJSON() })
    } catch(e) { console.error(e) }
  }

  function isOverdue(task) { return task.deadline && task.status!=='done' && new Date(task.deadline)<new Date() }

  const active = tasks.filter(t2=>t2.status!=='done')
  const archived = tasks.filter(t2=>t2.status==='done')
  const filtered = active.filter(t2 => {
    if (filter==='urgent' && t2.status!=='urgent') return false
    if (filter==='open' && !['open','inprogress','waiting'].includes(t2.status)) return false
    if (filter==='mine' && t2.assigned_to!==user?.id) return false
    if (search) { const q=search.toLowerCase(); return (t2.order_number||'').toLowerCase().includes(q)||(t2.product_name||'').toLowerCase().includes(q)||(t2.client_name||'').toLowerCase().includes(q)||(t2.claim_number||'').toLowerCase().includes(q) }
    return true
  })
  const counts = { all:active.length, open:active.filter(t2=>['open','inprogress','waiting'].includes(t2.status)).length, urgent:active.filter(t2=>t2.status==='urgent').length, mine:active.filter(t2=>t2.assigned_to===user?.id).length, archive:archived.length }
  const availWS = WORKSPACES.filter(w=>w.key!==workspace&&(profile?.role==='admin'||(profile?.areas||[]).includes(w.key)))
  const cols = '100px 1fr 100px 120px 90px 70px 80px 140px'
  const fmtDate = (d) => d?new Date(d).toLocaleDateString(lang==='pl'?'pl-PL':'en-GB'):''
  const fmtDT = (d) => d?new Date(d).toLocaleString(lang==='pl'?'pl-PL':'en-GB',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):''
  const fileIcon = (n) => n.match(/\.(jpg|jpeg|png|gif|webp)$/i)?'IMG':n.match(/\.pdf$/i)?'PDF':n.match(/\.docx?$/i)?'DOC':n.match(/\.xlsx?$/i)?'XLS':'FILE'
  const initials = (name) => (name||'?').substring(0,2).toUpperCase()

  const notifBtnStyle = notifStatus==='granted'
    ? { bg:'#f0fdf4', color:'#166534', label:'✓ '+t.notifOn, disabled:true }
    : notifStatus==='denied'
    ? { bg:'#fef2f2', color:'#dc2626', label:'✕ '+t.notifBlocked, disabled:true }
    : { bg:'#fafaf9', color:'#374151', label:'🔔 '+t.notifOff, disabled:false }

  const TaskRow = ({ task, isArchived=false, index=0 }) => {
    const baseBg = index % 2 === 0 ? '#ffffff' : '#f7f7f5'
    return (
    <div onClick={()=>openPreview(task)}
      style={{...S.row, gridTemplateColumns:cols, opacity:isArchived?0.65:1, background:baseBg}}
      onMouseEnter={e=>e.currentTarget.style.background='#eef2ff'}
      onMouseLeave={e=>e.currentTarget.style.background=baseBg}>
      <div>
        <div style={{fontSize:'12px', fontWeight:'500', color:'#2563eb', fontFamily:"'DM Mono', monospace", letterSpacing:'-0.3px'}}>{task.order_number||'—'}</div>
        <div style={{fontSize:'10px', color:'#9ca3af', marginTop:'1px'}}>{task.claim_number||''}</div>
      </div>
      <div>
        <div style={{fontSize:'13px', fontWeight:'500', color:'#111', letterSpacing:'-0.1px'}}>{task.product_name}</div>
        <div style={{fontSize:'12px', color:'#9ca3af', marginTop:'2px'}}>{task.client_name}{task.category?' · '+task.category:''}</div>
      </div>
      <div style={{fontSize:'12px', color:'#6b7280'}}>{task.marketplace||'—'}</div>
      <div onClick={e=>e.stopPropagation()}>
        {isArchived
          ? <span style={S.pill('done')}>{statusLabel('done')}</span>
          : <select value={task.status} onChange={e=>{e.stopPropagation();changeStatus(task.id,e.target.value)}}
              style={{...S.pill(task.status), border:'none', cursor:'pointer', outline:'none', appearance:'none', paddingRight:'6px', fontFamily:"'DM Sans', sans-serif"}}>
              {Object.keys(STATUS_META).map(k=><option key={k} value={k}>{statusLabel(k)}</option>)}
            </select>
        }
      </div>
      <div style={{fontSize:'12px', color:'#6b7280', display:'flex', alignItems:'center', gap:'5px'}}>
        {task.assigned_profile?.full_name
          ? <><div style={{width:'20px',height:'20px',borderRadius:'50%',background:'#eff6ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:'600',color:'#2563eb',flexShrink:0,letterSpacing:'0'}}>{initials(task.assigned_profile.full_name)}</div><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'12px'}}>{task.assigned_profile.full_name}</span></>
          : <span style={{color:'#d1d5db'}}>—</span>}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
        <span style={{width:'7px',height:'7px',borderRadius:'50%',background:PRIO_DOT[task.priority],flexShrink:0,display:'inline-block'}}></span>
        <span style={{fontSize:'11px',color:'#9ca3af'}}>{task.priority==='high'?t.high:task.priority==='med'?t.med:t.low}</span>
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
  )}



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
              <div style={{fontSize:'10px',color:'#9ca3af',marginTop:'1px'}}>{t.appSub}</div>
            </div>
          </div>
          <button onClick={toggleLang} style={{fontSize:'16px',border:'1px solid #e8e8e6',borderRadius:'6px',padding:'3px 7px',cursor:'pointer',background:'#fafaf9',lineHeight:'1.3'}}>
            {lang==='pl'?'🇵🇱':'🇬🇧'}
          </button>
        </div>

        <div style={S.sidebarSection}>
          <div style={S.sidebarLabel}>{t.ws}</div>
          {WORKSPACES.filter(ws=>profile?.role==='admin'||(profile?.areas||[]).includes(ws.key)).map(ws=>(
            <button key={ws.key} onClick={()=>{setWorkspace(ws.key);setFilter('all');setShowArchive(false)}} style={S.wsBtn(workspace===ws.key)}>
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
            <button key={item.key} onClick={()=>{setFilter(item.key);setShowArchive(false)}} style={S.navBtn(filter===item.key&&!showArchive)}>
              {item.label}
              <span style={S.badge(item.red&&item.count>0, item.blue&&item.count>0)}>{item.count}</span>
            </button>
          ))}
          <div style={{borderTop:'1px solid #f0f0ee',marginTop:'8px',paddingTop:'8px'}}>
            <button onClick={()=>{setShowArchive(true);setFilter('all')}} style={S.navBtn(showArchive)}>
              📦 {t.archive}
              <span style={S.badge(false,false)}>{counts.archive}</span>
            </button>
          </div>
        </nav>

        <div style={S.sidebarBottom}>
          <div style={{fontSize:'13px',fontWeight:'500',color:'#111',marginBottom:'2px',letterSpacing:'-0.1px'}}>{profile?.full_name||user?.email?.split('@')[0]}</div>
          <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'10px'}}>{profile?.role==='admin'?t.admin:t.user}</div>
          <button onClick={enableNotifications} disabled={notifBtnStyle.disabled}
            style={{display:'block',width:'100%',textAlign:'left',fontSize:'11px',color:notifBtnStyle.color,background:notifBtnStyle.bg,border:'1px solid #e8e8e6',borderRadius:'6px',cursor:notifBtnStyle.disabled?'default':'pointer',padding:'5px 8px',marginBottom:'8px',fontWeight:'500',fontFamily:"'DM Sans', sans-serif"}}>
            {notifBtnStyle.label}
          </button>
          <button onClick={()=>router.push('/messages')} style={{display:'block',fontSize:'11px',color:'#2563eb',border:'none',background:'none',cursor:'pointer',padding:'0',marginBottom:'5px',fontWeight:'500',fontFamily:"'DM Sans', sans-serif"}}>
            {lang==='pl'?'Wiadomosci':'Messages'}
          </button>
          <button onClick={()=>router.push('/reports')} style={{display:'block',fontSize:'11px',color:'#16a34a',border:'none',background:'none',cursor:'pointer',padding:'0',marginBottom:'5px',fontWeight:'500',fontFamily:"'DM Sans', sans-serif"}}>{t.reports}</button>
          <button onClick={()=>router.push('/account')} style={{display:'block',fontSize:'11px',color:'#6b7280',border:'none',background:'none',cursor:'pointer',padding:'0',marginBottom:'5px',fontFamily:"'DM Sans', sans-serif"}}>{t.account}</button>
          {profile?.role==='admin'&&<button onClick={()=>router.push('/admin')} style={{display:'block',fontSize:'11px',color:'#7c3aed',border:'none',background:'none',cursor:'pointer',padding:'0',marginBottom:'5px',fontWeight:'500',fontFamily:"'DM Sans', sans-serif"}}>{t.adminPanel}</button>}
          <button onClick={logout} style={{display:'block',fontSize:'11px',color:'#9ca3af',border:'none',background:'none',cursor:'pointer',padding:'0',fontFamily:"'DM Sans', sans-serif"}}>{t.logout}</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={S.main}>
        <div style={S.liveBanner}>
          <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#16a34a',display:'inline-block'}}></span>
          {t.live}
        </div>

        <div style={S.topbar}>
          <span style={{fontSize:'15px',fontWeight:'600',flex:1,letterSpacing:'-0.3px',color:'#111'}}>
            {WORKSPACES.find(w=>w.key===workspace)?.label}
            {showArchive&&<span style={{fontSize:'13px',color:'#9ca3af',fontWeight:'400',marginLeft:'8px'}}>· {t.archive}</span>}
          </span>
          {!showArchive&&<input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.search} style={S.searchInput} />}
          {!showArchive&&<button onClick={openNew} style={S.btnPrimary}>{t.newTask}</button>}
        </div>

        {!showArchive&&(
          <div style={S.statsGrid}>
            {[
              {label:t.all, val:counts.all, color:'#111'},
              {label:t.mine, val:counts.mine, color:'#2563eb'},
              {label:t.urgent, val:counts.urgent, color:'#dc2626'},
              {label:t.archive, val:counts.archive, color:'#9ca3af'},
            ].map(s=>(
              <div key={s.label} style={S.statCard}>
                <div style={{fontSize:'10px',color:'#9ca3af',marginBottom:'6px',fontWeight:'500',letterSpacing:'0.06em',textTransform:'uppercase'}}>{s.label}</div>
                <div style={{fontSize:'28px',fontWeight:'600',color:s.color,letterSpacing:'-0.5px',lineHeight:'1'}}>{s.val}</div>
              </div>
            ))}
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
      </div>

      {/* PREVIEW MODAL */}
      {showPreview&&selectedTask&&(
        <div style={S.modalOverlay}>
          <div style={S.modal('600px')}>
            <div style={S.modalHeader}>
              <div>
                <div style={{fontSize:'15px',fontWeight:'600',letterSpacing:'-0.2px',color:'#111'}}>{selectedTask.product_name}</div>
                <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'3px'}}>
                  {selectedTask.order_number}{selectedTask.client_name?' · '+selectedTask.client_name:''}
                  {isOverdue(selectedTask)&&<span style={{marginLeft:'8px',background:'#fef2f2',color:'#dc2626',fontSize:'10px',padding:'2px 7px',borderRadius:'5px',fontWeight:'500'}}>{t.overdue}</span>}
                </div>
              </div>
              <button onClick={()=>setShowPreview(false)} style={{border:'none',background:'none',fontSize:'20px',cursor:'pointer',color:'#9ca3af',lineHeight:'1'}}>×</button>
            </div>
            <div style={S.modalBody}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'16px'}}>
                {[
                  {label:t.col4, val:<span style={S.pill(selectedTask.status)}>{statusLabel(selectedTask.status)}</span>},
                  {label:t.col6, val:<span style={{display:'flex',alignItems:'center',gap:'5px'}}><span style={{width:'8px',height:'8px',borderRadius:'50%',background:PRIO_DOT[selectedTask.priority],display:'inline-block'}}></span>{selectedTask.priority==='high'?t.high:selectedTask.priority==='med'?t.med:t.low}</span>},
                  {label:t.col5, val:selectedTask.assigned_profile?.full_name||'—'},
                  {label:t.col7, val:selectedTask.deadline?fmtDate(selectedTask.deadline):'—'},
                  {label:t.col3, val:selectedTask.marketplace||'—'},
                  {label:'SKU', val:selectedTask.sku||'—'},
                  {label:t.f_client, val:selectedTask.client_name||'—'},
                  {label:t.f_cat, val:selectedTask.category||'—'},
                ].map(item=>(
                  <div key={item.label} style={S.metaItem}>
                    <div style={S.metaLabel}>{item.label}</div>
                    <div style={{fontSize:'13px',color:'#111',fontWeight:'500'}}>{item.val}</div>
                  </div>
                ))}
              </div>
              {selectedTask.description&&<div style={{padding:'12px 14px',background:'#fafaf9',borderRadius:'8px',border:'1px solid #f0f0ee',fontSize:'13px',color:'#374151',lineHeight:'1.6',marginBottom:'16px'}}><div style={{...S.metaLabel,marginBottom:'6px'}}>{t.descLabel}</div>{selectedTask.description}</div>}
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
              </div>
            </div>
            <div style={S.modalFooter}>
              {!showArchive&&<button onClick={()=>{setShowPreview(false);openEdit(selectedTask)}} style={S.btnPrimary}>{t.edit}</button>}
              <button onClick={()=>setShowPreview(false)} style={{...S.btnSm(), padding:'8px 16px', fontSize:'13px'}}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE MODAL */}
      {showMove&&selectedTask&&(
        <div style={S.modalOverlay}>
          <div style={S.modal('340px')}>
            <div style={S.modalHeader}>
              <span style={{fontSize:'15px',fontWeight:'600',letterSpacing:'-0.2px'}}>{t.moveTitle}</span>
              <button onClick={()=>setShowMove(false)} style={{border:'none',background:'none',fontSize:'20px',cursor:'pointer',color:'#9ca3af',lineHeight:'1'}}>×</button>
            </div>
            <div style={S.modalBody}>
              <div style={{fontSize:'13px',color:'#374151',marginBottom:'14px',fontWeight:'500'}}>{selectedTask.product_name}</div>
              <FormField label={t.moveTo}>
                <select value={moveTarget} onChange={e=>setMoveTarget(e.target.value)} style={{...S.select, marginBottom:'20px'}}>
                  {availWS.map(w=><option key={w.key} value={w.key}>{w.label}</option>)}
                </select>
              </FormField>
              <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',marginTop:'4px'}}>
                <button onClick={()=>setShowMove(false)} style={{...S.btnSm(), padding:'8px 16px', fontSize:'13px'}}>{t.cancel}</button>
                <button onClick={doMove} style={{...S.btnPrimary, background:'#4f46e5'}}>{t.move}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILES + COMMENTS MODAL */}
      {showDetail&&selectedTask&&(
        <div style={S.modalOverlay}>
          <div style={S.modal('560px')}>
            <div style={S.modalHeader}>
              <div>
                <div style={{fontSize:'15px',fontWeight:'600',letterSpacing:'-0.2px'}}>{selectedTask.product_name}</div>
                <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'2px'}}>{selectedTask.order_number}{selectedTask.client_name?' · '+selectedTask.client_name:''}</div>
              </div>
              <button onClick={()=>setShowDetail(false)} style={{border:'none',background:'none',fontSize:'20px',cursor:'pointer',color:'#9ca3af',lineHeight:'1'}}>×</button>
            </div>
            <div style={S.modalBody}>
              {selectedTask.description&&<div style={{marginBottom:'16px',padding:'12px 14px',background:'#fafaf9',borderRadius:'8px',border:'1px solid #f0f0ee',fontSize:'13px',color:'#374151',lineHeight:'1.5'}}>{selectedTask.description}</div>}
              <div style={{marginBottom:'18px'}}>
                <div style={{marginBottom:'10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{...S.metaLabel,marginBottom:'0'}}>{t.attach} ({taskFiles.length})</div>
                  <button onClick={()=>fileRef.current?.click()} disabled={uploading} style={{...S.btnSm('green'), padding:'5px 10px', fontSize:'12px'}}>{uploading?t.uploading:t.addFile}</button>
                  <input ref={fileRef} type="file" style={{display:'none'}} onChange={uploadFile} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp" />
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
                  <input value={newComment} onChange={e=>setNewComment(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendComment()} placeholder={t.addComment} style={{...S.input, flex:1}} />
                  <button onClick={sendComment} disabled={sendingCmt||!newComment.trim()} style={{...S.btnPrimary, opacity:(!newComment.trim()||sendingCmt)?0.5:1}}>{t.send}</button>
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
              <span style={{fontSize:'15px',fontWeight:'600',letterSpacing:'-0.2px'}}>{editingTask?t.editTask:t.newTaskTitle}</span>
              <button onClick={()=>setShowModal(false)} style={{border:'none',background:'none',fontSize:'20px',cursor:'pointer',color:'#9ca3af',lineHeight:'1'}}>×</button>
            </div>
            <div style={S.modalBody}>
              <div style={S.grid2}>
                <FormField label={t.f_order}><input value={form.order_number} onChange={e=>setForm({...form,order_number:e.target.value})} placeholder="ORD-2026-001" style={S.input} /></FormField>
                <FormField label={t.f_claim}><input value={form.claim_number} onChange={e=>setForm({...form,claim_number:e.target.value})} placeholder="CLM-001" style={S.input} /></FormField>
              </div>
              <div style={{marginBottom:'12px'}}>
                <FormField label={t.f_product}><input value={form.product_name} onChange={e=>setForm({...form,product_name:e.target.value})} placeholder="np. Strawberry Slices 100g" style={S.input} /></FormField>
              </div>
              <div style={S.grid2}>
                <FormField label={t.f_sku}><input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="HF-STR-100" style={S.input} /></FormField>
                <FormField label={t.f_client}><input value={form.client_name} onChange={e=>setForm({...form,client_name:e.target.value})} placeholder="Nazwa klienta" style={S.input} /></FormField>
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
                    <option value="high">{t.high}</option>
                    <option value="med">{t.med}</option>
                    <option value="low">{t.low}</option>
                  </select>
                </FormField>
                <FormField label={t.f_status}>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})} style={S.select}>
                    {Object.entries(STATUS_META).map(([k,v])=><option key={k} value={k}>{lang==='en'?v.labelEn:v.label}</option>)}
                  </select>
                </FormField>
              </div>
              <div style={S.grid2}>
                <FormField label={t.f_assign}>
                  <select value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})} style={S.select}>
                    <option value="">{t.f_none}</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.full_name||u.id}</option>)}
                  </select>
                </FormField>
                <FormField label={t.f_deadline}><input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})} style={S.input} /></FormField>
              </div>
              <FormField label={t.f_desc}>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder={t.f_desc} style={{...S.input, height:'72px', resize:'vertical'}} />
              </FormField>
            </div>
            <div style={S.modalFooter}>
              <button onClick={()=>setShowModal(false)} style={{...S.btnSm(), padding:'9px 16px', fontSize:'13px'}}>{t.cancel}</button>
              <button onClick={handleSave} disabled={saving} style={{...S.btnPrimary, opacity:saving?0.7:1}}>
                {saving?t.saving:editingTask?t.saveChanges:t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
