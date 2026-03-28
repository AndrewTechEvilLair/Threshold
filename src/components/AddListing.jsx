import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const WORKER_URL = import.meta.env.VITE_WORKER_URL

// Extract a human-readable address hint from listing URL slugs
function extractAddressFromUrl(url) {
  try {
    const path = new URL(url).pathname

    // Homes.com: /property/3-beth-haven-church-rd-denver-nc/id/
    let m = path.match(/\/property\/([a-z0-9-]+)\//)
    if (m) return slugToAddress(m[1])

    // Zillow: /homedetails/3-Beth-Haven-Church-Rd-Denver-NC-28037/zpid/
    m = path.match(/\/homedetails\/([^/]+)\//)
    if (m) return slugToAddress(m[1])

    // Redfin: /NC/Denver/3-Beth-Haven-Church-Rd-28037/home/
    m = path.match(/\/[A-Z]{2}\/[^/]+\/([^/]+)\/home/)
    if (m) return slugToAddress(m[1])

    // Realtor: /realestateandhomes-detail/3-Beth-Haven-Church-Rd_Denver_NC_28037/
    m = path.match(/\/realestateandhomes-detail\/([^/]+)\//)
    if (m) return slugToAddress(m[1].replace(/_/g, '-'))

    // Trulia: /p/nc/city/address-slug/
    m = path.match(/\/p\/[a-z]{2}\/[^/]+\/([^/]+)\//)
    if (m) return slugToAddress(m[1])

  } catch (e) {}
  return null
}

function slugToAddress(slug) {
  // Remove trailing IDs (e.g. zpid numbers, homes.com hash)
  const cleaned = slug
    .replace(/-\d{6,}$/, '')   // trailing long numbers
    .replace(/-[a-z0-9]{8,}$/, '') // trailing hash IDs
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
  return cleaned || null
}

function isUrl(input) {
  try { new URL(input); return true } catch { return false }
}

async function fetchListingData(input) {
  let prompt

  if (isUrl(input)) {
    const addressHint = extractAddressFromUrl(input)
    const propertyLine = addressHint
      ? `Property: ${addressHint}\nSource URL: ${input}`
      : `URL: ${input}`
    prompt = `Look up this real estate listing and return ONLY raw JSON, no markdown:
${propertyLine}

Search for this property and a photo CDN URL. Return:
{"address":"street only","city":"","state":"ST","zip":"","price":0,"beds":0,"baths":0,"sqft":0,"acres":0.0,"year_built":0,"photo_url":"https://...","description":"1-2 sentences","highlights":["tag1","tag2"],"source_site":"zillow|redfin|realtor|homes|trulia","mls_number":"","listing_url":null}

listing_url must be null when a source URL was already provided. Null for unknown fields. Raw JSON only.`
  } else {
    prompt = `Search homes.com for this address and return ONLY raw JSON, no markdown:
Address: ${input}

Find the listing on homes.com. Return:
{"address":"street only","city":"","state":"ST","zip":"","price":0,"beds":0,"baths":0,"sqft":0,"acres":0.0,"year_built":0,"photo_url":"https://...","description":"1-2 sentences","highlights":["tag1","tag2"],"source_site":"homes","mls_number":"","listing_url":"https://www.homes.com/property/..."}

listing_url must be the full homes.com property URL if found, otherwise null. Null for unknown fields. Raw JSON only.`
  }

  const response = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err?.error?.message || 'Claude API error')
  }

  const data = await response.json()
  const textBlock = data.content?.find(b => b.type === 'text')
  const raw = textBlock?.text || ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Could not parse listing data')
  return JSON.parse(jsonMatch[0])
}

async function geocodeAddress(address, city, state, zip) {
  const parts = [address, city, state, zip].filter(Boolean)
  if (!parts.length) return null

  const query = encodeURIComponent(parts.join(', '))
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=us`

  try {
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'Threshold/1.0' }
    })
    const data = await res.json()
    if (data?.[0]) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      }
    }
  } catch (e) {
    console.warn('Geocoding failed:', e)
  }
  return null
}

const TOKEN_ERROR_PHRASES = [
  "Claude stepped out for coffee. Briefly.",
  "The AI is momentarily house-hunting for itself.",
  "Our listing genie needs a quick recharge.",
  "Even robots need a snack break.",
  "The scout is catching their breath.",
  "Too many houses, not enough horsepower. One moment.",
]

function isTokenError(message) {
  const m = (message || '').toLowerCase()
  return m.includes('rate') || m.includes('limit') || m.includes('overload') ||
    m.includes('capacity') || m.includes('token') || m.includes('quota') ||
    m.includes('529') || m.includes('429')
}

const LOADING_PHRASES = [
  'Bribing Zillow for intel...',
  'Asking the neighbors...',
  'Checking if it floods...',
  'Counting the closets...',
  'Googling the commute...',
  'Sniffing out the HOA fees...',
  'Checking school ratings...',
  'Measuring the backyard...',
  'Peeking in the windows...',
  'Running the numbers...',
]

export default function AddListing({ listId, onAdded }) {
  const { user } = useAuth()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [error, setError] = useState(null)
  const [tokenPhrase, setTokenPhrase] = useState(null)
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef(null)

  useEffect(() => {
    if (countdown <= 0) return
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); setTokenPhrase(null); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(countdownRef.current)
  }, [countdown])

  const startPhrases = () => {
    const pick = () => LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)]
    setPhrase(pick())
    const interval = setInterval(() => setPhrase(pick()), 2500)
    return interval
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const phraseInterval = startPhrases()

    try {
      const urlInput = isUrl(url)

      // For URL inputs, check duplicate before hitting the API
      if (urlInput) {
        const { data: existing } = await supabase
          .from('homes')
          .select('id, address')
          .eq('list_id', listId)
          .eq('url', url)
          .limit(1)
        if (existing && existing.length > 0) {
          throw new Error(`This listing is already on your list${existing[0].address ? ` (${existing[0].address})` : ''}.`)
        }
      }

      const data = await fetchListingData(url)
      const resolvedUrl = (!urlInput && data.listing_url) ? data.listing_url : url

      // For address inputs, check duplicate against the resolved homes.com URL
      if (!urlInput && resolvedUrl !== url) {
        const { data: existing } = await supabase
          .from('homes')
          .select('id, address')
          .eq('list_id', listId)
          .eq('url', resolvedUrl)
          .limit(1)
        if (existing && existing.length > 0) {
          throw new Error(`This listing is already on your list${existing[0].address ? ` (${existing[0].address})` : ''}.`)
        }
      }

      const coords = await geocodeAddress(data.address, data.city, data.state, data.zip)

      const { error: dbError } = await supabase
        .from('homes')
        .insert({
          list_id: listId,
          added_by: user.id,
          url: resolvedUrl,
          address: data.address || url,
          city: data.city,
          state: data.state,
          zip: data.zip,
          price: data.price,
          beds: data.beds,
          baths: data.baths,
          sqft: data.sqft,
          acres: data.acres,
          year_built: data.year_built,
          photo_url: data.photo_url,
          description: data.description,
          highlights: data.highlights,
          source_site: data.source_site,
          mls_number: data.mls_number ?? null,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        })

      if (dbError) throw new Error(dbError.message)

      setUrl('')
      onAdded()
    } catch (err) {
      if (isTokenError(err.message)) {
        setTokenPhrase(TOKEN_ERROR_PHRASES[Math.floor(Math.random() * TOKEN_ERROR_PHRASES.length)])
        setCountdown(30)
      } else {
        setError(err.message)
      }
    }

    clearInterval(phraseInterval)
    setPhrase('')
    setLoading(false)
  }

  return (
    <div className="add-listing-bar">
      <form onSubmit={handleSubmit} className="add-listing-form">
        <input
          type="text"
          placeholder="Paste a listing URL or enter an address..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          className="listing-url-input"
        />
        <button type="submit" className="btn-add-submit" disabled={loading || !url || countdown > 0}>
          {loading ? 'Fetching...' : countdown > 0 ? `Wait ${countdown}s` : 'Add'}
        </button>
      </form>
      {loading && phrase && (
        <p className="add-loading-phrase">{phrase}</p>
      )}
      {tokenPhrase && (
        <div className="add-token-error">
          <p className="add-token-phrase">{tokenPhrase}</p>
          <p className="add-token-retry">Try again in {countdown}s</p>
        </div>
      )}
      {error && <p className="add-error">{error}</p>}
    </div>
  )
}