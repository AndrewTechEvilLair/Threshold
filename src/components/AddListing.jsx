import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function AddListing({ listId, onAdded }) {
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Call the Cloudflare Worker to parse the listing
      const workerUrl = import.meta.env.VITE_WORKER_URL
      const res = await fetch(`${workerUrl}?url=${encodeURIComponent(url)}`)
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      // Save to Supabase
      const { error: dbError } = await supabase
        .from('homes')
        .insert({
          list_id: listId,
          added_by: user.id,
          url: data.url,
          address: data.address || url,
          city: data.city,
          state: data.state,
          zip: data.zip,
          price: data.price,
          beds: data.beds,
          baths: data.baths,
          sqft: data.sqft,
          year_built: data.year_built,
          taxes: data.taxes,
          photo_url: data.photo_url,
          source_site: data.source_site,
        })

      if (dbError) throw new Error(dbError.message)

      setUrl('')
      onAdded()
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  return (
    <div className="add-listing-bar">
      <form onSubmit={handleSubmit} className="add-listing-form">
        <input
          type="url"
          placeholder="Paste a Zillow, Redfin, Realtor, Homes.com or Trulia URL..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          className="listing-url-input"
        />
        <button type="submit" className="btn-add-submit" disabled={loading || !url}>
          {loading ? 'Fetching...' : 'Add'}
        </button>
      </form>
      {error && <p className="add-error">{error}</p>}
    </div>
  )
}
