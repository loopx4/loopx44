import React, { useState, useEffect } from 'react';
import { DataService } from '../services/dataService';
import { useAuth } from '../context/AuthContext';

export default function ProfileSelector() {
  const { selectEmployeeProfile } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const data = await DataService.getProfiles();
      setProfiles(data || []);
    } catch (err) {
      console.error('Failed to load profiles:', err);
      setError('Unable to load employee profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Please enter your full name or nickname.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await DataService.createProfile(trimmed);
      if (!res.success) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      setNewName('');
      // Enter workspace immediately with newly created profile
      selectEmployeeProfile(res.profile);
    } catch (err) {
      setError(err.message || 'Failed to create profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '640px', marginTop: '40px' }}>
      <div className="card" style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <h1 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Select Employee Profile</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Choose your profile to enter the workspace, or add your name if you are joining for the first time.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading employee profiles...
          </div>
        ) : profiles.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: '28px', padding: '36px 20px' }}>
            <div className="empty-state-title">Zero Profiles Found</div>
            <div className="empty-state-desc">
              No employee profiles have been registered yet. Create your profile below to get started.
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: '28px' }}>
            <label style={{ marginBottom: '12px', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Existing Profiles ({profiles.length})
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectEmployeeProfile(p)}
                  className="btn-secondary"
                  style={{
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    textAlign: 'left',
                    width: '100%',
                    borderColor: 'var(--border-subtle)'
                  }}
                >
                  <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{p.name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--color-green)' }}>Enter Workspace →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add Profile Form */}
        <form onSubmit={handleCreate} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '24px' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '14px', color: 'var(--text-white)' }}>
            Add New Employee Profile
          </h3>

          {error && (
            <div
              style={{
                backgroundColor: '#1a0505',
                border: '1px solid #661111',
                color: 'var(--color-error)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                marginBottom: '16px'
              }}
            >
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="profileName">Employee Name</label>
            <input
              id="profileName"
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError('');
              }}
              disabled={isSubmitting}
            />
            <div className="form-hint">
              Profile names must be unique. Uppercase and lowercase duplicates are automatically prevented.
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '12px' }}
            disabled={isSubmitting || !newName.trim()}
          >
            {isSubmitting ? 'Registering Profile...' : 'Add Profile & Enter Workspace'}
          </button>
        </form>
      </div>
    </div>
  );
}
