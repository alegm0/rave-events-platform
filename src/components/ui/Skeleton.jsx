import './Skeleton.css'

export const Skeleton = ({ width, height, radius = 0, className = '' }) => (
  <div className={`skeleton ${className}`} style={{ width, height, borderRadius: radius }} />
)

export const EventCardSkeleton = () => (
  <div className="skel-event-card">
    <Skeleton height="220px" />
    <div style={{ padding: '1.25rem', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
      <div><Skeleton width="48px" height="48px" /></div>
      <div style={{ flex: 1 }}><Skeleton width="70%" height="14px" /><Skeleton width="50%" height="12px" className="skel-mt" /></div>
      <Skeleton width="50px" height="14px" />
    </div>
  </div>
)

export const TicketSkeleton = () => (
  <div className="skel-ticket">
    <Skeleton width="140px" height="120px" />
    <div style={{ flex: 1, padding: '1.25rem' }}>
      <Skeleton width="40%" height="12px" /><Skeleton width="70%" height="16px" className="skel-mt" />
      <Skeleton width="60%" height="12px" className="skel-mt" />
    </div>
    <div style={{ padding: '1.25rem' }}><Skeleton width="44px" height="44px" /></div>
  </div>
)
