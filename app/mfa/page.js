'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function MFASetup() {
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [factorId, setFactorId] = useState('')
  const router = useRouter()

  const F = { fontFamily: "'DM Sans', sans-serif" }

  useEffect(() => {
    setupMFA()
  }, [])

  async function setupMFA() {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'TaskFlow Authenticator'
      })
      if (error) throw error
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
    } catch (err) {
      setError('Blad konfiguracji 2FA: ' + err.message)
    }
    setLoading(false)
  }

  async function verifyCode() {
    if (code.length !== 6) return
    setVerifying(true)
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
    }
    setVerifying(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f5f3', ...F }}>
      <div style={{ width:'100%', maxWidth:'440px', background:'#fff', borderRadius:'16px', border:'1px solid #e8e8e6', padding:'40px', boxShadow:'0 4px 24px rgba(0,0,0,0.06)' }}>
        
        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'32px' }}>
          <div style={{ width:'32px', height:'32px', background:'#111', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:'13px', height:'13px', border:'2.5px solid white', borderRadius:'3px' }}></div>
          </div>
          <span style={{ fontSize:'16px', fontWeight:'600', color:'#111' }}>TaskFlow</span>
        </div>

        <h2 style={{ fontSize:'20px', fontWeight:'600', color:'#111', margin:'0 0 8px' }}>Skonfiguruj weryfikację 2FA</h2>
        <p style={{ fontSize:'13px', color:'#6b7280', margin:'0 0 28px', lineHeight:'1.6' }}>
          Twoje konto wymaga weryfikacji dwuetapowej. Zeskanuj kod QR aplikacją Google Authenticator lub Authy.
        </p>

        {loading && (
          <div style={{ textAlign:'center', padding:'40px', color:'#9ca3af' }}>Generowanie kodu QR...</div>
        )}

        {!loading && qrCode && (
          <>
            {/* QR Code */}
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:'24px' }}>
              <div style={{ padding:'16px', background:'#fff', border:'2px solid #e8e8e6', borderRadius:'12px', marginBottom:'16px' }}>
                <img src={qrCode} alt="QR Code 2FA" style={{ width:'180px', height:'180px', display:'block' }} />
              </div>
              <p style={{ fontSize:'12px', color:'#9ca3af', textAlign:'center', margin:'0 0 8px' }}>
                Nie możesz zeskanować? Wpisz ręcznie:
              </p>
              <code style={{ fontSize:'11px', background:'#f4f4f3', padding:'6px 12px', borderRadius:'6px', color:'#374151', letterSpacing:'0.1em', wordBreak:'break-all', textAlign:'center' }}>
                {secret}
              </code>
            </div>

            {/* Steps */}
            <div style={{ background:'#f9f9f8', border:'1px solid #f0f0ee', borderRadius:'10px', padding:'16px', marginBottom:'24px' }}>
              <div style={{ fontSize:'12px', color:'#374151', lineHeight:'1.8' }}>
                <div>1. Pobierz <strong>Google Authenticator</strong> lub <strong>Authy</strong></div>
                <div>2. Kliknij "+" → "Skanuj kod QR"</div>
                <div>3. Zeskanuj kod powyżej</div>
                <div>4. Wpisz 6-cyfrowy kod poniżej</div>
              </div>
            </div>

            {/* Code input */}
            <div style={{ marginBottom:'16px' }}>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'500', marginBottom:'8px', color:'#374151' }}>
                Kod weryfikacyjny (6 cyfr)
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={e => e.key === 'Enter' && verifyCode()}
                placeholder="000000"
                maxLength={6}
                style={{ width:'100%', padding:'12px 14px', border:'1px solid #e8e8e6', borderRadius:'8px', fontSize:'20px', outline:'none', textAlign:'center', letterSpacing:'0.3em', fontFamily:"'DM Mono', monospace", color:'#111' }}
                onFocus={e => e.target.style.borderColor='#111'}
                onBlur={e => e.target.style.borderColor='#e8e8e6'}
                autoFocus
              />
            </div>

            {error && (
              <div style={{ padding:'10px 13px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', fontSize:'13px', color:'#dc2626', marginBottom:'16px' }}>
                {error}
              </div>
            )}

            <button onClick={verifyCode} disabled={verifying || code.length !== 6}
              style={{ width:'100%', padding:'12px', background: verifying || code.length !== 6 ? '#9ca3af' : '#111', color:'white', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'500', cursor: verifying || code.length !== 6 ? 'not-allowed' : 'pointer', ...F }}>
              {verifying ? 'Weryfikowanie...' : 'Aktywuj 2FA →'}
            </button>
          </>
        )}

        {error && !qrCode && (
          <div style={{ padding:'10px 13px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', fontSize:'13px', color:'#dc2626' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
