import { useState } from 'react'
import { supabase } from './supabaseClient.js'

export default function AuthPage() {
    const [tab, setTab]           = useState('signin')
    const [email, setEmail]       = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading]   = useState(false)
    const [error, setError]       = useState(null)
    const [success, setSuccess]   = useState(null)

    const font = "'IBM Plex Mono', 'SF Mono', 'Fira Code', monospace"

    const inputStyle = {
        width: '100%', padding: '11px 14px', background: '#12121a',
        border: '1px solid #252530', borderRadius: '8px', color: '#e2e8f0',
        fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: font
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        setSuccess(null)
        setLoading(true)

        if (tab === 'signup') {
            const { error } = await supabase.auth.signUp({ email, password })
            if (error) {
                setError(error.message)
            } else {
                setSuccess('Account created! Check your email to confirm, then sign in.')
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) setError(error.message)
            // On success, onAuthStateChange in main.jsx fires → renders <App>
        }
        setLoading(false)
    }

    const switchTab = (t) => {
        setTab(t)
        setError(null)
        setSuccess(null)
    }

    return (
        <div style={{
            minHeight: '100vh', background: '#0a0a10', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontFamily: font, color: '#e2e8f0'
        }}>
            <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <div style={{
                width: '100%', maxWidth: '400px', padding: '32px',
                background: '#13131d', border: '1px solid #1e1e2a',
                borderRadius: '16px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)'
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
                        <span style={{ color: '#3b82f6' }}>▸</span> OUTREACH CRM
                    </div>
                    <div style={{ fontSize: '11px', color: '#475569' }}>cold outreach pipeline manager</div>
                </div>

                {/* Tab toggle */}
                <div style={{
                    display: 'flex', background: '#0a0a10', borderRadius: '8px',
                    padding: '3px', marginBottom: '24px', border: '1px solid #1e1e2a'
                }}>
                    {[['signin', 'Sign In'], ['signup', 'Sign Up']].map(([t, label]) => (
                        <button key={t} onClick={() => switchTab(t)} style={{
                            flex: 1, padding: '8px', border: 'none', borderRadius: '6px',
                            cursor: 'pointer', fontFamily: font, fontSize: '12px',
                            fontWeight: tab === t ? 600 : 400,
                            background: tab === t ? '#1e293b' : 'transparent',
                            color: tab === t ? '#f8fafc' : '#64748b',
                            transition: 'all 0.15s'
                        }}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '5px', display: 'block' }}>Email</label>
                        <input
                            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com" required style={inputStyle}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '5px', display: 'block' }}>Password</label>
                        <input
                            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                            placeholder={tab === 'signup' ? 'min 6 characters' : '••••••••'} required style={inputStyle}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '10px 14px', background: '#450a0a',
                            border: '1px solid #ef444433', borderRadius: '8px',
                            fontSize: '12px', color: '#fca5a5', lineHeight: 1.5
                        }}>
                            {error}
                        </div>
                    )}
                    {success && (
                        <div style={{
                            padding: '10px 14px', background: '#022c22',
                            border: '1px solid #10b98133', borderRadius: '8px',
                            fontSize: '12px', color: '#6ee7b7', lineHeight: 1.5
                        }}>
                            {success}
                        </div>
                    )}

                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '12px',
                        background: loading ? '#1e293b' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        color: loading ? '#64748b' : '#fff', border: 'none', borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600,
                        fontSize: '13px', fontFamily: font, boxShadow: loading ? 'none' : '0 2px 12px #3b82f633',
                        transition: 'all 0.15s', marginTop: '4px'
                    }}>
                        {loading ? 'loading...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    )
}
