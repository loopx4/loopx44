/*
 * =============================================================================
 * LOOPX APPLICATION ROUTER & ACCESS CONTROLLER
 * src/App.jsx
 * =============================================================================
 * Route Hierarchy:
 * 1. Public Client Submission Portal: /submit/:token (No auth required)
 * 2. Public Homepage: / (Landing view with "Portal Login" action)
 * 3. Login Portal: /login (Unified authentication with auto role routing)
 * 4. Protected Executive Views (Login required):
 *    - Owner Dashboard: Only accessible with role === 'owner'
 *    - Employee Workspace: Only accessible with role === 'employee'
 *
 * Direct unauthenticated navigation to /owner or /employee automatically
 * redirects to the login screen, preserving protected status.
 * =============================================================================
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import PublicHomePage from './pages/PublicHomePage';
import LoginPage from './pages/LoginPage';
import ProfileSelector from './components/ProfileSelector';
import EmployeeWorkspace from './pages/EmployeeWorkspace';
import OwnerDashboard from './pages/OwnerDashboard';
import ClientSubmissionPage from './pages/ClientSubmissionPage';

export default function App() {
  const { session, activeProfile, isOwner, isEmployee } = useAuth();
  const [currentRoute, setCurrentRoute] = useState(() => {
    return {
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    };
  });

  // Client-side navigation helper
  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentRoute({
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    });
  };

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentRoute({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash
      });
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const path = currentRoute.pathname;
  const hash = currentRoute.hash;
  const params = new URLSearchParams(currentRoute.search);

  // 1. PUBLIC ROUTE: Client Submission Form (/submit/:token or #/submit/:token or ?token=...)
  let clientToken = null;
  if (path.startsWith('/submit/')) {
    clientToken = path.replace('/submit/', '').split('/')[0];
  } else if (hash.startsWith('#/submit/')) {
    clientToken = hash.replace('#/submit/', '').split('/')[0];
  } else if (params.get('token')) {
    clientToken = params.get('token');
  }

  if (clientToken) {
    return <ClientSubmissionPage token={clientToken} />;
  }

  // 2. AUTHENTICATED ROUTES: Protected Dashboards
  if (session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />

        <main style={{ flex: 1 }}>
          {isOwner && <OwnerDashboard />}

          {isEmployee && (
            activeProfile ? <EmployeeWorkspace /> : <ProfileSelector />
          )}
        </main>
      </div>
    );
  }

  // 3. UNAUTHENTICATED ROUTES
  // If user navigates explicitly to /login or #/login, or tries to access /owner or /employee:
  const isLoginPage = path === '/login' || hash === '#/login' || path === '/owner' || path === '/employee';

  if (isLoginPage) {
    return <LoginPage onBackToHome={() => navigateTo('/')} />;
  }

  // Default root path (/) opens the Public Homepage
  return <PublicHomePage onGoToLogin={() => navigateTo('/login')} />;
}
