import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function makeIcon(rank, isActive) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin${isActive ? ' map-pin-active' : ''}">${rank}</div>`,
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
  const map = useMap()
  return <TileLayer key={theme} url={TILES[theme]} />
}

export default function HomeMap({ homes, ratings = {}, rankings = {}, partnerRatings = {}, onHomeClick }) {
  const mappable = homes.filter(h => h.lat && h.lng)
  const [selectedId, setSelectedId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mapTheme, setMapTheme] = useState('dark')
  const drawerRef = useRef(null)
  const startY = useRef(null)

  const selectedHome = mappable.find(h => h.id === selectedId)
  const selectedRank = mappable.findIndex(h => h.id === selectedId) + 1

  function selectHome(id) {
    setSelectedId(id)
    setDrawerOpen(false) // start collapsed, user taps to expand
    onHomeClick?.(id)
  }

  function handleDrawerTouchStart(e) {
    startY.current = e.touches[0].clientY
  }
  function handleDrawerTouchEnd(e) {
    const delta = startY.current - e.changedTouches[0].clientY
    if (delta > 40) setDrawerOpen(true)
    if (delta < -40) setDrawerOpen(false)
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

  return (
    <div className="map-tab-wrap" style={{ position: 'relative' }}>
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
            key={home.id}
            position={[home.lat, home.lng]}
            icon={makeIcon(i + 1, home.id === selectedId)}
            eventHandlers={{ click: () => selectHome(home.id) }}
          />
        ))}
      </MapContainer>

      {/* Theme toggle */}
      <button
        className="map-theme-toggle"
        onClick={() => setMapTheme(t => t === 'dark' ? 'light' : 'dark')}
        title={mapTheme === 'dark' ? 'Switch to light map' : 'Switch to dark map'}
      >
        {mapTheme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* Drawer */}
      {selectedHome && (
        <>
          {/* Scrim — only visible when expanded */}
          <div
            className={'map-drawer-scrim' + (drawerOpen ? ' visible' : '')}
            onClick={() => setDrawerOpen(false)}
          />

          <div
            className={'map-drawer' + (drawerOpen ? ' open' : '')}
            ref={drawerRef}
            onTouchStart={handleDrawerTouchStart}
            onTouchEnd={handleDrawerTouchEnd}
          >
            {/* Drag handle + collapsed peek */}
            <div className="map-drawer-peek" onClick={() => setDrawerOpen(o => !o)}>
              <div className="map-drawer-handle" />
              <div className="map-drawer-peek-row">
                <div className="map-drawer-peek-left">
                  <span className="map-drawer-rank">#{selectedRank}</span>
                  <div>
                    <div className="map-drawer-address">{selectedHome.address}</div>
                    <div className="map-drawer-city">{[selectedHome.city, selectedHome.state, selectedHome.zip].filter(Boolean).join(', ')}</div>
                  </div>
                </div>
                <div className="map-drawer-peek-right">
                  {selectedHome.status && (
                    <span className="map-drawer-status" style={{ color: statusColor(selectedHome.status) }}>{selectedHome.status}</span>
                  )}
                  <div className="map-drawer-price">{formatPrice(selectedHome.price)}</div>
                </div>
              </div>
            </div>

            {/* Expanded content */}
            <div className="map-drawer-body">
              {selectedHome.photo_url && (
                <img src={selectedHome.photo_url} alt={selectedHome.address} className="map-drawer-photo" />
              )}

              {/* Stats */}
              <div className="map-drawer-stats">
                {selectedHome.beds  && <div className="map-drawer-stat"><span className="map-drawer-stat-val">{selectedHome.beds}</span><span className="map-drawer-stat-label">Beds</span></div>}
                {selectedHome.baths && <div className="map-drawer-stat"><span className="map-drawer-stat-val">{selectedHome.baths}</span><span className="map-drawer-stat-label">Baths</span></div>}
                {selectedHome.sqft  && <div className="map-drawer-stat"><span className="map-drawer-stat-val">{selectedHome.sqft.toLocaleString()}</span><span className="map-drawer-stat-label">Sqft</span></div>}
                {selectedHome.acres && <div className="map-drawer-stat"><span className="map-drawer-stat-val">{selectedHome.acres}</span><span className="map-drawer-stat-label">Acres</span></div>}
                {selectedHome.year_built && <div className="map-drawer-stat"><span className="map-drawer-stat-val">{selectedHome.year_built}</span><span className="map-drawer-stat-label">Built</span></div>}
              </div>

              {/* Intensity bars */}
              <div className="map-drawer-intensity">
                <div className="map-drawer-intensity-row">
                  <span className="map-drawer-intensity-label">You</span>
                  <div className="map-drawer-bar-track">
                    <div className="map-drawer-bar-fill" style={{ width: myIntensity + '%' }} />
                  </div>
                  <span className="map-drawer-intensity-pct">{myIntensity}%</span>
                </div>
                <div className="map-drawer-intensity-row">
                  <span className="map-drawer-intensity-label">Partner</span>
                  <div className="map-drawer-bar-track">
                    <div className="map-drawer-bar-fill partner" style={{ width: partnerIntensity + '%' }} />
                  </div>
                  <span className="map-drawer-intensity-pct">{partnerIntensity}%</span>
                </div>
              </div>

              {/* Actions */}
              <div className="map-drawer-actions">
                {selectedHome.url && (
                  <a href={selectedHome.url} target="_blank" rel="noreferrer" className="map-drawer-btn">
                    {'View on ' + (() => { try { return new URL(selectedHome.url).hostname.replace('www.', '').split('.')[0] } catch { return 'listing' } })()} →
                  </a>
                )}
                <button className="map-drawer-btn" onClick={() => setDrawerOpen(false)}>
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
