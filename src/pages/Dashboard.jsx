import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PropertyCard from '../components/PropertyCard'
import AddListing from '../components/AddListing'
import InviteModal from '../components/InviteModal'

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

  useEffect(() => {
    if (user?.id) initList()
  }, [user?.id])

  async function initList() {
    setLoading(true)

    let { data: owned } = await supabase
      .from('lists')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .single()

    if (owned) {
      setListId(owned.id)
      await loadHomes(owned.id)
      await loadPartner(owned.id)
      setLoading(false)
      return
    }

    const { data: invites } = await supabase
      .from('invites')
      .select('list_id')
      .eq('accepted_by', user.id)
      .limit(1)

    const invite = invites?.[0]

    if (invite) {
      setListId(invite.list_id)
      await loadHomes(invite.list_id)
      await loadPartner(invite.list_id)
      setLoading(false)
      return
    }

    const { data: created } = await supabase
      .from('lists')
      .insert({ owner_id: user.id, name: 'My Home List' })
      .select('id')
      .single()

    if (created) setListId(created.id)
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

    const { data: listData } = await supabase
      .from('lists')
      .select('owner_id')
      .eq('id', listId_)
      .single()

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
    await supabase.from('notes').upsert({
      user_id: user.id,
      home_id: homeId,
      list_id: listId,
      body: note,
    }, { onConflict: 'user_id,home_id' })
  }

  async function deleteHome(homeId) {
    await supabase.from('homes').delete().eq('id', homeId)
    setHomes(prev => prev.filter(h => h.id !== homeId))
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
    // Update rankings map so combined tab recalculates immediately
    const newRankings = {}
    updated.forEach((home, i) => { newRankings[home.id] = i + 1 })
    setRankings(newRankings)
  }

  function handleThumbnailClick(homeId) {
    setHighlightedId(homeId)
    cardRefs.current[homeId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setHighlightedId(null), 2000)
  }

  const handleSignOut = async () => { await supabase.auth.signOut() }

  // Combined score — neutral sort by id so result is identical for both users
  const combinedHomes = [...homes]
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
    }).sort((a, b) => b.score - a.score)

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
                      : <div className="thumb-placeholder" />
                    }
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
                    isHighlighted={highlightedId === home.id}
                    cardRef={el => cardRefs.current[home.id] = el}
                  />
                </div>
              ))
            )}
            <div className="card-list-spacer" />
          </div>
        </div>
      )}

      {/* COMBINED TAB */}
      {activeTab === 'combined' && (
        <div className="dashboard-body">
          <div className="card-list">
            {combinedHomes.length === 0 ? (
              <div className="empty-state"><p>No homes yet.</p></div>
            ) : (
              combinedHomes.map((home, index) => {
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
                  <div key={home.id} className="card">
                    {/* Main row: rank | photo | info | score */}
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
                        {(home.url || home.mls_number) && (
                          <div className="card-source-row" style={{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap'}}>
                            {home.url && (
                              <a href={home.url} target="_blank" rel="noreferrer" className="card-source-link">View listing →</a>
                            )}
                            {home.mls_number && (
                              <span style={{fontSize:'11px',color:'var(--text-muted)'}}>MLS# {home.mls_number}</span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="card-actions" style={{justifyContent:'center'}}>
                        <div style={{textAlign:'center'}}>
                          <div style={{fontFamily:'"Syne",sans-serif',fontSize:'16px',fontWeight:800,color:'var(--coral)'}}>★ {Math.max(0, home.score)}</div>
                          <div style={{fontSize:'9px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'1px',marginTop:'3px'}}>score</div>
                        </div>
                      </div>
                    </div>

                    {/* People + notes — each person's note under their own slider */}
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

          <div className="analytics-row">
            <div className="an-card">
              <div className="an-card-title">Intensity</div>
              <div className="an-bubbles">
                {[...homes].sort((a, b) => (ratings[b.id] ?? 50) - (ratings[a.id] ?? 50)).map(home => {
                  const intensity = ratings[home.id] ?? 50
                  const size = Math.round(30 + (intensity / 100) * 70)
                  const opacity = 0.4 + (intensity / 100) * 0.6
                  return (
                    <div key={home.id} className="an-bubble-col">
                      <div className="an-bubble" style={{ width: size, height: size, background: `rgba(255,96,64,${opacity})`, fontSize: size > 55 ? 13 : 11 }}>
                        {intensity}%
                      </div>
                      <div className="an-bubble-label">{home.address?.split(' ').slice(0,3).join(' ')}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="an-card">
              <div className="an-card-title">Price vs your rank</div>
              <div className="an-price-list">
                {[...homes].map((home, index) => {
                  const maxPrice = Math.max(...homes.filter(h => h.price).map(h => h.price))
                  const barWidth = home.price ? Math.round((home.price / maxPrice) * 100) : 0
                  return (
                    <div key={home.id} className="an-price-row">
                      <span className="an-price-rank">#{index + 1}</span>
                      <span className="an-price-addr">{home.address?.split(',')[0]}</span>
                      <div className="an-price-bar-bg">
                        <div className="an-price-bar" style={{width: barWidth + '%'}} />
                      </div>
                      <span className="an-price-val">{home.price ? '$' + Math.round(home.price / 1000) + 'K' : '—'}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

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
                  <div key={home.id} className="an-agree-row">
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
                <div className="an-stat-row">
                  <span className="an-stat-label">Sources</span>
                  <span className="an-stat-val">{[...new Set(homes.map(h => h.source_site).filter(Boolean))].join(', ') || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {(() => {
            const topHome = combinedHomes[0]
            const cheapest = [...homes].filter(h=>h.price).sort((a,b) => a.price - b.price)[0]
            if (!topHome) return null
            const topIsCheapest = cheapest && topHome.id === cheapest.id
            return (
              <div className="an-insight">
                {topIsCheapest
                  ? `Your #1 pick (${topHome.address?.split(',')[0]}) is also your cheapest at $${Math.round(topHome.price/1000)}K — strong signal.`
                  : `Your top ranked home is ${topHome.address?.split(',')[0]} at $${topHome.price ? Math.round(topHome.price/1000)+'K' : 'unknown price'}.`
                }
                {Object.values(ratings).length > 0 && ` Average intensity is ${Math.round(Object.values(ratings).reduce((s,v)=>s+v,0)/Object.values(ratings).length)}%.`}
                {!partner && ' Invite your partner to unlock agreement tracking.'}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
