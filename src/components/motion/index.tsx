"use client";

import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";

/**
 * Shared motion primitives. Every animation here respects
 * prefers-reduced-motion automatically via useReducedMotion().
 */

export const springy = { type: "spring", stiffness: 400, damping: 32, mass: 0.6 } as const;
export const springySoft = { type: "spring", stiffness: 300, damping: 30 } as const;

/** Fades + rises content in on mount. Wrap page bodies with this. */
export function FadeIn({
  children,
  delay = 0,
  y = 8,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springySoft, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Staggers a list of children in — use for grids of cards/KPIs. */
export function StaggerGroup({
  children,
  className = "",
  stagger = 0.05,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : stagger } },
  };
  return (
    <motion.div initial="hidden" animate="show" variants={container} className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const item: Variants = {
    hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: springySoft },
  };
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

/** A card/row that lifts gently on hover and presses down on tap. Opt-in. */
export function HoverLift({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      onClick={onClick}
      whileHover={reduce ? undefined : { y: -2, transition: springy }}
      whileTap={reduce ? undefined : { scale: 0.985 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Animated primary button — spring press feedback, works like a normal <button>. */
export function MotionButton({
  children,
  className = "",
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={reduce || disabled ? undefined : { scale: 1.015 }}
      whileTap={reduce || disabled ? undefined : { scale: 0.97 }}
      transition={springy}
      className={className}
    >
      {children}
    </motion.button>
  );
}

/** Wraps route content so navigating between pages cross-fades smoothly. */
export function RouteTransition({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: reduce ? 0 : 0.16, ease: [0.4, 0, 0.2, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** A soft pulsing placeholder for loading states. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-700 ${className}`} />;
}

/** A few stacked skeleton rows, e.g. for a table/list about to load. */
export function SkeletonRows({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 p-4 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A small celebratory checkmark burst — use after a successful save/submit. */
export function SuccessPulse({ show }: { show: boolean }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          initial={reduce ? { opacity: 1 } : { scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={springy}
          className="inline-block"
        >
          ✓
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export { motion, AnimatePresence, useReducedMotion };
