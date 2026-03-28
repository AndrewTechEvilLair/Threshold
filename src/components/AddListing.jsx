import { useState } from 'react'
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

async function fetchListingData(url) {
  const addressHint = extractAddressFromUrl(url)
  const propertyLine = addressHint
    ? `Property: ${addressHint}\nSource URL: ${url}`
    : `URL: ${url}`

  const prompt = `Look up this real estate listing and return ONLY raw JSON, no markdown:
${propertyLine}

Search Zillow/Redfin for this property and a photo CDN URL. Return:
{"address":"street only","city":"","state":"ST","zip":"","price":0,"beds":0,"baths":0,"sqft":0,"acres":0.0,"year_built":0,"photo_url":"https://photos.zillowstatic.com/... or https://ssl.cdn-redfin.com/...","description":"1-2 sentences","highlights":["tag1","tag2"],"source_site":"zillow|redfin|realtor|homes|trulia","mls_number":""}

Null for unknown fields. Raw JSON only.`

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
      // Check for duplicate before fetching listing data
      const { data: existing } = await supabase
        .from('homes')
        .select('id, address')
        .eq('list_id', listId)
        .eq('url', url)
        .limit(1)

      if (existing && existing.length > 0) {
        throw new Error(`This listing is already on your list${existing[0].address ? ` (${existing[0].address})` : ''}.`)
      }

      const data = await fetchListingData(url)
      const coords = await geocodeAddress(data.address, data.city, data.state, data.zip)

      const { error: dbError } = await supabase
        .from('homes')
        .insert({
          list_id: listId,
          added_by: user.id,
          url: url,
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
      setError(err.message)
    }

    clearInterval(phraseInterval)
    setPhrase('')
    setLoading(false)
  }

  return (
    <div className="add-listing-bar">
      <form onSubmit={handleSubmit} className="add-listing-form">
        <input
          type="url"
          placeholder="Paste a Zillow, Redfin, Realtor, Homes.com or Trulia URL..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          required
          className="listing-url-input"
        />
        <button type="submit" className="btn-add-submit" disabled={loading || !url}>
          {loading ? 'Fetching...' : 'Add'}
        </button>
      </form>
      {loading && phrase && (
        <p className="add-loading-phrase">{phrase}</p>
      )}
      {error && <p className="add-error">{error}</p>}
    </div>
  )
}