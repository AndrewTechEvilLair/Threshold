import { useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ShareView from './pages/ShareView'
import { supabase } from './lib/supabase'

const shareId = new URLSearchParams(window.location.search).get('share')

function AppContent() {
  const { user, loading } = useAuth()

  if (shareId) return <ShareView listId={shareId} />

  // Save invite token immediately on page load, before auth wipes the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const inviteToken = params.get('invite')
    if (inviteToken) {
      sessionStorage.setItem('pendingInvite', inviteToken)
    }
  }, [])

  // After login, check for a pending invite and accept it
  useEffect(() => {
    if (!user || loading) return

    const token = sessionStorage.getItem('pendingInvite')
    if (token) {
      sessionStorage.removeItem('pendingInvite')
      acceptInvite(token, user)
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

    // Clean the URL and reload so Dashboard picks up the accepted invite
    sessionStorage.setItem('justAcceptedInvite', 'true')
    window.history.replaceState({}, '', window.location.pathname)
    window.location.reload()
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
