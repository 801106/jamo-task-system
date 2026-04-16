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
    if (error) { setError('Nieprawidlowy email lub haslo') }
    else { router.push('/dashboard') }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#fafaf9',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '360px', padding: '0 24px' }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', background: '#111', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid white', borderRadius: '3px' }}></div>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#111', margin: '0 0 4px', letterSpacing: '-0.3px' }}>TaskFlow</h1>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Jamo Operations System</p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '6px', color: '#374151', letterSpacing: '0.01em' }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="twoj@email.com"
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid #e8e8e6', borderRadius: '8px',
                fontSize: '14px', outline: 'none', background: 'white',
                color: '#111', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#111'}
              onBlur={e => e.target.style.borderColor = '#e8e8e6'}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', marginBottom: '6px', color: '#374151', letterSpacing: '0.01em' }}>Haslo</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 12px',
                border: '1px solid #e8e8e6', borderRadius: '8px',
                fontSize: '14px', outline: 'none', background: 'white',
                color: '#111', transition: 'border-color 0.15s',
              }}
              onFocus={e => e.target.style.borderColor = '#111'}
              onBlur={e => e.target.style.borderColor = '#e8e8e6'}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '11px',
              background: loading ? '#6b7280' : '#111', color: 'white',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.1px', transition: 'background 0.15s',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {loading ? 'Logowanie...' : 'Zaloguj sie'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#d1d5db' }}>
          TaskFlow v11 · Jamo Solutions
        </p>
      </div>
    </div>
  )
}
