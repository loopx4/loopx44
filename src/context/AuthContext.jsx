import React, { createContext, useContext, useState, useEffect } from 'react';
import { authenticateUser } from '../config/auth.config';

const AuthContext = createContext(null);

const SESSION_KEY = 'loopx_auth_session';
const PROFILE_KEY = 'loopx_selected_profile';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [activeProfile, setActiveProfile] = useState(() => {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (username, password) => {
    const result = authenticateUser(username, password);
    if (result.success) {
      const newSession = {
        role: result.role,
        username: result.username,
        displayName: result.displayName,
        permissions: result.permissions,
        loginAt: new Date().toISOString()
      };
      setSession(newSession);
      localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));

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

  const logout = () => {
    setSession(null);
    setActiveProfile(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PROFILE_KEY);
  };

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
