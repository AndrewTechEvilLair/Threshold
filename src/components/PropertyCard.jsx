import { useState } from 'react'

export default function PropertyCard({ home, rank, intensity, onIntensityChange, onDelete, onNoteSave, isHighlighted, cardRef }) {
  const [note, setNote] = useState(home.user_note || '')
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [mapError, setMapError] = useState(false)

  const formatPrice = (p) => p ? '$' + p.toLocaleString() : 'Price N/A'

  const intensityLabel = (val) => {
     if (val < 25) return '😬 Hard Pass'
    if (val < 50) return '🤔 Maybe'
    if (val < 75) return '😊 Like It'
    return '😍 Packing Bags'
   }

  const handleNoteSave = () => {
    onNoteSave(home.id, note)
    setNoteSaved(true)
    setTimeout(() => {
      setNoteSaved(false)
      setNoteExpanded(false)
    }, 1500)
  }

  const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(
    [home.address, home.city, home.state, home.zip].filter(Boolean).join(', ')
  )

  const statItems = [
    home.beds      ? { label: 'Beds',  val: home.beds }                  : null,
    home.baths     ? { label: 'Baths', val: home.baths }                 : null,
    home.sqft      ? { label: 'Sqft',  val: home.sqft.toLocaleString() } : null,
    home.acres     ? { label: 'Acres', val: home.acres }                 : null,
    home.year_built ? { label: 'Built', val: home.year_built }           : null,
  ].filter(Boolean)

  // Map tile — OSM static map centered on coordinates, 25% larger than card height
  const mapTileUrl = home.lat && home.lng && !mapError
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${home.lat},${home.lng}&zoom=15&size=250x250&markers=${home.lat},${home.lng},red`
    : null

  const showPhoto = home.photo_url && !imgError

  const renderCardImage = () => {
    if (showPhoto) {
      return (
        <img
          src={home.photo_url}
          alt={home.address}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )
    }
    if (mapTileUrl) {
      return (
        <img
          src={mapTileUrl}
          alt={'Map of ' + home.address}
          onError={() => setMapError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )
    }
    // Final fallback — styled placeholder
    const initials = home.address?.split(' ').slice(0, 2).map(w => w[0]).join('') || '?'
    return (
      <div className="card-photo-placeholder">
        <span className="card-photo-initials">{initials}</span>
      </div>
    )
  }

  return (
    <div
      className={'card' + (isHighlighted ? ' card-highlighted' : '')}
      ref={cardRef}
    >
      {/* ── TOP ROW: rank | photo | info | actions ── */}
      <div className="card-main">

        {/* Rank column */}
        <div className="card-rank-col">
          <span className="card-rank-num">{'#' + rank}</span>
          <span className="card-rank-label">rank</span>
        </div>

        {/* Photo / Map tile */}
        <div className="card-photo">
          {renderCardImage()}
        </div>

        {/* Info */}
        <div className="card-info">

          {/* Address + price */}
          <div className="card-top">
            <div className="card-address-block">
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="card-address-link">
                {home.address}
              </a>
              <div className="card-city">
                {[home.city, home.state, home.zip].filter(Boolean).join(', ')}
              </div>
            </div>
            <div className="card-price">{formatPrice(home.price)}</div>
          </div>

          {/* Stats */}
          {statItems.length > 0 && (
            <div className="card-stats">
              {statItems.map(({ label, val }) => (
                <div key={label} className="card-stat">
                  <span className="card-stat-val">{val}</span>
                  <span className="card-stat-label">{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Source link + MLS */}
          {(home.url || home.mls_number) && (
            <div className="card-source-row" style={{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
              {home.url && (
                <a href={home.url} target="_blank" rel="noreferrer" className="card-source-link">
                  {'View on ' + (home.source_site || 'listing') + ' →'}
                </a>
              )}
              {home.mls_number && (
                <span style={{fontSize:'11px',color:'var(--text-muted)'}}>MLS# {home.mls_number}</span>
              )}
            </div>
          )}

        </div>

        {/* Action column */}
        <div className="card-actions">
          <div className="drag-handle" title="Drag to reorder">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="4" cy="3"  r="1.4" fill="currentColor"/>
              <circle cx="10" cy="3" r="1.4" fill="currentColor"/>
              <circle cx="4" cy="7"  r="1.4" fill="currentColor"/>
              <circle cx="10" cy="7" r="1.4" fill="currentColor"/>
              <circle cx="4" cy="11" r="1.4" fill="currentColor"/>
              <circle cx="10" cy="11" r="1.4" fill="currentColor"/>
            </svg>
          </div>
          <button
            className="delete-btn"
            onClick={() => onDelete(home.id)}
            title="Remove listing"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

      </div>

      {/* ── BOTTOM: intensity + notes ── */}
      <div className="card-body">

        <div className="intensity-row" onDragStart={e => e.stopPropagation()}>
          <div className="intensity-label">{intensityLabel(intensity)}</div>
          <input
            type="range"
            min="0"
            max="100"
            value={intensity}
            onChange={e => onIntensityChange(Number(e.target.value))}
            className="intensity-slider"
          />
        </div>

        <div className="notes-row" onDragStart={e => e.stopPropagation()}>
          {noteExpanded ? (
            <>
              <textarea
                className="notes-input"
                placeholder="Add a note about this place..."
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="notes-footer">
                <button className="btn-cancel-note" onClick={() => setNoteExpanded(false)}>Cancel</button>
                <button className="btn-save-note" onClick={handleNoteSave}>
                  {noteSaved ? '✓ Saved' : 'Save Note'}
                </button>
              </div>
            </>
          ) : (
            <button className="btn-note-collapsed" onClick={() => setNoteExpanded(true)}>
              {note ? '📝 ' + note.slice(0, 60) + (note.length > 60 ? '…' : '') : '+ Add a note'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
