import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DataService } from '../services/dataService';
import SubmissionDetailModal from '../components/SubmissionDetailModal';
import TeamDiscussion from '../components/TeamDiscussion';

export default function OwnerDashboard() {
  const { session } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'employees' | 'discussion'
  const [statusFilter, setStatusFilter] = useState('Total'); // 'Total' | 'Pending' | 'Working' | 'Completed'

  const [submissions, setSubmissions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      // Owner gets ALL submissions
      const allSubs = await DataService.getSubmissions();
      setSubmissions(allSubs || []);

      const allProfiles = await DataService.getProfiles();
      setProfiles(allProfiles || []);
    } catch (err) {
      console.error('Failed to load owner dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
          TAB 1: SUBMISSIONS & WORKFLOW (Clickable 4 Cards + Filtered Table)
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
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-white)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {totalCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Click to view all {totalCount} records
              </div>
            </div>

            {/* Pending Card */}
            <div
              onClick={() => setStatusFilter('Pending')}
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: statusFilter === 'Pending' ? 'var(--color-warning)' : 'var(--border-subtle)',
                backgroundColor: statusFilter === 'Pending' ? '#181404' : 'var(--bg-surface)',
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
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {pendingCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Click to view only pending ({pendingCount})
              </div>
            </div>

            {/* Working Card */}
            <div
              onClick={() => setStatusFilter('Working')}
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: statusFilter === 'Working' ? '#38bdf8' : 'var(--border-subtle)',
                backgroundColor: statusFilter === 'Working' ? '#04121a' : 'var(--bg-surface)',
                transition: 'border-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Working / In Progress
                </span>
                {statusFilter === 'Working' && (
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>● ACTIVE LIST</span>
                )}
              </div>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {workingCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Click to view only working ({workingCount})
              </div>
            </div>

            {/* Completed Card */}
            <div
              onClick={() => setStatusFilter('Completed')}
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: statusFilter === 'Completed' ? 'var(--color-green)' : 'var(--border-subtle)',
                backgroundColor: statusFilter === 'Completed' ? '#0a1a05' : 'var(--bg-surface)',
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
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--color-green)', marginTop: '8px', fontFamily: 'var(--font-mono)' }}>
                {completedCount}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Click to view only completed ({completedCount})
              </div>
            </div>
          </div>

          {/* Simple Chart Based on Actual Database Status Counts */}
          <div className="card" style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '0.95rem', textTransform: 'uppercase', color: 'var(--text-white)' }}>
                Database Status Distribution Chart
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {totalCount} Total Records
              </span>
            </div>

            {totalCount === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Zero submissions recorded. This breakdown chart updates live based on genuine database counts.
              </div>
            ) : (
              <div>
                {/* Horizontal Bar Chart */}
                <div
                  style={{
                    height: '24px',
                    width: '100%',
                    backgroundColor: '#111111',
                    borderRadius: '4px',
                    display: 'flex',
                    overflow: 'hidden',
                    marginBottom: '12px'
                  }}
                >
                  {pendingCount > 0 && (
                    <div
                      title={`Pending: ${pendingCount} (${Math.round((pendingCount / totalCount) * 100)}%)`}
                      style={{
                        width: `${(pendingCount / totalCount) * 100}%`,
                        backgroundColor: 'var(--color-warning)'
                      }}
                    />
                  )}
                  {workingCount > 0 && (
                    <div
                      title={`Working: ${workingCount} (${Math.round((workingCount / totalCount) * 100)}%)`}
                      style={{
                        width: `${(workingCount / totalCount) * 100}%`,
                        backgroundColor: '#38bdf8'
                      }}
                    />
                  )}
                  {completedCount > 0 && (
                    <div
                      title={`Completed: ${completedCount} (${Math.round((completedCount / totalCount) * 100)}%)`}
                      style={{
                        width: `${(completedCount / totalCount) * 100}%`,
                        backgroundColor: 'var(--color-green)'
                      }}
                    />
                  )}
                </div>

                {/* Chart Legend */}
                <div style={{ display: 'flex', gap: '20px', fontSize: '12px', fontFamily: 'var(--font-mono)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--color-warning)', borderRadius: '2px' }} />
                    Pending: {pendingCount} ({Math.round((pendingCount / totalCount) * 100)}%)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#38bdf8', borderRadius: '2px' }} />
                    Working: {workingCount} ({Math.round((workingCount / totalCount) * 100)}%)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: 'var(--color-green)', borderRadius: '2px' }} />
                    Completed: {completedCount} ({Math.round((completedCount / totalCount) * 100)}%)
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Corresponding Actual Submission List */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', color: 'var(--text-white)' }}>
                  {statusFilter === 'Total' ? 'All Submissions' : `${statusFilter} Submissions`} ({filteredSubmissions.length})
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Displaying real-time records. Click any row to inspect complete details and update workflow status.
                </div>
              </div>

              {statusFilter !== 'Total' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('Total')}
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  Clear Filter (Show All)
                </button>
              )}
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No Records Found</div>
                <div className="empty-state-desc">
                  There are currently zero submissions matching the "{statusFilter}" filter.
                </div>
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Queue #</th>
                      <th>Client Name</th>
                      <th>Business Name</th>
                      <th>Handled By (Employee)</th>
                      <th>Submission Date</th>
                      <th>Current Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-green)' }}>
                            {sub.queue_number}
                          </span>
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
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedSubmission(sub)}
                            className="btn-secondary"
                            style={{ padding: '4px 10px', fontSize: '12px' }}
                          >
                            Open Details & Status
                          </button>
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
          TAB 2: EMPLOYEE PROFILES & WORK COUNTS
         ---------------------------------------------------------------------- */}
      {activeTab === 'employees' && (
        <div className="card">
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Employee Profiles & Work Attribution</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
              Real-time work volume and status breakdown per registered employee profile.
            </p>
          </div>

          {employeeStats.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Zero Employee Profiles</div>
              <div className="empty-state-desc">
                No employee profiles have registered in the system yet. Once employees log in and create their profiles, their individual performance and attribution metrics will appear here.
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
                  </tr>
                </thead>
                <tbody>
                  {employeeStats.map((emp) => (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 600, color: 'var(--text-white)' }}>{emp.name}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------
          TAB 3: TEAM DISCUSSION
         ---------------------------------------------------------------------- */}
      {activeTab === 'discussion' && (
        <TeamDiscussion currentUserDisplayName="Jagan (Owner)" currentUserRole="owner" />
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          currentUserDisplayName="Jagan (Owner)"
          onClose={() => setSelectedSubmission(null)}
          onStatusUpdated={(updated) => {
            setSelectedSubmission(updated);
            loadData();
          }}
        />
      )}
    </div>
  );
}
