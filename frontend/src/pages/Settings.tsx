import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from './Dashboard';
import MagneticButton from '@/components/MagneticButton';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getConnections, revokeConnection, 
  getUserProfile, updateUserProfile, 
  deleteAccount, revokeAllConnections 
} from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UserPreferences {
  tokenExpiry: string;
  stepUpAuth: boolean;
  mentorDelegation: boolean;
  darkMode: boolean;
}

const STORAGE_KEY = 'delivervault-preferences';

function loadPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return {
    tokenExpiry: '24h',
    stepUpAuth: true,
    mentorDelegation: true,
    darkMode: document.documentElement.classList.contains('dark'),
  };
}

function savePreferences(prefs: UserPreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export default function Settings() {
  const { user, isDemo, logout } = useAuth();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState('');
  const [prefs, setPrefs] = useState<UserPreferences>({
    tokenExpiry: '24h',
    stepUpAuth: true,
    mentorDelegation: true,
    darkMode: document.documentElement.classList.contains('dark'),
  });
  
  const [saved, setSaved] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);

  // ─── Fetch Profile ───
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: getUserProfile,
    enabled: !isDemo,
  });

  // Sync state with fetched profile
  useEffect(() => {
    if (profileData?.user) {
      setDisplayName(profileData.user.name || '');
      setPrefs({
        tokenExpiry:      profileData.user.tokenExpiry || '24h',
        stepUpAuth:       profileData.user.stepUpAuth ?? true,
        mentorDelegation: profileData.user.mentorDelegation ?? true,
        darkMode:         profileData.user.darkMode ?? false,
      });
    } else if (user?.name) {
      setDisplayName(user.name);
    }
  }, [profileData, user]);

  // Sync dark mode class
  useEffect(() => {
    if (prefs.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [prefs.darkMode]);

  const updatePref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  // ─── Mutations ───
  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => updateUserProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      setSaved(true);
      toast.success('Settings saved successfully');
      setTimeout(() => setSaved(false), 2500);
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const revokeAllMutation = useMutation({
    mutationFn: revokeAllConnections,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      toast.success('All tokens revoked successfully');
      setRevokeLoading(false);
      setRevokeDialogOpen(false);
    },
    onError: () => {
      toast.error('Failed to revoke tokens');
      setRevokeLoading(false);
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success('Account deleted successfully');
      logout();
    },
    onError: () => toast.error('Failed to delete account'),
  });

  const handleSave = useCallback(() => {
    if (isDemo) {
      localStorage.setItem('delivervault-preferences', JSON.stringify(prefs));
      if (displayName) localStorage.setItem('delivervault-display-name', displayName);
      setSaved(true);
      toast.success('Settings saved (demo)');
      setTimeout(() => setSaved(false), 2500);
    } else {
      updateProfileMutation.mutate({ name: displayName, ...prefs });
    }
  }, [prefs, displayName, isDemo, updateProfileMutation]);

  const handleRevokeAll = useCallback(() => {
    setRevokeLoading(true);
    if (isDemo) {
      setTimeout(() => {
        toast.success('Tokens revoked (demo)');
        setRevokeLoading(false);
        setRevokeDialogOpen(false);
      }, 1000);
    } else {
      revokeAllMutation.mutate();
    }
  }, [isDemo, revokeAllMutation]);

  const handleDeleteAccount = useCallback(() => {
    setDeleteDialogOpen(false);
    if (isDemo) {
      toast.info('Account deletion simulated in demo mode');
      logout();
    } else {
      deleteAccountMutation.mutate();
    }
  }, [isDemo, deleteAccountMutation, logout]);

  const userName = user?.name || displayName || 'User';
  const userEmail = user?.email || 'user@delivervault.dev';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const ToggleSwitch = ({ checked, onChange, label, description }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description: string;
  }) => (
    <div className="flex items-center justify-between">
      <div className="pr-4">
        <div className="font-body text-sm" style={{ color: 'hsl(var(--ink))' }}>{label}</div>
        <div className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="w-10 h-5 rounded-full relative cursor-pointer transition-colors duration-200 flex-shrink-0"
        style={{ background: checked ? 'hsl(var(--accent))' : 'hsl(var(--border))' }}
        role="switch"
        aria-checked={checked}
        aria-label={label}>
        <motion.div
          className="absolute top-0.5 w-4 h-4 rounded-full"
          style={{ background: 'white' }}
          animate={{ left: checked ? 20 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
      </button>
    </div>
  );

  return (
    <DashboardLayout title="Settings">
      <div className="space-y-6 max-w-[680px]">
        {/* Profile */}
        <motion.div className="border rounded-xl p-6" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h4 className="font-body text-sm font-semibold mb-4" style={{ color: 'hsl(var(--ink))' }}>Profile</h4>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-mono text-lg"
              style={{ background: 'hsl(var(--accent-light))', color: 'hsl(var(--accent))' }}>
              {userInitials}
            </div>
            <div>
              <div className="font-body text-base font-semibold" style={{ color: 'hsl(var(--ink))' }}>{userName}</div>
              <div className="font-body text-sm" style={{ color: 'hsl(var(--ink-tertiary))' }}>{userEmail}</div>
              {isDemo && (
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full inline-block mt-1"
                  style={{ background: 'hsl(var(--dv-success) / 0.15)', color: 'hsl(var(--dv-success))' }}>
                  DEMO MODE
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-body text-sm font-medium block mb-1.5" style={{ color: 'hsl(var(--ink))' }}>Display name</label>
              <input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 font-body text-sm focus:outline-none focus:ring-1 transition-shadow"
                style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--ink))', '--tw-ring-color': 'hsl(var(--accent) / 0.3)' } as React.CSSProperties}
              />
            </div>
            <div>
              <label className="font-body text-sm font-medium block mb-1.5" style={{ color: 'hsl(var(--ink))' }}>Email</label>
              <input defaultValue={userEmail} disabled
                className="w-full border rounded-lg px-3 py-2.5 font-body text-sm opacity-60"
                style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--ink))' }} />
            </div>
          </div>
        </motion.div>

        {/* Preferences */}
        <motion.div className="border rounded-xl p-6" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-surface))' }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <h4 className="font-body text-sm font-semibold mb-4" style={{ color: 'hsl(var(--ink))' }}>Preferences</h4>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <div className="font-body text-sm" style={{ color: 'hsl(var(--ink))' }}>Token auto-expiry</div>
                <div className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>How long tokens remain active</div>
              </div>
              <select value={prefs.tokenExpiry} onChange={e => updatePref('tokenExpiry', e.target.value)}
                className="border rounded-lg px-3 py-2 font-mono text-sm focus:outline-none flex-shrink-0"
                style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-primary))', color: 'hsl(var(--ink))' }}>
                <option value="1h">1 hour</option>
                <option value="6h">6 hours</option>
                <option value="12h">12 hours</option>
                <option value="24h">24 hours</option>
              </select>
            </div>

            <ToggleSwitch
              checked={prefs.stepUpAuth}
              onChange={v => updatePref('stepUpAuth', v)}
              label="Step-up authentication"
              description="Require push confirmation before sending"
            />

            <ToggleSwitch
              checked={prefs.mentorDelegation}
              onChange={v => updatePref('mentorDelegation', v)}
              label="Mentor delegation"
              description="Allow delegating proposals for review"
            />

            <ToggleSwitch
              checked={prefs.darkMode}
              onChange={v => updatePref('darkMode', v)}
              label="Dark mode"
              description="Toggle dark theme appearance"
            />
          </div>
        </motion.div>

        {/* Danger zone */}
        <motion.div className="border rounded-xl p-6" style={{ borderColor: 'hsl(var(--dv-danger) / 0.3)', background: 'hsl(var(--dv-danger) / 0.04)' }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h4 className="font-body text-sm font-semibold mb-4" style={{ color: 'hsl(var(--dv-danger))' }}>Danger Zone</h4>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="font-body text-sm" style={{ color: 'hsl(var(--ink))' }}>Revoke all tokens</div>
                <div className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Disconnect all services and revoke all active tokens</div>
              </div>
              <button
                onClick={() => setRevokeDialogOpen(true)}
                className="font-body text-sm px-4 py-2 rounded-lg border flex-shrink-0 transition-colors"
                style={{ borderColor: 'hsl(var(--dv-danger))', color: 'hsl(var(--dv-danger))' }}
                onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--dv-danger) / 0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                Revoke all tokens
              </button>
            </div>
            <div className="border-t pt-4" style={{ borderColor: 'hsl(var(--dv-danger) / 0.2)' }}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="font-body text-sm" style={{ color: 'hsl(var(--ink))' }}>Delete account</div>
                  <div className="font-body text-xs" style={{ color: 'hsl(var(--ink-tertiary))' }}>Permanently delete your account and all data</div>
                </div>
                <button
                  onClick={() => setDeleteDialogOpen(true)}
                  className="font-body text-sm px-4 py-2 rounded-lg border flex-shrink-0 transition-colors"
                  style={{ borderColor: 'hsl(var(--dv-danger))', color: 'hsl(var(--dv-danger))' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--dv-danger) / 0.08)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  Delete account
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="flex justify-end">
          <MagneticButton onClick={handleSave}>
            {saved ? 'Saved ✓' : 'Save changes'}
          </MagneticButton>
        </div>
      </div>

      {/* Delete Account Confirmation */}
      <AnimatePresence>
        {deleteDialogOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setDeleteDialogOpen(false)} />
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="relative z-10 w-full max-w-[400px] rounded-2xl p-6"
              style={{ background: 'hsl(var(--bg-primary))', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              <div className="text-center">
                <div className="text-3xl mb-3">🗑️</div>
                <h4 className="font-body text-base font-semibold mb-2" style={{ color: 'hsl(var(--ink))' }}>Delete Account</h4>
                <p className="font-body text-sm mb-6" style={{ color: 'hsl(var(--ink-secondary))' }}>
                  This action is permanent. All your proposals, connections, and data will be deleted.
                </p>
                <div className="flex gap-3 justify-center">
                  <motion.button onClick={handleDeleteAccount} className="font-body text-sm px-4 py-2 rounded-lg text-white"
                    style={{ background: 'hsl(var(--dv-danger))' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    Yes, delete
                  </motion.button>
                  <motion.button onClick={() => setDeleteDialogOpen(false)} className="font-body text-sm px-4 py-2 rounded-lg border"
                    style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                    whileHover={{ borderColor: 'hsl(var(--accent))' }}>Cancel</motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Revoke All Tokens Confirmation */}
      <AnimatePresence>
        {revokeDialogOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} onClick={() => !revokeLoading && setRevokeDialogOpen(false)} />
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="relative z-10 w-full max-w-[400px] rounded-2xl p-6"
              style={{ background: 'hsl(var(--bg-primary))', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
              <div className="text-center">
                <motion.div className="text-3xl mb-3" animate={revokeLoading ? { rotate: [0, 360] } : {}} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>⚠️</motion.div>
                <h4 className="font-body text-base font-semibold mb-2" style={{ color: 'hsl(var(--ink))' }}>Revoke All Tokens</h4>
                <p className="font-body text-sm mb-6" style={{ color: 'hsl(var(--ink-secondary))' }}>
                  {revokeLoading ? 'Revoking all active tokens…' : 'This will disconnect all services and revoke all active tokens.'}
                </p>
                <div className="flex gap-3 justify-center">
                  <motion.button onClick={handleRevokeAll} disabled={revokeLoading}
                    className="font-body text-sm px-4 py-2 rounded-lg text-white disabled:opacity-70"
                    style={{ background: 'hsl(var(--dv-danger))' }} whileHover={{ scale: revokeLoading ? 1 : 1.02 }} whileTap={{ scale: revokeLoading ? 1 : 0.98 }}>
                    {revokeLoading ? 'Revoking…' : 'Yes, revoke all'}
                  </motion.button>
                  <motion.button onClick={() => setRevokeDialogOpen(false)} disabled={revokeLoading}
                    className="font-body text-sm px-4 py-2 rounded-lg border disabled:opacity-50"
                    style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--ink-secondary))' }}
                    whileHover={{ borderColor: 'hsl(var(--accent))' }}>Cancel</motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
