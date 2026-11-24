import React from 'react';

export default function ConfirmationModal({
  isOpen,
  title = 'Confirm Deletion',
  message = 'Are you sure you want to delete this item?',
  itemName = '',
  itemDetails = '',
  confirmLabel = 'Delete Permanently',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isProcessing = false
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '20px'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '500px',
          backgroundColor: '#0a0a0a',
          border: '1px solid #7f1d1d',
          padding: '28px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <span style={{ fontSize: '24px' }}>⚠️</span>
          <h2 style={{ fontSize: '1.25rem', color: '#f87171', margin: 0, textTransform: 'none' }}>
            {title}
          </h2>
        </div>

        <p style={{ color: 'var(--text-white)', fontSize: '14px', lineHeight: 1.5, marginBottom: '14px' }}>
          {message}
        </p>

        {itemName && (
          <div
            style={{
              backgroundColor: '#170909',
              border: '1px solid #991b1b',
              borderRadius: '4px',
              padding: '10px 14px',
              marginBottom: '16px'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fca5a5' }}>
              {itemName}
            </div>
            {itemDetails && (
              <div style={{ fontSize: '12px', color: '#f87171', marginTop: '4px', opacity: 0.9 }}>
                {itemDetails}
              </div>
            )}
          </div>
        )}

        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          This action will permanently remove the record and any associated storage files. It cannot be undone.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="btn-danger"
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              backgroundColor: '#dc2626',
              borderColor: '#b91c1c',
              color: '#fff',
              fontWeight: 600
            }}
          >
            {isProcessing ? 'Deleting...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
