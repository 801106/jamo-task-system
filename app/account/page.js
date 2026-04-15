'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUser(user)
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  async function handleChangePassword(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    if (newPassword.length < 6) {
      setError('Haslo musi miec minimum 6 znakow')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Hasla nie sa identyczne')
      return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setError('Blad zmiany hasla: ' + error.message)
    } else {
      setMessage('Haslo zostalo zmienione pomyslnie!')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}}>
      <div style={{background:'white',borderBottom:'1px solid #e5e7eb',padding:'0 24px',height:'52px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <button onClick={() => router.push('/dashboard')}
            style={{fontSize:'13px',color:'#6b7280',border:'none',background:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px'}}>
            ← Powrot do aplikacji
          </button>
          <span style={{color:'#e5e7eb'}}>|</span>
          <span style={{fontSize:'15px',fontWeight:'600'}}>Moje konto</span>
        </div>
        <button onClick={handleLogout} style={{fontSize:'13px',color:'#9ca3af',border:'none',background:'none',cursor:'pointer'}}>Wyloguj</button>
      </div>

      <div style={{maxWidth:'480px',margin:'40px auto',padding:'0 16px'}}>
        <div style={{background:'white',borderRadius:'12px',border:'1px solid #e5e7eb',padding:'24px',marginBottom:'16px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'14px',marginBottom:'20px',paddingBottom:'20px',borderBottom:'1px solid #e5e7eb'}}>
            <div style={{width:'48px',height:'48px',borderRadius:'50%',background:'#dbeafe',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:'600',color:'#1d4ed8'}}>
              {(profile?.full_name || user?.email || '?').substring(0,2).toUpperCase()}
            </div>
            <div>
              <div style={{fontSize:'15px',fontWeight:'600',color:'#111'}}>{profile?.full_name || 'Uzytkownik'}</div>
              <div style={{fontSize:'13px',color:'#6b7280'}}>{user?.email}</div>
              <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'2px'}}>{profile?.role === 'admin' ? 'Administrator' : 'Uzytkownik'}</div>
            </div>
          </div>

          <h2 style={{fontSize:'14px',fontWeight:'600',color:'#111',marginBottom:'16px'}}>Zmiana hasla</h2>

          <form onSubmit={handleChangePassword}>
            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'6px',color:'#374151'}}>Nowe haslo</label>
              <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)}
                placeholder="Minimum 6 znakow" required
                style={{width:'100%',padding:'9px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',outline:'none'}} />
            </div>
            <div style={{marginBottom:'20px'}}>
              <label style={{display:'block',fontSize:'12px',fontWeight:'500',marginBottom:'6px',color:'#374151'}}>Potwierdz nowe haslo</label>
              <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
                placeholder="Wpisz haslo jeszcze raz" required
                style={{width:'100%',padding:'9px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',outline:'none'}} />
            </div>

            {error && (
              <div style={{padding:'10px 12px',background:'#fee2e2',borderRadius:'8px',fontSize:'13px',color:'#991b1b',marginBottom:'14px'}}>
                {error}
              </div>
            )}
            {message && (
              <div style={{padding:'10px 12px',background:'#d1fae5',borderRadius:'8px',fontSize:'13px',color:'#065f46',marginBottom:'14px'}}>
                {message}
              </div>
            )}

            <button type="submit" disabled={saving}
              style={{width:'100%',padding:'10px',background:'#111',color:'white',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer',opacity:saving?0.7:1}}>
              {saving ? 'Zapisywanie...' : 'Zmien haslo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
