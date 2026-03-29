import { useEffect, useRef } from 'react'
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

export default function HomeMap({ homes, activeId, onHomeClick }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef({})

  // Init map once
  useEffect(() => {
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map)

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.control.attribution({ position: 'bottomleft', prefix: '© OpenStreetMap' }).addTo(map)

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Rebuild markers when homes list changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    const mappable = homes.filter(h => h.lat && h.lng)
    if (!mappable.length) return

    mappable.forEach((home, i) => {
      const marker = L.marker([home.lat, home.lng], {
        icon: makeIcon(i + 1, home.id === activeId),
      }).addTo(map)
      marker.on('click', () => onHomeClick?.(home.id))
      markersRef.current[home.id] = marker
    })

    const bounds = L.latLngBounds(mappable.map(h => [h.lat, h.lng]))
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
  }, [homes])

  // Update pin styles + pan when activeId changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    homes.forEach((home, i) => {
      const marker = markersRef.current[home.id]
      if (marker) marker.setIcon(makeIcon(i + 1, home.id === activeId))
    })

    const active = homes.find(h => h.id === activeId)
    if (active?.lat && active?.lng) {
      map.panTo([active.lat, active.lng], { animate: true, duration: 0.6 })
    }
  }, [activeId])

  return <div ref={containerRef} className="home-map" />
}
