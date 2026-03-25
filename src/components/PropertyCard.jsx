import { useState } from 'react'

export default function PropertyCard({ home, rank, intensity, onIntensityChange, onDelete, onNoteSave, isHighlighted, cardRef }) {
  const [note, setNote] = useState(home.user_note || '')
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

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

  const statLine = [
    home.beds ? home.beds + ' bd' : null,
    home.baths ? home.baths + ' ba' : null,
    home.sqft ? home.sqft.toLocaleString() + ' sqft' : null,
  ].filter(Boolean).join(' · ')

  return (
    <div
      className={'card' + (isHighlighted ? ' card-highlighted' : '')}
      ref={cardRef}
    >
      <div className="card-img">
        {home.photo_url
          ? <img src={home.photo_url} alt={home.address} />
          : <div className="card-img-placeholder" />
        }
        <div className="rank-badge">{'#' + rank}</div>
        <button className="delete-btn" onClick={() => onDelete(home.id)} title="Remove listing">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <div className="card-body">
        <div className="drag-handle">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="5" cy="4" r="1.5" fill="currentColor"/>
            <circle cx="11" cy="4" r="1.5" fill="currentColor"/>
            <circle cx="5" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="11" cy="8" r="1.5" fill="currentColor"/>
            <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="11" cy="12" r="1.5" fill="currentColor"/>
          </svg>
        </div>

        <div className="card-top">
          <div className="card-address-block">
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="card-address-link">
              {home.address}
            </a>
            <div className="card-meta-line">
              <span>{[home.city, home.state, home.zip].filter(Boolean).join(', ')}</span>
              {statLine ? <><span className="card-meta-dot">·</span><span>{statLine}</span></> : null}
              {home.year_built ? <><span className="card-meta-dot">·</span><span>{'Built ' + home.year_built}</span></> : null}
              {home.url ? <><span className="card-meta-dot">·</span><a href={home.url} target="_blank" rel="noreferrer">{'View on ' + (home.source_site || 'listing') + ' \u2192'}</a></> : null}
            </div>
          </div>
          <div className="card-price">{formatPrice(home.price)}</div>
        </div>

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