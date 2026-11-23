import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
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

  // 1. Check for Public Client Submission Route: /submit/:token or #/submit/:token or ?token=:token
  let clientToken = null;
  const path = currentRoute.pathname;
  const hash = currentRoute.hash;
  const params = new URLSearchParams(currentRoute.search);

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

  // 2. Unauthenticated -> Login Page
  if (!session) {
    return <LoginPage />;
  }

  // 3. Authenticated -> Navigation & Role Specific Views
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
