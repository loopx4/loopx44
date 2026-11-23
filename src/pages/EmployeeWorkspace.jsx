import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DataService } from '../services/dataService';
import SubmissionDetailModal from '../components/SubmissionDetailModal';
import TeamDiscussion from '../components/TeamDiscussion';

export default function EmployeeWorkspace() {
  const { activeProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'create_link' | 'my_submissions' | 'work_queue' | 'team_discussion'

  // Submissions State (Filtered strictly to activeProfile)
  const [submissions, setSubmissions] = useState([]);
  const [createdLinks, setCreatedLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  // Client Link Creation State
  const [generatingLink, setGeneratingLink] = useState(false);
  const [latestGeneratedLink, setLatestGeneratedLink] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadEmployeeData = async () => {
    if (!activeProfile) return;
    try {
      setLoading(true);

      // Load submissions attributed to this employee profile only
      const subs = await DataService.getSubmissions({ profileId: activeProfile.id });
      setSubmissions(subs || []);

      // Load client links created by this profile (Supabase or local standby mode)
      const links = await DataService.getClientLinks(activeProfile.id);
      setCreatedLinks(links || []);
    } catch (err) {
      console.error('Failed to load employee data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployeeData();
  }, [activeProfile]);

  const handleGenerateLink = async () => {
    if (!activeProfile) return;
    setGeneratingLink(true);
    setCopiedLink(false);
    try {
      const linkRecord = await DataService.createClientLink(activeProfile.id, activeProfile.name);
      const fullUrl = `${window.location.origin}/submit/${linkRecord.token}`;
      setLatestGeneratedLink({
        ...linkRecord,
        url: fullUrl
      });
      loadEmployeeData();
    } catch (err) {
      console.error('Failed to generate link:', err);
    } finally {
      setGeneratingLink(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Stats calculation
  const totalCount = submissions.length;
  const pendingCount = submissions.filter((s) => s.current_status === 'Pending').length;
  const workingCount = submissions.filter((s) => s.current_status === 'Working').length;
  const completedCount = submissions.filter((s) => s.current_status === 'Completed').length;

  return (
    <div className="app-container">
      {/* Workspace Header */}
      <div style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '4px' }}>
            EMPLOYEE WORKSPACE
          </div>
          <h1 style={{ fontSize: '1.6rem', color: 'var(--text-white)' }}>
            Welcome, <span style={{ color: 'var(--color-green)' }}>{activeProfile?.name}</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('create_link')}
          className="btn-primary"
          style={{ padding: '10px 18px' }}
        >
          + Create Client Link
        </button>
      </div>

      {/* Workspace Navigation Tabs */}
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
          { id: 'overview', label: 'Overview' },
          { id: 'create_link', label: 'Create Client Link' },
          { id: 'my_submissions', label: `My Client Submissions (${totalCount})` },
          { id: 'work_queue', label: `Work Queue (${pendingCount + workingCount})` },
          { id: 'team_discussion', label: 'Team Discussion' }
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
          TAB 1: OVERVIEW
         ---------------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div>
          {/* Quick Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div className="card">
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>My Total Submissions</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-white)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {totalCount}
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Review</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {pendingCount}
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>In Progress / Working</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {workingCount}
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completed</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-green)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                {completedCount}
              </div>
            </div>
          </div>

          {/* Recent Submissions List */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', marginBottom: '16px', color: 'var(--text-white)' }}>
              Recent Submissions Created by You
            </h3>

            {submissions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">Zero Submissions Yet</div>
                <div className="empty-state-desc">
                  You have not received any client submissions yet. Click "Create Client Link" to send a submission link to your client.
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('create_link')}
                  className="btn-primary"
                >
                  Create Your First Client Link
                </button>
              </div>
            ) : (
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Queue #</th>
                      <th>Client Name</th>
                      <th>Business</th>
                      <th>Submitted Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.slice(0, 5).map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-green)' }}>
                            {sub.queue_number}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{sub.client_name}</td>
                        <td>{sub.business_name}</td>
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
                            Open Details
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
          TAB 2: CREATE CLIENT LINK
         ---------------------------------------------------------------------- */}
      {activeTab === 'create_link' && (
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div className="card" style={{ padding: '32px' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Create Private Client Link</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
              Generates a private, unpredictable URL attributed directly to your profile (<strong>{activeProfile.name}</strong>).
              Share this link with your client to complete their intake form.
            </p>

            <button
              type="button"
              onClick={handleGenerateLink}
              disabled={generatingLink}
              className="btn-primary"
              style={{ padding: '12px 20px', width: '100%', marginBottom: '24px' }}
            >
              {generatingLink ? 'Generating Secure Token...' : '+ Generate New Client Link'}
            </button>

            {latestGeneratedLink && (
              <div
                style={{
                  backgroundColor: '#0d0d0d',
                  border: '1px solid var(--border-green)',
                  borderRadius: '6px',
                  padding: '20px',
                  marginBottom: '20px'
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  ✓ Link Generated Successfully
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-white)', marginBottom: '12px', wordBreak: 'break-all' }}>
                  <code style={{ color: 'var(--color-green)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                    {latestGeneratedLink.url}
                  </code>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(latestGeneratedLink.url)}
                    className="btn-primary"
                    style={{ flex: 1 }}
                  >
                    {copiedLink ? '✓ Copied to Clipboard!' : 'Copy Link'}
                  </button>
                  <a
                    href={latestGeneratedLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                  >
                    Open Link ↗
                  </a>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
                  Note: The queue number is not assigned yet. When the client submits the form, an atomic sequential queue number (e.g. LX-001) will be generated automatically.
                </div>
              </div>
            )}

            {/* Generated links list */}
            {createdLinks.length > 0 && (
              <div style={{ marginTop: '30px', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Your Active Generated Links ({createdLinks.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {createdLinks.map((link) => {
                    const linkUrl = `${window.location.origin}/submit/${link.token}`;
                    return (
                      <div
                        key={link.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          backgroundColor: '#090909',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px'
                        }}
                      >
                        <div>
                          <span className={`badge ${link.status === 'submitted' ? 'badge-completed' : 'badge-pending'}`} style={{ marginRight: '8px' }}>
                            {link.status === 'submitted' ? `Submitted: ${link.queue_number}` : 'Awaiting Submission'}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {new Date(link.created_at).toLocaleDateString()}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => copyToClipboard(linkUrl)}
                          className="btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          Copy URL
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          TAB 3: MY CLIENT SUBMISSIONS
         ---------------------------------------------------------------------- */}
      {activeTab === 'my_submissions' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem' }}>All My Client Submissions ({totalCount})</h2>
          </div>

          {submissions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Zero Submissions Found</div>
              <div className="empty-state-desc">
                No submissions have been filed under your employee profile ({activeProfile.name}) yet.
              </div>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Queue #</th>
                    <th>Client Name</th>
                    <th>Business</th>
                    <th>Phone</th>
                    <th>Location</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-green)' }}>
                          {sub.queue_number}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{sub.client_name}</td>
                      <td>{sub.business_name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{sub.phone}</td>
                      <td>{sub.location}</td>
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
                          Open Details
                        </button>
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
          TAB 4: WORK QUEUE (Pending + Working)
         ---------------------------------------------------------------------- */}
      {activeTab === 'work_queue' && (
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>
            Active Work Queue ({pendingCount + workingCount})
          </h2>

          {pendingCount + workingCount === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">Work Queue Clean</div>
              <div className="empty-state-desc">
                You have zero pending or active tasks in your work queue.
              </div>
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Queue #</th>
                    <th>Client Name</th>
                    <th>Business</th>
                    <th>Services Required</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions
                    .filter((s) => s.current_status !== 'Completed')
                    .map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-green)' }}>
                            {sub.queue_number}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{sub.client_name}</td>
                        <td>{sub.business_name}</td>
                        <td style={{ fontSize: '13px' }}>{sub.services_required}</td>
                        <td>
                          <span className={`badge badge-${sub.current_status.toLowerCase()}`}>
                            {sub.current_status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedSubmission(sub)}
                            className="btn-primary"
                            style={{ padding: '4px 12px', fontSize: '12px' }}
                          >
                            Update Status →
                          </button>
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
          TAB 5: TEAM DISCUSSION
         ---------------------------------------------------------------------- */}
      {activeTab === 'team_discussion' && (
        <TeamDiscussion currentUserDisplayName={activeProfile.name} currentUserRole="employee" />
      )}

      {/* Submission Detail Modal */}
      {selectedSubmission && (
        <SubmissionDetailModal
          submission={selectedSubmission}
          currentUserDisplayName={activeProfile.name}
          onClose={() => setSelectedSubmission(null)}
          onStatusUpdated={(updated) => {
            setSelectedSubmission(updated);
            loadEmployeeData();
          }}
        />
      )}
    </div>
  );
}
