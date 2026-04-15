'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const STATUS_COLORS = {
  open: '#3b82f6', inprogress: '#f59e0b', waiting: '#8b5cf6',
  done: '#22c55e', urgent: '#ef4444'
}
const STATUS_LABELS = {
  open:'Otwarte', inprogress:'W trakcie', waiting:'Oczekuje', done:'Zamkniete', urgent:'Pilne'
}
const PRIORITY_COLORS = { high:'#ef4444', med:'#f59e0b', low:'#22c55e' }
const WORKSPACES = [
  { key: 'all', label: 'Wszystkie workspace' },
  { key: 'jamo_healthy', label: 'Jamo + Healthy' },
  { key: 'packpack', label: 'PackPack' },
  { key: 'private', label: 'Private' },
]

export default function ReportsPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState([])
  const [workspace, setWorkspace] = useState('all')
  const [loading, setLoading] = useState(true)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const reportRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      loadTasks()
    })
  }, [workspace])

  async function loadTasks() {
    setLoading(true)
    let query = supabase.from('tasks')
      .select('*, assigned_profile:profiles!assigned_to(full_name)')
      .order('created_at', { ascending: false })
    if (workspace !== 'all') query = query.eq('area', workspace)
    const { data } = await query
    setTasks(data || [])
    setLoading(false)
  }

  // Stats
  const total = tasks.length
  const byStatus = Object.keys(STATUS_LABELS).map(s => ({
    key: s, label: STATUS_LABELS[s], count: tasks.filter(t => t.status === s).length,
    color: STATUS_COLORS[s]
  }))
  const byPriority = [
    { key:'high', label:'Wysoki', count: tasks.filter(t=>t.priority==='high').length, color:'#ef4444' },
    { key:'med', label:'Sredni', count: tasks.filter(t=>t.priority==='med').length, color:'#f59e0b' },
    { key:'low', label:'Niski', count: tasks.filter(t=>t.priority==='low').length, color:'#22c55e' },
  ]
  const byMarketplace = [...new Set(tasks.map(t=>t.marketplace).filter(Boolean))].map(m => ({
    label: m, count: tasks.filter(t=>t.marketplace===m).length
  })).sort((a,b)=>b.count-a.count).slice(0,5)

  const overdue = tasks.filter(t => t.deadline && t.status !== 'done' && new Date(t.deadline) < new Date())
  const done = tasks.filter(t => t.status === 'done').length
  const completionRate = total ? Math.round((done / total) * 100) : 0

  // By assignee
  const byAssignee = {}
  tasks.forEach(t => {
    const name = t.assigned_profile?.full_name || 'Nieprzypisane'
    byAssignee[name] = (byAssignee[name] || 0) + 1
  })
  const assigneeData = Object.entries(byAssignee).sort((a,b)=>b[1]-a[1])

  function generatePDF() {
    setGeneratingPdf(true)
    const content = reportRef.current
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
      <head>
        <title>TaskFlow Raport - ${new Date().toLocaleDateString('pl-PL')}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #111; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 16px; margin: 24px 0 12px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
          .meta { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
          .stat { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
          .stat-val { font-size: 28px; font-weight: 700; }
          .stat-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th { background: #f9fafb; padding: 8px 10px; text-align: left; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-transform: uppercase; }
          td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
          .badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500; }
          .bar { height: 8px; border-radius: 4px; margin-top: 4px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>TaskFlow — Raport operacyjny</h1>
        <div class="meta">
          Workspace: ${WORKSPACES.find(w=>w.key===workspace)?.label} &nbsp;|&nbsp;
          Wygenerowano: ${new Date().toLocaleString('pl-PL')}
        </div>

        <div class="stats-grid">
          <div class="stat"><div class="stat-val">${total}</div><div class="stat-label">Wszystkie zadania</div></div>
          <div class="stat"><div class="stat-val" style="color:#22c55e">${done}</div><div class="stat-label">Zamkniete</div></div>
          <div class="stat"><div class="stat-val" style="color:#ef4444">${overdue.length}</div><div class="stat-label">Przeterminowane</div></div>
          <div class="stat"><div class="stat-val" style="color:#3b82f6">${completionRate}%</div><div class="stat-label">Wskaznik realizacji</div></div>
        </div>

        <h2>Status zadan</h2>
        ${byStatus.map(s=>`
          <div class="row">
            <span>${s.label}</span>
            <span><strong>${s.count}</strong> (${total?Math.round(s.count/total*100):0}%)</span>
          </div>
        `).join('')}

        <h2>Przypisanie zadan</h2>
        ${assigneeData.map(([name, count])=>`
          <div class="row"><span>${name}</span><span><strong>${count}</strong></span></div>
        `).join('')}

        <h2>Marketplace</h2>
        ${byMarketplace.map(m=>`
          <div class="row"><span>${m.label}</span><span><strong>${m.count}</strong></span></div>
        `).join('')}

        <h2>Wszystkie zadania</h2>
        <table>
          <thead>
            <tr>
              <th>Nr zamowienia</th>
              <th>Produkt / Klient</th>
              <th>Status</th>
              <th>Priorytet</th>
              <th>Przypisano</th>
              <th>Termin</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(t=>`
              <tr>
                <td>${t.order_number||'—'}</td>
                <td>${t.product_name}<br><small style="color:#6b7280">${t.client_name||''}</small></td>
                <td>${STATUS_LABELS[t.status]||t.status}</td>
                <td>${t.priority==='high'?'Wysoki':t.priority==='med'?'Sredni':'Niski'}</td>
                <td>${t.assigned_profile?.full_name||'—'}</td>
                <td>${t.deadline?new Date(t.deadline).toLocaleDateString('pl-PL'):'—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
      setGeneratingPdf(false)
    }, 500)
  }

  const maxCount = Math.max(...byStatus.map(s=>s.count), 1)

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
      <div style={{background:'white',borderBottom:'1px solid #e5e7eb',padding:'0 24px',height:'52px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <button onClick={()=>router.push('/dashboard')}
            style={{fontSize:'13px',color:'#6b7280',border:'none',background:'none',cursor:'pointer'}}>
            ← Powrot do aplikacji
          </button>
          <span style={{color:'#e5e7eb'}}>|</span>
          <span style={{fontSize:'15px',fontWeight:'600'}}>Raporty i wykresy</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <select value={workspace} onChange={e=>setWorkspace(e.target.value)}
            style={{padding:'6px 10px',border:'1px solid #e5e7eb',borderRadius:'8px',fontSize:'13px',outline:'none'}}>
            {WORKSPACES.map(w=><option key={w.key} value={w.key}>{w.label}</option>)}
          </select>
          <button onClick={generatePDF} disabled={generatingPdf||loading}
            style={{background:'#111',color:'white',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:'500',cursor:'pointer',opacity:generatingPdf?0.7:1}}>
            {generatingPdf ? 'Generowanie...' : '📄 Eksport PDF'}
          </button>
        </div>
      </div>

      <div ref={reportRef} style={{maxWidth:'960px',margin:'24px auto',padding:'0 20px'}}>

        {/* STATS CARDS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'}}>
          {[
            { label:'Wszystkie zadania', val:total, color:'#111' },
            { label:'Zamkniete', val:done, color:'#22c55e' },
            { label:'Przeterminowane', val:overdue.length, color:'#ef4444' },
            { label:'Wskaznik realizacji', val:completionRate+'%', color:'#3b82f6' },
          ].map(s=>(
            <div key={s.label} style={{background:'white',borderRadius:'10px',padding:'16px',border:'1px solid #e5e7eb'}}>
              <div style={{fontSize:'11px',color:'#9ca3af',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.04em'}}>{s.label}</div>
              <div style={{fontSize:'28px',fontWeight:'700',color:s.color}}>{s.val}</div>
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'24px'}}>

          {/* STATUS CHART */}
          <div style={{background:'white',borderRadius:'10px',padding:'20px',border:'1px solid #e5e7eb'}}>
            <h2 style={{fontSize:'14px',fontWeight:'600',marginBottom:'16px',color:'#111'}}>Status zadan</h2>
            {loading ? <div style={{color:'#9ca3af',fontSize:'13px'}}>Ladowanie...</div> :
              byStatus.map(s=>(
                <div key={s.key} style={{marginBottom:'12px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                    <span style={{fontSize:'13px',color:'#374151'}}>{s.label}</span>
                    <span style={{fontSize:'13px',fontWeight:'600',color:s.color}}>{s.count}</span>
                  </div>
                  <div style={{background:'#f3f4f6',borderRadius:'4px',height:'8px',overflow:'hidden'}}>
                    <div style={{width:`${total?Math.round(s.count/maxCount*100):0}%`,height:'100%',background:s.color,borderRadius:'4px',transition:'width 0.5s'}}></div>
                  </div>
                </div>
              ))
            }
          </div>

          {/* PRIORITY CHART */}
          <div style={{background:'white',borderRadius:'10px',padding:'20px',border:'1px solid #e5e7eb'}}>
            <h2 style={{fontSize:'14px',fontWeight:'600',marginBottom:'16px',color:'#111'}}>Priorytety</h2>
            {byPriority.map(p=>(
              <div key={p.key} style={{marginBottom:'12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                  <span style={{fontSize:'13px',color:'#374151'}}>{p.label}</span>
                  <span style={{fontSize:'13px',fontWeight:'600',color:p.color}}>{p.count}</span>
                </div>
                <div style={{background:'#f3f4f6',borderRadius:'4px',height:'8px',overflow:'hidden'}}>
                  <div style={{width:`${total?Math.round(p.count/total*100):0}%`,height:'100%',background:p.color,borderRadius:'4px'}}></div>
                </div>
              </div>
            ))}

            <h2 style={{fontSize:'14px',fontWeight:'600',margin:'20px 0 12px',color:'#111'}}>Marketplace</h2>
            {byMarketplace.map(m=>(
              <div key={m.label} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid #f3f4f6'}}>
                <span style={{fontSize:'13px',color:'#374151'}}>{m.label}</span>
                <span style={{fontSize:'13px',fontWeight:'600',color:'#111'}}>{m.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ASSIGNEE */}
        <div style={{background:'white',borderRadius:'10px',padding:'20px',border:'1px solid #e5e7eb',marginBottom:'24px'}}>
          <h2 style={{fontSize:'14px',fontWeight:'600',marginBottom:'16px',color:'#111'}}>Zadania per uzytkownik</h2>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:'12px'}}>
            {assigneeData.map(([name, count])=>(
              <div key={name} style={{textAlign:'center',padding:'16px',background:'#f9fafb',borderRadius:'8px',border:'1px solid #e5e7eb'}}>
                <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',fontWeight:'600',color:'#1d4ed8',margin:'0 auto 8px'}}>
                  {name.substring(0,2).toUpperCase()}
                </div>
                <div style={{fontSize:'13px',fontWeight:'500',color:'#111'}}>{name}</div>
                <div style={{fontSize:'22px',fontWeight:'700',color:'#1d4ed8',marginTop:'4px'}}>{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* OVERDUE */}
        {overdue.length > 0 && (
          <div style={{background:'white',borderRadius:'10px',border:'1px solid #fee2e2',marginBottom:'24px',overflow:'hidden'}}>
            <div style={{padding:'14px 20px',background:'#fee2e2',borderBottom:'1px solid #fca5a5'}}>
              <span style={{fontSize:'14px',fontWeight:'600',color:'#991b1b'}}>Przeterminowane zadania ({overdue.length})</span>
            </div>
            {overdue.map(task=>(
              <div key={task.id} style={{display:'grid',gridTemplateColumns:'1fr 120px 100px 120px',padding:'12px 20px',borderBottom:'1px solid #fee2e2',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:'13px',fontWeight:'500',color:'#111'}}>{task.product_name}</div>
                  <div style={{fontSize:'12px',color:'#6b7280'}}>{task.client_name} {task.order_number?'· '+task.order_number:''}</div>
                </div>
                <div style={{fontSize:'12px',color:'#dc2626',fontWeight:'500'}}>
                  {new Date(task.deadline).toLocaleDateString('pl-PL')}
                </div>
                <div style={{fontSize:'12px',color:'#6b7280'}}>{STATUS_LABELS[task.status]}</div>
                <div style={{fontSize:'12px',color:'#6b7280'}}>{task.assigned_profile?.full_name||'—'}</div>
              </div>
            ))}
          </div>
        )}

        {/* ALL TASKS TABLE */}
        <div style={{background:'white',borderRadius:'10px',border:'1px solid #e5e7eb',overflow:'hidden'}}>
          <div style={{padding:'14px 20px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'14px',fontWeight:'600',color:'#111'}}>Wszystkie zadania ({tasks.length})</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'100px 1fr 100px 100px 110px 90px',padding:'8px 16px',borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
            {['Nr zam.','Zadanie','Status','Priorytet','Przypisano','Termin'].map(h=>(
              <span key={h} style={{fontSize:'11px',color:'#9ca3af',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</span>
            ))}
          </div>
          {tasks.map(task=>(
            <div key={task.id} style={{display:'grid',gridTemplateColumns:'100px 1fr 100px 100px 110px 90px',padding:'10px 16px',borderBottom:'1px solid #f3f4f6',alignItems:'center'}}>
              <div style={{fontSize:'12px',fontWeight:'500',color:'#2563eb',fontFamily:'monospace'}}>{task.order_number||'—'}</div>
              <div>
                <div style={{fontSize:'13px',fontWeight:'500',color:'#111'}}>{task.product_name}</div>
                <div style={{fontSize:'11px',color:'#9ca3af'}}>{task.client_name}</div>
              </div>
              <div>
                <span style={{padding:'2px 8px',borderRadius:'10px',fontSize:'11px',fontWeight:'500',
                  background:task.status==='done'?'#d1fae5':task.status==='urgent'?'#fee2e2':'#f3f4f6',
                  color:task.status==='done'?'#065f46':task.status==='urgent'?'#991b1b':'#374151'}}>
                  {STATUS_LABELS[task.status]}
                </span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'4px'}}>
                <span style={{width:'8px',height:'8px',borderRadius:'50%',background:PRIORITY_COLORS[task.priority],display:'inline-block'}}></span>
                <span style={{fontSize:'12px',color:'#6b7280'}}>{task.priority==='high'?'Wysoki':task.priority==='med'?'Sredni':'Niski'}</span>
              </div>
              <div style={{fontSize:'12px',color:'#6b7280'}}>{task.assigned_profile?.full_name||'—'}</div>
              <div style={{fontSize:'12px',color:task.deadline&&task.status!=='done'&&new Date(task.deadline)<new Date()?'#dc2626':'#374151',fontWeight:task.deadline&&task.status!=='done'&&new Date(task.deadline)<new Date()?'500':'400'}}>
                {task.deadline?new Date(task.deadline).toLocaleDateString('pl-PL'):'—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
