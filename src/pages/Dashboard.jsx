import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PropertyCard from '../components/PropertyCard'
import AddListing from '../components/AddListing'
import InviteModal from '../components/InviteModal'
const HomeMap = lazy(() => import('../components/HomeMap'))

export default function Dashboard() {
  const { user } = useAuth()
  const [listId, setListId] = useState(null)
  const [homes, setHomes] = useState([])
  const [rankings, setRankings] = useState({})
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [activeTab, setActiveTab] = useState('mine')
  const [highlightedId, setHighlightedId] = useState(null)
  const [partner, setPartner] = useState(null)
  const [partnerHomes, setPartnerHomes] = useState([])
  const [partnerRankings, setPartnerRankings] = useState({})
  const [partnerRatings, setPartnerRatings] = useState({})
  const dragItem = useRef(null)
  const dragOver = useRef(null)
  const cardRefs = useRef({})
  const [partnerNotesMap, setPartnerNotesMap] = useState({})
  const [stateFilter, setStateFilter] = useState([])
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [mapActiveId, setMapActiveId] = useState(null)
  const [areaHome, setAreaHome] = useState(null)

  const AREA_CATEGORIES = [
    { label: 'Coffee & Espresso', emoji: '☕', query: 'coffee espresso' },
    { label: 'Ice Cream',         emoji: '🍦', query: 'ice cream' },
    { label: 'Gas Stations',      emoji: '⛽', query: 'gas station' },
    { label: 'Grocery Stores',    emoji: '🛒', query: 'grocery store' },
    { label: 'Restaurants',       emoji: '🍽️', query: 'restaurants' },
    { label: 'Schools',           emoji: '🏫', query: 'school' },
    { label: 'Wholesale Clubs',   emoji: '🏬', query: 'wholesale club costco sams' },
    { label: 'Parks & Trails',    emoji: '🌳', query: 'parks trails' },
  ]

  function areaUrl(home, query) {
    if (home.lat && home.lng) return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${home.lat},${home.lng},13z`
    const addr = [home.address, home.city, home.state, home.zip].filter(Boolean).join(', ')
    return `https://www.google.com/maps/search/${encodeURIComponent(query + ' near ' + addr)}`
  }

  useEffect(() => {
    if (user?.id) initList()
  }, [user?.id])

  async function initList() {
    setLoading(true)
    console.log('=== initList start, user.id:', user.id)

    // Clear the just-accepted flag so it only protects one load
    sessionStorage.removeItem('justAcceptedInvite')

    // Check for accepted invite FIRST — collaborators should always land in the shared list
    const { data: invites, error: inviteError } = await supabase
      .from('invites')
      .select('list_id')
      .eq('accepted_by', user.id)
      .limit(1)

    console.log('invites:', invites, 'inviteError:', inviteError)

    const invite = invites?.[0]
    if (invite) {
      console.log('found invite, loading list:', invite.list_id)
      setListId(invite.list_id)
      await loadHomes(invite.list_id)
      await loadPartner(invite.list_id)
      setLoading(false)
      return
    }

    // Then check for owned list
let { data: ownedList } = await supabase
  .from('lists')
  .select('id')
  .eq('owner_id', user.id)
  .limit(1)

const owned = ownedList?.[0]
    console.log('owned list:', owned)

    if (owned) {
      setListId(owned.id)
      await loadHomes(owned.id)
      await loadPartner(owned.id)
      setLoading(false)
      return
    }

    // Only create a new list if we didn't just accept an invite
    const justAccepted = sessionStorage.getItem('justAcceptedInvite')
    if (!justAccepted) {
      console.log('no list found, creating new one')
      const { data: created } = await supabase
        .from('lists')
        .insert({ owner_id: user.id, name: 'My Home List' })
        .select('id')
        .single()
      if (created) setListId(created.id)
    } else {
      console.log('just accepted invite, skipping list creation')
    }
    setLoading(false)
  }

  async function loadHomes(id) {
    const lid = id || listId
    if (!lid) return

    const { data: homesData } = await supabase
      .from('homes')
      .select('*')
      .eq('list_id', lid)
      .order('created_at', { ascending: true })

    const { data: rankData } = await supabase
      .from('rankings')
      .select('home_id, position')
      .eq('user_id', user.id)

    const { data: ratingData } = await supabase
      .from('ratings')
      .select('home_id, intensity')
      .eq('user_id', user.id)

    const { data: notesData } = await supabase
      .from('notes')
      .select('home_id, body')
      .eq('user_id', user.id)

    const rankMap = {}
    rankData?.forEach(r => { rankMap[r.home_id] = r.position })

    const ratingMap = {}
    ratingData?.forEach(r => { ratingMap[r.home_id] = r.intensity })

    const notesMap = {}
    notesData?.forEach(n => { notesMap[n.home_id] = n.body })

    setRankings(rankMap)
    setRatings(ratingMap)

    const sorted = (homesData || []).sort((a, b) => {
      const ra = rankMap[a.id] ?? 9999
      const rb = rankMap[b.id] ?? 9999
      return ra - rb
    }).map(h => ({ ...h, user_note: notesMap[h.id] || '' }))

    setHomes(sorted)
  }

  async function loadPartner(lid) {
    const listId_ = lid || listId
    if (!listId_) return

    const { data: listDataArr } = await supabase
      .from('lists')
      .select('owner_id')
      .eq('id', listId_)
      .limit(1)

    const listData = listDataArr?.[0]

    const { data: invites } = await supabase
      .from('invites')
      .select('accepted_by, email')
      .eq('list_id', listId_)
      .not('accepted_by', 'is', null)
      .limit(1)

    const invite = invites?.[0] || null
    if (!invite || !listData) return

    const ownerId = listData.owner_id
    const collaboratorId = invite.accepted_by
    const partnerId = user.id === ownerId ? collaboratorId : ownerId
    const partnerEmail = partnerId === collaboratorId ? invite.email : 'Owner'

    setPartner({ id: partnerId, email: partnerEmail })

    const { data: rankData } = await supabase
      .from('rankings')
      .select('home_id, position')
      .eq('user_id', partnerId)

    const { data: ratingData } = await supabase
      .from('ratings')
      .select('home_id, intensity')
      .eq('user_id', partnerId)

    const { data: partnerNotesData } = await supabase
      .from('notes')
      .select('home_id, body')
      .eq('user_id', partnerId)

    const rankMap = {}
    rankData?.forEach(r => { rankMap[r.home_id] = r.position })

    const ratingMap = {}
    ratingData?.forEach(r => { ratingMap[r.home_id] = r.intensity })

    const notesMap = {}
    partnerNotesData?.forEach(n => { notesMap[n.home_id] = n.body })

    setPartnerRankings(rankMap)
    setPartnerRatings(ratingMap)
    setPartnerNotesMap(notesMap)

    setPartnerHomes([...homes].sort((a, b) => {
      const ra = rankMap[a.id] ?? 9999
      const rb = rankMap[b.id] ?? 9999
      return ra - rb
    }))
  }

  async function saveRankings(orderedHomes) {
    const upserts = orderedHomes.map((home, i) => ({
      user_id: user.id,
      home_id: home.id,
      list_id: listId,
      position: i + 1,
    }))
    await supabase
      .from('rankings')
      .upsert(upserts, { onConflict: 'list_id,home_id,user_id' })
  }

  async function saveRating(homeId, intensity) {
    setRatings(prev => ({ ...prev, [homeId]: intensity }))
    await supabase.from('ratings').upsert({
      user_id: user.id,
      home_id: homeId,
      list_id: listId,
      intensity,
    }, { onConflict: 'user_id,home_id' })
  }

  async function saveNote(homeId, note) {
    const { error } = await supabase.from('notes').upsert({
      user_id: user.id,
      home_id: homeId,
      list_id: listId,
      body: note,
    }, { onConflict: 'user_id,home_id' })
    if (error) throw new Error(error.message)
  }

  async function deleteHome(homeId) {
    await supabase.from('homes').delete().eq('id', homeId)
    setHomes(prev => prev.filter(h => h.id !== homeId))
  }

  function handlePhotoUpdate(homeId, photoUrl) {
    const updater = prev => prev.map(h => h.id === homeId ? { ...h, photo_url: photoUrl } : h)
    setHomes(updater)
    setPartnerHomes(updater)
  }

  async function handlePriceUpdate(homeId, newPrice) {
    const price = newPrice === '' ? null : Number(newPrice)
    const { error } = await supabase.from('homes').update({ price }).eq('id', homeId)
    if (error) throw new Error(error.message)
    setHomes(prev => prev.map(h => h.id === homeId ? { ...h, price } : h))
  }

  function handleMove(index, direction) {
    const updated = [...homes]
    const target = index + direction
    if (target < 0 || target >= updated.length) return
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    setHomes(updated)
    saveRankings(updated)
    const newRankings = {}
    updated.forEach((h, i) => { newRankings[h.id] = i + 1 })
    setRankings(newRankings)
  }

  function handleDragStart(index) { dragItem.current = index }
  function handleDragEnter(index) { dragOver.current = index }
  function handleDragEnd() {
    const updated = [...homes]
    const dragged = updated.splice(dragItem.current, 1)[0]
    updated.splice(dragOver.current, 0, dragged)
    dragItem.current = null
    dragOver.current = null
    setHomes(updated)
    saveRankings(updated)
    const newRankings = {}
    updated.forEach((home, i) => { newRankings[home.id] = i + 1 })
    setRankings(newRankings)
  }


  useEffect(() => {
    if (activeTab !== 'mine' && activeTab !== 'combined') return
    const handleScroll = () => {
      const mid = window.innerHeight / 2
      let closest = null
      let closestDist = Infinity
      const list = activeTab === 'mine' ? homes : combinedHomes
      list.forEach(home => {
        const el = cardRefs.current[home.id]
        if (!el) return
        const rect = el.getBoundingClientRect()
        const dist = Math.abs((rect.top + rect.bottom) / 2 - mid)
        if (dist < closestDist) { closestDist = dist; closest = home.id }
      })
      if (closest) setMapActiveId(closest)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [homes, combinedHomes, activeTab])

  function handleThumbnailClick(homeId) {
    setHighlightedId(homeId)
    setTimeout(() => {
      cardRefs.current[homeId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    setTimeout(() => setHighlightedId(null), 2000)
  }

  const handleSignOut = async () => { await supabase.auth.signOut() }

  const combinedHomes = useMemo(() => [...homes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((home, _, arr) => {
      const n = arr.length
      const myRank = rankings[home.id] ?? n
      const myIntensity = ratings[home.id] ?? 50
      const partnerRank = partnerRankings[home.id] ?? n
      const partnerIntensity = partnerRatings[home.id] ?? 50
      const avgRank = (myRank + partnerRank) / 2
      const avgIntensity = (myIntensity + partnerIntensity) / 2
      const rankScore = ((n + 1 - avgRank) / n) * 100
      const intensityScore = (avgIntensity - 50) * 2
      const score = Math.round((rankScore * 0.7) + (intensityScore * 0.3))
      return {
        ...home,
        score,
        myRank,
        myIntensity,
        partnerRank,
        partnerIntensity,
        partner_note: partnerNotesMap[home.id] || null,
      }
    }).sort((a, b) => b.score - a.score),
  [homes, rankings, ratings, partnerRankings, partnerRatings, partnerNotesMap])

  function downloadCSV() {
    const headers = ['Rank', 'Address', 'City', 'State', 'Zip', 'Price', 'Beds', 'Baths', 'Sqft', 'Acres', 'Year Built', 'MLS#', 'Score', 'My Rank', 'My Intensity', 'Partner Rank', 'Partner Intensity', 'URL']
    const escape = v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`
    const rows = combinedHomes.map((home, i) => [
      i + 1,
      escape(home.address),
      escape(home.city),
      escape(home.state),
      escape(home.zip),
      home.price ?? '',
      home.beds ?? '',
      home.baths ?? '',
      home.sqft ?? '',
      home.acres ?? '',
      home.year_built ?? '',
      escape(home.mls_number),
      home.score ?? '',
      home.myRank ?? '',
      home.myIntensity ?? '',
      home.partnerRank ?? '',
      home.partnerIntensity ?? '',
      escape(home.url),
    ].join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'threshold-homes.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function openPrintView() {
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const rows = combinedHomes.map((home, i) => {
      const stats = [
        home.beds       ? `${home.beds} bd`           : null,
        home.baths      ? `${home.baths} ba`           : null,
        home.sqft       ? `${home.sqft.toLocaleString()} sqft` : null,
        home.acres      ? `${home.acres} acres`        : null,
        home.year_built ? `Built ${home.year_built}`   : null,
      ].filter(Boolean).join('  ·  ')

      const location = [home.city, home.state, home.zip].filter(Boolean).join(', ')
      const price = home.price ? '$' + home.price.toLocaleString() : 'Price N/A'
      const photo = home.photo_url
        ? `<img src="${home.photo_url}" alt="${home.address}" />`
        : `<div class="no-photo">${(home.city || '?')[0]}</div>`

      const myLabel = user?.email?.split('@')[0] || 'Me'
      const partnerEmail = partner?.email && partner.email !== 'pending' ? partner.email : null
      const partnerLabel = partnerEmail ? partnerEmail.split('@')[0] : 'Partner'

      const peopleRows = `
        <div class="people-row">
          <div class="person-block">
            <div class="person-label">${myLabel}</div>
            <div class="person-rank">Rank #${home.myRank}</div>
            <div class="person-intensity">
              <div class="intensity-bar-bg"><div class="intensity-bar" style="width:${home.myIntensity}%"></div></div>
              <span class="intensity-pct">${home.myIntensity}%</span>
            </div>
            ${home.user_note ? `<div class="person-note">"${home.user_note}"</div>` : ''}
          </div>
          ${partner ? `
          <div class="person-divider"></div>
          <div class="person-block">
            <div class="person-label">${partnerLabel}</div>
            <div class="person-rank">Rank #${home.partnerRank}</div>
            <div class="person-intensity">
              <div class="intensity-bar-bg"><div class="intensity-bar partner" style="width:${home.partnerIntensity}%"></div></div>
              <span class="intensity-pct">${home.partnerIntensity}%</span>
            </div>
            ${home.partner_note ? `<div class="person-note">"${home.partner_note}"</div>` : ''}
          </div>` : ''}
        </div>`

      return `
        <div class="home-card">
          <div class="home-rank">#${i + 1}</div>
          <div class="home-photo">${photo}</div>
          <div class="home-info">
            <div class="home-address">${home.address}</div>
            <div class="home-location">${location}</div>
            <div class="home-price">${price}</div>
            ${stats ? `<div class="home-stats">${stats}</div>` : ''}
            ${home.url ? `<div class="home-link"><a href="${home.url}" target="_blank">${home.source_site ? 'View on ' + home.source_site : 'View listing'} →</a></div>` : ''}
            ${peopleRows}
          </div>
          <div class="home-score">
            <div class="score-val">${Math.max(0, home.score)}</div>
            <div class="score-label">score</div>
          </div>
        </div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Home Shortlist · ${date}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, serif; background: #fff; color: #111; padding: 40px; max-width: 860px; margin: 0 auto; }
  h1 { font-size: 28px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px; }
  .subtitle { font-size: 13px; color: #666; margin-bottom: 6px; }
  .meta { font-size: 12px; color: #999; margin-bottom: 36px; border-bottom: 1px solid #ddd; padding-bottom: 16px; }
  .home-card {
    display: flex; align-items: flex-start; gap: 20px;
    padding: 20px 0; border-bottom: 1px solid #eee;
    page-break-inside: avoid; break-inside: avoid;
  }
  .home-rank { font-size: 22px; font-weight: 700; color: #ccc; width: 36px; flex-shrink: 0; padding-top: 4px; text-align: right; }
  .home-photo { width: 140px; height: 100px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: #f0f0f0; }
  .home-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .no-photo { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 32px; color: #ccc; font-family: sans-serif; }
  .home-info { flex: 1; }
  .home-address { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
  .home-location { font-size: 13px; color: #666; margin-bottom: 8px; }
  .home-price { font-size: 18px; font-weight: 700; color: #e8442a; margin-bottom: 6px; }
  .home-stats { font-size: 12px; color: #555; margin-bottom: 6px; }
  .home-link a { font-size: 12px; color: #888; text-decoration: none; }
  .home-score { text-align: center; flex-shrink: 0; width: 60px; }
  .score-val { font-size: 26px; font-weight: 700; color: #e8442a; line-height: 1; }
  .score-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-top: 2px; }
  .people-row { display: flex; gap: 16px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #eee; }
  .person-block { flex: 1; }
  .person-divider { width: 1px; background: #eee; flex-shrink: 0; }
  .person-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #aaa; margin-bottom: 3px; }
  .person-rank { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 5px; }
  .person-intensity { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .intensity-bar-bg { flex: 1; height: 5px; background: #eee; border-radius: 3px; overflow: hidden; }
  .intensity-bar { height: 100%; background: #e8442a; border-radius: 3px; }
  .intensity-bar.partner { background: #4A9EFF; }
  .intensity-pct { font-size: 11px; color: #888; min-width: 28px; }
  .person-note { font-size: 11px; color: #777; font-style: italic; line-height: 1.4; }
  @media print {
    body { padding: 20px; }
    .home-card { page-break-inside: avoid; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
  <h1>Threshold</h1>
  <div class="subtitle">Home Shortlist · ${homes.length} properties</div>
  <div class="meta">Prepared ${date}${user?.email ? ' · ' + user.email : ''}</div>
  ${rows}
</body>
</html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
  }

  const stateChips = [...new Set(combinedHomes.map(h => h.state).filter(Boolean))].sort()
    .map(state => ({ state, count: combinedHomes.filter(h => h.state === state).length }))

  function toggleStateFilter(state) {
    setStateFilter(prev => prev.includes(state) ? prev.filter(s => s !== state) : [...prev, state])
  }

  const filteredCombined = stateFilter.length === 0
    ? combinedHomes
    : combinedHomes.filter(h => stateFilter.includes(h.state))

  if (loading) return <div className="loading-screen">Loading your list...</div>

  return (
    <div className="app">
      <header className="header">
        <div className="logo">THRESHOLD</div>
        <div className="header-right">
          <span className="user-email">{user?.email}</span>
          {!partner && (
            <button className="btn-invite" onClick={() => setShowInvite(true)}>
              + Partner
            </button>
          )}
          {homes.length > 0 && (
            <div className="share-menu-wrap">
              <button className="btn-export" onClick={() => setShowShareMenu(prev => !prev)}>Share</button>
              {showShareMenu && (
                <div className="share-menu" onClick={() => setShowShareMenu(false)}>
                  <button className="share-menu-item" onClick={openPrintView}>
                    🖨️ Print View
                  </button>
                  <button className="share-menu-item" onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}?share=${listId}`
                    navigator.clipboard.writeText(url)
                      .then(() => alert('Link copied to clipboard!'))
                      .catch(() => prompt('Copy this link:', url))
                  }}>
                    🔗 Copy Share Link
                  </button>
                  <button className="share-menu-item" onClick={downloadCSV}>
                    📥 Download CSV
                  </button>
                </div>
              )}
            </div>
          )}
          <button className="btn-signout" onClick={handleSignOut}>Sign out</button>
          <button className="btn-add" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </header>

      <div className="view-bar">
        <div className={`view-tab ${activeTab === 'mine' ? 'active' : ''}`} onClick={() => setActiveTab('mine')}>My List</div>
        <div className={`view-tab ${activeTab === 'combined' ? 'active' : ''}`} onClick={() => setActiveTab('combined')}>Combined</div>
        <div className={`view-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</div>
      </div>

      <div className="sub-bar">
        <span className="sub-count">
          <strong>{homes.length} {homes.length === 1 ? 'home' : 'homes'}</strong>
          {activeTab === 'mine' && (homes.length === 0 ? ' · add your first listing' : ' · drag to reorder')}
          {activeTab === 'combined' && ' · sorted by combined score'}
          {activeTab === 'analytics' && ' · your list at a glance'}
        </span>
        {activeTab === 'combined' && stateChips.length > 1 && (
          <div className="sub-state-chips">
            {stateChips.map(({ state, count }) => (
              <button
                key={state}
                className={`state-chip${stateFilter.includes(state) ? ' active' : ''}`}
                onClick={() => toggleStateFilter(state)}
              >
                {state} <span className="state-chip-count">({count})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add a Listing</span>
              <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            </div>
            <AddListing listId={listId} onAdded={() => { setShowAdd(false); loadHomes() }} />
          </div>
        </div>
      )}

      {showInvite && (
        <InviteModal listId={listId} onClose={() => setShowInvite(false)} />
      )}

      {areaHome && (
        <div className="area-overlay" onClick={() => setAreaHome(null)}>
          <div className="area-modal" onClick={e => e.stopPropagation()}>
            <div className="area-modal-header">
              <div>
                <div className="area-modal-title">In the Area</div>
                <div className="area-modal-sub">{[areaHome.city, areaHome.state].filter(Boolean).join(', ')} · opens in Google Maps</div>
              </div>
              <button className="area-modal-close" onClick={() => setAreaHome(null)}>✕</button>
            </div>
            <div className="area-modal-label">SELECT A CATEGORY TO SEARCH NEARBY</div>
            <div className="area-grid">
              {AREA_CATEGORIES.map(cat => (
                <a key={cat.query} href={areaUrl(areaHome, cat.query)} target="_blank" rel="noreferrer" className="area-tile" onClick={() => setAreaHome(null)}>
                  <span className="area-tile-emoji">{cat.emoji}</span>
                  <span className="area-tile-label">{cat.label}</span>
                </a>
              ))}
            </div>
            <div className="area-modal-footer">↗ Results open in Google Maps · zoom out to expand the search area</div>
          </div>
        </div>
      )}

      {/* MY LIST TAB */}
      {activeTab === 'mine' && (
        <div className="dashboard-body">
          {homes.length > 0 && (
            <div className="thumb-sidebar">
              {homes.map((home, index) => (
                <div
                  key={home.id}
                  className={'thumb-item' + (highlightedId === home.id ? ' thumb-active' : '')}
                  draggable
                  onClick={() => handleThumbnailClick(home.id)}
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                >
                  <div className="thumb-rank">{'#' + (index + 1)}</div>
                  <div className="thumb-img">
                    {home.photo_url
                      ? <img src={home.photo_url} alt={home.address} />
                      : null
                    }
                  </div>
                  <div className="thumb-preview">
                    <div className="thumb-preview-img">
                      {home.photo_url
                        ? <img src={home.photo_url} alt={home.address} />
                        : <div className="thumb-preview-placeholder" />
                      }
                    </div>
                    <div className="thumb-preview-addr">{home.address}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="card-list">
            {homes.length === 0 ? (
              <div className="empty-state">
                <p>No homes yet.</p>
                <p>Hit <strong>+ Add</strong> and paste a listing URL to get started.</p>
              </div>
            ) : (
              homes.map((home, index) => (
                <div
                  key={home.id}
                  draggable
                  onDragStart={(e) => {
                    if (e.target.closest('.card-body')) { e.preventDefault(); return; }
                    handleDragStart(index)
                  }}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => e.preventDefault()}
                  onMouseDown={(e) => {
                    if (e.target.closest('.card-body')) e.currentTarget.draggable = false
                  }}
                  onMouseUp={(e) => { e.currentTarget.draggable = true }}
                >
                  <PropertyCard
                    home={home}
                    rank={index + 1}
                    intensity={ratings[home.id] ?? 50}
                    onIntensityChange={(val) => saveRating(home.id, val)}
                    onDelete={deleteHome}
                    onNoteSave={saveNote}
                    onPhotoUpdate={handlePhotoUpdate}
                    onPriceUpdate={handlePriceUpdate}
                    onMoveUp={() => handleMove(index, -1)}
                    onMoveDown={() => handleMove(index, 1)}
                    isFirst={index === 0}
                    isLast={index === homes.length - 1}
                    isHighlighted={highlightedId === home.id}
                    cardRef={el => cardRefs.current[home.id] = el}
                  />
                </div>
              ))
            )}
            <div className="card-list-spacer" />
          </div>
          {homes.some(h => h.lat && h.lng) && (
            <div className="map-panel">
              <Suspense fallback={null}>
                <HomeMap homes={homes} activeId={mapActiveId} onHomeClick={handleThumbnailClick} />
              </Suspense>
            </div>
          )}
        </div>
      )}

      {/* COMBINED TAB */}
      {activeTab === 'combined' && (
        <div className="dashboard-body">
          <div className="card-list">
            {filteredCombined.length === 0 ? (
              <div className="empty-state"><p>No homes yet.</p></div>
            ) : (
              filteredCombined.map((home, index) => {
                const intensityEmoji = (val) => {
                  if (val < 25) return '😬'
                  if (val < 50) return '🤔'
                  if (val < 75) return '😊'
                  return '😍'
                }
                const mapTileUrl = home.lat && home.lng
                  ? `https://staticmap.openstreetmap.de/staticmap.php?center=${home.lat},${home.lng}&zoom=15&size=250x250&markers=${home.lat},${home.lng},red`
                  : null
                const photoSrc = home.photo_url || mapTileUrl

                return (
                  <div key={home.id} className="card" ref={el => cardRefs.current[home.id] = el}>
                    <div className="card-main">

                      <div className="card-rank-col">
                        <span className="card-rank-num">{'#' + (index + 1)}</span>
                        <span className="card-rank-label">rank</span>
                      </div>

                      <div className="card-photo">
                        {photoSrc
                          ? <img src={photoSrc} alt={home.address} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                          : <div className="card-photo-placeholder" style={{flexDirection:'column',gap:'4px',padding:'8px',textAlign:'center'}}>
                              <div style={{fontSize:'12px',fontWeight:700,color:'var(--text-muted)',lineHeight:1.3}}>{home.city || '—'}</div>
                              {home.state && <div style={{fontSize:'10px',color:'var(--text-muted)',opacity:0.6}}>{home.state}</div>}
                            </div>
                        }
                      </div>

                      <div className="card-info">
                        <div className="card-top">
                          <div className="card-address-block">
                            <div className="card-address-link">{home.address}</div>
                            <div className="card-city">{[home.city, home.state, home.zip].filter(Boolean).join(', ')}</div>
                          </div>
                          <div className="card-price">{home.price ? '$' + home.price.toLocaleString() : 'Price N/A'}</div>
                        </div>
                        <div className="card-stats">
                          {home.beds  && <div className="card-stat"><span className="card-stat-val">{home.beds}</span><span className="card-stat-label">Beds</span></div>}
                          {home.baths && <div className="card-stat"><span className="card-stat-val">{home.baths}</span><span className="card-stat-label">Baths</span></div>}
                          {home.sqft  && <div className="card-stat"><span className="card-stat-val">{home.sqft.toLocaleString()}</span><span className="card-stat-label">Sqft</span></div>}
                          {home.acres && <div className="card-stat"><span className="card-stat-val">{home.acres}</span><span className="card-stat-label">Acres</span></div>}
                        </div>
                        <div className="card-source-row" style={{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
                          {home.url && (
                            <a href={home.url} target="_blank" rel="noreferrer" className="card-source-link">View listing →</a>
                          )}
                          <button className="btn-in-the-area" onClick={() => setAreaHome(home)}>🗺️ In the Area</button>
                          {home.mls_number && (
                            <span style={{fontSize:'11px',color:'var(--text-muted)'}}>MLS# {home.mls_number}</span>
                          )}
                        </div>
                      </div>

                      <div className="card-actions" style={{justifyContent:'center'}}>
                        <div className="combined-score-wrap">
                          <div style={{fontFamily:'"Syne",sans-serif',fontSize:'16px',fontWeight:800,color:'var(--coral)'}}>★ {Math.max(0, home.score)}</div>
                          <div style={{fontSize:'9px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',marginTop:'3px'}}>score</div>
                          <div className="combined-score-tooltip">
                            Score blends both partners' rankings (70%) and intensity (30%). Higher = stronger mutual interest.
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card-body" style={{gap:'12px'}}>
                      <div className="combined-people">
                        <div className="combined-person">
                          <div className="combined-person-label">You</div>
                          <div className="combined-person-rank">#{home.myRank}</div>
                          <div className="combined-intensity-row">
                            <span className="combined-emoji">{intensityEmoji(home.myIntensity)}</span>
                            <div className="combined-bar-track">
                              <div className="combined-bar-fill" style={{width: home.myIntensity + '%'}} />
                            </div>
                            <span className="combined-pct">{home.myIntensity}%</span>
                          </div>
                          {home.user_note && (
                            <div style={{fontSize:'12px',color:'var(--text-secondary)',marginTop:'8px',lineHeight:1.5}}>
                              {home.user_note.slice(0, 100)}{home.user_note.length > 100 ? '…' : ''}
                            </div>
                          )}
                        </div>

                        <div className="combined-divider" />

                        <div className="combined-person">
                          <div className="combined-person-label">Partner</div>
                          <div className="combined-person-rank">#{home.partnerRank}</div>
                          <div className="combined-intensity-row">
                            <span className="combined-emoji">{intensityEmoji(home.partnerIntensity)}</span>
                            <div className="combined-bar-track">
                              <div className="combined-bar-fill partner" style={{width: home.partnerIntensity + '%'}} />
                            </div>
                            <span className="combined-pct">{home.partnerIntensity}%</span>
                          </div>
                          {home.partner_note && (
                            <div style={{fontSize:'12px',color:'var(--text-secondary)',marginTop:'8px',lineHeight:1.5}}>
                              {home.partner_note.slice(0, 100)}{home.partner_note.length > 100 ? '…' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div className="card-list-spacer" />
          </div>
          {combinedHomes.some(h => h.lat && h.lng) && (
            <div className="map-panel">
              <Suspense fallback={null}>
                <HomeMap
                  homes={combinedHomes}
                  activeId={mapActiveId}
                  onHomeClick={(id) => {
                    setHighlightedId(id)
                    setTimeout(() => cardRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
                    setTimeout(() => setHighlightedId(null), 2000)
                  }}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS TAB */}
      {activeTab === 'analytics' && (
        <div className="analytics-wrap">
          <div className="analytics-metrics">
            <div className="an-metric">
              <div className="an-val">{homes.length}</div>
              <div className="an-label">homes tracked</div>
            </div>
            <div className="an-metric">
              <div className="an-val">
                {homes.filter(h => h.price).length > 0
                  ? '$' + Math.round(homes.filter(h => h.price).reduce((s, h) => s + h.price, 0) / homes.filter(h => h.price).length / 1000) + 'K'
                  : '—'}
              </div>
              <div className="an-label">avg price</div>
            </div>
            <div className="an-metric">
              <div className="an-val">
                {homes.filter(h => h.beds).length > 0
                  ? Math.round(homes.filter(h => h.beds).reduce((s, h) => s + h.beds, 0) / homes.filter(h => h.beds).length) + ' bd'
                  : '—'}
              </div>
              <div className="an-label">avg beds</div>
            </div>
            <div className="an-metric">
              <div className="an-val">
                {Object.values(ratings).length > 0
                  ? Math.round(Object.values(ratings).reduce((s, v) => s + v, 0) / Object.values(ratings).length) + '%'
                  : '—'}
              </div>
              <div className="an-label">avg intensity</div>
            </div>
          </div>

          {/* ── Intensity bar chart ── */}
          <div className="an-card">
            <div className="an-card-title">Your Intensity</div>
            <div className="an-bar-chart">
              {[...homes].sort((a, b) => (ratings[b.id] ?? 50) - (ratings[a.id] ?? 50)).map(home => {
                const intensity = ratings[home.id] ?? 50
                return (
                  <div key={home.id} className="an-bar-row" onClick={() => { setActiveTab('mine'); handleThumbnailClick(home.id) }}>
                    <div className="an-bar-label">{home.address?.split(',')[0]}</div>
                    <div className="an-bar-track">
                      <div className="an-bar-fill" style={{ width: intensity + '%', opacity: 0.4 + (intensity / 100) * 0.6 }} />
                    </div>
                    <div className="an-bar-val">{intensity}%</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Scatter: rank vs price ── */}
          {homes.filter(h => h.price).length > 1 && (() => {
            const priced = homes.filter(h => h.price)
            const maxPrice = Math.max(...priced.map(h => h.price))
            const minPrice = Math.min(...priced.map(h => h.price))
            const priceRange = maxPrice - minPrice || 1
            const n = homes.length
            return (
              <div className="an-card">
                <div className="an-card-title">Rank vs Price</div>
                <div className="an-scatter">
                  <div className="an-scatter-area">
                    {priced.map(home => {
                      const rank = rankings[home.id] ?? n
                      const x = ((rank - 1) / Math.max(n - 1, 1)) * 100
                      const y = 100 - ((home.price - minPrice) / priceRange) * 100
                      return (
                        <div
                          key={home.id}
                          className="an-scatter-dot"
                          style={{ left: x + '%', top: y + '%' }}
                          title={`${home.address?.split(',')[0]} · #${rank} · $${Math.round(home.price/1000)}K`}
                          onClick={() => { setActiveTab('mine'); handleThumbnailClick(home.id) }}
                        >
                          <div className="an-scatter-tooltip">
                            <div>{home.address?.split(',')[0]}</div>
                            <div>#{rank} · ${Math.round(home.price/1000)}K</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="an-scatter-x-label">← Higher ranked · Lower ranked →</div>
                  <div className="an-scatter-y-label">Price ↑</div>
                </div>
              </div>
            )
          })()}

          {/* ── You vs Partner ── */}
          {partner && (() => {
            const ranked = homes.filter(h => rankings[h.id] != null && partnerRankings[h.id] != null)
            const agreements = ranked.filter(h => Math.abs((rankings[h.id] ?? 99) - (partnerRankings[h.id] ?? 99)) <= 2 && Math.abs((ratings[h.id] ?? 50) - (partnerRatings[h.id] ?? 50)) < 25).slice(0, 3)
            const disagreements = ranked.filter(h => Math.abs((rankings[h.id] ?? 99) - (partnerRankings[h.id] ?? 99)) >= 4 || Math.abs((ratings[h.id] ?? 50) - (partnerRatings[h.id] ?? 50)) >= 35).slice(0, 3)
            const myLabel = user?.email?.split('@')[0] || 'You'
            const pLabel = (partner?.email && partner.email !== 'pending') ? partner.email.split('@')[0] : 'Partner'
            return (
              <div className="an-card">
                <div className="an-card-title">You vs {pLabel}</div>
                <div className="an-vs-grid">
                  <div className="an-vs-col">
                    <div className="an-vs-col-title agree">✓ On the same page</div>
                    {agreements.length === 0 && <div className="an-vs-empty">Not enough data yet</div>}
                    {agreements.map(home => (
                      <div key={home.id} className="an-vs-row" onClick={() => { setActiveTab('mine'); handleThumbnailClick(home.id) }}>
                        <div className="an-vs-addr">{home.address?.split(',')[0]}</div>
                        <div className="an-vs-ranks">#{rankings[home.id]} · #{partnerRankings[home.id]}</div>
                      </div>
                    ))}
                  </div>
                  <div className="an-vs-divider" />
                  <div className="an-vs-col">
                    <div className="an-vs-col-title talk">💬 Worth a talk</div>
                    {disagreements.length === 0 && <div className="an-vs-empty">No major disagreements</div>}
                    {disagreements.map(home => (
                      <div key={home.id} className="an-vs-row" onClick={() => { setActiveTab('mine'); handleThumbnailClick(home.id) }}>
                        <div className="an-vs-addr">{home.address?.split(',')[0]}</div>
                        <div className="an-vs-ranks">#{rankings[home.id] ?? '?'} · #{partnerRankings[home.id] ?? '?'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Agreement list + stats ── */}
          <div className="analytics-row">
            <div className="an-card">
              <div className="an-card-title">Agreement</div>
              {homes.map(home => {
                const myRank = rankings[home.id]
                const pRank = partnerRankings[home.id]
                const myInt = ratings[home.id] ?? 50
                const pInt = partnerRatings[home.id] ?? 50
                const hasPartner = pRank != null
                const rankGap = hasPartner ? Math.abs(myRank - pRank) : null
                const intGap = hasPartner ? Math.abs(myInt - pInt) : null
                const isDisagreement = hasPartner && (rankGap >= 4 || intGap >= 35)
                return (
                  <div key={home.id} className="an-agree-row" onClick={() => { setActiveTab('mine'); handleThumbnailClick(home.id) }} style={{ cursor: 'pointer' }}>
                    <div className="an-agree-addr">{home.address?.split(',')[0]}</div>
                    {!hasPartner
                      ? <span className="an-badge an-badge-waiting">waiting</span>
                      : isDisagreement
                      ? <span className="an-badge an-badge-talk">💬 talk</span>
                      : <span className="an-badge an-badge-agree">✓ agree</span>
                    }
                  </div>
                )
              })}
            </div>

            <div className="an-card">
              <div className="an-card-title">List stats</div>
              <div className="an-stats-list">
                <div className="an-stat-row">
                  <span className="an-stat-label">States</span>
                  <span className="an-stat-val">{[...new Set(homes.map(h => h.state).filter(Boolean))].join(', ') || '—'}</span>
                </div>
                <div className="an-stat-row">
                  <span className="an-stat-label">Price range</span>
                  <span className="an-stat-val">
                    {homes.filter(h => h.price).length > 1
                      ? '$' + Math.round(Math.min(...homes.filter(h=>h.price).map(h=>h.price))/1000) + 'K – $' + Math.round(Math.max(...homes.filter(h=>h.price).map(h=>h.price))/1000) + 'K'
                      : '—'}
                  </span>
                </div>
                <div className="an-stat-row">
                  <span className="an-stat-label">Oldest built</span>
                  <span className="an-stat-val">{homes.filter(h=>h.year_built).length > 0 ? Math.min(...homes.filter(h=>h.year_built).map(h=>h.year_built)) : '—'}</span>
                </div>
                <div className="an-stat-row">
                  <span className="an-stat-label">Newest built</span>
                  <span className="an-stat-val">{homes.filter(h=>h.year_built).length > 0 ? Math.max(...homes.filter(h=>h.year_built).map(h=>h.year_built)) : '—'}</span>
                </div>
                <div className="an-stat-row an-stat-row-sources">
                  <span className="an-stat-label">Sources</span>
                  <div className="an-source-chips">
                    {[...new Set(homes.map(h => h.source_site).filter(Boolean))].map(s => (
                      <span key={s} className="an-source-chip">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Sweet spot callout ── */}
          {(() => {
            const priced = combinedHomes.filter(h => h.price)
            if (priced.length < 2) return null
            const avgPrice = priced.reduce((s, h) => s + h.price, 0) / priced.length
            const sweetSpot = priced.reduce((best, h) => {
              const val = (h.score / Math.max(1, h.price / avgPrice))
              const bestVal = (best.score / Math.max(1, best.price / avgPrice))
              return val > bestVal ? h : best
            })
            const topHome = combinedHomes[0]
            return (
              <div className="an-insight">
                {sweetSpot && <>🏆 <strong>Best value:</strong> {sweetSpot.address?.split(',')[0]} — score {Math.max(0, sweetSpot.score)} at ${Math.round(sweetSpot.price/1000)}K.</>}
                {topHome && topHome.id !== sweetSpot?.id && <> Your top pick is {topHome.address?.split(',')[0]} at ${topHome.price ? Math.round(topHome.price/1000)+'K' : 'unknown price'}.</>}
                {!partner && <> Invite your partner to unlock agreement tracking.</>}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}