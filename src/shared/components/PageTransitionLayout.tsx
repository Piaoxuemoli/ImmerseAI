import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'

const variants = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
}

export function PageTransitionLayout() {
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.key}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: 0.25, ease: 'easeInOut' }}
        style={{ minHeight: '100vh' }}
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}
