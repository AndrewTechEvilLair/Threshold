import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function makeIcon(rank, isActive, theme) {
  const light = theme === 'light'
  const bg = isActive ? (light ? '#c0392b' : '#e8442a') : (light ? '#3a3a4a' : 'rgba(255,255,255,0.15)')
  const border = isActive ? (light ? '#c0392b' : '#e8442a') : (light ? '#555' : 'rgba(255,255,255,0.3)')
  const color = light ? '#fff' : (isActive ? '#fff' : '#ccc')
  const glow = isActive ? (light ? '0 0 0 4px rgba(192,57,43,0.25)' : '0 0 0 4px rgba(232,68,42,0.35)') : 'none'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;border-radius:50%;
      background:${bg};border:2px solid ${border};
      color:${color};font-family:Syne,sans-serif;font-size:11px;font-weight:800;
      display:flex;align-items:center;justify-content:center;
      box-shadow:${glow};
      transition:all 0.2s;
    ">${rank}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  })
}

function PanTo({ activeId, homes }) {
  const map = useMap()
  useEffect(() => {
    const active = homes.find(h => h.id === activeId)
    if (active?.lat && active?.lng) {
      map.panTo([active.lat, active.lng], { animate: true, duration: 0.4 })
    }
  }, [activeId])
  return null
}

function formatPrice(p) {
  return p ? '$' + p.toLocaleString() : 'Price N/A'
}

function statusColor(s) {
  if (!s) return 'var(--text-muted)'
  const sl = s.toLowerCase()
  if (sl === 'active') return '#1d9e75'
  if (sl === 'pending' || sl === 'under contract') return '#d4a017'
  if (sl === 'sold') return 'var(--coral)'
  return 'var(--text-muted)'
}

const TILES = {
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
}

function TileLayerSwitcher({ theme }) {
  return <TileLayer key={theme} url={TILES[theme]} />
}

export default function HomeMap({ homes, ratings = {}, partnerRatings = {}, onHomeClick }) {
  const mappable = homes.filter(h => h.lat && h.lng)
  const [selectedId, setSelectedId] = useState(null)
  const [mapTheme, setMapTheme] = useState('dark')

  const selectedHome = mappable.find(h => h.id === selectedId)
  const selectedIndex = mappable.findIndex(h => h.id === selectedId)
  const selectedRank = selectedIndex + 1

  function selectHome(id) {
    setSelectedId(id)
    onHomeClick?.(id)
  }

  function navigate(dir) {
    const next = mappable[selectedIndex + dir]
    if (next) selectHome(next.id)
  }

  if (!mappable.length) return (
    <div className="map-tab-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
      No homes with location data yet.
    </div>
  )

  const center = [
    mappable.reduce((s, h) => s + h.lat, 0) / mappable.length,
    mappable.reduce((s, h) => s + h.lng, 0) / mappable.length,
  ]

  const myIntensity = selectedHome ? (ratings[selectedHome.id] ?? 50) : 0
  const partnerIntensity = selectedHome ? (partnerRatings[selectedHome.id] ?? 50) : 0
  const isLight = mapTheme === 'light'

  return (
    <div className={'map-tab-wrap map-theme-' + mapTheme} style={{ display: 'flex', position: 'relative' }}>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        <MapContainer
          center={center}
          zoom={9}
          className="home-map"
          zoomControl={true}
          attributionControl={false}
        >
          <TileLayerSwitcher theme={mapTheme} />
          <PanTo activeId={selectedId} homes={mappable} />
          {mappable.map((home, i) => (
            <Marker
              key={home.id + '-' + mapTheme}
              position={[home.lat, home.lng]}
              icon={makeIcon(i + 1, home.id === selectedId, mapTheme)}
              eventHandlers={{ click: () => selectHome(home.id) }}
            />
          ))}
        </MapContainer>

        {/* Theme toggle */}
        <button
          className="map-theme-toggle"
          onClick={() => setMapTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={isLight ? 'Switch to dark map' : 'Switch to light map'}
        >
          {isLight ? '🌙' : '☀️'}
        </button>
      </div>

      {/* Side panel */}
      <div className={'map-side-panel' + (selectedHome ? ' open' : '')}>
        {!selectedHome ? (
          <div className="map-side-empty">
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>📍</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
              Tap a pin<br/>to view details
            </div>
          </div>
        ) : (
          <>
            {/* Nav */}
            <div className="map-side-nav">
              <button className="map-side-nav-btn" onClick={() => navigate(-1)} disabled={selectedIndex === 0}>← Prev</button>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedRank} of {mappable.length}</span>
              <button className="map-side-nav-btn" onClick={() => navigate(1)} disabled={selectedIndex === mappable.length - 1}>Next →</button>
            </div>

            {/* Photo */}
            {selectedHome.photo_url && (
              <img src={selectedHome.photo_url} alt={selectedHome.address} className="map-side-photo" />
            )}

            {/* Header */}
            <div className="map-side-header">
              <div className="map-side-rank">#{selectedRank}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="map-side-address">{selectedHome.address}</div>
                <div className="map-side-city">{[selectedHome.city, selectedHome.state, selectedHome.zip].filter(Boolean).join(', ')}</div>
              </div>
            </div>

            <div className="map-side-price-row">
              {selectedHome.status && (
                <span className="map-side-status" style={{ color: statusColor(selectedHome.status) }}>{selectedHome.status}</span>
              )}
              <div className="map-side-price">{formatPrice(selectedHome.price)}</div>
            </div>

            {/* Stats */}
            <div className="map-side-stats">
              {selectedHome.beds  && <div className="map-side-stat"><span className="map-side-stat-val">{selectedHome.beds}</span><span className="map-side-stat-label">Beds</span></div>}
              {selectedHome.baths && <div className="map-side-stat"><span className="map-side-stat-val">{selectedHome.baths}</span><span className="map-side-stat-label">Baths</span></div>}
              {selectedHome.sqft  && <div className="map-side-stat"><span className="map-side-stat-val">{selectedHome.sqft.toLocaleString()}</span><span className="map-side-stat-label">Sqft</span></div>}
              {selectedHome.acres && <div className="map-side-stat"><span className="map-side-stat-val">{selectedHome.acres}</span><span className="map-side-stat-label">Acres</span></div>}
              {selectedHome.year_built && <div className="map-side-stat"><span className="map-side-stat-val">{selectedHome.year_built}</span><span className="map-side-stat-label">Built</span></div>}
            </div>

            {/* Intensity */}
            <div className="map-side-intensity">
              <div className="map-side-intensity-row">
                <span className="map-side-intensity-label">You</span>
                <div className="map-side-bar-track"><div className="map-side-bar-fill" style={{ width: myIntensity + '%' }} /></div>
                <span className="map-side-intensity-pct">{myIntensity}%</span>
              </div>
              <div className="map-side-intensity-row">
                <span className="map-side-intensity-label">Partner</span>
                <div className="map-side-bar-track"><div className="map-side-bar-fill partner" style={{ width: partnerIntensity + '%' }} /></div>
                <span className="map-side-intensity-pct">{partnerIntensity}%</span>
              </div>
            </div>

            {/* Actions */}
            <div className="map-side-actions">
              {selectedHome.url && (
                <a href={selectedHome.url} target="_blank" rel="noreferrer" className="map-drawer-btn">
                  {'View on ' + (() => { try { return new URL(selectedHome.url).hostname.replace('www.', '').split('.')[0] } catch { return 'listing' } })()} →
                </a>
              )}
              <button className="map-drawer-btn" onClick={() => setSelectedId(null)}>✕ Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
