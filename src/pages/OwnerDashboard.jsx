import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DataService } from '../services/dataService';
import SubmissionDetailModal from '../components/SubmissionDetailModal';
import TeamDiscussion from '../components/TeamDiscussion';
import ConfirmationModal from '../components/ConfirmationModal';

export default function OwnerDashboard() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'employees' | 'storage' | 'discussion'
  const [statusFilter, setStatusFilter] = useState('Total'); // 'Total' | 'Pending' | 'Working' | 'Completed'

  const [submissions, setSubmissions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [storageStats, setStorageStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // New Profile State
  const [newProfileName, setNewProfileName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [isAddingProfile, setIsAddingProfile] = useState(false);

  // Profile Edit State
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [editingProfileName, setEditingProfileName] = useState('');
  const [profileEditError, setProfileEditError] = useState('');

  // Confirmation Modals State
  const [profileToDelete, setProfileToDelete] = useState(null);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);

  const [subToDelete, setSubToDelete] = useState(null);
  const [isDeletingSub, setIsDeletingSub] = useState(false);

  // Storage Management State
  const [selectedFileKeys, setSelectedFileKeys] = useState([]);
  const [singleFileToDelete, setSingleFileToDelete] = useState(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeletingStorageFiles, setIsDeletingStorageFiles] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allSubs, allProfiles, stats] = await Promise.all([
        DataService.getSubmissions(),
        DataService.getProfiles(),
        DataService.getStorageStats()
      ]);
      setSubmissions(allSubs || []);
      setProfiles(allProfiles || []);
      setStorageStats(stats);
      setSelectedFileKeys([]);
    } catch (err) {
      console.error('Failed to load owner dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 1. Employee Profile Handlers
  const handleCreateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    const trimmed = newProfileName.trim();
    if (!trimmed) {
      setProfileError('Please enter an employee name.');
      return;
    }
    setIsAddingProfile(true);
    try {
      const res = await DataService.createProfile(trimmed);
      if (!res.success) {
        setProfileError(res.error);
        return;
      }
      setNewProfileName('');
      await loadData();
    } catch (err) {
      setProfileError(err.message || 'Failed to create profile.');
    } finally {
      setIsAddingProfile(false);
    }
  };

  const handleStartEditProfile = (profile) => {
    setEditingProfileId(profile.id);
    setEditingProfileName(profile.name);
    setProfileEditError('');
  };

  const handleSaveEditProfile = async (profileId) => {
    setProfileEditError('');
    const trimmed = editingProfileName.trim();
    if (!trimmed) {
      setProfileEditError('Profile name cannot be empty.');
      return;
    }

    try {
      const res = await DataService.updateProfile(profileId, trimmed);
      if (!res.success) {
        setProfileEditError(res.error);
        return;
      }
      setEditingProfileId(null);
      setEditingProfileName('');
      await loadData();
    } catch (err) {
      setProfileEditError(err.message || 'Failed to update profile.');
    }
  };

  const handleConfirmDeleteProfile = async () => {
    if (!profileToDelete) return;
    setIsDeletingProfile(true);
    try {
      await DataService.deleteProfile(profileToDelete.id);
      setProfileToDelete(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete profile:', err);
    } finally {
      setIsDeletingProfile(false);
    }
  };

  // 2. Client Submission Deletion Handlers
  const handleConfirmDeleteSubmission = async () => {
    if (!subToDelete) return;
    setIsDeletingSub(true);
    try {
      await DataService.deleteSubmission(subToDelete.id);
      setSubToDelete(null);
      if (selectedSubmission?.id === subToDelete.id) {
        setSelectedSubmission(null);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to delete submission:', err);
    } finally {
      setIsDeletingSub(false);
    }
  };

  // 3. Storage File Deletion Handlers
  const handleConfirmDeleteSingleFile = async () => {
    if (!singleFileToDelete) return;
    setIsDeletingStorageFiles(true);
    try {
      await DataService.deleteSubmissionFile(
        singleFileToDelete.submissionId,
        singleFileToDelete.storagePath || singleFileToDelete.fileName
      );
      setSingleFileToDelete(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete storage file:', err);
    } finally {
      setIsDeletingStorageFiles(false);
    }
  };

  const handleConfirmBulkDeleteFiles = async () => {
    if (selectedFileKeys.length === 0 || !storageStats) return;
    setIsDeletingStorageFiles(true);

    const itemsToDelete = storageStats.clientFiles.filter((f) =>
      selectedFileKeys.includes(`${f.submissionId}_${f.fileName}`)
    );

    try {
      await DataService.deleteMultipleFiles(itemsToDelete);
      setSelectedFileKeys([]);
      setShowBulkDeleteModal(false);
      await loadData();
    } catch (err) {
      console.error('Failed to bulk delete files:', err);
    } finally {
      setIsDeletingStorageFiles(false);
    }
  };

  const toggleSelectAllFiles = (e) => {
    if (e.target.checked && storageStats) {
      const allKeys = storageStats.clientFiles.map((f) => `${f.submissionId}_${f.fileName}`);
      setSelectedFileKeys(allKeys);
    } else {
      setSelectedFileKeys([]);
    }
  };

  const toggleSelectFile = (key) => {
    setSelectedFileKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Compute counts strictly from actual records
  const totalCount = submissions.length;
  const pendingCount = submissions.filter((s) => s.current_status === 'Pending').length;
  const workingCount = submissions.filter((s) => s.current_status === 'Working').length;
  const completedCount = submissions.filter((s) => s.current_status === 'Completed').length;

  // Filtered submissions based on card clicked
  const filteredSubmissions = submissions.filter((s) => {
    if (statusFilter === 'Total') return true;
    return s.current_status === statusFilter;
  });

  // Calculate employee-wise stats
  const employeeStats = profiles.map((p) => {
    const pSubs = submissions.filter((s) => s.created_by_profile_id === p.id);
    return {
      id: p.id,
      name: p.name,
      total: pSubs.length,
      pending: pSubs.filter((s) => s.current_status === 'Pending').length,
      working: pSubs.filter((s) => s.current_status === 'Working').length,
      completed: pSubs.filter((s) => s.current_status === 'Completed').length,
      created_at: p.created_at
    };
  });

  return (
    <div className="app-container">
      {/* Dashboard Top Header */}
      <div style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '4px' }}>
            COMMAND CENTER • EXECUTIVE ACCESS
          </div>
          <h1 style={{ fontSize: '1.75rem', color: 'var(--text-white)' }}>
            Owner Dashboard — <span style={{ color: 'var(--color-green)' }}>{session?.username || 'Jagan'}</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '13px' }}
        >
          ↻ Refresh Live Records
        </button>
      </div>

      {/* Top Nav Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '28px',
          overflowX: 'auto'
        }}
      >
        {[
          { id: 'overview', label: `Submissions & Workflow (${totalCount})` },
          { id: 'employees', label: `Employee Profiles (${profiles.length})` },
          { id: 'storage', label: `Storage Management (${storageStats?.totalFileCount || 0})` },
          { id: 'discussion', label: 'Team Discussion' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 18px',
              fontSize: '13px',
              fontWeight: 600,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-green)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--color-green)' : 'var(--text-muted)',
              borderRadius: 0,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------------------
          TAB 1: SUBMISSIONS & WORKFLOW (Cards + Filtered Table + Management)
         ---------------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div>
          {/* Four Clickable Summary Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '28px'
            }}
          >
            {/* Total Card */}
            <div
              onClick={() => setStatusFilter('Total')}
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: statusFilter === 'Total' ? 'var(--color-green)' : 'var(--border-subtle)',
                backgroundColor: statusFilter === 'Total' ? '#0e1509' : 'var(--bg-surface)',
                transition: 'border-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Total Submissions
                </span>
                {statusFilter === 'Total' && (
                  <span style={{ fontSize: '11px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>● ACTIVE LIST</span>
                )}
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-white)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {totalCount}
              </div>
            </div>

            {/* Pending Card */}
            <div
              onClick={() => setStatusFilter('Pending')}
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: statusFilter === 'Pending' ? 'var(--color-warning)' : 'var(--border-subtle)',
                backgroundColor: statusFilter === 'Pending' ? '#1c1505' : 'var(--bg-surface)',
                transition: 'border-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Pending
                </span>
                {statusFilter === 'Pending' && (
                  <span style={{ fontSize: '11px', color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>● ACTIVE LIST</span>
                )}
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {pendingCount}
              </div>
            </div>

            {/* Working Card */}
            <div
              onClick={() => setStatusFilter('Working')}
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: statusFilter === 'Working' ? '#38bdf8' : 'var(--border-subtle)',
                backgroundColor: statusFilter === 'Working' ? '#071824' : 'var(--bg-surface)',
                transition: 'border-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Working
                </span>
                {statusFilter === 'Working' && (
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>● ACTIVE LIST</span>
                )}
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: '#38bdf8', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {workingCount}
              </div>
            </div>

            {/* Completed Card */}
            <div
              onClick={() => setStatusFilter('Completed')}
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: statusFilter === 'Completed' ? 'var(--color-green)' : 'var(--border-subtle)',
                backgroundColor: statusFilter === 'Completed' ? '#0e1509' : 'var(--bg-surface)',
                transition: 'border-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Completed
                </span>
                {statusFilter === 'Completed' && (
                  <span style={{ fontSize: '11px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>● ACTIVE LIST</span>
                )}
              </div>
              <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--color-green)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {completedCount}
              </div>
            </div>
          </div>

          {/* Submissions Data Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>
                  {statusFilter === 'Total' ? 'All Client Submissions' : `${statusFilter} Submissions`} ({filteredSubmissions.length})
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Showing actual client intakes registered in LoopX. Click "Manage Details" to inspect, edit, or delete records.
                </div>
              </div>

              {statusFilter !== 'Total' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('Total')}
                  className="btn-secondary"
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  Clear Filter
                </button>
              )}
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No Submissions Found</div>
                <div className="empty-state-desc">
                  {statusFilter === 'Total'
                    ? 'No clients have submitted requirements through an intake link yet.'
                    : `There are currently 0 submissions marked as "${statusFilter}".`}
                </div>
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Queue ID</th>
                      <th>Client</th>
                      <th>Business</th>
                      <th>Representative</th>
                      <th>Submitted Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-green)' }}>
                          {sub.queue_number}
                        </td>
                        <td style={{ fontWeight: 600 }}>{sub.client_name}</td>
                        <td>{sub.business_name}</td>
                        <td>
                          <span style={{ color: 'var(--text-white)', fontWeight: 500 }}>
                            {sub.created_by_name || '—'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {new Date(sub.submitted_at).toLocaleDateString()}
                        </td>
                        <td>
                          <span className={`badge badge-${sub.current_status.toLowerCase()}`}>
                            {sub.current_status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedSubmission(sub)}
                              className="btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                            >
                              Manage Details
                            </button>
                            <button
                              type="button"
                              onClick={() => setSubToDelete(sub)}
                              className="btn-danger"
                              style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#3f0d0d', borderColor: '#7f1d1d' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          TAB 2: EMPLOYEE PROFILES & SCALABLE MANAGEMENT
         ---------------------------------------------------------------------- */}
      {activeTab === 'employees' && (
        <div className="card">
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Employee Profiles & Team Management</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Scalable multi-member management without arbitrary employee limits. Add, rename, or remove representative profiles.
            </p>
          </div>

          {/* Owner Profile Registration Form */}
          <form onSubmit={handleCreateProfile} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                placeholder="New Employee Name (e.g. Ramesh Kumar)"
                value={newProfileName}
                onChange={(e) => {
                  setNewProfileName(e.target.value);
                  setProfileError('');
                }}
                disabled={isAddingProfile}
                style={{ width: '100%' }}
              />
              {profileError && (
                <div style={{ color: 'var(--color-error)', fontSize: '12px', marginTop: '4px' }}>
                  {profileError}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={isAddingProfile || !newProfileName.trim()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {isAddingProfile ? 'Adding...' : '+ Add Employee Profile'}
            </button>
          </form>

          {profileEditError && (
            <div style={{ backgroundColor: '#1a0505', border: '1px solid #661111', color: 'var(--color-error)', padding: '10px 14px', borderRadius: '4px', fontSize: '13px', marginBottom: '16px' }}>
              {profileEditError}
            </div>
          )}

          {employeeStats.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Zero Employee Profiles</div>
              <div className="empty-state-desc">
                No employee profiles have been registered yet. Add team members above to start issuing client links.
              </div>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee Name</th>
                    <th>Total Submissions</th>
                    <th>Pending</th>
                    <th>Working</th>
                    <th>Completed</th>
                    <th>Registered Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeStats.map((emp) => (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                        {editingProfileId === emp.id ? (
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={editingProfileName}
                              onChange={(e) => setEditingProfileName(e.target.value)}
                              style={{ padding: '4px 8px', fontSize: '13px', width: '180px' }}
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditProfile(emp.id)}
                              className="btn-primary"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProfileId(null)}
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          emp.name
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{emp.total}</td>
                      <td>
                        <span className="badge badge-pending">{emp.pending}</span>
                      </td>
                      <td>
                        <span className="badge badge-working">{emp.working}</span>
                      </td>
                      <td>
                        <span className="badge badge-completed">{emp.completed}</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {new Date(emp.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleStartEditProfile(emp)}
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => setProfileToDelete(emp)}
                            className="btn-danger"
                            style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#3f0d0d', borderColor: '#7f1d1d' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------
          TAB 3: OWNER STORAGE MANAGEMENT (Usage Meters & Client Files)
         ---------------------------------------------------------------------- */}
      {activeTab === 'storage' && (
        <div>
          {/* Storage Meter Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '28px'
            }}
          >
            {/* Total Allocated Card */}
            <div className="card">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Allocated Tier
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-white)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                1.00 GB
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                1,024 MB Standard Quota
              </div>
            </div>

            {/* Storage Used Card */}
            <div className="card">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Current Storage Used
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-green)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {storageStats ? `${(storageStats.usedBytes / (1024 * 1024)).toFixed(2)} MB` : '0.00 MB'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {storageStats?.usagePercentage || 0}% of total capacity
              </div>
            </div>

            {/* Available Storage Card */}
            <div className="card">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Available / Remaining
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {storageStats ? `${(storageStats.availableBytes / (1024 * 1024)).toFixed(2)} MB` : '1024.00 MB'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Free capacity remaining
              </div>
            </div>

            {/* Total Stored Files Card */}
            <div className="card">
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Client Files Stored
              </span>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-white)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {storageStats?.totalFileCount || 0}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Individual uploads across clients
              </div>
            </div>
          </div>

          {/* Visual Usage Progress Bar */}
          <div className="card" style={{ marginBottom: '28px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)' }}>
                Storage Capacity Utilization
              </span>
              <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-green)' }}>
                {storageStats?.usagePercentage || 0}% Used
              </span>
            </div>
            <div style={{ width: '100%', height: '10px', backgroundColor: '#1a1a1a', borderRadius: '5px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${Math.max(1, Math.min(100, storageStats?.usagePercentage || 0))}%`,
                  height: '100%',
                  backgroundColor: 'var(--color-green)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>

          {/* Client Files Management Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Client Uploaded Files Directory</h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Grouped by client and queue number. Selecting files allows bulk deletion from Supabase Storage and records.
                </div>
              </div>

              {selectedFileKeys.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="btn-danger"
                  style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: '#7f1d1d' }}
                >
                  Delete Selected Files ({selectedFileKeys.length})
                </button>
              )}
            </div>

            {!storageStats || storageStats.clientFiles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No Stored Files</div>
                <div className="empty-state-desc">
                  No files have been uploaded by clients yet. When clients submit attachments, they will appear here.
                </div>
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          onChange={toggleSelectAllFiles}
                          checked={selectedFileKeys.length > 0 && selectedFileKeys.length === storageStats.clientFiles.length}
                        />
                      </th>
                      <th>Queue ID</th>
                      <th>Client Name</th>
                      <th>Business</th>
                      <th>File Name</th>
                      <th>Size</th>
                      <th>Uploaded Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {storageStats.clientFiles.map((f, idx) => {
                      const fileKey = `${f.submissionId}_${f.fileName}`;
                      const isSelected = selectedFileKeys.includes(fileKey);
                      return (
                        <tr key={idx} style={{ backgroundColor: isSelected ? '#1c1505' : 'transparent' }}>
                          <td>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectFile(fileKey)}
                            />
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-green)' }}>
                            {f.queueNumber}
                          </td>
                          <td style={{ fontWeight: 600 }}>{f.clientName}</td>
                          <td>{f.businessName}</td>
                          <td style={{ color: 'var(--text-white)' }}>📄 {f.fileName}</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                            {f.fileSize >= 1024 * 1024
                              ? `${(f.fileSize / (1024 * 1024)).toFixed(2)} MB`
                              : `${Math.round(f.fileSize / 1024)} KB`}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            {new Date(f.uploadedAt).toLocaleDateString()}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '8px' }}>
                              {f.dataUrl && (
                                <a
                                  href={f.dataUrl}
                                  download={f.fileName}
                                  className="btn-secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                >
                                  Download
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => setSingleFileToDelete(f)}
                                className="btn-danger"
                                style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: '#3f0d0d', borderColor: '#7f1d1d' }}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          TAB 4: TEAM DISCUSSION
         ---------------------------------------------------------------------- */}
      {activeTab === 'discussion' && (
        <TeamDiscussion currentUserDisplayName="Jagan (Owner)" currentUserRole="owner" />
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          currentUserDisplayName="Jagan (Owner)"
          isOwner={true}
          onClose={() => setSelectedSubmission(null)}
          onStatusUpdated={(updated) => {
            setSelectedSubmission(updated);
            loadData();
          }}
          onSubmissionDeleted={() => {
            setSelectedSubmission(null);
            loadData();
          }}
        />
      )}

      {/* Delete Employee Profile Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(profileToDelete)}
        title="Delete Employee Profile"
        message="Are you sure you want to remove this employee profile? The employee will no longer appear in the team directory."
        itemName={profileToDelete?.name}
        itemDetails="Existing client links and historical records will remain intact."
        confirmLabel="Delete Profile"
        isProcessing={isDeletingProfile}
        onCancel={() => setProfileToDelete(null)}
        onConfirm={handleConfirmDeleteProfile}
      />

      {/* Delete Client Submission Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(subToDelete)}
        title="Delete Client Submission"
        message="Are you sure you want to permanently delete this client submission? All submitted details, status history, and uploaded files in Supabase Storage will be erased."
        itemName={`${subToDelete?.queue_number} — ${subToDelete?.business_name}`}
        itemDetails={`Client: ${subToDelete?.client_name}`}
        confirmLabel="Delete Submission"
        isProcessing={isDeletingSub}
        onCancel={() => setSubToDelete(null)}
        onConfirm={handleConfirmDeleteSubmission}
      />

      {/* Delete Single Storage File Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(singleFileToDelete)}
        title="Delete Uploaded File"
        message="Are you sure you want to permanently delete this file? This will remove the object from Supabase Storage and decrease your storage usage."
        itemName={singleFileToDelete?.fileName}
        itemDetails={singleFileToDelete ? `${(singleFileToDelete.fileSize / (1024 * 1024)).toFixed(2)} MB • Linked to ${singleFileToDelete.queueNumber} (${singleFileToDelete.clientName})` : ''}
        confirmLabel="Delete File"
        isProcessing={isDeletingStorageFiles}
        onCancel={() => setSingleFileToDelete(null)}
        onConfirm={handleConfirmDeleteSingleFile}
      />

      {/* Bulk Delete Storage Files Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBulkDeleteModal}
        title="Delete Multiple Selected Files"
        message={`Are you sure you want to permanently delete ${selectedFileKeys.length} selected files? All corresponding objects will be removed from Supabase Storage.`}
        itemName={`${selectedFileKeys.length} files selected for permanent deletion`}
        confirmLabel={`Delete ${selectedFileKeys.length} Files`}
        isProcessing={isDeletingStorageFiles}
        onCancel={() => setShowBulkDeleteModal(false)}
        onConfirm={handleConfirmBulkDeleteFiles}
      />
    </div>
  );
}
