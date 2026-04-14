'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Nieprawidlowy email lub haslo')
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f5f4'}}>
      <div style={{background:'white',borderRadius:'12px',padding:'40px',width:'100%',maxWidth:'380px',boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
        <div style={{marginBottom:'32px'}}>
          <h1 style={{fontSize:'20px',fontWeight:'600',margin:'0 0 4px'}}>TaskFlow</h1>
          <p style={{fontSize:'13px',color:'#6b7280',margin:0}}>Jamo Operations System</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'6px',color:'#374151'}}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              style={{width:'100%',padding:'9px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',outline:'none'}}
              placeholder="twoj@email.com" />
          </div>
          <div style={{marginBottom:'24px'}}>
            <label style={{display:'block',fontSize:'13px',fontWeight:'500',marginBottom:'6px',color:'#374151'}}>Haslo</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required
              style={{width:'100%',padding:'9px 12px',border:'1px solid #d1d5db',borderRadius:'8px',fontSize:'14px',outline:'none'}}
              placeholder="••••••••" />
          </div>
          {error && <p style={{color:'#dc2626',fontSize:'13px',marginBottom:'16px'}}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{width:'100%',padding:'10px',background:'#111',color:'white',border:'none',borderRadius:'8px',fontSize:'14px',fontWeight:'500',cursor:'pointer',opacity:loading?0.7:1}}>
            {loading ? 'Logowanie...' : 'Zaloguj sie'}
          </button>
        </form>
      </div>
    </div>
  )
}
