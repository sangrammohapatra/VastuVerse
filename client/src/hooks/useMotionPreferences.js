import { useReducedMotion } from 'framer-motion';

/**
 * Single source of truth for motion preferences across VastuVerse.
 *
 *   const { reduced, fade, slideUp, scale, transition } = useMotionPreferences();
 *
 *   <motion.div {...fade}>...</motion.div>
 *   <motion.div {...slideUp(0.2)}>...</motion.div>     // 0.2s stagger delay
 *   <motion.button {...scale}>...</motion.button>
 *
 * When the user has `prefers-reduced-motion: reduce` set (or has toggled
 * Reduce Motion in OS settings), `reduced` is true and the variants
 * degrade to instant transitions — components keep working, they just
 * skip the animation. Opacity changes still happen because they don't
 * trigger vestibular reactions.
 *
 * Why not call useReducedMotion() inline in every component?
 *   - Centralizing here gives consistent durations + easings everywhere
 *   - Future-proofs against design tweaks (one place to retune)
 *   - Lets us export pre-baked variants so callers can spread instead
 *     of constructing motion props from scratch
 */
export function useMotionPreferences() {
  const reduced = useReducedMotion();

  /** Standard ease (matches the curve used across the wizard / dashboard). */
  const easing = [0.22, 1, 0.36, 1];

  const baseTransition = (duration = 0.45, delay = 0) =>
    reduced
      ? { duration: 0, delay: 0 }
      : { duration, delay, ease: easing };

  /** Plain fade in/out — never reduced because opacity is harmless. */
  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit:    { opacity: 0 },
    transition: baseTransition(0.3),
  };

  /** Slide up + fade. Degrades to a plain fade when reduced. */
  const slideUp = (delay = 0) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 16 },
    animate: reduced ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit:    reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    transition: baseTransition(0.45, delay),
  });

  /** Slide from left. Degrades to fade. */
  const slideLeft = (delay = 0) => ({
    initial: reduced ? { opacity: 0 } : { opacity: 0, x: -20 },
    animate: reduced ? { opacity: 1 } : { opacity: 1, x: 0 },
    transition: baseTransition(0.35, delay),
  });

  /** Scale pop (notification badges, success ticks). Reduced → instant. */
  const scale = {
    initial: reduced ? { scale: 1 } : { scale: 0.7, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit:    reduced ? { opacity: 0 } : { scale: 0.7, opacity: 0 },
    transition: baseTransition(0.35),
  };

  /** Staggered list (use on parent; children get fade). */
  const stagger = (gap = 0.06) => ({
    initial: 'hidden',
    animate: 'show',
    variants: {
      hidden: {},
      show: {
        transition: {
          staggerChildren: reduced ? 0 : gap,
          delayChildren: reduced ? 0 : 0.05,
        },
      },
    },
  });

  /** Stagger item — pair with the `stagger()` parent above. */
  const staggerItem = {
    variants: {
      hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 12 },
      show:   { opacity: 1, y: 0 },
    },
    transition: baseTransition(0.4),
  };

  /** Spring (snappy interactive feedback). Reduced → no movement. */
  const spring = reduced
    ? { type: 'tween', duration: 0 }
    : { type: 'spring', stiffness: 380, damping: 30 };

  return {
    reduced,
    fade,
    slideUp,
    slideLeft,
    scale,
    stagger,
    staggerItem,
    spring,
    transition: baseTransition,
  };
}

export default useMotionPreferences;
