import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function PropertyCard({ home, rank, intensity, onIntensityChange, onDelete, onNoteSave, onPhotoUpdate, isHighlighted, cardRef, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [note, setNote] = useState(home.user_note || '')
  const [noteExpanded, setNoteExpanded] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [mapError, setMapError] = useState(false)
  const [pasteActive, setPasteActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const photoRef = useRef(null)
  const fileInputRef = useRef(null)
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

  const formatPrice = (p) => p ? '$' + p.toLocaleString() : 'Price N/A'

  const intensityLabel = (val) => {
    if (val < 25) return '😬 Hard Pass'
    if (val < 50) return '🤔 Maybe'
    if (val < 75) return '😊 Like It'
    return '😍 Packing Bags'
  }

  const [noteSaving, setNoteSaving] = useState(false)
  const [noteError, setNoteError] = useState(null)

  const handleNoteSave = async () => {
    setNoteSaving(true)
    setNoteError(null)
    try {
      await onNoteSave(home.id, note)
      setNoteSaved(true)
      setTimeout(() => {
        setNoteSaved(false)
        setNoteExpanded(false)
      }, 1500)
    } catch (err) {
      setNoteError('Failed to save — try again')
    } finally {
      setNoteSaving(false)
    }
  }

  // ── Photo handlers ──
  const handlePhotoClick = () => {
    if (isMobile) {
      fileInputRef.current?.click()
    } else {
      setPasteActive(true)
      photoRef.current?.focus()
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    e.target.value = ''
    setUploading(true)
    try {
      const ext = file.type.split('/')[1] || 'png'
      const fileName = `home-${home.id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('home-photos')
        .upload(fileName, file, { contentType: file.type, upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: urlData } = supabase.storage.from('home-photos').getPublicUrl(fileName)
      const { error: dbError } = await supabase.from('homes').update({ photo_url: urlData.publicUrl }).eq('id', home.id)
      if (dbError) throw new Error(dbError.message)
      setImgError(false)
      onPhotoUpdate(home.id, urlData.publicUrl)
    } catch (err) {
      console.error('Photo upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    let imageFile = null
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        imageFile = item.getAsFile()
        break
      }
    }

    if (!imageFile) return
    e.preventDefault()
    setPasteActive(false)
    setUploading(true)

    try {
      const ext = imageFile.type.split('/')[1] || 'png'
      const fileName = `home-${home.id}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('home-photos')
        .upload(fileName, imageFile, { contentType: imageFile.type, upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage
        .from('home-photos')
        .getPublicUrl(fileName)

      const publicUrl = urlData.publicUrl

      const { error: dbError } = await supabase
        .from('homes')
        .update({ photo_url: publicUrl })
        .eq('id', home.id)

      if (dbError) throw new Error(dbError.message)

      setImgError(false)
      onPhotoUpdate(home.id, publicUrl)
    } catch (err) {
      console.error('Photo upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(
    [home.address, home.city, home.state, home.zip].filter(Boolean).join(', ')
  )

  const iceCreamUrl = home.lat && home.lng
    ? `https://www.google.com/maps/search/ice+cream+shop/@${home.lat},${home.lng},15z`
    : 'https://www.google.com/maps/search/ice+cream+shop+near+' + encodeURIComponent(
        [home.address, home.city, home.state, home.zip].filter(Boolean).join(', ')
      )

  const statItems = [
    home.beds       ? { label: 'Beds',  val: home.beds }                  : null,
    home.baths      ? { label: 'Baths', val: home.baths }                 : null,
    home.sqft       ? { label: 'Sqft',  val: home.sqft.toLocaleString() } : null,
    home.acres      ? { label: 'Acres', val: home.acres }                 : null,
    home.year_built ? { label: 'Built', val: home.year_built }            : null,
  ].filter(Boolean)

  const mapTileUrl = home.lat && home.lng && !mapError
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${home.lat},${home.lng}&zoom=15&size=250x250&markers=${home.lat},${home.lng},red`
    : null

  const showPhoto = home.photo_url && !imgError

  const renderCardImage = () => {
    if (uploading) {
      return (
        <div className="card-photo-placeholder">
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>Uploading…</span>
        </div>
      )
    }

    if (pasteActive) {
      return (
        <div
          className="card-photo-placeholder card-photo-paste-active"
          style={{ cursor: 'default' }}
        >
          <span style={{ fontSize: '20px' }}>📋</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Press Ctrl+V</span>
        </div>
      )
    }

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

    const initials = home.address?.split(' ').slice(0, 2).map(w => w[0]).join('') || '?'
    return (
      <div className="card-photo-placeholder">
        <span className="card-photo-initials">{initials}</span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.5px' }}>
          {isMobile ? 'Tap to add photo' : 'Click to add photo'}
        </span>
      </div>
    )
  }

  return (
    <div
      className={'card' + (isHighlighted ? ' card-highlighted' : '')}
      ref={cardRef}
    >
      <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
      {/* ── TOP ROW: rank | photo | info | actions ── */}
      <div className="card-main">

        {/* Rank column */}
        <div className="card-rank-col">
          <span className="card-rank-num">{'#' + rank}</span>
          <span className="card-rank-label">rank</span>
        </div>

        {/* Photo / Map tile — click to activate paste zone */}
        <div
          className="card-photo"
          ref={photoRef}
          tabIndex={0}
          onClick={handlePhotoClick}
          onPaste={handlePaste}
          onBlur={() => setPasteActive(false)}
          onKeyDown={e => { if (e.key === 'Escape') setPasteActive(false) }}
          title={showPhoto ? 'Click to replace photo' : isMobile ? 'Tap to add photo' : 'Click then Ctrl+V to add photo'}
          style={{ cursor: uploading ? 'wait' : 'pointer', outline: pasteActive ? '2px solid var(--accent)' : 'none' }}
        >
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
          <div className="card-source-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {home.url && (
                <a href={home.url} target="_blank" rel="noreferrer" className="card-source-link">
                  {'View on ' + (home.source_site || 'listing') + ' →'}
                </a>
              )}
              <a href={iceCreamUrl} target="_blank" rel="noreferrer" className="card-source-link">
                🍦 Nearest Ice Cream
              </a>
              {home.mls_number && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>MLS# {home.mls_number}</span>
              )}
            </div>

          {/* Mobile up/down buttons */}
          <div className="card-move-bar">
            <button className="card-move-bar-btn" onClick={onMoveUp} disabled={isFirst}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3L2 11h12L8 3z" fill="currentColor"/>
              </svg>
              Up
            </button>
            <button className="card-move-bar-btn" onClick={onMoveDown} disabled={isLast}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 13L2 5h12L8 13z" fill="currentColor"/>
              </svg>
              Down
            </button>
          </div>

        </div>

        {/* Action column */}
        <div className="card-actions">
          <div className="drag-handle" title="Drag to reorder">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="4"  cy="3"  r="1.4" fill="currentColor"/>
              <circle cx="10" cy="3"  r="1.4" fill="currentColor"/>
              <circle cx="4"  cy="7"  r="1.4" fill="currentColor"/>
              <circle cx="10" cy="7"  r="1.4" fill="currentColor"/>
              <circle cx="4"  cy="11" r="1.4" fill="currentColor"/>
              <circle cx="10" cy="11" r="1.4" fill="currentColor"/>
            </svg>
          </div>
          <div className="move-btns">
            <button className="move-btn" onClick={onMoveUp} disabled={isFirst} title="Move up">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 2L1 7h8L5 2z" fill="currentColor"/>
              </svg>
            </button>
            <button className="move-btn" onClick={onMoveDown} disabled={isLast} title="Move down">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 8L1 3h8L5 8z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <button
            className="delete-btn"
            onClick={() => { if (window.confirm(`Remove "${home.address}"?`)) onDelete(home.id) }}
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
                onBlur={handleNoteSave}
                rows={3}
                autoFocus
              />
              {noteError && <div style={{ fontSize: '12px', color: 'var(--coral)', marginBottom: '4px' }}>{noteError}</div>}
              <div className="notes-footer">
                <button className="btn-cancel-note" onClick={() => setNoteExpanded(false)}>Cancel</button>
                <button className="btn-save-note" onClick={handleNoteSave} disabled={noteSaving}>
                  {noteSaved ? '✓ Saved' : noteSaving ? 'Saving…' : 'Save Note'}
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
