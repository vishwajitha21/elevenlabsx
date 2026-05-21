import { useState, useCallback, useEffect, useRef } from 'react';

export function useScrambleText(text: string, duration: number = 800) {
  const [display, setDisplay] = useState(text);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const rafRef = useRef<number>(0);

  const scramble = useCallback(() => {
    const startTime = performance.now();
    const originalChars = text.split('');
    const totalChars = originalChars.length;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const result = originalChars.map((char, i) => {
        if (char === ' ') return ' ';
        const charProgress = progress * totalChars;
        if (i < charProgress - 2) return char;
        if (i < charProgress + 2) return chars[Math.floor(Math.random() * chars.length)];
        return char;
      });

      setDisplay(result.join(''));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(text);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [text, duration]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return { display, scramble };
}
