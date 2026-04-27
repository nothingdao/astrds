// src/components/common/AvatarDisplay.tsx
import React from 'react'

interface AvatarDisplayProps {
  url: string | null | undefined
  address: string
  size?: number
  className?: string
}

const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  url,
  address,
  size = 32,
  className = '',
}) => {
  const initials = address ? address.slice(0, 2).toUpperCase() : '??'
  const fontSize = Math.max(8, Math.floor(size * 0.35))

  if (url) {
    return (
      <img
        src={url}
        alt='avatar'
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-primary font-mono flex-shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize }}
    >
      {initials}
    </div>
  )
}

export default AvatarDisplay
