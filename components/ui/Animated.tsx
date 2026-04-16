'use client'

import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'

/* ─── Fade-in + slide-up page wrapper with staggered children ─── */

const pageVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
}

const childVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

export function AnimatedPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function AnimatedSection({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={childVariants} className={className}>
      {children}
    </motion.div>
  )
}

/* ─── Staggered grid for cards ─── */

const gridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const gridItemVariants: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: 'easeOut' } },
}

export function AnimatedGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={gridVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function AnimatedGridItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={gridItemVariants} className={className}>
      {children}
    </motion.div>
  )
}

/* ─── Interactive card with hover lift + glow ─── */

export function HoverCard({
  children,
  className,
  onClick,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(230,57,70,0.15)' }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2 }}
      className={className}
      onClick={onClick}
    >
      {children}
    </motion.div>
  )
}

/* ─── Count-up number animation ─── */

export function CountUp({
  value,
  duration = 0.8,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (value === 0) { setDisplay(0); return }

    const start = performance.now()
    const from = 0

    function tick(now: number) {
      const elapsed = (now - start) / 1000
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (value - from) * eased))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [value, duration])

  return <span className={className}>{prefix}{display}{suffix}</span>
}

/* ─── Skeleton loader with shimmer ─── */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-surface-hover ${className || ''}`} />
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-surface-border bg-surface-card p-6 space-y-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  )
}

export function SkeletonPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="rounded-lg border border-surface-border bg-surface-card p-6 space-y-3">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}

/* ─── Tab content transition ─── */

export function AnimatedTab({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={id}
        initial={{ opacity: 0, x: 8 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -8 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/* ─── Pulse for overdue/warning badges ─── */

export function PulseBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.span
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      className={className}
    >
      {children}
    </motion.span>
  )
}

/* ─── Modal animation wrapper ─── */

export function AnimatedModal({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

/* ─── Kanban-specific animations ─── */

export const kanbanCardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.25, ease: 'easeOut' },
  }),
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
}

export function KanbanCard({
  children,
  index = 0,
  isDragging = false,
  className,
}: {
  children: ReactNode
  index?: number
  isDragging?: boolean
  className?: string
}) {
  return (
    <motion.div
      custom={index}
      variants={kanbanCardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover={!isDragging ? { y: -2, boxShadow: '0 6px 20px rgba(0,0,0,0.25)' } : undefined}
      style={isDragging ? { scale: 1.03, boxShadow: '0 12px 32px rgba(0,0,0,0.4)', zIndex: 50 } : undefined}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function KanbanColumnDrop({
  isOver,
  children,
  className,
}: {
  isOver: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      animate={isOver ? { borderColor: 'rgba(230, 57, 70, 0.5)', backgroundColor: 'rgba(230, 57, 70, 0.05)' } : {}}
      transition={{ duration: 0.2 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─── Done / completion celebration ─── */

export function CompletionCheck({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success text-white"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
