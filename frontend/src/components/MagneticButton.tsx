import React from 'react';
import { motion } from 'framer-motion';
import { useMagneticButton } from '@/hooks/useMagneticButton';

interface MagneticButtonProps {
  children: React.ReactNode;
  variant?: 'filled' | 'outlined';
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export default function MagneticButton({ children, variant = 'filled', onClick, className = '', disabled, loading }: MagneticButtonProps) {
  const { ref, springX, springY, handleMouseMove, handleMouseLeave } = useMagneticButton(8);

  const base = 'inline-flex items-center justify-center gap-2 font-body font-medium text-sm rounded-lg h-9 px-4 transition-colors duration-[120ms] select-none';
  const variants = {
    filled: 'bg-primary text-primary-foreground hover:opacity-90',
    outlined: 'border border-foreground text-foreground hover:bg-surface',
  };

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY, display: 'inline-block' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={onClick}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${className} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {loading ? <LoadingDots /> : children}
      </button>
    </motion.div>
  );
}

function LoadingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="inline-block w-1.5 h-1.5 rounded-full bg-current"
          animate={{ scale: [1, 1.4, 1] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}
