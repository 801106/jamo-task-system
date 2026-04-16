'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const F = { fontFamily: "'DM Sans', -apple-system, sans-serif" }

export default function MessagesPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [unreadCounts, setUnreadCounts] = useState({})
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [taskRef, setTaskRef] = useState('')
  const [taskObj, setTaskObj] = useState(null)
  const [showTaskPicker, setShowTaskPicker] = useState(false)
  const [tasks, setTasks] = useState([])
  const [taskSearch, setTaskSearch] = useState('')
  const [tab, setTab] = useState('chat')
  const [lang, setLang] = useState('pl')
  const messagesEndRef = useRef(null)
  const fileRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const saved = localStorage.getItem('tf_lang'); if (saved) setLang(saved)
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUser(user)
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => setProfile(data))
    })
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('id, full_name, role').neq('id', user.id).then(({ data }) => setUsers(data || []))
    supabase.from('tasks').select('id, product_name, order_number, area').order('created_at', { ascending: false }).limit(50).then(({ data }) => setTasks(data || []))
    loadUnreadCounts()
  }, [user])

  async function loadUnreadCounts() {
    if (!user) return
    const { data } = await supabase.from('messages').select('sender_id').eq('receiver_id', user.id).eq('read', false)
    const counts = {}
    ;(data || []).forEach(m => { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1 })
    setUnreadCounts(counts)
  }

  const loadMessages = useCallback(async () => {
    if (!user || !selectedUser) return
    const { data } = await supabase.from('messages')
      .select('*, sender:profiles!sender_id(full_name), task:tasks!task_id(product_name, order_number)')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    await supabase.from('messages').update({ read: true }).eq('sender_id', selectedUser.id).eq('receiver_id', user.id).eq('read', false)
    loadUnreadCounts()
  }, [user, selectedUser])

  useEffect(() => { loadMessages() }, [loadMessages])

  useEffect(() => {
    if (!user || !selectedUser) return
    const ch = supabase.channel('msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadMessages())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user, selectedUser, loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if ((!text.trim() && !taskRef) || !selectedUser || !user) return
    setSending(true)
    await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content: text.trim() || null,
      task_id: taskObj?.id || null,
      task_ref: taskObj ? `#${taskObj.order_number || taskObj.id.substring(0,6).toUpperCase()} · ${taskObj.product_name}` : taskRef || null,
    })
    if (taskObj?.id) {
      await fetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: selectedUser.id, title: `Wiadomosc od ${profile?.full_name}`, body: text.trim() || `Task ${taskObj.order_number}`, url: '/messages' }) })
    } else {
      await fetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: selectedUser.id, title: `Wiadomosc od ${profile?.full_name}`, body: text.trim() || 'Nowa wiadomosc', url: '/messages' }) })
    }
    setText(''); setTaskRef(''); setTaskObj(null); setSending(false)
    inputRef.current?.focus()
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file || !selectedUser || !user) return
    setUploading(true)
    const path = `messages/${user.id}/${Date.now()}_${file.name}`
    const { data: upload, error } = await supabase.storage.from('task-files').upload(path, file)
    if (!error) {
      const { data: urlData } = await supabase.storage.from('task-files').createSignedUrl(path, 86400 * 30)
      await supabase.from('messages').insert({
        sender_id: user.id,
        receiver_id: selectedUser.id,
        content: null,
        file_url: urlData?.signedUrl,
        file_name: file.name,
        file_size: file.size,
        task_id: taskObj?.id || null,
        task_ref: taskObj ? `#${taskObj.order_number || taskObj.id.substring(0,6).toUpperCase()} · ${taskObj.product_name}` : null,
      })
      if (taskObj?.id) {
        await supabase.storage.from('task-files').copy(path, `${taskObj.id}/${Date.now()}_${file.name}`)
      }
      await fetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: selectedUser.id, title: `Plik od ${profile?.full_name}`, body: file.name, url: '/messages' }) })
      setTaskObj(null); setTaskRef('')
    }
    setUploading(false)
    e.target.value = ''
  }

  function selectTask(task) {
    setTaskObj(task)
    setTaskRef(`#${task.order_number || task.id.substring(0,6).toUpperCase()} · ${task.product_name}`)
    setShowTaskPicker(false)
    setTaskSearch('')
    inputRef.current?.focus()
  }

  function fmtTime(d) { return new Date(d).toLocaleTimeString(lang==='pl'?'pl-PL':'en-GB', { hour: '2-digit', minute: '2-digit' }) }
  function fmtDate(d) {
    const now = new Date(); const msg = new Date(d)
    if (now.toDateString() === msg.toDateString()) return lang==='pl'?'Dzisiaj':'Today'
    const yes = new Date(now); yes.setDate(now.getDate()-1)
    if (yes.toDateString() === msg.toDateString()) return lang==='pl'?'Wczoraj':'Yesterday'
    return msg.toLocaleDateString(lang==='pl'?'pl-PL':'en-GB')
  }
  function fmtSize(b) { if (b < 1024) return b+'B'; if (b < 1024*1024) return (b/1024).toFixed(1)+'KB'; return (b/1024/1024).toFixed(1)+'MB' }
  function fileIcon(name) { if (!name) return 'FILE'; if (name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'IMG'; if (name.match(/\.pdf$/i)) return 'PDF'; if (name.match(/\.docx?$/i)) return 'DOC'; if (name.match(/\.xlsx?$/i)) return 'XLS'; return 'FILE' }
  function initials(name) { return (name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().substring(0,2) }

  const filteredTasks = tasks.filter(t => {
    if (!taskSearch) return true
    const q = taskSearch.toLowerCase()
    return (t.product_name||'').toLowerCase().includes(q) || (t.order_number||'').toLowerCase().includes(q)
  })

  const avatarColors = { 0: { bg:'#eff6ff', color:'#1d4ed8' }, 1: { bg:'#f0fdf4', color:'#16a34a' }, 2: { bg:'#faf5ff', color:'#7c3aed' }, 3: { bg:'#fff7ed', color:'#c2410c' }, 4: { bg:'#fdf2f8', color:'#be185d' } }
  const getColor = (id) => avatarColors[users.findIndex(u=>u.id===id) % 5] || avatarColors[0]

  const myColor = { bg:'#111', color:'#fff' }

  let lastDate = ''

  const filesOnly = messages.filter(m => m.file_url)

  return (
    <div style={{ display:'flex', height:'100vh', ...F }}>
      {/* SIDEBAR */}
      <div style={{ width:'220px', background:'#fff', borderRight:'1px solid #e8e8e6', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'18px 16px 14px', borderBottom:'1px solid #e8e8e6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontWeight:'600', fontSize:'14px', letterSpacing:'-0.3px' }}>TaskFlow</div>
            <div style={{ fontSize:'10px', color:'#9ca3af', marginTop:'1px' }}>Jamo Operations</div>
          </div>
          <button onClick={toggleLang} style={{ fontSize:'16px', border:'1px solid #e8e8e6', borderRadius:'6px', padding:'3px 7px', cursor:'pointer', background:'#fafaf9' }}>{lang==='pl'?'🇵🇱':'🇬🇧'}</button>
        </div>

        <nav style={{ padding:'10px 8px', borderBottom:'1px solid #e8e8e6' }}>
          {[
            { label: lang==='pl'?'Zadania':'Tasks', path:'/dashboard' },
            { label: lang==='pl'?'Wiadomosci':'Messages', path:'/messages', active:true },
            { label: lang==='pl'?'Raporty':'Reports', path:'/reports' },
          ].map(item => (
            <button key={item.path} onClick={() => router.push(item.path)}
              style={{ display:'flex', alignItems:'center', width:'100%', textAlign:'left', padding:'7px 9px', borderRadius:'7px', fontSize:'13px', cursor:'pointer', border:'none', background:item.active?'#f4f4f3':'transparent', color:item.active?'#111':'#6b7280', fontWeight:item.active?'500':'400', marginBottom:'2px' }}>
              {item.label}
              {item.active && Object.values(unreadCounts).reduce((a,b)=>a+b,0) > 0 && (
                <span style={{ marginLeft:'auto', background:'#2563eb', color:'white', fontSize:'10px', fontWeight:'600', padding:'1px 6px', borderRadius:'10px' }}>
                  {Object.values(unreadCounts).reduce((a,b)=>a+b,0)}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ flex:1, overflowY:'auto' }}>
          <div style={{ padding:'10px 14px 6px', fontSize:'10px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.07em', fontWeight:'500' }}>
            {lang==='pl'?'Rozmowy':'Conversations'}
          </div>
          {users.map(u => {
            const col = getColor(u.id)
            const unread = unreadCounts[u.id] || 0
            const lastMsg = messages.filter(m => m.sender_id === u.id || m.receiver_id === u.id).slice(-1)[0]
            return (
              <div key={u.id} onClick={() => setSelectedUser(u)}
                style={{ display:'flex', alignItems:'center', gap:'9px', padding:'9px 12px', cursor:'pointer', background:selectedUser?.id===u.id?'#f4f4f3':'transparent', borderBottom:'1px solid #f0f0ee' }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:col.bg, color:col.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'500', flexShrink:0 }}>
                  {initials(u.full_name)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'13px', fontWeight:unread?'600':'500', color:'#111' }}>{u.full_name}</div>
                  {lastMsg && <div style={{ fontSize:'11px', color:'#9ca3af', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:'1px' }}>{lastMsg.file_name || lastMsg.content || lastMsg.task_ref}</div>}
                </div>
                {unread > 0 && <span style={{ background:'#2563eb', color:'white', fontSize:'10px', fontWeight:'600', padding:'1px 6px', borderRadius:'10px', flexShrink:0 }}>{unread}</span>}
              </div>
            )
          })}
        </div>

        <div style={{ padding:'12px 14px', borderTop:'1px solid #e8e8e6' }}>
          <div style={{ fontSize:'12px', fontWeight:'500', color:'#111', marginBottom:'2px' }}>{profile?.full_name}</div>
          <button onClick={() => router.push('/dashboard')} style={{ fontSize:'11px', color:'#6b7280', border:'none', background:'none', cursor:'pointer', padding:'0' }}>
            ← {lang==='pl'?'Wróc do zadan':'Back to tasks'}
          </button>
        </div>
      </div>

      {/* CHAT AREA */}
      {!selectedUser ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f5f3' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ width:'48px', height:'48px', background:'#f0f0ee', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M18 10c0 4.4-3.6 8-8 8l-5 2 1-3C3.6 15.7 2 13 2 10c0-4.4 3.6-8 8-8s8 3.6 8 8z" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ fontSize:'14px', fontWeight:'500', color:'#374151', marginBottom:'4px' }}>{lang==='pl'?'Wybierz rozmowe':'Select a conversation'}</div>
            <div style={{ fontSize:'12px', color:'#9ca3af' }}>{lang==='pl'?'Kliknij na uzytkownika po lewej':'Click a user on the left'}</div>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#f5f5f3' }}>
          {/* CHAT HEADER */}
          <div style={{ background:'#fff', borderBottom:'1px solid #e8e8e6', padding:'0 20px', height:'56px', display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:getColor(selectedUser.id).bg, color:getColor(selectedUser.id).color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'500', flexShrink:0 }}>
              {initials(selectedUser.full_name)}
            </div>
            <div>
              <div style={{ fontSize:'14px', fontWeight:'600', color:'#111', letterSpacing:'-0.2px' }}>{selectedUser.full_name}</div>
              <div style={{ fontSize:'11px', color:'#16a34a' }}>● {lang==='pl'?'aktywny':'active'}</div>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:'0' }}>
              {['chat','files'].map(t => (
                <button key={t} onClick={()=>setTab(t)}
                  style={{ padding:'6px 14px', fontSize:'12px', border:'none', background:'transparent', cursor:'pointer', color:tab===t?'#111':'#9ca3af', fontWeight:tab===t?'500':'400', borderBottom:tab===t?'2px solid #111':'2px solid transparent', ...F }}>
                  {t==='chat'?(lang==='pl'?'Czat':'Chat'):(lang==='pl'?'Pliki':'Files')}
                  {t==='files'&&filesOnly.length>0&&<span style={{ marginLeft:'5px', background:'#f0f0ee', color:'#6b7280', fontSize:'10px', padding:'1px 5px', borderRadius:'8px' }}>{filesOnly.length}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* MESSAGES or FILES */}
          {tab === 'chat' ? (
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:'8px' }}>
              {messages.length === 0 && (
                <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'13px', marginTop:'40px' }}>
                  {lang==='pl'?'Brak wiadomosci — zacznij rozmowe!':'No messages yet — start the conversation!'}
                </div>
              )}
              {messages.map((msg, i) => {
                const isMine = msg.sender_id === user?.id
                const msgDate = fmtDate(msg.created_at)
                const showDate = msgDate !== lastDate
                if (showDate) lastDate = msgDate
                const col = isMine ? myColor : getColor(msg.sender_id)
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div style={{ textAlign:'center', margin:'8px 0', fontSize:'11px', color:'#9ca3af' }}>
                        <span style={{ background:'#f0f0ee', padding:'2px 10px', borderRadius:'10px' }}>{msgDate}</span>
                      </div>
                    )}
                    <div style={{ display:'flex', flexDirection:'column', alignItems:isMine?'flex-end':'flex-start', maxWidth:'70%', alignSelf:isMine?'flex-end':'flex-start' }}>
                      {!isMine && i===0 || (messages[i-1]?.sender_id !== msg.sender_id) ? (
                        <div style={{ fontSize:'11px', color:'#9ca3af', marginBottom:'3px', paddingLeft:isMine?0:'2px' }}>{msg.sender?.full_name}</div>
                      ) : null}

                      {msg.task_ref && (
                        <div style={{ display:'inline-flex', alignItems:'center', gap:'5px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'6px', padding:'3px 9px', fontSize:'11px', color:'#1d4ed8', fontWeight:'500', marginBottom:'4px' }}>
                          <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#2563eb', flexShrink:0 }}></div>
                          {msg.task_ref}
                        </div>
                      )}

                      {msg.content && (
                        <div style={{ padding:'9px 13px', borderRadius:'12px', fontSize:'13px', lineHeight:'1.5', background:isMine?'#111':'#fff', color:isMine?'white':'#111', border:isMine?'none':'1px solid #e8e8e6', borderBottomRightRadius:isMine?'4px':'12px', borderBottomLeftRadius:isMine?'12px':'4px' }}>
                          {msg.content}
                        </div>
                      )}

                      {msg.file_url && (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 13px', borderRadius:'10px', background:'#fff', border:'1px solid #e8e8e6', marginTop:msg.content?'4px':'0', cursor:'pointer' }}>
                            <div style={{ width:'32px', height:'32px', background:'#eff6ff', borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:'600', color:'#1d4ed8', flexShrink:0 }}>
                              {fileIcon(msg.file_name)}
                            </div>
                            <div>
                              <div style={{ fontSize:'12px', fontWeight:'500', color:'#111' }}>{msg.file_name}</div>
                              <div style={{ fontSize:'10px', color:'#9ca3af', marginTop:'1px' }}>{fmtSize(msg.file_size || 0)}</div>
                            </div>
                          </div>
                        </a>
                      )}

                      <div style={{ fontSize:'10px', color:'#9ca3af', marginTop:'3px' }}>{fmtTime(msg.created_at)}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
              <div style={{ fontSize:'11px', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:'500', marginBottom:'12px' }}>
                {lang==='pl'?'Wszyskie pliki w tej rozmowie':'All files in this conversation'} ({filesOnly.length})
              </div>
              {filesOnly.length === 0 && <div style={{ color:'#9ca3af', fontSize:'13px' }}>{lang==='pl'?'Brak plikow':'No files yet'}</div>}
              {filesOnly.map(msg => (
                <a key={msg.id} href={msg.file_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'11px 14px', background:'#fff', border:'1px solid #e8e8e6', borderRadius:'9px', marginBottom:'8px', cursor:'pointer' }}>
                    <div style={{ width:'36px', height:'36px', background:'#eff6ff', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:'600', color:'#1d4ed8', flexShrink:0 }}>
                      {fileIcon(msg.file_name)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'13px', fontWeight:'500', color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{msg.file_name}</div>
                      <div style={{ fontSize:'11px', color:'#9ca3af', marginTop:'2px' }}>
                        {msg.sender?.full_name} · {fmtDate(msg.created_at)} · {fmtSize(msg.file_size || 0)}
                        {msg.task_ref && <span style={{ marginLeft:'6px', color:'#2563eb', fontWeight:'500' }}>{msg.task_ref}</span>}
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* INPUT AREA */}
          <div style={{ background:'#fff', borderTop:'1px solid #e8e8e6', padding:'12px 16px' }}>
            {taskObj && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:'6px', background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:'7px', padding:'4px 10px', fontSize:'11px', color:'#1d4ed8', fontWeight:'500', marginBottom:'8px' }}>
                <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#2563eb' }}></div>
                {taskRef}
                <button onClick={()=>{setTaskObj(null);setTaskRef('')}} style={{ background:'none', border:'none', cursor:'pointer', color:'#93c5fd', fontSize:'14px', lineHeight:'1', padding:'0 0 0 4px' }}>×</button>
              </div>
            )}

            {showTaskPicker && (
              <div style={{ background:'#fff', border:'1px solid #e8e8e6', borderRadius:'10px', padding:'10px', marginBottom:'10px', maxHeight:'200px', overflowY:'auto' }}>
                <input value={taskSearch} onChange={e=>setTaskSearch(e.target.value)} placeholder={lang==='pl'?'Szukaj zadania...':'Search task...'}
                  style={{ width:'100%', padding:'7px 10px', border:'1px solid #e8e8e6', borderRadius:'7px', fontSize:'12px', outline:'none', marginBottom:'8px', ...F }} autoFocus />
                {filteredTasks.slice(0,8).map(t => (
                  <div key={t.id} onClick={() => selectTask(t)}
                    style={{ padding:'8px 10px', borderRadius:'7px', cursor:'pointer', fontSize:'12px', color:'#111', display:'flex', alignItems:'center', gap:'8px' }}
                    onMouseEnter={e=>e.currentTarget.style.background='#f4f4f3'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <span style={{ color:'#2563eb', fontWeight:'500', fontFamily:"'DM Mono', monospace", fontSize:'11px' }}>{t.order_number||t.id.substring(0,6).toUpperCase()}</span>
                    <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.product_name}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <input ref={fileRef} type="file" style={{ display:'none' }} onChange={handleFileUpload} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} title={lang==='pl'?'Dodaj plik':'Attach file'}
                style={{ width:'36px', height:'36px', background:'#fafaf9', border:'1px solid #e8e8e6', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {uploading
                  ? <div style={{ width:'14px', height:'14px', border:'2px solid #e5e7eb', borderTopColor:'#6b7280', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}></div>
                  : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12 7L7 12C5.3 13.7 2.7 13.7 1 12C-.7 10.3-.7 7.7 1 6L7.5 1C8.6-.1 10.4-.1 11.5 1C12.6 2.1 12.6 3.9 11.5 5L5 11C4.4 11.6 3.6 11.6 3 11C2.4 10.4 2.4 9.6 3 9L8.5 3.5" stroke="#6b7280" strokeWidth="1.3" strokeLinecap="round"/></svg>
                }
              </button>

              <button onClick={() => setShowTaskPicker(!showTaskPicker)} title={lang==='pl'?'Przypnij task':'Pin task'}
                style={{ padding:'0 12px', height:'36px', background:showTaskPicker?'#eff6ff':'#fafaf9', border:`1px solid ${showTaskPicker?'#bfdbfe':'#e8e8e6'}`, borderRadius:'8px', cursor:'pointer', fontSize:'11px', color:showTaskPicker?'#1d4ed8':'#6b7280', fontWeight:'500', whiteSpace:'nowrap', ...F }}>
                + Task
              </button>

              <input ref={inputRef} value={text} onChange={e=>setText(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage()}}}
                placeholder={lang==='pl'?'Napisz wiadomosc... (Enter = wyslij)':'Type a message... (Enter = send)'}
                style={{ flex:1, padding:'9px 13px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', outline:'none', background:'#fafaf9', color:'#111', ...F }}
                onFocus={e=>e.target.style.borderColor='#111'} onBlur={e=>e.target.style.borderColor='#e8e8e6'} />

              <button onClick={sendMessage} disabled={sending || (!text.trim() && !taskObj)}
                style={{ width:'36px', height:'36px', background:'#111', border:'none', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, opacity:(sending||(!text.trim()&&!taskObj))?0.4:1 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12.5 7H2M12.5 7L8 2.5M12.5 7L8 11.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  function toggleLang() { const n=lang==='pl'?'en':'pl'; setLang(n); localStorage.setItem('tf_lang',n) }
}
