import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

async function fetchListingData(url) {
  const prompt = `Search for this real estate listing and return structured data.

URL: ${url}

Steps:
1. Search for the property using the URL to identify the address
2. Search for that address on Zillow or Redfin to find a photo URL
3. Return ONLY this JSON (no markdown, no explanation):
{
  "address": "street address only",
  "city": "City",
  "state": "ST",
  "zip": "00000",
  "price": 000000,
  "beds": 0,
  "baths": 0,
  "sqft": 0,
  "acres": 0.0,
  "year_built": 0000,
  "photo_url": "direct image URL from photos.zillowstatic.com or ssl.cdn-redfin.com",
  "description": "2-3 sentence description",
  "highlights": ["up to 4 short feature tags"],
  "source_site": "zillow | redfin | realtor | homes | trulia",
  "mls_number": "MLS number as a string e.g. 1327198"
}

For photo_url specifically: search Zillow or Redfin for this address, find a listing photo, and return the direct CDN image URL. These typically look like https://photos.zillowstatic.com/fp/... or https://ssl.cdn-redfin.com/...
Set any unknown fields to null. Return ONLY the raw JSON.`

  const response = await fetch('https://threshold-parser.lordbizness1234.workers.dev/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
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
