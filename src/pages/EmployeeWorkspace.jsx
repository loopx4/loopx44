import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { DataService } from '../services/dataService';
import SubmissionDetailModal from '../components/SubmissionDetailModal';
import TeamDiscussion from '../components/TeamDiscussion';
import FormBuilder from '../components/FormBuilder';
import ConfirmationModal from '../components/ConfirmationModal';

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

  // Link Deletion State
  const [linkToDelete, setLinkToDelete] = useState(null);
  const [isDeletingLink, setIsDeletingLink] = useState(false);

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

  const handleConfirmDeleteLink = async () => {
    if (!linkToDelete) return;
    setIsDeletingLink(true);
    try {
      await DataService.deleteClientLink(linkToDelete.id);
      setLinkToDelete(null);
      await loadEmployeeData();
    } catch (err) {
      console.error('Failed to delete client link:', err);
    } finally {
      setIsDeletingLink(false);
    }
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
          TAB 2: CREATE CLIENT LINK (FORM BUILDER)
         ---------------------------------------------------------------------- */}
      {activeTab === 'create_link' && (
        <div>
          {latestGeneratedLink && (
            <div
              style={{
                maxWidth: '860px',
                margin: '0 auto 24px auto',
                backgroundColor: '#0d0d0d',
                border: '1px solid var(--border-green)',
                borderRadius: '6px',
                padding: '24px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                  ✓ Client Link Successfully Generated
                </div>
                <button
                  type="button"
                  onClick={() => setLatestGeneratedLink(null)}
                  className="btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                >
                  ✕ Dismiss
                </button>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-white)', marginBottom: '14px', wordBreak: 'break-all' }}>
                <code style={{ color: 'var(--color-green)', fontFamily: 'var(--font-mono)', fontSize: '15px' }}>
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
            </div>
          )}

          {/* Shared Form Questionnaire Builder */}
          <FormBuilder
            activeProfile={activeProfile}
            onLinkGenerated={(newLink) => {
              setLatestGeneratedLink(newLink);
              loadEmployeeData();
            }}
          />

          {/* Generated links history list */}
          {createdLinks.length > 0 && (
            <div style={{ maxWidth: '860px', margin: '30px auto 0 auto' }}>
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
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
                          padding: '12px 16px',
                          backgroundColor: '#090909',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '4px',
                          gap: '12px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <code className="mono-token">{link.token.substring(0, 12)}...</code>
                            <span className={`badge ${link.status === 'submitted' ? 'badge-completed' : 'badge-pending'}`}>
                              {link.status === 'submitted' ? 'Submitted' : 'Awaiting Submission'}
                            </span>
                            {link.queue_number && (
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-green)', fontWeight: 700, fontSize: '12px' }}>
                                [{link.queue_number}]
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Created: {new Date(link.created_at).toLocaleString()}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(linkUrl)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            Copy Link
                          </button>
                          <a
                            href={linkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            Open ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => setLinkToDelete(link)}
                            className="btn-danger"
                            style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: '#3f0d0d', borderColor: '#7f1d1d' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
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
          onSubmissionDeleted={() => {
            setSelectedSubmission(null);
            loadEmployeeData();
          }}
        />
      )}

      {/* Confirmation Modal for Client Link Deletion */}
      <ConfirmationModal
        isOpen={Boolean(linkToDelete)}
        title="Delete Client Link"
        message="Are you sure you want to permanently delete this client link? The URL token will no longer accept client submissions."
        itemName={`Token: ${linkToDelete?.token.substring(0, 16)}...`}
        itemDetails={linkToDelete ? `Status: ${linkToDelete.status} • Created: ${new Date(linkToDelete.created_at).toLocaleString()}` : ''}
        confirmLabel="Delete Link"
        isProcessing={isDeletingLink}
        onCancel={() => setLinkToDelete(null)}
        onConfirm={handleConfirmDeleteLink}
      />
    </div>
  );
}
