import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PropertyCard from '../components/PropertyCard'
import AddListing from '../components/AddListing'

export default function Dashboard() {
  const { user } = useAuth()
  const [listId, setListId] = useState(null)
  const [homes, setHomes] = useState([])
  const [rankings, setRankings] = useState({})
  const [ratings, setRatings] = useState({})
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [activeTab, setActiveTab] = useState('mine')
  const [highlightedId, setHighlightedId] = useState(null)
  const dragItem = useRef(null)
  const dragOver = useRef(null)
  const cardRefs = useRef({})

  useEffect(() => {
    if (user) initList()
  }, [user])

  async function initList() {
    setLoading(true)
    let { data: existing } = await supabase
      .from('lists')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)
      .single()

    if (existing) {
      setListId(existing.id)
      await loadHomes(existing.id)
    } else {
      const { data: created } = await supabase
        .from('lists')
        .insert({ owner_id: user.id, name: 'My Home List' })
        .select('id')
        .single()
      if (created) {
        setListId(created.id)
      }
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
      .select('home_id, rank_position')
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
    rankData?.forEach(r => { rankMap[r.home_id] = r.rank_position })

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

  async function saveRankings(orderedHomes) {
    const upserts = orderedHomes.map((home, i) => ({
      user_id: user.id,
      home_id: home.id,
      list_id: listId,
      rank_position: i + 1,
    }))
    await supabase.from('rankings').upsert(upserts, { onConflict: 'user_id,home_id' })
  }

async function saveRating(homeId, intensity) {
    setRatings(prev => ({ ...prev, [homeId]: intensity }))
    const { data, error } = await supabase.from('ratings').upsert({
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
  }

  function handleThumbnailClick(homeId) {
    setHighlightedId(homeId)
    cardRefs.current[homeId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setHighlightedId(null), 2000)
  }

  const handleSignOut = async () => { await supabase.auth.signOut() }

  if (loading) return <div className="loading-screen">Loading your list...</div>

  return (
    <div className="app">
      <header className="header">
        <div className="logo">THRESHOLD</div>
        <div className="header-right">
          <span className="user-email">{user?.email}</span>
          <button className="btn-signout" onClick={handleSignOut}>Sign out</button>
          <button className="btn-add" onClick={() => setShowAdd(true)}>+ Add</button>
        </div>
      </header>

      <div className="view-bar">
        <div className={`view-tab ${activeTab === 'mine' ? 'active' : ''}`} onClick={() => setActiveTab('mine')}>My List</div>
        <div className={`view-tab ${activeTab === 'partner' ? 'active' : ''}`} onClick={() => setActiveTab('partner')}>Partner</div>
        <div className={`view-tab ${activeTab === 'combined' ? 'active' : ''}`} onClick={() => setActiveTab('combined')}>Combined</div>
        <div className={`view-tab ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Analytics</div>
      </div>

      <div className="sub-bar">
        <span className="sub-count">
          <strong>{homes.length} {homes.length === 1 ? 'home' : 'homes'}</strong>
          {homes.length === 0 ? ' · add your first listing' : ' · drag to reorder'}
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

      <div className="dashboard-body">
        {/* LEFT THUMBNAIL SIDEBAR */}
        {/* LEFT THUMBNAIL SIDEBAR */}
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

        {/* CARD LIST */}
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
    </div>
  )
}