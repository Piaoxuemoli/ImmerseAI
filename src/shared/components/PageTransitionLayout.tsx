import { AnimatePresence, motion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import { TitleBar } from './TitleBar'

const variants = {
  initial: { opacity: 0, y: 8, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
}

export function PageTransitionLayout() {
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <div className="h-screen overflow-hidden">
      <TitleBar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.key}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          style={{ paddingTop: '36px', height: 'calc(100vh - 36px)' }}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
