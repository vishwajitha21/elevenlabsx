import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'hsl(var(--bg-primary))' }}
    >
      <div className="text-center px-6">
        <div className="font-display text-8xl font-bold mb-4" style={{ color: 'hsl(var(--accent))' }}>404</div>
        <h1 className="font-display text-2xl mb-3" style={{ color: 'hsl(var(--ink))' }}>Page not found</h1>
        <p className="font-body text-sm mb-8" style={{ color: 'hsl(var(--ink-secondary))' }}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 font-body text-sm px-5 py-2.5 rounded-lg border transition-colors"
          style={{ borderColor: 'hsl(var(--accent))', color: 'hsl(var(--accent))' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Return to Home
        </Link>
      </div>
    </motion.div>
  );
};

export default NotFound;
