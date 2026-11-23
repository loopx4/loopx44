import React, { useState, useEffect } from 'react';
import { DataService } from '../services/dataService';

export default function SubmissionDetailModal({ submission, currentUserDisplayName, onClose, onStatusUpdated }) {
  const [currentStatus, setCurrentStatus] = useState(submission.current_status);
  const [history, setHistory] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadHistory() {
      try {
        const hist = await DataService.getStatusHistory(submission.id);
        setHistory(hist || []);
      } catch (err) {
        console.error('Failed to load status history:', err);
      }
    }
    loadHistory();
  }, [submission.id]);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === currentStatus) return;
    setUpdating(true);
    setError('');

    try {
      const updated = await DataService.updateSubmissionStatus(
        submission.id,
        newStatus,
        currentUserDisplayName
      );
      setCurrentStatus(newStatus);
      if (onStatusUpdated) onStatusUpdated(updated);

      // Refresh history
      const hist = await DataService.getStatusHistory(submission.id);
      setHistory(hist || []);
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#0a0a0a',
          border: '1px solid var(--border-strong)',
          padding: '28px',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            padding: '6px 12px',
            fontSize: '12px'
          }}
        >
          ✕ Close
        </button>

        {/* Header */}
        <div style={{ marginBottom: '20px', paddingRight: '70px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>
              {submission.queue_number}
            </span>
            <span className={`badge badge-${currentStatus.toLowerCase()}`}>
              {currentStatus}
            </span>
          </div>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-white)', textTransform: 'none' }}>
            {submission.business_name} — {submission.client_name}
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Created by: {submission.created_by_name} • Submitted on: {new Date(submission.submitted_at).toLocaleString()}
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: '#1a0505', border: '1px solid #661111', color: 'var(--color-error)', padding: '8px 12px', borderRadius: '4px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* Status Update Control */}
        <div
          style={{
            backgroundColor: '#111111',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '24px'
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Update Workflow Status (Attributed to: {currentUserDisplayName})
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['Pending', 'Working', 'Completed'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleStatusChange(st)}
                disabled={updating || currentStatus === st}
                className={currentStatus === st ? 'btn-primary' : 'btn-secondary'}
                style={{
                  fontSize: '12px',
                  padding: '8px 16px',
                  opacity: currentStatus === st ? 1 : 0.8
                }}
              >
                {currentStatus === st ? `✓ ${st}` : `Set ${st}`}
              </button>
            ))}
          </div>
        </div>

        {/* Information Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Phone</label>
            <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)' }}>{submission.phone}</div>
          </div>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Email</label>
            <div style={{ fontSize: '14px' }}>{submission.email || '—'}</div>
          </div>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Location</label>
            <div style={{ fontSize: '14px' }}>{submission.location}</div>
          </div>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Business Type</label>
            <div style={{ fontSize: '14px' }}>{submission.business_type}</div>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Services Required</label>
          <div style={{ fontSize: '14px', backgroundColor: '#0d0d0d', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
            {submission.services_required}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Detailed Requirements</label>
          <div style={{ fontSize: '14px', backgroundColor: '#0d0d0d', padding: '12px 14px', borderRadius: '4px', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap' }}>
            {submission.detailed_requirements}
          </div>
        </div>

        {submission.additional_info && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Additional Information</label>
            <div style={{ fontSize: '14px', backgroundColor: '#0d0d0d', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap' }}>
              {submission.additional_info}
            </div>
          </div>
        )}

        {/* Uploaded Files */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '6px' }}>
            Uploaded Photos & Documents ({submission.files ? submission.files.length : 0})
          </label>
          {!submission.files || submission.files.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>No files uploaded.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {submission.files.map((file, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    backgroundColor: '#0d0d0d',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px'
                  }}
                >
                  <span style={{ fontSize: '13px' }}>
                    {file.name} ({Math.round(file.size / 1024)} KB)
                  </span>
                  {file.dataUrl && (
                    <a
                      href={file.dataUrl}
                      download={file.name}
                      className="btn-secondary"
                      style={{ padding: '3px 8px', fontSize: '11px' }}
                    >
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Audit Trail */}
        <div>
          <label style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>
            Status Change Audit History ({history.length})
          </label>
          {history.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>No status changes recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    backgroundColor: '#0f0f0f',
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #1a1a1a',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>
                    Status {h.old_status ? `"${h.old_status}" → ` : 'initialized to '}
                    <strong style={{ color: 'var(--color-green)' }}>"{h.new_status}"</strong> by {h.changed_by}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {new Date(h.changed_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
