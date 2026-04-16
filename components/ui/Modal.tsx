'use client'

import { cn } from '@/lib/utils'
import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        className={cn(
          'bg-surface-card rounded-lg shadow-lg border border-surface-border w-full max-w-lg mx-4',
          className
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-surface-border">
            <h3 className="text-base sm:text-lg font-medium text-gray-100">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300"
            >
              &times;
            </button>
          </div>
        )}
        <div className="px-4 sm:px-6 py-4 max-h-[calc(90vh-60px)] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
