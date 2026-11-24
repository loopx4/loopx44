import React, { useState, useEffect } from 'react';
import { DataService } from '../services/dataService';
import ConfirmationModal from './ConfirmationModal';

export default function SubmissionDetailModal({
  submission,
  currentUserDisplayName,
  isOwner = false,
  onClose,
  onStatusUpdated,
  onSubmissionDeleted
}) {
  const [currentSub, setCurrentSub] = useState(submission);
  const [currentStatus, setCurrentStatus] = useState(submission.current_status);
  const [history, setHistory] = useState([]);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Editing Client Information State
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    client_name: submission.client_name || '',
    business_name: submission.business_name || '',
    phone: submission.phone || '',
    email: submission.email || '',
    location: submission.location || '',
    business_type: submission.business_type || '',
    services_required: submission.services_required || '',
    detailed_requirements: submission.detailed_requirements || '',
    additional_info: submission.additional_info || ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Deletion Modals State
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isDeletingFile, setIsDeletingFile] = useState(false);
  const [showDeleteSubModal, setShowDeleteSubModal] = useState(false);
  const [isDeletingSub, setIsDeletingSub] = useState(false);

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
    setSuccessMessage('');

    try {
      const updated = await DataService.updateSubmissionStatus(
        submission.id,
        newStatus,
        currentUserDisplayName
      );
      setCurrentStatus(newStatus);
      setCurrentSub((prev) => ({ ...prev, current_status: newStatus }));
      if (onStatusUpdated) onStatusUpdated(updated);

      const hist = await DataService.getStatusHistory(submission.id);
      setHistory(hist || []);
      setSuccessMessage(`Status updated to "${newStatus}"`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setIsSavingEdit(true);
    setError('');
    setSuccessMessage('');

    try {
      const updated = await DataService.updateSubmissionDetails(
        submission.id,
        editFormData,
        currentUserDisplayName
      );
      setCurrentSub(updated);
      setIsEditing(false);
      if (onStatusUpdated) onStatusUpdated(updated);
      setSuccessMessage('Client details updated successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to update client details.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setIsDeletingFile(true);
    setError('');

    try {
      const res = await DataService.deleteSubmissionFile(
        submission.id,
        fileToDelete.storagePath || fileToDelete.name
      );
      if (res && res.submission) {
        setCurrentSub(res.submission);
        if (onStatusUpdated) onStatusUpdated(res.submission);
      }
      setFileToDelete(null);
      setSuccessMessage(`File "${fileToDelete.name}" deleted.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete file.');
    } finally {
      setIsDeletingFile(false);
    }
  };

  const handleConfirmDeleteSubmission = async () => {
    setIsDeletingSub(true);
    setError('');

    try {
      await DataService.deleteSubmission(submission.id);
      setShowDeleteSubModal(false);
      if (onSubmissionDeleted) {
        onSubmissionDeleted(submission.id);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete submission.');
      setIsDeletingSub(false);
    }
  };

  const files = currentSub.files || [];

  return (
    <>
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
            maxWidth: '840px',
            maxHeight: '92vh',
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
                {currentSub.queue_number}
              </span>
              <span className={`badge badge-${currentStatus.toLowerCase()}`}>
                {currentStatus}
              </span>
            </div>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--text-white)', textTransform: 'none', margin: '4px 0' }}>
              {currentSub.business_name} — {currentSub.client_name}
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Assigned Representative: <strong style={{ color: 'var(--text-white)' }}>{currentSub.created_by_name}</strong> • Submitted: {new Date(currentSub.submitted_at).toLocaleString()}
            </div>
          </div>

          {error && (
            <div style={{ backgroundColor: '#1a0505', border: '1px solid #661111', color: 'var(--color-error)', padding: '10px 14px', borderRadius: '4px', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div style={{ backgroundColor: '#0c1a05', border: '1px solid #234f07', color: 'var(--color-green)', padding: '10px 14px', borderRadius: '4px', fontSize: '13px', marginBottom: '16px' }}>
              ✓ {successMessage}
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
              Workflow Status
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

          {/* Client Information Header & Edit Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-white)', margin: 0 }}>
              Client Details & Specifications
            </h3>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {isEditing ? '✕ Cancel Editing' : '✎ Edit Client Information'}
            </button>
          </div>

          {/* Edit Form Mode */}
          {isEditing ? (
            <form onSubmit={handleSaveEdit} style={{ backgroundColor: '#111111', border: '1px solid var(--border-strong)', borderRadius: '6px', padding: '18px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Client Full Name</label>
                  <input
                    type="text"
                    value={editFormData.client_name}
                    onChange={(e) => setEditFormData({ ...editFormData, client_name: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Business / Organisation Name</label>
                  <input
                    type="text"
                    value={editFormData.business_name}
                    onChange={(e) => setEditFormData({ ...editFormData, business_name: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email Address</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Business Location</label>
                  <input
                    type="text"
                    value={editFormData.location}
                    onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Business Sector / Type</label>
                  <input
                    type="text"
                    value={editFormData.business_type}
                    onChange={(e) => setEditFormData({ ...editFormData, business_type: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Services Required</label>
                <input
                  type="text"
                  value={editFormData.services_required}
                  onChange={(e) => setEditFormData({ ...editFormData, services_required: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Detailed Requirements</label>
                <textarea
                  rows={4}
                  value={editFormData.detailed_requirements}
                  onChange={(e) => setEditFormData({ ...editFormData, detailed_requirements: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn-secondary"
                  disabled={isSavingEdit}
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSavingEdit}
                  style={{ padding: '8px 18px', fontSize: '13px' }}
                >
                  {isSavingEdit ? 'Saving Changes...' : 'Save Updates'}
                </button>
              </div>
            </form>
          ) : (
            /* Read-Only Details Grid */
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  backgroundColor: '#111111',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: '16px'
                }}
              >
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Client Name</label>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-white)' }}>{currentSub.client_name}</div>
                </div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Business Name</label>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-white)' }}>{currentSub.business_name}</div>
                </div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Phone</label>
                  <div style={{ fontSize: '14px' }}>{currentSub.phone || '—'}</div>
                </div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Email</label>
                  <div style={{ fontSize: '14px' }}>{currentSub.email || '—'}</div>
                </div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Location</label>
                  <div style={{ fontSize: '14px' }}>{currentSub.location}</div>
                </div>
                <div>
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Business Sector</label>
                  <div style={{ fontSize: '14px' }}>{currentSub.business_type}</div>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Services Required</label>
                <div style={{ fontSize: '14px', backgroundColor: '#0d0d0d', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                  {currentSub.services_required}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Detailed Requirements</label>
                <div style={{ fontSize: '14px', backgroundColor: '#0d0d0d', padding: '12px 14px', borderRadius: '4px', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap' }}>
                  {currentSub.detailed_requirements}
                </div>
              </div>

              {currentSub.additional_info && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Additional Information</label>
                  <div style={{ fontSize: '14px', backgroundColor: '#0d0d0d', padding: '10px 14px', borderRadius: '4px', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap' }}>
                    {currentSub.additional_info}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Questionnaire Responses */}
          {currentSub.responses && Object.keys(currentSub.responses).length > 0 && (
            <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <label style={{ color: 'var(--color-green)', fontSize: '12px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', marginBottom: '10px', display: 'block' }}>
                Custom Questionnaire Responses
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(currentSub.responses).map(([label, val], idx) => {
                  const displayVal = Array.isArray(val) ? val.join(', ') : String(val || '—');
                  return (
                    <div key={idx} style={{ backgroundColor: '#0d0d0d', border: '1px solid var(--border-subtle)', borderRadius: '4px', padding: '10px 14px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                        {label}
                      </div>
                      <div style={{ fontSize: '14px', color: 'var(--text-white)', whiteSpace: 'pre-wrap' }}>
                        {displayVal}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Uploaded Files with Individual Deletion */}
          <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                Uploaded Documents & Files ({files.length})
              </label>
              {files.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>
                  Total: {(files.reduce((a, b) => a + (Number(b.size) || 0), 0) / (1024 * 1024)).toFixed(2)} MB
                </span>
              )}
            </div>

            {files.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>No files attached to this record.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {files.map((file, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      backgroundColor: '#0d0d0d',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-white)' }}>
                        📄 {file.name}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                        ({(Number(file.size) / (1024 * 1024) >= 1 ? `${(Number(file.size) / (1024 * 1024)).toFixed(2)} MB` : `${Math.round(Number(file.size) / 1024)} KB`)})
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {file.dataUrl && (
                        <a
                          href={file.dataUrl}
                          download={file.name}
                          className="btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                        >
                          Download
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setFileToDelete(file)}
                        className="btn-danger"
                        style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#450a0a', borderColor: '#7f1d1d' }}
                      >
                        Delete File
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Audit Trail */}
          <div style={{ marginBottom: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <label style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px', display: 'block' }}>
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
                      padding: '8px 12px',
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

          {/* Bottom Destructive Action: Delete Entire Submission */}
          <div style={{ borderTop: '1px solid #331111', paddingTop: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Queue Number: <strong style={{ color: 'var(--color-green)' }}>{currentSub.queue_number}</strong>
            </div>
            <button
              type="button"
              onClick={() => setShowDeleteSubModal(true)}
              className="btn-danger"
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                backgroundColor: '#7f1d1d',
                borderColor: '#991b1b'
              }}
            >
              Delete Submission Record
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for File Deletion */}
      <ConfirmationModal
        isOpen={Boolean(fileToDelete)}
        title="Delete Uploaded File"
        message="Are you sure you want to permanently delete this file? This will remove the object from storage and cannot be restored."
        itemName={fileToDelete?.name}
        itemDetails={fileToDelete ? `${(Number(fileToDelete.size) / (1024 * 1024)).toFixed(2)} MB • Linked to ${currentSub.queue_number}` : ''}
        confirmLabel="Delete File"
        isProcessing={isDeletingFile}
        onCancel={() => setFileToDelete(null)}
        onConfirm={handleConfirmDeleteFile}
      />

      {/* Confirmation Modal for Submission Deletion */}
      <ConfirmationModal
        isOpen={showDeleteSubModal}
        title="Delete Entire Client Submission"
        message="Are you sure you want to delete this submission record? All submitted business details, status history, and attached files in storage will be permanently erased."
        itemName={`${currentSub.queue_number} — ${currentSub.business_name}`}
        itemDetails={`Client: ${currentSub.client_name} • Files: ${files.length}`}
        confirmLabel="Delete Submission Permanently"
        isProcessing={isDeletingSub}
        onCancel={() => setShowDeleteSubModal(false)}
        onConfirm={handleConfirmDeleteSubmission}
      />
    </>
  );
}
