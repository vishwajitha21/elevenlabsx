import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CursorTrailer() {
  const [visible, setVisible] = useState(false);
  const [hoverType, setHoverType] = useState<'default' | 'button' | 'card'>('default');
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const ringX = useSpring(cursorX, { stiffness: 150, damping: 15 });
  const ringY = useSpring(cursorY, { stiffness: 150, damping: 15 });

  useEffect(() => {
    // Hide on touch devices
    if (window.matchMedia('(hover: none)').matches) return;
    setVisible(true);

    const move = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const over = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('button, a, [role="button"]')) setHoverType('button');
      else if (target.closest('[data-cursor="card"]')) setHoverType('card');
      else setHoverType('default');
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseover', over);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseover', over);
    };
  }, [cursorX, cursorY]);

  if (!visible) return null;

  const ringSize = hoverType === 'card' ? 64 : hoverType === 'button' ? 48 : 28;
  const dotOpacity = hoverType === 'button' ? 0 : 1;

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full"
        style={{
          x: cursorX,
          y: cursorY,
          width: 8,
          height: 8,
          translateX: '-50%',
          translateY: '-50%',
          background: 'hsl(var(--accent))',
          opacity: dotOpacity,
          transition: 'opacity 120ms ease',
        }}
      />
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9998] rounded-full"
        style={{
          x: ringX,
          y: ringY,
          width: ringSize,
          height: ringSize,
          translateX: '-50%',
          translateY: '-50%',
          border: '1px solid hsl(var(--accent))',
          background: hoverType === 'card' ? 'hsl(var(--accent) / 0.08)' : 'transparent',
          transition: 'width 200ms ease, height 200ms ease, background 200ms ease',
        }}
      />
    </>
  );
}
