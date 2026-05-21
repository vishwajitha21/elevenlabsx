import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import MagneticButton from '@/components/MagneticButton';

export default function Login() {
  const { isAuthenticated, isLoading, isDemo, isAdmin, loginWithRedirect } = useAuth();
  const navigate = useNavigate();

  // In demo mode or already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'hsl(var(--bg-primary))' }}
    >
      {/* Background effects */}
      <motion.div className="absolute w-[600px] h-[600px] rounded-full opacity-[0.04] blur-[160px]"
        style={{ background: 'hsl(var(--accent))', top: '-20%', right: '-10%' }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 20, repeat: Infinity }}
      />

      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="w-full max-w-[420px] mx-4"
      >
        <div className="border rounded-2xl p-8 md:p-10"
          style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))', boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}>
          
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg border flex items-center justify-center"
              style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))' }}>
              <span className="font-mono text-sm font-bold" style={{ color: 'hsl(var(--accent))' }}>DV</span>
            </div>
            <div>
              <span className="font-display text-lg" style={{ color: 'hsl(var(--ink))' }}>DeliverVault</span>
              <div className="font-mono text-[9px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>Consent-chained proposals</div>
            </div>
          </div>

          <h2 className="font-display text-2xl mb-2" style={{ color: 'hsl(var(--ink))' }}>Welcome back</h2>
          <p className="font-body text-sm mb-8" style={{ color: 'hsl(var(--ink-secondary))' }}>
            Sign in to manage your consent-chained proposal workflows.
          </p>

          {/* Demo Mode Banner */}
          {isDemo && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border rounded-xl p-4 mb-6"
              style={{
                borderColor: 'hsl(var(--dv-success) / 0.3)',
                background: 'hsl(var(--dv-success) / 0.06)',
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'hsl(var(--dv-success) / 0.15)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--dv-success))" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <span className="font-body text-sm font-semibold" style={{ color: 'hsl(var(--dv-success))' }}>Admin Mode</span>
              </div>
              <p className="font-body text-xs" style={{ color: 'hsl(var(--ink-secondary))' }}>
                Running in demo mode — no authentication required. You have full admin access to all features.
              </p>
            </motion.div>
          )}

          {/* Demo mode: Enter as Admin button */}
          {isDemo && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <MagneticButton onClick={() => navigate('/dashboard')} className="w-full mb-4">
                <span className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Enter as Admin
                </span>
              </MagneticButton>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-[1px]" style={{ background: 'hsl(var(--border))' }} />
                <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>OR</span>
                <div className="flex-1 h-[1px]" style={{ background: 'hsl(var(--border))' }} />
              </div>
            </motion.div>
          )}

          {/* Auth0 login button — only show when Auth0 is configured */}
          {!isDemo && (
            <>
              <MagneticButton loading={isLoading} onClick={() => loginWithRedirect()} className="w-full">
                <span className="flex items-center justify-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Sign in securely
                </span>
              </MagneticButton>

              <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 h-[1px]" style={{ background: 'hsl(var(--border))' }} />
                <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--ink-tertiary))' }}>OR</span>
                <div className="flex-1 h-[1px]" style={{ background: 'hsl(var(--border))' }} />
              </div>

              {/* Social providers */}
              <div className="grid grid-cols-2 gap-3 mt-6">
                {[
                  { label: 'Google', icon: 'G' },
                  { label: 'GitHub', icon: 'GH' },
                ].map(provider => (
                  <motion.button key={provider.label}
                    onClick={() => loginWithRedirect()}
                    className="flex items-center justify-center gap-2 border rounded-xl py-3 font-body text-sm transition-colors"
                    style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                    whileHover={{ borderColor: 'hsl(var(--accent))', y: -1 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="font-mono text-xs font-bold" style={{ color: 'hsl(var(--accent))' }}>{provider.icon}</span>
                    {provider.label}
                  </motion.button>
                ))}
              </div>
            </>
          )}

          {/* Demo mode info links */}
          {isDemo && (
            <div className="mt-4 space-y-2">
              <motion.button
                onClick={() => navigate('/admin')}
                className="w-full flex items-center justify-between border rounded-xl py-3 px-4 font-body text-sm transition-colors"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                whileHover={{ borderColor: 'hsl(var(--accent))', y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold" style={{ color: 'hsl(var(--dv-danger))' }}>ADM</span>
                  Admin Panel
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </motion.button>

              <motion.button
                onClick={() => navigate('/')}
                className="w-full flex items-center justify-between border rounded-xl py-3 px-4 font-body text-sm transition-colors"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                whileHover={{ borderColor: 'hsl(var(--accent))', y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold" style={{ color: 'hsl(var(--ink-tertiary))' }}>←</span>
                  Back to Home
                </span>
              </motion.button>
            </div>
          )}

          <p className="font-body text-[11px] text-center mt-8" style={{ color: 'hsl(var(--ink-tertiary))' }}>
            {isDemo
              ? 'Demo mode active. All data is simulated. No real backend required.'
              : 'By signing in, you agree to our consent policies.\nAll tokens auto-expire after 24 hours.'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
