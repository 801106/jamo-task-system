'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const WORKSPACES = [
  { key: 'jamo_healthy', label: 'Jamo + Healthy' },
  { key: 'packpack', label: 'PackPack' },
  { key: 'private', label: 'Private' },
]

const STATUS_LABELS = { open:'Otwarte', inprogress:'W trakcie', waiting:'Oczekuje', done:'Zamkniete', urgent:'Pilne' }
const STATUS_COLORS = {
  open: { bg:'#dbeafe', color:'#1d4ed8' },
  inprogress: { bg:'#fef3c7', color:'#92400e' },
  waiting: { bg:'#ede9fe', color:'#6d28d9' },
  done: { bg:'#d1fae5', color:'#065f46' },
  urgent: { bg:'#fee2e2', color:'#991b1b' },
}
const PRIORITY_COLORS = { high:'#ef4444', med:'#f59e0b', low:'#22c55e' }

export default function Dashboard() {
  const router = useRouter()
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
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({
    order_number:'', claim_number:'', product_name:'', sku:'', client_name:'',
    marketplace:'Amazon UK', category:'Reklamacja', description:'',
    status:'open', priority:'med', assigned_to:''
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUser(user)
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
    supabase.from('profiles').select('id, full_name').then(({ data }) => setUsers(data || []))
  }, [])

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' },
        () => { loadTasks() }
      ).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [workspace, loadTasks])

  async function loadTaskFiles(taskId) {
    const { data } = await supabase.storage.from('task-files').list(taskId)
    setTaskFiles(data || [])
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file || !selectedTask) return
    setUploading(true)
    const filePath = `${selectedTask.id}/${Date.now()}_${file.name}`
    await supabase.storage.from('task-files').upload(filePath, file)
    await loadTaskFiles(selectedTask.id)
    setUploading(false)
  }

  async function handleFileDelete(fileName) {
    if (!confirm('Usunac ten plik?')) return
    await supabase.storage.from('task-files').remove([`${selectedTask.id}/${fileName}`])
    await loadTaskFiles(selectedTask.id)
  }

  async function getFileUrl(fileName) {
    const { data } = await supabase.storage.from('task-files').createSignedUrl(`${selectedTask.id}/${fileName}`, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  function openNewTask() {
    setEditingTask(null)
    setForm({ order_number:'', claim_number:'', product_name:'', sku:'', client_name:'', marketplace:'Amazon UK', category:'Reklamacja', description:'', status:'open', priority:'med', assigned_to:'' })
    setShowModal(true)
  }

  function openEditTask(task) {
    setEditingTask(task)
    setForm({
      order_number: task.order_number || '',
      claim_number: task.claim_number || '',
      product_name: task.product_name || '',
      sku: task.sku || '',
      client_name: task.client_name || '',
      marketplace: task.marketplace || 'Amazon UK',
      category: task.category || 'Reklamacja',
      description: task.description || '',
      status: task.status || 'open',
      priority: task.priority || 'med',
      assigned_to: task.assigned_to || ''
    })
    setShowModal(true)
  }

  async function openTaskDetail(task) {
    setSelectedTask(task)
    setShowDetailModal(true)
    await loadTaskFiles(task.id)
  }

  async function handleSave() {
    if (!form.product_name) return
    setSaving(true)
    const payload = { ...form, assigned_to: form.assigned_to || null }
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
    if (!confirm('Usunac to zadanie?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
    loadTasks()
  }

  async function changeStatus(taskId, status) {
    await supabase.from('tasks').update({ status }).eq('id', taskId)
    loadTasks()
  }

  const filtered = tasks.filter(t => {
    if (filter === 'urgent' && t.status !== 'urgent') return false
    if (filter === 'open' && !['open','inprogress','waiting'].includes(t.status)) return false
    if (filter === 'done' && t.status !== 'done') return false
    if (filter === 'mine' && t.assigned_to !== user?.id) return false
    if (search) {
      const q = search.toLowerCase()
      return (t.order_number||'').toLowerCase().includes(q) ||
        (t.product_name||'').toLowerCase().includes(q) ||
        (t.client_name||'').toLowerCase().includes(q) ||
        (t.claim_number||'').toLowerCase().includes(q)
    }
    return true
  })

  const counts = {
    all: tasks.length,
    open: tasks.filter(t => ['open','inprogress','waiting'].includes(t.status)).length,
    urgent: tasks.filter(t => t.status === 'urgent').length,
    done: tasks.filter(t => t.status === 'done').length,
    mine: tasks.filter(t => t.assigned_to === user?.id).length,
  }

  const getFileIcon = (name) => {
    if (name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'IMG'
    if (name.match(/\.(pdf)$/i)) return 'PDF'
    if (name.match(/\.(doc|docx)$/i)) return 'DOC'
    if (name.match(/\.(xls|xlsx)$/i)) return 'XLS'
    return 'FILE'
  }

  return (
    <div style={{display:'flex',height:'100vh',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',fontSize:'14px'}}>
      <div style={{width:'220px',background:'white',borderRight:'1px solid #e5e7eb',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid #e5e7eb'}}>
          <div style={{fontWeight:'600',fontSize:'15px'}}>TaskFlow</div>
          <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'2px'}}>Jamo Operations</div>
        </div>
        <div style={{padding:'10px 12px',borderBottom:'1px solid #e5e7eb'}}>
          <div style={{fontSize:'10px',color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'6px'}}>Workspace</div>
          {WORKSPACES.map(ws => (
            <button key={ws.key} onClick={() => { setWorkspace(ws.key); setFilter('all') }}
              style={{display:'block',width:'100%',textAlign:'left',padding:'6px 8px',borderRadius:'6px',fontSize:'13px',cursor:'pointer',border:'none',background:workspace===ws.key?'#eff6ff':'transparent',color:workspace===ws.key?'#1d4ed8':'#6b7280',fontWeight:workspace===ws.key?'500':'400',marginBottom:'2px'}}>
              {ws.label}
            </button>
          ))}
        </div>
        <nav style={{padding:'10px 8px',flex:1}}>
          {[
            { key:'all', label:'Wszystkie', count:counts.all },
            { key:'mine', label:'Moje zadania', count:counts.mine, blue:true },
            { key:'open', label:'Otwarte', count:counts.open },
            { key:'urgent', label:'Pilne', count:counts.urgent, red:true },
            { key:'done', label:'Zamkniete', count:counts.done },
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
        <div style={{padding:'12px 16px',borderTop:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:'12px',fontWeight:'500'}}>{profile?.full_name || user?.email?.split('@')[0]}</div>
            <div style={{fontSize:'11px',color:'#9ca3af'}}>{profile?.role === 'admin' ? 'Admin' : 'Uzytkownik'}</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'4px'}}><button onClick={()=>router.push('/account')} style={{fontSize:'11px',color:'#6b7280',border:'none',background:'none',cursor:'pointer',textAlign:'left'}}>Moje konto</button><button onClick={handleLogout} style={{fontSize:'11px',color:'#9ca3af',border:'none',background:'none',cursor:'pointer',textAlign:'left'}}>Wyloguj</button></div>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:'#f9fafb'}}>
        <div style={{background:'#d1fae5',borderBottom:'1px solid #a7f3d0',padding:'5px 20px',fontSize:'12px',color:'#065f46',display:'flex',alignItems:'center',gap:'6px'}}>
          <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'#059669',display:'inline-block'}}></span>
          Polaczono - zmiany synchronizuja sie na zywo
        </div>
        <div style={{background:'white',borderBottom:'1px solid #e5e7eb',padding:'0 20px',height:'52px',display:'flex',alignItems:'center',gap:'12px'}}>
          <span style={{fontSize:'15px',fontWeight:'500',flex:1}}>{WORKSPACES.find(w=>w.key===workspace)?.label}</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Szukaj zamowienia, klienta..."
            style={{padding:'7px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',width:'260px',outline:'none'}} />
          <button onClick={openNewTask}
            style={{background:'#111',color:'white',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:'500',cursor:'pointer',whiteSpace:'nowrap'}}>
            + Nowe zadanie
          </button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',padding:'16px 20px 0'}}>
          {[
            { label:'Wszystkie', val:counts.all, color:'#111' },
            { label:'Moje', val:counts.mine, color:'#1d4ed8' },
            { label:'Pilne', val:counts.urgent, color:'#dc2626' },
            { label:'Zamkniete', val:counts.done, color:'#059669' },
          ].map(s => (
            <div key={s.label} style={{background:'white',borderRadius:'8px',padding:'12px 14px',border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'4px'}}>{s.label}</div>
              <div style={{fontSize:'24px',fontWeight:'600',color:s.color}}>{s.val}</div>
            </div>
          ))}
        </div>

        <div style={{flex:1,overflow:'auto',padding:'12px 20px 20px'}}>
          <div style={{background:'white',borderRadius:'10px',border:'1px solid #e5e7eb',overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'100px 1fr 100px 120px 100px 80px 140px',padding:'10px 16px',borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
              {['Nr zam.','Zadanie / Klient','Marketplace','Status','Przypisano','Priorytet','Akcje'].map(h => (
                <span key={h} style={{fontSize:'11px',color:'#9ca3af',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</span>
              ))}
            </div>
            {filtered.length === 0 && (
              <div style={{padding:'40px',textAlign:'center',color:'#9ca3af',fontSize:'13px'}}>Brak zadan w tym widoku</div>
            )}
            {filtered.map(task => (
              <div key={task.id} style={{display:'grid',gridTemplateColumns:'100px 1fr 100px 120px 100px 80px 140px',padding:'11px 16px',borderBottom:'1px solid #f3f4f6',alignItems:'center',background:'white'}}
                onMouseEnter={e=>e.currentTarget.style.background='#f9fafb'}
                onMouseLeave={e=>e.currentTarget.style.background='white'}>
                <div>
                  <div style={{fontSize:'12px',fontWeight:'500',color:'#2563eb',fontFamily:'monospace'}}>{task.order_number||'—'}</div>
                  <div style={{fontSize:'10px',color:'#9ca3af'}}>{task.claim_number||''}</div>
                </div>
                <div>
                  <div style={{fontSize:'13px',fontWeight:'500',color:'#111'}}>{task.product_name}</div>
                  <div style={{fontSize:'12px',color:'#6b7280',marginTop:'1px'}}>{task.client_name} {task.category ? `· ${task.category}` : ''}</div>
                </div>
                <div style={{fontSize:'12px',color:'#6b7280'}}>{task.marketplace||'—'}</div>
                <div>
                  <select value={task.status} onChange={e=>changeStatus(task.id, e.target.value)}
                    style={{padding:'3px 6px',borderRadius:'12px',border:'none',fontSize:'11px',fontWeight:'500',cursor:'pointer',
                      background:STATUS_COLORS[task.status]?.bg||'#f3f4f6',
                      color:STATUS_COLORS[task.status]?.color||'#374151'}}>
                    {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div style={{fontSize:'12px',color:'#6b7280',display:'flex',alignItems:'center',gap:'5px'}}>
                  {task.assigned_profile?.full_name ? (
                    <>
                      <div style={{width:'20px',height:'20px',borderRadius:'50%',background:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',fontWeight:'600',color:'#1d4ed8',flexShrink:0}}>
                        {task.assigned_profile.full_name.substring(0,2).toUpperCase()}
                      </div>
                      {task.assigned_profile.full_name}
                    </>
                  ) : <span style={{color:'#d1d5db'}}>—</span>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'5px'}}>
                  <span style={{width:'8px',height:'8px',borderRadius:'50%',background:PRIORITY_COLORS[task.priority],flexShrink:0,display:'inline-block'}}></span>
                  <span style={{fontSize:'11px',color:'#6b7280'}}>{task.priority==='high'?'Wysoki':task.priority==='med'?'Sredni':'Niski'}</span>
                </div>
                <div style={{display:'flex',gap:'3px'}}>
                  <button onClick={()=>openTaskDetail(task)}
                    style={{padding:'4px 7px',fontSize:'11px',border:'1px solid #bbf7d0',borderRadius:'6px',cursor:'pointer',background:'#f0fdf4',color:'#059669'}}>
                    Pliki
                  </button>
                  <button onClick={()=>openEditTask(task)}
                    style={{padding:'4px 7px',fontSize:'11px',border:'1px solid #e5e7eb',borderRadius:'6px',cursor:'pointer',background:'white',color:'#374151'}}>
                    Edytuj
                  </button>
                  <button onClick={()=>handleDelete(task.id)}
                    style={{padding:'4px 7px',fontSize:'11px',border:'1px solid #fee2e2',borderRadius:'6px',cursor:'pointer',background:'#fff5f5',color:'#dc2626'}}>
                    Usun
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showDetailModal && selectedTask && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div style={{background:'white',borderRadius:'12px',width:'540px',maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:'15px',fontWeight:'600'}}>{selectedTask.product_name}</div>
                <div style={{fontSize:'12px',color:'#6b7280',marginTop:'2px'}}>{selectedTask.order_number} {selectedTask.client_name ? '· ' + selectedTask.client_name : ''}</div>
              </div>
              <button onClick={() => setShowDetailModal(false)} style={{border:'none',background:'none',fontSize:'18px',cursor:'pointer',color:'#9ca3af'}}>x</button>
            </div>
            <div style={{padding:'18px 20px'}}>
              {selectedTask.description && (
                <div style={{marginBottom:'20px',padding:'12px',background:'#f9fafb',borderRadius:'8px',fontSize:'13px',color:'#374151',lineHeight:'1.5'}}>
                  {selectedTask.description}
                </div>
              )}
              <div style={{marginBottom:'12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{fontSize:'13px',fontWeight:'600',color:'#111'}}>Zalaczniki ({taskFiles.length})</div>
                <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                  style={{padding:'6px 14px',background:'#111',color:'white',border:'none',borderRadius:'8px',fontSize:'12px',fontWeight:'500',cursor:'pointer',opacity:uploading?0.7:1}}>
                  {uploading ? 'Wgrywanie...' : '+ Dodaj plik'}
                </button>
                <input ref={fileInputRef} type="file" style={{display:'none'}} onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp" />
              </div>

              {taskFiles.length === 0 && (
                <div style={{padding:'24px',textAlign:'center',color:'#9ca3af',fontSize:'13px',border:'2px dashed #e5e7eb',borderRadius:'8px'}}>
                  Brak zalacznikow — kliknij "+ Dodaj plik"
                </div>
              )}

              {taskFiles.map(file => (
                <div key={file.name} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 12px',border:'1px solid #e5e7eb',borderRadius:'8px',marginBottom:'8px'}}>
                  <div style={{width:'36px',height:'36px',borderRadius:'6px',background:'#f3f4f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'600',color:'#6b7280',flexShrink:0}}>
                    {getFileIcon(file.name)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'13px',fontWeight:'500',color:'#111',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {file.name.replace(/^\d+_/, '')}
                    </div>
                    <div style={{fontSize:'11px',color:'#9ca3af'}}>
                      {file.metadata?.size ? `${Math.round(file.metadata.size / 1024)} KB` : ''}
                    </div>
                  </div>
                  <button onClick={() => getFileUrl(file.name)}
                    style={{padding:'4px 10px',fontSize:'11px',border:'1px solid #e5e7eb',borderRadius:'6px',cursor:'pointer',background:'white',color:'#374151',whiteSpace:'nowrap'}}>
                    Pobierz
                  </button>
                  <button onClick={() => handleFileDelete(file.name)}
                    style={{padding:'4px 8px',fontSize:'11px',border:'1px solid #fee2e2',borderRadius:'6px',cursor:'pointer',background:'#fff5f5',color:'#dc2626'}}>
                    Usun
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div style={{background:'white',borderRadius:'12px',width:'540px',maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'15px',fontWeight:'600'}}>{editingTask ? 'Edytuj zadanie' : 'Nowe zadanie'}</span>
              <button onClick={() => setShowModal(false)} style={{border:'none',background:'none',fontSize:'18px',cursor:'pointer',color:'#9ca3af'}}>x</button>
            </div>
            <div style={{padding:'18px 20px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>Nr zamowienia</label>
                  <input value={form.order_number} onChange={e=>setForm({...form,order_number:e.target.value})} placeholder="ORD-2026-001"
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>Nr reklamacji</label>
                  <input value={form.claim_number} onChange={e=>setForm({...form,claim_number:e.target.value})} placeholder="CLM-001"
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
                </div>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>Nazwa produktu *</label>
                <input value={form.product_name} onChange={e=>setForm({...form,product_name:e.target.value})} placeholder="np. Strawberry Slices 100g"
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>SKU</label>
                  <input value={form.sku} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="HF-STR-100"
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
                </div>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>Klient</label>
                  <input value={form.client_name} onChange={e=>setForm({...form,client_name:e.target.value})} placeholder="Nazwa klienta"
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>Marketplace</label>
                  <select value={form.marketplace} onChange={e=>setForm({...form,marketplace:e.target.value})}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                    {['Amazon UK','eBay UK','Sklep wlasny','Allegro','Inne'].map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>Kategoria</label>
                  <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                    {['Reklamacja','Zwrot','Uszkodzenie','Brak dostawy','Inne'].map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>Priorytet</label>
                  <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                    <option value="high">Wysoki</option>
                    <option value="med">Sredni</option>
                    <option value="low">Niski</option>
                  </select>
                </div>
                <div>
                  <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>Status</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}
                    style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                    {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:'12px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>Przypisz do</label>
                <select value={form.assigned_to} onChange={e=>setForm({...form,assigned_to:e.target.value})}
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                  <option value="">— Nieprzypisane —</option>
                  {users.map(u=><option key={u.id} value={u.id}>{u.full_name || u.id}</option>)}
                </select>
              </div>
              <div>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'4px',color:'#374151'}}>Opis / Nastepny krok</label>
                <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}
                  placeholder="Opisz problem i co nalezy zrobic..."
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none',height:'72px',resize:'vertical',fontFamily:'inherit'}} />
              </div>
            </div>
            <div style={{padding:'14px 20px',borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'flex-end',gap:'8px'}}>
              <button onClick={() => setShowModal(false)} style={{padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:'8px',background:'white',fontSize:'13px',cursor:'pointer',color:'#374151'}}>Anuluj</button>
              <button onClick={handleSave} disabled={saving}
                style={{padding:'8px 18px',background:'#111',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer',opacity:saving?0.7:1}}>
                {saving ? 'Zapisywanie...' : editingTask ? 'Zapisz zmiany' : 'Zapisz zadanie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
