import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function makeIcon(rank, isActive) {
  return L.divIcon({
    className: '',
    html: `<div class="map-pin${isActive ? ' map-pin-active' : ''}">${rank}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  })
}

function PanTo({ activeId, homes }) {
  const map = useMap()
  useEffect(() => {
    const active = homes.find(h => h.id === activeId)
    if (active?.lat && active?.lng) {
      map.panTo([active.lat, active.lng], { animate: true, duration: 0.5 })
    }
  }, [activeId])
  return null
}

export default function HomeMap({ homes, activeId, onHomeClick }) {
  const mappable = homes.filter(h => h.lat && h.lng)
  if (!mappable.length) return null

  const center = [
    mappable.reduce((s, h) => s + h.lat, 0) / mappable.length,
    mappable.reduce((s, h) => s + h.lng, 0) / mappable.length,
  ]

  return (
    <MapContainer
      center={center}
      zoom={9}
      className="home-map"
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <PanTo activeId={activeId} homes={mappable} />
      {mappable.map((home, i) => (
        <Marker
          key={home.id}
          position={[home.lat, home.lng]}
          icon={makeIcon(i + 1, home.id === activeId)}
          eventHandlers={{ click: () => onHomeClick?.(home.id) }}
        >
          <Popup className="map-popup">
            <div className="map-tooltip">
              <div className="map-tooltip-rank">#{i + 1}</div>
              <div className="map-tooltip-addr">{home.address}</div>
              {home.price && <div className="map-tooltip-price">${home.price.toLocaleString()}</div>}
              <div className="map-tooltip-stats">
                {[home.beds && `${home.beds} bd`, home.baths && `${home.baths} ba`, home.sqft && `${home.sqft.toLocaleString()} sqft`].filter(Boolean).join(' · ')}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
