import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function InviteModal({ listId, onClose }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const handleInvite = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Create invite record in DB
      const token = crypto.randomUUID()
const { error: dbError } = await supabase
        .from('invites')
        .insert({
          list_id: listId,
          email: email.toLowerCase().trim(),
          token,
          role: 'collaborator',
          invited_by: (await supabase.auth.getUser()).data.user.id,
        })

      if (dbError) throw new Error(dbError.message)

      // Build the invite URL
      const inviteUrl = window.location.origin + '?invite=' + token

      // Send magic link with invite URL as redirect
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          emailRedirectTo: inviteUrl,
        }
      })

      if (authError) throw new Error(authError.message)

      setSent(true)
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Invite Partner</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="invite-body">
          {sent ? (
            <div className="invite-sent">
              <div className="invite-sent-icon">✉️</div>
              <h3>Invite sent!</h3>
              <p>We sent a link to <strong>{email}</strong>. When they click it they'll land directly in your list.</p>
              <button className="btn-magic" onClick={onClose}>Done</button>
            </div>
          ) : (
            <>
              <p className="invite-desc">Enter your partner's email. They'll get a link that drops them straight into your shared list.</p>
              <form onSubmit={handleInvite} className="invite-form">
                <input
                  type="email"
                  placeholder="partner@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="email-input"
                />
                <button
                  type="submit"
                  className="btn-magic"
                  disabled={loading || !email}
                >
                  {loading ? 'Sending...' : 'Send Invite'}
                </button>
              </form>
              {error && <p className="auth-error">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}