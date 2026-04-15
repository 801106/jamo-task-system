'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const WORKSPACES = [
  { key: 'jamo_healthy', label: 'Jamo + Healthy' },
  { key: 'packpack', label: 'PackPack' },
  { key: 'private', label: 'Private' },
]

const STATUS_COLORS = {
  open: { bg:'#dbeafe', color:'#1d4ed8' },
  inprogress: { bg:'#fef3c7', color:'#92400e' },
  waiting: { bg:'#ede9fe', color:'#6d28d9' },
  done: { bg:'#d1fae5', color:'#065f46' },
  urgent: { bg:'#fee2e2', color:'#991b1b' },
}
const PRIORITY_COLORS = { high:'#ef4444', med:'#f59e0b', low:'#22c55e' }

const T = {
  pl: {
    appSub:'Jamo Operations', workspace:'Przestrzen robocza',
    all:'Wszystkie', mine:'Moje zadania', open:'Otwarte', urgent:'Pilne', closed:'Zamkniete',
    search:'Szukaj zamowienia, klienta...', newTask:'+ Nowe zadanie',
    connected:'Polaczono - zmiany synchronizuja sie na zywo',
    admin:'Administrator', user:'Uzytkownik', myAccount:'Moje konto', logout:'Wyloguj',
    orderNo:'Nr zam.', taskCol:'Zadanie / Klient', marketplace:'Marketplace',
    status:'Status', assignedTo:'Przypisano', priority:'Priorytet', deadline:'Termin', actions:'Akcje',
    noTasks:'Brak zadan w tym widoku',
    files:'Pliki', edit:'Edytuj', del:'Usun',
    editTask:'Edytuj zadanie', newTaskTitle:'Nowe zadanie',
    orderNumber:'Nr zamowienia', claimNumber:'Nr reklamacji',
    productName:'Nazwa produktu *', sku:'SKU', client:'Klient',
    category:'Kategoria', prio:'Priorytet', statusLabel:'Status',
    assignTo:'Przypisz do', unassigned:'— Nieprzypisane —',
    description:'Opis / Nastepny krok', descPlaceholder:'Opisz problem i co nalezy zrobic...',
    deadlineLabel:'Termin wykonania',
    cancel:'Anuluj', save:'Zapisz zadanie', saveChanges:'Zapisz zmiany', saving:'Zapisywanie...',
    high:'Wysoki', med:'Sredni', low:'Niski',
    attachments:'Zalaczniki', noFiles:'Brak zalacznikow — kliknij "+ Dodaj plik"',
    addFile:'+ Dodaj plik', uploading:'Wgrywanie...', download:'Pobierz',
    deleteConfirm:'Usunac to zadanie?', deleteFileConfirm:'Usunac ten plik?',
    comments:'Komentarze', addComment:'Dodaj komentarz...', send:'Wyslij',
    noComments:'Brak komentarzy — dodaj pierwszy!', overdue:'Przeterminowane',
    statusOpen:'Otwarte', statusInprogress:'W trakcie', statusWaiting:'Oczekuje', statusDone:'Zamkniete', statusUrgent:'Pilne',
  },
  en: {
    appSub:'Jamo Operations', workspace:'Workspace',
    all:'All', mine:'My tasks', open:'Open', urgent:'Urgent', closed:'Closed',
    search:'Search order, client...', newTask:'+ New task',
    connected:'Connected - changes sync live on all devices',
    admin:'Administrator', user:'User', myAccount:'My account', logout:'Logout',
    orderNo:'Order no.', taskCol:'Task / Client', marketplace:'Marketplace',
    status:'Status', assignedTo:'Assigned to', priority:'Priority', deadline:'Deadline', actions:'Actions',
    noTasks:'No tasks in this view',
    files:'Files', edit:'Edit', del:'Delete',
    editTask:'Edit task', newTaskTitle:'New task',
    orderNumber:'Order number', claimNumber:'Claim number',
    productName:'Product name *', sku:'SKU', client:'Client',
    category:'Category', prio:'Priority', statusLabel:'Status',
    assignTo:'Assign to', unassigned:'— Unassigned —',
    description:'Description / Next step', descPlaceholder:'Describe the issue and what needs to be done...',
    deadlineLabel:'Deadline',
    cancel:'Cancel', save:'Save task', saveChanges:'Save changes', saving:'Saving...',
    high:'High', med:'Medium', low:'Low',
    attachments:'Attachments', noFiles:'No attachments — click "+ Add file"',
    addFile:'+ Add file', uploading:'Uploading...', download:'Download',
    deleteConfirm:'Delete this task?', deleteFileConfirm:'Delete this file?',
    comments:'Comments', addComment:'Add a comment...', send:'Send',
    noComments:'No comments yet — add the first one!', overdue:'Overdue',
    statusOpen:'Open', statusInprogress:'In progress', statusWaiting:'Waiting', statusDone:'Closed', statusUrgent:'Urgent',
  }
}

