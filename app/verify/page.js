'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function MFAVerify() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [factorId, setFactorId] = useState('')
  const router = useRouter()

  const F = { fontFamily: "'DM Sans', sans-serif" }

  useEffect(() => {
    getFactorId()
  }, [])

  async function getFactorId() {
    const { data } = await supabase.auth.mfa.listFactors()
    const totp = data?.totp?.[0]
    if (!totp) {
      router.push('/mfa')
      return
    }
    setFactorId(totp.id)
  }

  async function verifyCode() {
    if (code.length !== 6 || !factorId) return
    setLoading(true)
    setError('')
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      })
      if (verifyError) throw verifyError

      router.push('/dashboard')
    } catch (err) {
      setError('Nieprawidlowy kod. Sprawdz aplikacje i sprobuj ponownie.')
      setCode('')
    }
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f5f3', ...F }}>
      <div style={{ width:'100%', maxWidth:'380px', background:'#fff', borderRadius:'16px', border:'1px solid #e8e8e6', padding:'40px', boxShadow:'0 4px 24px rgba(0,0,0,0.06)' }}>

        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'32px' }}>
          <div style={{ width:'32px', height:'32px', background:'#111', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:'13px', height:'13px', border:'2.5px solid white', borderRadius:'3px' }}></div>
          </div>
          <span style={{ fontSize:'16px', fontWeight:'600', color:'#111' }}>TaskFlow</span>
        </div>

        <div style={{ textAlign:'center', marginBottom:'32px' }}>
          <div style={{ fontSize:'40px', marginBottom:'16px' }}>🔐</div>
          <h2 style={{ fontSize:'20px', fontWeight:'600', color:'#111', margin:'0 0 8px' }}>Weryfikacja dwuetapowa</h2>
          <p style={{ fontSize:'13px', color:'#6b7280', margin:0, lineHeight:'1.6' }}>
            Otwórz Google Authenticator i wpisz 6-cyfrowy kod dla TaskFlow
          </p>
        </div>

        <div style={{ marginBottom:'16px' }}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && verifyCode()}
            placeholder="000000"
            maxLength={6}
            style={{ width:'100%', padding:'16px 14px', border:'2px solid #e8e8e6', borderRadius:'10px', fontSize:'28px', outline:'none', textAlign:'center', letterSpacing:'0.4em', fontFamily:"'DM Mono', monospace", color:'#111' }}
            onFocus={e => e.target.style.borderColor='#111'}
            onBlur={e => e.target.style.borderColor='#e8e8e6'}
            autoFocus
          />
        </div>

        {error && (
          <div style={{ padding:'10px 13px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', fontSize:'13px', color:'#dc2626', marginBottom:'16px', textAlign:'center' }}>
            {error}
          </div>
        )}

        <button onClick={verifyCode} disabled={loading || code.length !== 6}
          style={{ width:'100%', padding:'13px', background: loading || code.length !== 6 ? '#9ca3af' : '#111', color:'white', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor: loading || code.length !== 6 ? 'not-allowed' : 'pointer', marginBottom:'12px', ...F }}>
          {loading ? 'Weryfikowanie...' : 'Zweryfikuj →'}
        </button>

        <button onClick={handleLogout}
          style={{ width:'100%', padding:'11px', background:'transparent', color:'#9ca3af', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'13px', cursor:'pointer', ...F }}>
          Wróć do logowania
        </button>
      </div>
    </div>
  )
}
