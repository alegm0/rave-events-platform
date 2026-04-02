import './Card.css'

const Card = ({ 
  children, 
  variant = 'default',
  hover = false,
  className = '',
  onClick 
}) => {
  return (
    <div 
      className={`card card-${variant} ${hover ? 'card-hover' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export default Card
