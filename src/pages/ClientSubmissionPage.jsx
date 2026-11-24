import React, { useState, useEffect } from 'react';
import { DataService } from '../services/dataService';

export default function ClientSubmissionPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [linkRecord, setLinkRecord] = useState(null);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    client_name: '',
    business_name: '',
    phone: '',
    email: '',
    location: '',
    business_type: '',
    services_required: '',
    detailed_requirements: '',
    additional_info: ''
  });

  const [files, setFiles] = useState([]);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    async function loadLink() {
      if (!token) {
        setError('No submission token provided.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const link = await DataService.getClientLinkByToken(token);
        if (!link) {
          setError('This client submission link is invalid, expired, or was removed.');
          setLoading(false);
          return;
        }

        setLinkRecord(link);

        // Check if link was already submitted (Read-only mode check)
        if (link.status === 'submitted') {
          const sub = await DataService.getSubmissionByToken(token);
          setExistingSubmission(sub);
        }
      } catch (err) {
        console.error('Failed to load client link:', err);
        setError('Unable to verify submission link. Please check your network.');
      } finally {
        setLoading(false);
      }
    }

    loadLink();
  }, [token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setUploadError('');
    const selectedFiles = Array.from(e.target.files || []);

    // Check size limit: max 15MB total
    const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
    if (totalSize > 15 * 1024 * 1024) {
      setUploadError('Total file size must not exceed 15MB.');
      return;
    }

    // Process files
    const filePromises = selectedFiles.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: event.target.result
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(filePromises).then((processed) => {
      setFiles((prev) => [...prev, ...processed]);
    });
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.client_name.trim()) return setError('Client Name is required.');
    if (!formData.business_name.trim()) return setError('Business/Organisation Name is required.');
    if (!formData.phone.trim()) return setError('Phone Number is required.');
    if (!formData.location.trim()) return setError('Business Location is required.');
    if (!formData.business_type.trim()) return setError('Business Type is required.');
    if (!formData.services_required.trim()) return setError('Services Required is required.');
    if (!formData.detailed_requirements.trim()) return setError('Detailed Requirements is required.');

    setIsSubmitting(true);
    try {
      const res = await DataService.submitClientForm(token, formData, files);
      if (!res.success) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }

      setSubmitSuccess(res);
      setExistingSubmission(res.submission);
    } catch (err) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading client portal...</p>
      </div>
    );
  }

  // 2. Error / Invalid Link State
  if (error && !existingSubmission && !linkRecord) {
    return (
      <div className="app-container" style={{ maxWidth: '600px', marginTop: '60px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <img src="/assets/loopx-logo.png" alt="LoopX" style={{ height: '32px', marginBottom: '24px' }} />
          <h2 style={{ color: 'var(--color-error)', marginBottom: '12px' }}>Invalid Submission Link</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
            {error}
          </p>
          <div style={{ fontSize: '13px', color: 'var(--text-subtle)' }}>
            If you believe this is an error, please reach out to your LoopX account representative.
          </div>
        </div>
      </div>
    );
  }

  // 3. Submitted / Read-Only View (or freshly submitted view)
  if (existingSubmission) {
    const sub = existingSubmission;
    return (
      <div className="app-container" style={{ maxWidth: '780px', marginTop: '30px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img src="/assets/loopx-logo.png" alt="LoopX" style={{ height: '36px', marginBottom: '16px' }} />
          <div
            style={{
              display: 'inline-block',
              backgroundColor: '#0c1a05',
              border: '1px solid #234f07',
              color: 'var(--color-green)',
              padding: '6px 14px',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            {submitSuccess ? '✓ SUBMISSION RECEIVED SUCCESSFULLY' : '✓ SUBMISSION RECORD LOCKED (READ-ONLY)'}
          </div>
        </div>

        <div className="card" style={{ padding: '32px', marginBottom: '30px' }}>
          {/* Header Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '20px',
              marginBottom: '24px',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Assigned Queue Number
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>
                {sub.queue_number}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Current Status
              </div>
              <span className={`badge badge-${(sub.current_status || 'pending').toLowerCase()}`} style={{ fontSize: '13px', padding: '6px 12px' }}>
                {sub.current_status}
              </span>
            </div>
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '24px' }}>
            Submitted on {new Date(sub.submitted_at).toLocaleString()} • Managed by LoopX Partner ({sub.created_by_name || 'LoopX Team'})
          </p>

          {/* Submitted Information Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div>
              <label style={{ color: 'var(--text-muted)' }}>Client Name</label>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{sub.client_name}</div>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)' }}>Business / Organisation</label>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{sub.business_name}</div>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)' }}>Phone Number</label>
              <div style={{ fontSize: '15px', fontFamily: 'var(--font-mono)' }}>{sub.phone}</div>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)' }}>Email Address</label>
              <div style={{ fontSize: '15px' }}>{sub.email || '—'}</div>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)' }}>Business Location</label>
              <div style={{ fontSize: '15px' }}>{sub.location}</div>
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)' }}>Business Type</label>
              <div style={{ fontSize: '15px' }}>{sub.business_type}</div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: 'var(--text-muted)' }}>Services Required</label>
            <div style={{ fontSize: '14px', backgroundColor: '#0d0d0d', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
              {sub.services_required}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: 'var(--text-muted)' }}>Detailed Requirements</label>
            <div style={{ fontSize: '14px', backgroundColor: '#0d0d0d', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap' }}>
              {sub.detailed_requirements}
            </div>
          </div>

          {sub.additional_info && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: 'var(--text-muted)' }}>Additional Information</label>
              <div style={{ fontSize: '14px', backgroundColor: '#0d0d0d', padding: '12px', borderRadius: '4px', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap' }}>
                {sub.additional_info}
              </div>
            </div>
          )}

          {/* Uploaded Files Section */}
          <div>
            <label style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>
              Uploaded Photos & Documents ({sub.files ? sub.files.length : 0})
            </label>
            {!sub.files || sub.files.length === 0 ? (
              <div style={{ color: 'var(--text-subtle)', fontSize: '13px' }}>No files attached to this submission.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sub.files.map((file, idx) => (
                  <div
                    key={idx}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-green)' }}>
                        [{idx + 1}]
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{file.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </div>

                    {file.dataUrl && (
                      <a
                        href={file.dataUrl}
                        download={file.name}
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '13px' }}>
          Notice: This submission link is now locked in read-only mode. You can bookmark and reopen this exact page anytime to view the live status of your queue number.
        </div>
      </div>
    );
  }

  // 4. Initial Submission Form (Link is active, not submitted yet)
  return (
    <div className="app-container" style={{ maxWidth: '780px', marginTop: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <img src="/assets/loopx-logo.png" alt="LoopX" style={{ height: '36px', marginBottom: '16px' }} />
        <h1 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Client Onboarding & Project Intake</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Please complete your business details and project requirements below. Upon submission, your queue number will be assigned.
        </p>
      </div>

      <div className="card" style={{ padding: '32px' }}>
        {error && (
          <div
            style={{
              backgroundColor: '#1a0505',
              border: '1px solid #661111',
              color: 'var(--color-error)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              marginBottom: '20px'
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Section 1: Contact & Organisation */}
          <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', marginBottom: '16px', color: 'var(--color-green)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            1. Client & Business Information
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div className="form-group">
              <label htmlFor="client_name">Client Name *</label>
              <input
                id="client_name"
                name="client_name"
                type="text"
                placeholder="Full Name"
                value={formData.client_name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="business_name">Business / Organisation Name *</label>
              <input
                id="business_name"
                name="business_name"
                type="text"
                placeholder="e.g. Apex Dynamics Ltd"
                value={formData.business_name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address (Optional)</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="contact@business.com"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="location">Business Location *</label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="City, State / Country"
                value={formData.location}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="business_type">Business Type *</label>
              <input
                id="business_type"
                name="business_type"
                type="text"
                placeholder="e.g. Healthcare, Real Estate, E-Commerce"
                value={formData.business_type}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* Section 2: Requirements */}
          <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', marginTop: '16px', marginBottom: '16px', color: 'var(--color-green)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            2. Scope & Technical Requirements
          </h3>

          <div className="form-group">
            <label htmlFor="services_required">Services Required *</label>
            <input
              id="services_required"
              name="services_required"
              type="text"
              placeholder="e.g. Workflow Automation, CRM Integration, Web Application"
              value={formData.services_required}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="detailed_requirements">Detailed Requirements *</label>
            <textarea
              id="detailed_requirements"
              name="detailed_requirements"
              rows={4}
              placeholder="Describe your current process, goals, features needed, and expectations..."
              value={formData.detailed_requirements}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="additional_info">Additional Information (Optional)</label>
            <textarea
              id="additional_info"
              name="additional_info"
              rows={2}
              placeholder="Any deadlines, budget range, existing tools in use, or reference links..."
              value={formData.additional_info}
              onChange={handleInputChange}
            />
          </div>

          {/* Section 3: File Uploads */}
          <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', marginTop: '16px', marginBottom: '16px', color: 'var(--color-green)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            3. Photo & Document Uploads
          </h3>

          <div className="form-group">
            <label htmlFor="file_upload">Attach Photos, Schematics, or Documents (Max 15MB total)</label>
            <input
              id="file_upload"
              type="file"
              multiple
              onChange={handleFileChange}
              style={{ padding: '8px', cursor: 'pointer' }}
            />
            {uploadError && <div className="form-error">{uploadError}</div>}
          </div>

          {files.length > 0 && (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {files.map((file, i) => (
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
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="btn-danger"
                    style={{ padding: '2px 8px', fontSize: '11px' }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '24px', marginTop: '24px' }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '15px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Generating Queue Number & Submitting...' : 'Submit Requirements & Generate Queue Number'}
            </button>
            <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
              Your submission will be permanently timestamped and assigned an immutable sequential queue ID.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
