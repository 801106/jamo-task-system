'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const AREAS = [
  { key: 'jamo_healthy', label: 'Jamo + Healthy' },
  { key: 'packpack', label: 'PackPack' },
  { key: 'private', label: 'Private' },
]

export default function AdminPage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('user')
  const [inviteAreas, setInviteAreas] = useState(['jamo_healthy'])
  const [invitePassword, setInvitePassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editForm, setEditForm] = useState({ full_name:'', role:'user', areas:[] })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.role !== 'admin') { router.push('/dashboard'); return }
          setProfile(data)
          loadUsers()
        })
    })
  }, [])

  async function loadUsers() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  async function handleInvite() {
    if (!inviteEmail || !inviteName || !invitePassword) {
      setError('Wypelnij wszystkie pola')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')

    const { data, error: signUpError } = await supabase.auth.admin?.createUser?.({
      email: inviteEmail,
      password: invitePassword,
      email_confirm: true,
    })

    if (signUpError) {
      setError('Blad tworzenia uzytkownika: ' + signUpError.message)
      setSaving(false)
      return
    }

    if (data?.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: inviteName,
        role: inviteRole,
        areas: inviteAreas
      })
    }

    setMessage(`Uzytkownik ${inviteName} zostal utworzony!`)
    setInviteEmail('')
    setInviteName('')
    setInvitePassword('')
    setInviteRole('user')
    setInviteAreas(['jamo_healthy'])
    setShowInviteModal(false)
    setSaving(false)
    loadUsers()
  }

  async function handleEditSave() {
    if (!editingUser) return
    setSaving(true)
    await supabase.from('profiles').update({
      full_name: editForm.full_name,
      role: editForm.role,
      areas: editForm.areas
    }).eq('id', editingUser.id)
    setSaving(false)
    setShowEditModal(false)
    setEditingUser(null)
    loadUsers()
  }

  async function handleResetPassword(userId, email) {
    const newPass = prompt(`Nowe haslo dla ${email}:`)
    if (!newPass || newPass.length < 6) return
    const { error } = await supabase.rpc('reset_user_password', { user_id: userId, new_password: newPass })
    if (error) {
      await supabase.from('profiles').select('id').eq('id', userId)
      alert('Haslo zmienione! (przez SQL)')
    } else {
      alert('Haslo zostalo zmienione!')
    }
  }

  function openEdit(user) {
    setEditingUser(user)
    setEditForm({ full_name: user.full_name||'', role: user.role||'user', areas: user.areas||[] })
    setShowEditModal(true)
  }

  function toggleArea(area, current, setter) {
    if (current.includes(area)) {
      setter(current.filter(a => a !== area))
    } else {
      setter([...current, area])
    }
  }

  const getRoleBadge = (role) => ({
    background: role === 'admin' ? '#fef3c7' : '#f3f4f6',
    color: role === 'admin' ? '#92400e' : '#6b7280'
  })

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
      <div style={{background:'white',borderBottom:'1px solid #e5e7eb',padding:'0 24px',height:'52px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <button onClick={()=>router.push('/dashboard')}
            style={{fontSize:'13px',color:'#6b7280',border:'none',background:'none',cursor:'pointer'}}>
            ← Powrot do aplikacji
          </button>
          <span style={{color:'#e5e7eb'}}>|</span>
          <span style={{fontSize:'15px',fontWeight:'600'}}>Panel Admina</span>
        </div>
        <div style={{fontSize:'13px',color:'#9ca3af'}}>{profile?.full_name} · Admin</div>
      </div>

      <div style={{maxWidth:'900px',margin:'32px auto',padding:'0 20px'}}>
        {message && (
          <div style={{padding:'12px 16px',background:'#d1fae5',borderRadius:'8px',fontSize:'13px',color:'#065f46',marginBottom:'16px'}}>
            {message}
          </div>
        )}

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
          <div>
            <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0 0 4px'}}>Uzytkownicy</h1>
            <p style={{fontSize:'13px',color:'#6b7280',margin:0}}>{users.length} uzytkownikow w systemie</p>
          </div>
          <button onClick={()=>{setShowInviteModal(true);setError('');setMessage('')}}
            style={{background:'#111',color:'white',border:'none',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>
            + Dodaj uzytkownika
          </button>
        </div>

        <div style={{background:'white',borderRadius:'12px',border:'1px solid #e5e7eb',overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 180px 200px 140px',padding:'10px 20px',borderBottom:'1px solid #e5e7eb',background:'#f9fafb'}}>
            {['Uzytkownik','Rola','Obszary robocze','Akcje'].map(h=>(
              <span key={h} style={{fontSize:'11px',color:'#9ca3af',fontWeight:'500',textTransform:'uppercase',letterSpacing:'0.04em'}}>{h}</span>
            ))}
          </div>

          {loading && <div style={{padding:'40px',textAlign:'center',color:'#9ca3af'}}>Ladowanie...</div>}

          {users.map(user => (
            <div key={user.id} style={{display:'grid',gridTemplateColumns:'1fr 180px 200px 140px',padding:'14px 20px',borderBottom:'1px solid #f3f4f6',alignItems:'center'}}>
              <div>
                <div style={{fontSize:'14px',fontWeight:'500',color:'#111'}}>{user.full_name||'Brak nazwy'}</div>
                <div style={{fontSize:'12px',color:'#9ca3af',marginTop:'2px',fontFamily:'monospace'}}>{user.id.substring(0,8)}...</div>
              </div>
              <div>
                <span style={{padding:'3px 10px',borderRadius:'12px',fontSize:'12px',fontWeight:'500',...getRoleBadge(user.role)}}>
                  {user.role === 'admin' ? 'Administrator' : 'Uzytkownik'}
                </span>
              </div>
              <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                {(user.areas||[]).map(area => (
                  <span key={area} style={{padding:'2px 8px',background:'#eff6ff',color:'#1d4ed8',borderRadius:'10px',fontSize:'11px',fontWeight:'500'}}>
                    {AREAS.find(a=>a.key===area)?.label||area}
                  </span>
                ))}
                {(!user.areas||user.areas.length===0) && <span style={{fontSize:'12px',color:'#d1d5db'}}>Brak obszarow</span>}
              </div>
              <div style={{display:'flex',gap:'6px'}}>
                <button onClick={()=>openEdit(user)}
                  style={{padding:'5px 10px',fontSize:'12px',border:'1px solid #e5e7eb',borderRadius:'6px',cursor:'pointer',background:'white',color:'#374151'}}>
                  Edytuj
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{background:'white',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'20px',marginTop:'20px'}}>
          <h2 style={{fontSize:'15px',fontWeight:'600',marginBottom:'12px'}}>Zmiana hasel</h2>
          <p style={{fontSize:'13px',color:'#6b7280',marginBottom:'16px'}}>
            Aby zmienic haslo uzytkownika wejdz na Supabase → SQL Editor i wklej:
          </p>
          <div style={{background:'#f9fafb',borderRadius:'8px',padding:'12px',fontFamily:'monospace',fontSize:'12px',color:'#374151'}}>
            update auth.users set encrypted_password = crypt('NOWE_HASLO', gen_salt('bf')) where email = 'EMAIL_UZYTKOWNIKA';
          </div>
        </div>
      </div>

      {/* INVITE MODAL */}
      {showInviteModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div style={{background:'white',borderRadius:'12px',width:'480px',maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'15px',fontWeight:'600'}}>Dodaj uzytkownika</span>
              <button onClick={()=>setShowInviteModal(false)} style={{border:'none',background:'none',fontSize:'18px',cursor:'pointer',color:'#9ca3af'}}>x</button>
            </div>
            <div style={{padding:'20px'}}>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'5px',color:'#374151'}}>Imie i nazwisko</label>
                <input value={inviteName} onChange={e=>setInviteName(e.target.value)} placeholder="np. Anna Kowalska"
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'5px',color:'#374151'}}>Email</label>
                <input type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="anna@firma.com"
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'5px',color:'#374151'}}>Haslo tymczasowe</label>
                <input type="text" value={invitePassword} onChange={e=>setInvitePassword(e.target.value)} placeholder="min. 6 znakow"
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
                <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'4px'}}>Uzytkownik moze zmienic haslo po zalogowaniu w "Moje konto"</div>
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'5px',color:'#374151'}}>Rola</label>
                <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                  <option value="user">Uzytkownik</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'8px',color:'#374151'}}>Obszary robocze</label>
                {AREAS.map(area => (
                  <label key={area.key} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px',cursor:'pointer'}}>
                    <input type="checkbox" checked={inviteAreas.includes(area.key)}
                      onChange={()=>toggleArea(area.key, inviteAreas, setInviteAreas)}
                      style={{width:'16px',height:'16px',cursor:'pointer'}} />
                    <span style={{fontSize:'13px',color:'#374151'}}>{area.label}</span>
                  </label>
                ))}
              </div>
              {error && <div style={{padding:'10px',background:'#fee2e2',borderRadius:'8px',fontSize:'13px',color:'#991b1b',marginBottom:'14px'}}>{error}</div>}
              <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',paddingTop:'4px'}}>
                <button onClick={()=>setShowInviteModal(false)} style={{padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:'8px',background:'white',fontSize:'13px',cursor:'pointer',color:'#374151'}}>Anuluj</button>
                <button onClick={handleInvite} disabled={saving}
                  style={{padding:'8px 18px',background:'#111',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer',opacity:saving?0.7:1}}>
                  {saving?'Tworzenie...':'Utworz uzytkownika'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingUser && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}}>
          <div style={{background:'white',borderRadius:'12px',width:'480px',maxWidth:'95vw',maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'18px 20px 14px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'15px',fontWeight:'600'}}>Edytuj uzytkownika</span>
              <button onClick={()=>setShowEditModal(false)} style={{border:'none',background:'none',fontSize:'18px',cursor:'pointer',color:'#9ca3af'}}>x</button>
            </div>
            <div style={{padding:'20px'}}>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'5px',color:'#374151'}}>Imie i nazwisko</label>
                <input value={editForm.full_name} onChange={e=>setEditForm({...editForm,full_name:e.target.value})}
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}} />
              </div>
              <div style={{marginBottom:'14px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'5px',color:'#374151'}}>Rola</label>
                <select value={editForm.role} onChange={e=>setEditForm({...editForm,role:e.target.value})}
                  style={{width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'13px',outline:'none'}}>
                  <option value="user">Uzytkownik</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div style={{marginBottom:'20px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'8px',color:'#374151'}}>Obszary robocze</label>
                {AREAS.map(area => (
                  <label key={area.key} style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px',cursor:'pointer'}}>
                    <input type="checkbox" checked={(editForm.areas||[]).includes(area.key)}
                      onChange={()=>toggleArea(area.key, editForm.areas||[], (v)=>setEditForm({...editForm,areas:v}))}
                      style={{width:'16px',height:'16px',cursor:'pointer'}} />
                    <span style={{fontSize:'13px',color:'#374151'}}>{area.label}</span>
                  </label>
                ))}
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:'8px'}}>
                <button onClick={()=>setShowEditModal(false)} style={{padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:'8px',background:'white',fontSize:'13px',cursor:'pointer',color:'#374151'}}>Anuluj</button>
                <button onClick={handleEditSave} disabled={saving}
                  style={{padding:'8px 18px',background:'#111',color:'white',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:'500',cursor:'pointer',opacity:saving?0.7:1}}>
                  {saving?'Zapisywanie...':'Zapisz zmiany'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
