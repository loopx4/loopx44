import React, { createContext, useContext, useState, useEffect } from 'react';
import { authenticateUser, fetchServerSession, logoutServerSession } from '../config/auth.config';

const AuthContext = createContext(null);
const PROFILE_KEY = 'loopx_selected_profile';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [activeProfile, setActiveProfile] = useState(() => {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Verify server-issued session on initial mount
  useEffect(() => {
    let isMounted = true;

    async function checkServerSession() {
      try {
        const verifiedSession = await fetchServerSession();
        if (isMounted) {
          if (verifiedSession && verifiedSession.role) {
            setSession(verifiedSession);
          } else {
            setSession(null);
          }
        }
      } catch {
        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkServerSession();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Logs in with username & password via the secure backend API.
   * On success, backend sets an httpOnly session cookie and returns user session.
   */
  const login = async (username, password) => {
    const result = await authenticateUser(username, password);
    if (result.success) {
      const newSession = {
        role: result.role,
        username: result.username,
        displayName: result.displayName,
        permissions: result.permissions
      };
      setSession(newSession);

      // If owner logs in, clear any previously selected employee profile
      if (result.role === 'owner') {
        setActiveProfile(null);
        localStorage.removeItem(PROFILE_KEY);
      }
      return { success: true, role: result.role };
    }
    return { success: false, error: result.error };
  };

  const selectEmployeeProfile = (profile) => {
    setActiveProfile(profile);
    if (profile) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_KEY);
    }
  };

  /**
   * Terminates session on the backend and clears client state.
   */
  const logout = async () => {
    await logoutServerSession();
    setSession(null);
    setActiveProfile(null);
    localStorage.removeItem(PROFILE_KEY);
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted, #888888)',
          fontSize: '14px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
        }}
      >
        Authenticating...
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        activeProfile,
        isOwner: session?.role === 'owner',
        isEmployee: session?.role === 'employee',
        login,
        logout,
        selectEmployeeProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
