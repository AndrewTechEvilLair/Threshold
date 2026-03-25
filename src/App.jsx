import { useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import { supabase } from './lib/supabase'

function AppContent() {
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!user || loading) return

    const params = new URLSearchParams(window.location.search)
    const inviteToken = params.get('invite')

    if (inviteToken) {
      acceptInvite(inviteToken, user)
    }
  }, [user, loading])

  async function acceptInvite(token, user) {
    console.log('Accepting invite token:', token, 'for user:', user.id)

    const { data: invite, error } = await supabase
      .from('invites')
      .select('*')
      .eq('token', token)
      .single()

    console.log('Invite found:', invite, 'error:', error)

    if (!invite) return

    // Mark invite as accepted
    const { error: updateError } = await supabase
      .from('invites')
      .update({
        accepted_by: user.id,
        accepted_at: new Date().toISOString()
      })
      .eq('token', token)

    console.log('Update error:', updateError)

    // Clean the URL
    window.history.replaceState({}, '', window.location.pathname)
  }

  if (loading) return <div className="loading-screen">Loading...</div>
  if (!user) return <Login />
  return <Dashboard />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}