export default function PropertyCard({ home, rank }) {
  const formatPrice = (p) => p ? '$' + p.toLocaleString() : 'Price N/A'

  return (
    <div className="card">
      <div className="card-img">
        {home.photo_url
          ? <img src={home.photo_url} alt={home.address} />
          : <div className="card-img-placeholder" />
        }
        <div className="rank-badge">#{rank}</div>
      </div>
      <div className="card-body">
        <div className="drag-dots">
          <div className="drag-dot"></div><div className="drag-dot"></div>
          <div className="drag-dot"></div><div className="drag-dot"></div>
          <div className="drag-dot"></div><div className="drag-dot"></div>
        </div>
        <div className="card-top">
          <div className="card-address-block">
            <div className="card-address">{home.address}</div>
            <div className="card-city">{[home.city, home.state, home.zip].filter(Boolean).join(', ')}</div>
          </div>
          <div className="card-price">{formatPrice(home.price)}</div>
        </div>
        <div className="card-stats">
          <div className="stat-cell">
            <span className="stat-val">{home.beds ?? '—'}</span>
            <span className="stat-lbl">Beds</span>
          </div>
          <div className="stat-cell">
            <span className="stat-val">{home.baths ?? '—'}</span>
            <span className="stat-lbl">Baths</span>
          </div>
          <div className="stat-cell">
            <span className="stat-val">{home.sqft ? home.sqft.toLocaleString() : '—'}</span>
            <span className="stat-lbl">Sq Ft</span>
          </div>
          <div className="stat-cell">
            <span className="stat-val">{home.year_built ?? '—'}</span>
            <span className="stat-lbl">Built</span>
          </div>
        </div>
        <div className="score-row">
          <span className="score-who">You</span>
          <div class="bar-track"><div className="bar-fill" style={{width: '50%'}}></div></div>
          <span className="score-rank">#{rank}</span>
        </div>
        <div className="card-source">
          <a href={home.url} target="_blank" rel="noreferrer" className="source-link">
            View on {home.source_site || 'listing site'} →
          </a>
        </div>
      </div>
    </div>
  )
}
