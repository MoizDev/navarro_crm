import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './supabaseClient.js'
import App from '../app.jsx'
import AuthPage from './AuthPage.jsx'

function AuthWrapper() {
    const [user, setUser]       = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check for existing session immediately
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            setLoading(false)
        })

        // Keep user state in sync with auth events (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null)
            }
        )

        return () => subscription.unsubscribe()
    }, [])

    const font = "'IBM Plex Mono', 'SF Mono', 'Fira Code', monospace"

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh', background: '#0a0a10', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                color: '#3b82f6', fontFamily: font, fontSize: '13px'
            }}>
                loading...
            </div>
        )
    }

    return user ? <App user={user} /> : <AuthPage />
}

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <AuthWrapper />
    </StrictMode>
)
