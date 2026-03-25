import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function InviteModal({ listId, onClose }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [inviteUrl, setInviteUrl] = useState(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)

    try {
      const { data: existing } = await supabase
        .from('invites')
        .select('token')
        .eq('list_id', listId)
        .limit(1)

      let token
      if (existing && existing.length > 0) {
        token = existing[0].token
      } else {
        token = crypto.randomUUID()
        const { error: dbError } = await supabase
          .from('invites')
          .insert({
            list_id: listId,
            token,
            role: 'collaborator',
            invited_by: user.id,
            email: 'pending',
          })
        if (dbError) throw new Error(dbError.message)
      }

      setInviteUrl(window.location.origin + '?invite=' + token)
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Invite Partner</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="invite-body">
          {!inviteUrl ? (
            <>
              <p className="invite-desc">
                Generate a link and send it however you like — text, email, carrier pigeon. They tap it, create an account, and land straight in your shared list.
              </p>
              <button
                className="btn-magic"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate Invite Link'}
              </button>
              {error && <p className="auth-error">{error}</p>}
            </>
          ) : (
            <div className="invite-link-box">
              <p className="invite-desc">Send this link to your partner:</p>
              <div className="invite-url-row">
                <div className="invite-url-display">{inviteUrl}</div>
                <button className="btn-copy" onClick={handleCopy}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <p className="invite-desc" style={{fontSize: '12px', marginTop: '4px'}}>
                They'll create an account and land directly in your list.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}