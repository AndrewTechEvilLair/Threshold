import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">THRESHOLD</div>
        <div className="header-right">
          <span className="user-email">{user?.email}</span>
          <button className="btn-signout" onClick={handleSignOut}>Sign out</button>
        </div>
      </header>
      <div className="view-bar">
        <div className="view-tab active">My List</div>
        <div className="view-tab">Partner</div>
        <div className="view-tab">Combined</div>
        <div className="view-tab">Analytics</div>
      </div>
      <div className="sub-bar">
        <span className="sub-count"><strong>0 homes</strong> · add your first listing</span>
        <button className="btn-add">+ Add Listing</button>
      </div>
      <div className="card-list">
        <div className="empty-state">
          <p>No homes yet. Paste a listing URL to get started.</p>
        </div>
      </div>
    </div>
  )
}