export default function Dashboard() {
  const router = useRouter()
  const [lang, setLang] = useState('pl')
  const t = T[lang]

  const statusLabels = (l) => ({
    open: T[l].statusOpen, inprogress: T[l].statusInprogress,
    waiting: T[l].statusWaiting, done: T[l].statusDone, urgent: T[l].statusUrgent
  })

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tasks, setTasks] = useState([])
  const [users, setUsers] = useState([])
  const [workspace, setWorkspace] = useState('jamo_healthy')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [taskFiles, setTaskFiles] = useState([])
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sendingComment, setSendingComment] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    order_number:'', claim_number:'', product_name:'', sku:'', client_name:'',
    marketplace:'Amazon UK', category:'Reklamacja', description:'',
    status:'open', priority:'med', assigned_to:'', deadline:''
  })

  useEffect(() => {
    const saved = localStorage.getItem('taskflow_lang')
    if (saved) setLang(saved)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUser(user)
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
    supabase.from('profiles').select('id, full_name').then(({ data }) => setUsers(data || []))
  }, [])

  function toggleLang() {
    const next = lang === 'pl' ? 'en' : 'pl'
    setLang(next)
    localStorage.setItem('taskflow_lang', next)
  }

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*, assigned_profile:profiles!assigned_to(full_name)')
      .eq('area', workspace)
      .order('created_at', { ascending: false })
    setTasks(data || [])
  }, [workspace])

  useEffect(() => { loadTasks() }, [loadTasks])

  useEffect(() => {
    const channel = supabase.channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [workspace, loadTasks])

  async function loadTaskFiles(taskId) {
    const { data } = await supabase.storage.from('task-files').list(taskId)
    setTaskFiles(data || [])
  }

  async function loadComments(taskId) {
    const { data } = await supabase.from('comments')
      .select('*, author:profiles!author_id(full_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file || !selectedTask) return
    setUploading(true)
    await supabase.storage.from('task-files').upload(`${selectedTask.id}/${Date.now()}_${file.name}`, file)
    await loadTaskFiles(selectedTask.id)
    setUploading(false)
  }

  async function handleFileDelete(fileName) {
    if (!confirm(t.deleteFileConfirm)) return
    await supabase.storage.from('task-files').remove([`${selectedTask.id}/${fileName}`])
    await loadTaskFiles(selectedTask.id)
  }

  async function getFileUrl(fileName) {
    const { data } = await supabase.storage.from('task-files').createSignedUrl(`${selectedTask.id}/${fileName}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleSendComment() {
    if (!newComment.trim() || !selectedTask || !user) return
    setSendingComment(true)
    await supabase.from('comments').insert({ task_id: selectedTask.id, author_id: user.id, content: newComment.trim() })
    setNewComment('')
    await loadComments(selectedTask.id)
    setSendingComment(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function openNewTask() {
    setEditingTask(null)
    setForm({ order_number:'', claim_number:'', product_name:'', sku:'', client_name:'', marketplace:'Amazon UK', category:'Reklamacja', description:'', status:'open', priority:'med', assigned_to:'', deadline:'' })
    setShowModal(true)
  }

  function openEditTask(task) {
    setEditingTask(task)
    setForm({
      order_number: task.order_number||'', claim_number: task.claim_number||'',
      product_name: task.product_name||'', sku: task.sku||'', client_name: task.client_name||'',
      marketplace: task.marketplace||'Amazon UK', category: task.category||'Reklamacja',
      description: task.description||'', status: task.status||'open', priority: task.priority||'med',
      assigned_to: task.assigned_to||'', deadline: task.deadline ? task.deadline.split('T')[0] : ''
    })
    setShowModal(true)
  }

  async function openTaskDetail(task) {
    setSelectedTask(task)
    setShowDetailModal(true)
    await loadTaskFiles(task.id)
    await loadComments(task.id)
  }

  async function handleSave() {
    if (!form.product_name) return
    setSaving(true)
    const payload = { ...form, assigned_to: form.assigned_to||null, deadline: form.deadline||null }
    if (editingTask) {
      await supabase.from('tasks').update(payload).eq('id', editingTask.id)
    } else {
      await supabase.from('tasks').insert({ ...payload, area: workspace, created_by: user.id })
    }
    setSaving(false)
    setShowModal(false)
    setEditingTask(null)
    loadTasks()
  }

  async function handleDelete(taskId) {
    if (!confirm(t.deleteConfirm)) return
    await supabase.from('tasks').delete().eq('id', taskId)
    loadTasks()
  }

  async function changeStatus(taskId, status) {
    await supabase.from('tasks').update({ status }).eq('id', taskId)
    loadTasks()
  }

  function isOverdue(task) {
    if (!task.deadline || task.status === 'done') return false
    return new Date(task.deadline) < new Date()
  }

  const filtered = tasks.filter(t2 => {
    if (filter === 'urgent' && t2.status !== 'urgent') return false
    if (filter === 'open' && !['open','inprogress','waiting'].includes(t2.status)) return false
    if (filter === 'done' && t2.status !== 'done') return false
    if (filter === 'mine' && t2.assigned_to !== user?.id) return false
    if (search) {
      const q = search.toLowerCase()
      return (t2.order_number||'').toLowerCase().includes(q) ||
        (t2.product_name||'').toLowerCase().includes(q) ||
        (t2.client_name||'').toLowerCase().includes(q) ||
        (t2.claim_number||'').toLowerCase().includes(q)
    }
    return true
  })

  const counts = {
    all: tasks.length,
    open: tasks.filter(t2 => ['open','inprogress','waiting'].includes(t2.status)).length,
    urgent: tasks.filter(t2 => t2.status === 'urgent').length,
    done: tasks.filter(t2 => t2.status === 'done').length,
    mine: tasks.filter(t2 => t2.assigned_to === user?.id).length,
  }

  const getFileIcon = (name) => {
    if (name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'IMG'
    if (name.match(/\.(pdf)$/i)) return 'PDF'
    if (name.match(/\.(doc|docx)$/i)) return 'DOC'
    if (name.match(/\.(xls|xlsx)$/i)) return 'XLS'
    return 'FILE'
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString(lang==='pl'?'pl-PL':'en-GB') : ''
  const formatDateTime = (d) => d ? new Date(d).toLocaleString(lang==='pl'?'pl-PL':'en-GB',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : ''

  const sl = statusLabels(lang)

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:'14px'}}>
      <div style={{width:'220px',background:'white',borderRight:'1px solid #e5e7eb',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontWeight:'600',fontSize:'15px'}}>TaskFlow</div>
            <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'2px'}}>{t.appSub}</div>
          </div>
          <button onClick={toggleLang} title={lang==='pl'?'Switch to English':'Zmien na Polski'}
            style={{fontSize:'20px',border:'1px solid #e5e7eb',borderRadius:'6px',padding:'2px 6px',cursor:'pointer',background:'white',lineHeight:'1.2'}}>
            {lang==='pl'?'🇵🇱':'🇬🇧'}
          </button>
        </div>
        <div style={{padding:'10px 12px',borderBottom:'1px solid #e5e7eb'}}>
          <div style={{fontSize:'10px',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>{t.workspace}</div>
          {WORKSPACES.map(ws => (
            <button key={ws.key} onClick={() => { setWorkspace(ws.key); setFilter('all') }}
              style={{display:'block',width:'100%',textAlign:'left',padding:'6px 8px',borderRadius:'6px',fontSize:'13px',cursor:'pointer',border:'none',background:workspace===ws.key?'#eff6ff':'transparent',color:workspace===ws.key?'#1d4ed8':'#6b7280',fontWeight:workspace===ws.key?'500':'400',marginBottom:'2px'}}>
              {ws.label}
            </button>
          ))}
        </div>
        <nav style={{padding:'10px 8px',flex:1}}>
          {[
            { key:'all', label:t.all, count:counts.all },
            { key:'mine', label:t.mine, count:counts.mine, blue:true },
            { key:'open', label:t.open, count:counts.open },
            { key:'urgent', label:t.urgent, count:counts.urgent, red:true },
            { key:'done', label:t.closed, count:counts.done },
          ].map(item => (
            <button key={item.key} onClick={() => setFilter(item.key)}
              style={{display:'flex',alignItems:'center',width:'100%',textAlign:'left',padding:'7px 8px',borderRadius:'6px',fontSize:'13px',cursor:'pointer',border:'none',background:filter===item.key?'#f3f4f6':'transparent',color:filter===item.key?'#111':'#6b7280',fontWeight:filter===item.key?'500':'400',marginBottom:'2px'}}>
              {item.label}
              <span style={{marginLeft:'auto',fontSize:'11px',
                background:item.red&&item.count?'#fee2e2':item.blue&&item.count?'#dbeafe':'#f3f4f6',
                color:item.red&&item.count?'#991b1b':item.blue&&item.count?'#1d4ed8':'#6b7280',
                padding:'1px 6px',borderRadius:'10px'}}>
                {item.count}
              </span>
            </button>
          ))}
        </nav>
        <div style={{padding:'12px 16px',borderTop:'1px solid #e5e7eb'}}>
          <div style={{fontSize:'12px',fontWeight:'500',marginBottom:'4px'}}>{profile?.full_name || user?.email?.split('@')[0]}</div>
          <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'10px'}}>{profile?.role==='admin'?t.admin:t.user}</div>
          <button onClick={()=>router.push('/account')} style={{display:'block',fontSize:'11px',color:'#6b7280',border:'none',background:'none',cursor:'pointer',padding:'0',marginBottom:'6px'}}>{t.myAccount}</button>{profile?.role==='admin'&&<button onClick={()=>router.push('/admin')} style={{display:'block',fontSize:'11px',color:'#7c3aed',border:'none',background:'none',cursor:'pointer',padding:'0',marginBottom:'6px',fontWeight:'500'}}>Panel admina</button>}
          <button onClick={handleLogout} style={{display:'block',fontSize:'11px',color:'#9ca3af',border:'none',background:'none',cursor:'pointer',padding:'0'}}>{t.logout}</button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#f9fafb'}}>
        <div style={{background:'#d1fae5',borderBottom:'1px solid #a7f3d0',padding:'5px 20px',fontSize:'12px',color:'#065f46',display:'flex',alignItems:'center',gap:'6px'}}>
          <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#059669',display:'inline-block'}}></span>
          {t.connected}
        </div>
        <div style={{background:'white',borderBottom:'1px solid #e5e7eb',padding:'0 20px',height:'52px',display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{fontSize:'15px',fontWeight:'500',flex:1}}>{WORKSPACES.find(w=>w.key===workspace)?.label}</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t.search}
            style={{padding:'7px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',width:'260px',outline:'none'}} />
          <button onClick={openNewTask}
            style={{background:'#111',color:'white',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:'500',cursor:'pointer',whiteSpace:'nowrap'}}>
            {t.newTask}
          </button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',padding:'16px 20px 0'}}>
          {[
            { label:t.all, val:counts.all, color:'#111' },
            { label:t.mine, val:counts.mine, color:'#1d4ed8' },
            { label:t.urgent, val:counts.urgent, color:'#dc2626' },
            { label:t.closed, val:counts.done, color:'#059669' },
          ].map(s => (
            <div key={s.label} style={{background:'white',borderRadius:'8px',padding:'12px 14px',border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'4px'}}>{s.label}</div>
              <div style={{fontSize:'24px',fontWeight:'600',color:s.color}}>{s.val}</div>
            </div>
          ))}
        </div>

        <div style={{flex:1,overflow:'auto',padding:'12px 20px 20px'}}>
          <div style={{background:'white',borderRadius:'10px',border:'1px solid #e5e7eb',overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'95px 1fr 95px 110px 85px 65px 75px 135px',padding:'10px 16px',borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
              {[t.orderNo,t.taskCol,t.marketplace,t.status,t.assignedTo,t.priority,t.deadline,t.actions].map(h => (
                <span key={h} style={{fontSize:'11px',color:'#9ca3af',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</span>
              ))}
            </div>
            {filtered.length === 0 && (
              <div style={{padding:'40px',textAlign:'center',color:'#9ca3af',fontSize:'13px'}}>{t.noTasks}</div>
            )}
            {filtered.map(task => (
              <div key={task.id} style={{display:'grid',gridTemplateColumns:'95px 1fr 95px 110px 85px 65px 75px 135px',padding:'11px 16px',borderBottom:'1px solid #f3f4f6',alignItems:'center',background:'white'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                onMouseLeave={e=>e.currentTarget.style.background='white'}>
                <div>
                  <div style={{fontSize:'12px',fontWeight:'500',color:'#2563eb',fontFamily:'monospace'}}>{task.order_number||'—'}</div>
                  <div style={{fontSize:'10px',color:'#9ca3af'}}>{task.claim_number||''}</div>
                </div>
                <div>
                  <div style={{fontSize:'13px',fontWeight:'500',color:'#111'}}>{task.product_name}</div>
                  <div style={{fontSize:'12px',color:'#6b7280',marginTop:'1px'}}>{task.client_name} {task.category?`· ${task.category}`:''}</div>
                </div>
                <div style={{fontSize:'12px',color:'#6b7280'}}>{task.marketplace||'—'}</div>
                <div>
                  <select value={task.status} onChange={e=>changeStatus(task.id,e.target.value)}
                    style={{padding:'3px 6px',borderRadius:'12px',border:'none',fontSize:'11px',fontWeight:'500',cursor:'pointer',
                      background:STATUS_COLORS[task.status]?.bg||'#f3f4f6',color:STATUS_COLORS[task.status]?.color||'#374151'}}>
                    {Object.entries(sl).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div style={{fontSize:'12px',color:'#6b7280',display:'flex',alignItems:'center',gap:'4px'}}>
                  {task.assigned_profile?.full_name ? (
                    <>
                      <div style={{width:'18px',height:'18px',borderRadius:'50%',background:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'8px',fontWeight:'600',color:'#1d4ed8',flexShrink:0}}>
                        {task.assigned_profile.full_name.substring(0,2).toUpperCase()}
                      </div>
                      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'11px'}}>{task.assigned_profile.full_name}</span>
                    </>
                  ) : <span style={{color:'#d1d5db'}}>—</span>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                  <span style={{width:'7px',height:'7px',borderRadius:'50%',background:PRIORITY_COLORS[task.priority],flexShrink:0,display:'inline-block'}}></span>
                  <span style={{fontSize:'11px',color:'#6b7280'}}>{task.priority==='high'?t.high:task.priority==='med'?t.med:t.low}</span>
                </div>
                <div>
                  {task.deadline ? (
                    <span style={{fontSize:'11px',fontWeight:'500',color:isOverdue(task)?'#dc2626':'#374151',background:isOverdue(task)?'#fee2e2':'transparent',padding:isOverdue(task)?'2px 5px':'0',borderRadius:'4px'}}>
                      {formatDate(task.deadline)}
                    </span>
                  ) : <span style={{color:'#d1d5db',fontSize:'11px'}}>—</span>}
                </div>
                <div style={{display:'flex',gap:'3px'}}>
                  <button onClick={()=>openTaskDetail(task)}
                    style={{padding:'4px 6px',fontSize:'11px',border:'1px solid #bbf7d0',borderRadius:'6px',cursor:'pointer',background:'#f0fdf4',color:'#059669'}}>
                    {t.files}
                  </button>
                  <button onClick={()=>openEditTask(task)}
                    style={{padding:'4px 6px',fontSize:'11px',border:'1px solid #e5e7eb',borderRadius:'6px',cursor:'pointer',background:'white',color:'#374151'}}>
                    {t.edit}
                  </button>
                  <button onClick={()=>handleDelete(task.id)}
                    style={{padding:'4px 6px',fontSize:'11px',border:'1px solid #fee2e2',borderRadius:'6px',cursor:'pointer',background:'#fff5f5',color:'#dc2626'}}>
                    {t.del}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showDetailModal && selectedTask && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div style={{background:'white',borderRadius:'12px',width:'620px',maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:'15px',fontWeight:'600'}}>{selectedTask.product_name}</div>
                <div style={{fontSize:'12px',color:'#6b7280',marginTop:'2px'}}>
                  {selectedTask.order_number} {selectedTask.client_name?'· '+selectedTask.client_name:''}
                  {isOverdue(selectedTask)&&<span style={{marginLeft:'8px',background:'#fee2e2',color:'#dc2626',fontSize:'10px',padding:'1px 6px',borderRadius:'4px',fontWeight:'500'}}>{t.overdue}</span>}
                </div>
              </div>
              <button onClick={()=>setShowDetailModal(false)} style={{border:'none',background:'none',fontSize:'18px',cursor:'pointer',color:'#9ca3af'}}>x</button>
            </div>
            <div style={{padding:'18px 20px'}}>
              {selectedTask.description&&(
                <div style={{marginBottom:'20px',padding:'12px',background:'#f9fafb',borderRadius:'8px',fontSize:'13px',color:'#374151',lineHeight:'1.5'}}>
                  {selectedTask.description}
                </div>
              )}
              <div style={{marginBottom:'20px'}}>
                <div style={{marginBottom:'10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{fontSize:'13px',fontWeight:'600',color:'#111'}}>{t.attachments} ({taskFiles.length})</div>
                  <button onClick={()=>fileInputRef.current?.click()} disabled={uploading}
                    style={{padding:'6px 12px',background:'#111',color:'white',border:'none',borderRadius:'8px',fontSize:'12px',fontWeight:'500',cursor:'pointer',opacity:uploading?0.7:1}}>
                    {uploading?t.uploading:t.addFile}
                  </button>
                  <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp" />
                </div>
                {taskFiles.length===0&&(
                  <div style={{padding:'16px',textAlign:'center',color:'#9ca3af',fontSize:'13px',border:'2px dashed #e5e7eb',borderRadius:'8px'}}>{t.noFiles}</div>
                )}
                {taskFiles.map(file=>(
                  <div key={file.name} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',marginBottom:'6px'}}>
                    <div style={{width:'32px',height:'32px',borderRadius:'6px',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:'600',color:'#6b7280',flexShrink:0}}>
                      {getFileIcon(file.name)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:'13px',fontWeight:'500',color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {file.name.replace(/^\d+_/,'')}
                      </div>
                    </div>
                    <button onClick={()=>getFileUrl(file.name)}
                      style={{padding:'3px 8px',fontSize:'11px',border:'1px solid #e5e7eb',borderRadius:'6px',cursor:'pointer',background:'white',color:'#374151',whiteSpace:'nowrap'}}>
                      {t.download}
                    </button>
                    <button onClick={()=>handleFileDelete(file.name)}
                      style={{padding:'3px 8px',fontSize:'11px',border:'1px solid #fee2e2',borderRadius:'6px',cursor:'pointer',background:'#fff5f5',color:'#dc2626'}}>
                      {t.del}
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <div style={{fontSize:'13px',fontWeight:'600',color:'#111',marginBottom:'10px'}}>{t.comments} ({comments.length})</div>
                {comments.length===0&&(
                  <div style={{padding:'16px',textAlign:'center',color:'#9ca3af',fontSize:'13px',border:'2px dashed #e5e7eb',borderRadius:'8px',marginBottom:'10px'}}>{t.noComments}</div>
                )}
                {comments.map(c=>(
                  <div key={c.id} style={{marginBottom:'10px',padding:'10px 12px',background:'#f9fafb',borderRadius:'8px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                      <div style={{width:'22px',height:'22px',borderRadius:'50%',background:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:'600',color:'#1d4ed8'}}>
                        {(c.author?.full_name||'?').substring(0,2).toUpperCase()}
                      </div>
                      <span style={{fontSize:'12px',fontWeight:'500',color:'#374151'}}>{c.author?.full_name||'?'}</span>
                      <span style={{fontSize:'11px',color:'#9ca3af'}}>{formatDateTime(c.created_at)}</span>
                    </div>
                    <div style={{fontSize:'13px',color:'#111',lineHeight:'1.5',paddingLeft:'30px'}}>{c.content}</div>
                  </div>
                ))}
                <div style={{display:'flex',gap:'8px',marginTop:'10px'}}>
                  <input value={newComment} onChange={e=>setNewComment(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&handleSendComment()}
                    placeholder={t.addComment}
                    style={{flex:1,padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'13px',outline:'none'}} />
                  <button onClick={handleSendComment} disabled={sendingComment||!newComment.trim()}
                    style={{padding:'8px 16px',background:'#111',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer',opacity:(!newComment.trim()||sendingComment)?0.5:1}}>
                    {t.send}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div style={{background:'white',borderRadius:'12px',width:'540px',maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'15px',fontWeight:'600'}}>{editingTask?t.editTask:t.newTaskTitle}</span>
              <button onClick={()=>setShowModal(false)} style={{border:'none',background:'none',fontSize:'18px',cursor:'pointer',color:'#9ca3af'}}>x</button>
            </div>
            <div style={{padding:'18px 20px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.orderNumber}</label>
                  <input value={form.order_number} onChange={e=>setForm({...form,order_number:e.target.value})} placeholder="ORD-2026-001"
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.claimNumber}</label>
                  <input value={form.claim_number} onChange={e=>setForm({...form,claim_number:e.target.value})} placeholder="CLM-001"
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
                </div>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.productName}</label>
                <input value={form.product_name} onChange={e=>setForm({...form,product_name:e.target.value})} placeholder="np. Strawberry Slices 100g"
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.sku}</label>
                  <input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="HF-STR-100"
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.client}</label>
                  <input value={form.client_name} onChange={e=>setForm({...form,client_name:e.target.value})} placeholder="Nazwa klienta"
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.marketplace}</label>
                  <select value={form.marketplace} onChange={e=>setForm({...form,marketplace:e.target.value})}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                    {['Amazon UK','eBay UK','Sklep wlasny','Allegro','Inne'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.category}</label>
                  <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                    {['Reklamacja','Zwrot','Uszkodzenie','Brak dostawy','Inne'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.prio}</label>
                  <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                    <option value="high">{t.high}</option>
                    <option value="med">{t.med}</option>
                    <option value="low">{t.low}</option>
                  </select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.statusLabel}</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                    {Object.entries(sl).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.assignTo}</label>
                  <select value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                    <option value="">{t.unassigned}</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.full_name||u.id}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.deadlineLabel}</label>
                  <input type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
                </div>
              </div>
              <div>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>{t.description}</label>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                  placeholder={t.descPlaceholder}
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none',height:'72px',resize:'vertical',fontFamily:'inherit'}} />
              </div>
            </div>
            <div style={{padding:'14px 20px',borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'flex-end',gap:'8px'}}>
              <button onClick={()=>setShowModal(false)} style={{padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:'8px',background:'white',fontSize:'13px',cursor:'pointer',color:'#374151'}}>{t.cancel}</button>
              <button onClick={handleSave} disabled={saving}
                style={{padding:'8px 18px',background:'#111',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer',opacity:saving?0.7:1}}>
                {saving?t.saving:editingTask?t.saveChanges:t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
