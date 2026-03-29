import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ShareView({ listId }) {
  const [homes, setHomes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const { data: homesData, error: homesError } = await supabase
          .from('homes')
          .select('*')
          .eq('list_id', listId)
          .order('created_at', { ascending: true })

        if (homesError) throw new Error(homesError.message)

        const { data: rankData } = await supabase
          .from('rankings')
          .select('home_id, position, user_id')
          .in('home_id', (homesData || []).map(h => h.id))

        const { data: ratingData } = await supabase
          .from('ratings')
          .select('home_id, intensity, user_id')
          .in('home_id', (homesData || []).map(h => h.id))

        const { data: notesData } = await supabase
          .from('notes')
          .select('home_id, body, user_id')
          .in('home_id', (homesData || []).map(h => h.id))

        // Group by home, average across users
        const n = (homesData || []).length
        const scored = (homesData || []).map(home => {
          const ranks = rankData?.filter(r => r.home_id === home.id) || []
          const ratings_ = ratingData?.filter(r => r.home_id === home.id) || []
          const notes_ = notesData?.filter(r => r.home_id === home.id) || []

          const avgRank = ranks.length
            ? ranks.reduce((s, r) => s + r.position, 0) / ranks.length
            : n
          const avgIntensity = ratings_.length
            ? ratings_.reduce((s, r) => s + r.intensity, 0) / ratings_.length
            : 50

          const rankScore = ((n + 1 - avgRank) / n) * 100
          const intensityScore = (avgIntensity - 50) * 2
          const score = Math.round((rankScore * 0.7) + (intensityScore * 0.3))

          return { ...home, score, avgIntensity: Math.round(avgIntensity), notes: notes_ }
        }).sort((a, b) => b.score - a.score)

        setHomes(scored)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [listId])

  if (loading) return <div className="loading-screen">Loading...</div>
  if (error) return <div className="loading-screen">Unable to load this list.</div>

  return (
    <div className="share-view">
      <header className="share-header">
        <div className="logo">THRESHOLD</div>
        <div className="share-badge">Shared List · {homes.length} homes</div>
      </header>

      <div className="share-list">
        {homes.map((home, i) => {
          const mapTileUrl = home.lat && home.lng
            ? `https://staticmap.openstreetmap.de/staticmap.php?center=${home.lat},${home.lng}&zoom=15&size=300x200&markers=${home.lat},${home.lng},red`
            : null
          const photoSrc = home.photo_url || mapTileUrl

          return (
            <div key={home.id} className="share-card">
              <div className="share-card-rank">#{i + 1}</div>

              <div className="share-card-photo">
                {photoSrc
                  ? <img src={photoSrc} alt={home.address} />
                  : <div className="share-card-photo-placeholder">{(home.city || '?')[0]}</div>
                }
              </div>

              <div className="share-card-info">
                <div className="share-card-address">{home.address}</div>
                <div className="share-card-location">{[home.city, home.state, home.zip].filter(Boolean).join(', ')}</div>
                {home.price && <div className="share-card-price">${home.price.toLocaleString()}</div>}

                <div className="share-card-stats">
                  {home.beds  && <span>{home.beds} bd</span>}
                  {home.baths && <span>{home.baths} ba</span>}
                  {home.sqft  && <span>{home.sqft.toLocaleString()} sqft</span>}
                  {home.acres && <span>{home.acres} acres</span>}
                  {home.year_built && <span>Built {home.year_built}</span>}
                </div>

                {home.notes.length > 0 && (
                  <div className="share-card-notes">
                    {home.notes.filter(n => n.body).map((n, ni) => (
                      <div key={ni} className="share-card-note">"{n.body}"</div>
                    ))}
                  </div>
                )}

                {home.url && (
                  <a href={home.url} target="_blank" rel="noreferrer" className="share-card-link">
                    View listing →
                  </a>
                )}
              </div>

              <div className="share-card-score">
                <div className="share-score-val">{Math.max(0, home.score)}</div>
                <div className="share-score-label">score</div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="share-footer">
        Shared via <strong>Threshold</strong>
      </div>
    </div>
  )
}
