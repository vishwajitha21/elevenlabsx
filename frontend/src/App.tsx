import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from 'framer-motion';
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from '@/contexts/AuthContext';
import PageLoader from '@/components/PageLoader';
import CursorTrailer from '@/components/CursorTrailer';
import { useAuth0 } from '@auth0/auth0-react';
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import MentorApproval from "./pages/MentorApproval.tsx";
import AuditLog from "./pages/AuditLog.tsx";
import Connections from "./pages/Connections.tsx";
import Settings from "./pages/Settings.tsx";
import Proposals from "./pages/Proposals.tsx";
import Admin from "./pages/Admin.tsx";
import SharedProposal from "./pages/SharedProposal.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function LandingCursor() {
  const location = useLocation();
  if (location.pathname !== '/') return null;
  return <CursorTrailer />;
}

function AuthCallback() {
  const { isLoading, error } = useAuth0();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading && !error) {
      navigate('/dashboard', { replace: true });
    }
  }, [isLoading, error, navigate]);
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      Auth error: {error.message}
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', color: '#888' }}>
      Completing login…
    </div>
  );
}

/**
 * Routes — No auth guards.
 *
 * In demo mode (no Auth0 env vars), AuthContext automatically provides
 * an admin demo user, so all pages are freely accessible.
 *
 * When Auth0 IS configured, the login page handles redirect flow.
 * Dashboard pages are still accessible as routes — individual pages
 * can check `useAuth().isAuthenticated` if they need to.
 */
function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/audit" element={<AuditLog />} />
        <Route path="/dashboard/connections" element={<Connections />} />
        <Route path="/dashboard/settings" element={<Settings />} />
        <Route path="/dashboard/proposals" element={<Proposals />} />
        <Route path="/callback" element={<AuthCallback />} />
        <Route path="/share/:token" element={<SharedProposal />} />
        <Route path="/mentor/:token" element={<MentorApproval />} />
        {/* <Route path="/admin" element={<Admin />} /> */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 1800);
    return () => clearTimeout(t);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          {!loaded && <PageLoader />}
          <BrowserRouter>
            <LandingCursor />
            <AnimatedRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
