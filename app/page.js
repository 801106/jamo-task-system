'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push('/dashboard')
    })
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Nieprawidlowy email lub haslo')
      setLoading(false)
      return
    }

    // Sprawdź czy użytkownik ma 2FA
    const { data: mfaData } = await supabase.auth.mfa.listFactors()
    const hasTotp = mfaData?.totp?.length > 0

    if (hasTotp) {
      // Ma 2FA — idź do weryfikacji
      router.push('/verify')
    } else {
      // Nie ma 2FA — idź do konfiguracji
      router.push('/mfa')
    }

    setLoading(false)
  }

  const F = { fontFamily: "'DM Sans', sans-serif" }

  return (
    <div style={{ minHeight:'100vh', display:'flex', background:'#f5f5f3', ...F }}>
      {/* LEFT PANEL */}
      <div style={{ width:'400px', background:'#111', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'48px 40px', flexShrink:0 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'60px' }}>
            <div style={{ width:'32px', height:'32px', background:'white', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:'13px', height:'13px', border:'2.5px solid #111', borderRadius:'3px' }}></div>
            </div>
            <span style={{ color:'white', fontSize:'16px', fontWeight:'600', letterSpacing:'-0.3px' }}>TaskFlow</span>
          </div>
          <h1 style={{ color:'white', fontSize:'28px', fontWeight:'600', letterSpacing:'-0.5px', lineHeight:'1.3', margin:'0 0 16px' }}>
            Operacje<br/>pod kontrola.
          </h1>
          <p style={{ color:'#6b7280', fontSize:'14px', lineHeight:'1.6', margin:0 }}>
            Zarzadzaj reklamacjami, zadaniami i komunikacja z klientami w jednym miejscu.
          </p>
        </div>
        <div>
          {[
            { label:'Jamo Packaging Solutions', sub:'Opakowania custom' },
            { label:'Healthy Future', sub:'Owoce liofilizowane' },
            { label:'Pack Pack', sub:'Opakowania PL' },
          ].map((b,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
              <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#374151', flexShrink:0 }}></div>
              <span style={{ color:'#9ca3af', fontSize:'12px' }}>{b.label}</span>
              <span style={{ color:'#4b5563', fontSize:'11px', marginLeft:'auto' }}>{b.sub}</span>
            </div>
          ))}
        </div>
      </div>
      {/* RIGHT PANEL */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px' }}>
        <div style={{ width:'100%', maxWidth:'360px' }}>
          <div style={{ marginBottom:'32px' }}>
            <h2 style={{ fontSize:'22px', fontWeight:'600', color:'#111', margin:'0 0 6px', letterSpacing:'-0.3px' }}>Zaloguj sie</h2>
            <p style={{ fontSize:'13px', color:'#9ca3af', margin:0 }}>Wpisz dane do swojego konta</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom:'14px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'500', marginBottom:'6px', color:'#374151' }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="twoj@email.com"
                style={{ width:'100%', padding:'11px 13px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', outline:'none', background:'white', color:'#111', ...F }}
                onFocus={e=>e.target.style.borderColor='#111'} onBlur={e=>e.target.style.borderColor='#e8e8e6'} />
            </div>
            <div style={{ marginBottom:'22px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'500', marginBottom:'6px', color:'#374151' }}>Haslo</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="••••••••"
                style={{ width:'100%', padding:'11px 13px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', outline:'none', background:'white', color:'#111', ...F }}
                onFocus={e=>e.target.style.borderColor='#111'} onBlur={e=>e.target.style.borderColor='#e8e8e6'} />
            </div>
            {error && (
              <div style={{ padding:'10px 13px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', fontSize:'13px', color:'#dc2626', marginBottom:'16px' }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'12px', background:loading?'#6b7280':'#111', color:'white', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor:loading?'not-allowed':'pointer', ...F }}>
              {loading ? 'Logowanie...' : 'Zaloguj sie →'}
            </button>
          </form>
          <p style={{ textAlign:'center', marginTop:'28px', fontSize:'11px', color:'#d1d5db' }}>TaskFlow · Jamo Solutions · 2026</p>
        </div>
      </div>
    </div>
  )
}
