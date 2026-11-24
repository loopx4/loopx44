import React, { useState, useEffect } from 'react';
import { DataService, DEFAULT_LOOPX_QUESTIONS } from '../services/dataService';

export default function ClientSubmissionPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [linkRecord, setLinkRecord] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [existingSubmission, setExistingSubmission] = useState(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // Dynamic answers state: map of question ID/label to value
  const [answers, setAnswers] = useState({});
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

        // Extract questions from link's snapshot or shared form config
        if (link.form_snapshot && Array.isArray(link.form_snapshot) && link.form_snapshot.length > 0) {
          setQuestions(link.form_snapshot);
        } else {
          const config = await DataService.getFormConfig();
          setQuestions(config?.questions || DEFAULT_LOOPX_QUESTIONS);
        }

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

  const handleAnswerChange = (qKey, value) => {
    setAnswers((prev) => ({ ...prev, [qKey]: value }));
  };

  const handleCheckboxChange = (qKey, option, isChecked) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[qKey]) ? [...prev[qKey]] : [];
      if (isChecked) {
        if (!current.includes(option)) current.push(option);
      } else {
        const idx = current.indexOf(option);
        if (idx !== -1) current.splice(idx, 1);
      }
      return { ...prev, [qKey]: current };
    });
  };

  const handleFileChange = (e) => {
    setUploadError('');
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Check individual file limit (5 MB)
    for (const f of selectedFiles) {
      if (f.size > 5 * 1024 * 1024) {
        setUploadError(`File "${f.name}" (${(f.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB individual limit.`);
        return;
      }
    }

    // Check combined total size (30 MB)
    const existingSize = files.reduce((acc, f) => acc + (f.size || 0), 0);
    const newSelectedSize = selectedFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    const combinedTotal = existingSize + newSelectedSize;

    if (combinedTotal > 30 * 1024 * 1024) {
      setUploadError(`Combined file size (${(combinedTotal / (1024 * 1024)).toFixed(2)} MB) exceeds the 30 MB maximum limit.`);
      return;
    }

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

    // Dynamic validation of required questions
    for (const q of questions) {
      if (q.question_type === 'file_upload') continue;
      if (q.is_required) {
        const ans = answers[q.label] ?? answers[q.id];
        if (ans === undefined || ans === null || (typeof ans === 'string' && !ans.trim()) || (Array.isArray(ans) && ans.length === 0)) {
          setError(`"${q.label}" is required. Please provide an answer.`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      // Build responses map
      const responsesMap = {};
      questions.forEach((q) => {
        if (q.question_type !== 'file_upload') {
          responsesMap[q.label] = answers[q.label] ?? answers[q.id] ?? '';
        }
      });

      const payload = {
        responses: responsesMap
      };

      const res = await DataService.submitClientForm(token, payload, files);
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
        <p style={{ color: 'var(--text-muted)' }}>Loading client intake portal...</p>
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
    const subResponses = sub.responses || {};

    return (
      <div className="app-container" style={{ maxWidth: '820px', marginTop: '30px' }}>
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
            {submitSuccess ? '✓ SUBMISSION RECEIVED & CONFIRMED' : '✓ SUBMISSION RECORD LOCKED (READ-ONLY)'}
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
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>
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
            Submitted on <strong style={{ color: 'var(--text-white)' }}>{new Date(sub.submitted_at).toLocaleString()}</strong> by{' '}
            <strong style={{ color: 'var(--text-white)' }}>{sub.client_name || 'Client'}</strong>. Handled by representative{' '}
            <strong style={{ color: 'var(--color-green)' }}>{sub.created_by_name}</strong>.
          </p>

          {/* Submitted Responses Display */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
            {questions.map((q, idx) => {
              if (q.question_type === 'file_upload') return null;
              const ansVal = subResponses[q.label] ?? subResponses[q.id] ?? sub[q.label] ?? '—';
              const displayVal = Array.isArray(ansVal) ? ansVal.join(', ') : String(ansVal || '—');

              return (
                <div key={q.id || idx} style={{ backgroundColor: '#0d0d0d', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', marginBottom: '4px' }}>
                    {idx + 1}. {q.label}
                  </div>
                  <div style={{ color: 'var(--text-white)', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                    {displayVal}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Attached Files Display */}
          {sub.files && sub.files.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', marginTop: '20px' }}>
              <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Attached Files ({sub.files.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {sub.files.map((file, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#0d0d0d', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-white)' }}>
                      📄 {file.name} ({Math.round(file.size / 1024)} KB)
                    </span>
                    {file.dataUrl && (
                      <a href={file.dataUrl} download={file.name} className="btn-outline-green" style={{ padding: '2px 8px', fontSize: '11px' }}>
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
            This record is locked. Keep your queue number <strong style={{ color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>{sub.queue_number}</strong> for tracking your project status.
          </div>
        </div>
      </div>
    );
  }

  // 4. Active Client Intake Form
  return (
    <div className="app-container" style={{ maxWidth: '820px', marginTop: '20px', marginBottom: '60px' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <img src="/assets/loopx-logo.png" alt="LoopX" style={{ height: '36px', marginBottom: '12px' }} />
        <h1 style={{ fontSize: '1.6rem', color: 'var(--text-white)', marginBottom: '6px' }}>
          Client Requirements Intake
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Invited by LoopX Representative: <strong style={{ color: 'var(--color-green)' }}>{linkRecord?.created_by_name}</strong>
        </p>
      </div>

      <div className="card" style={{ padding: '32px' }}>
        {error && (
          <div style={{ backgroundColor: '#1a0505', border: '1px solid #661111', color: 'var(--color-error)', padding: '12px 16px', borderRadius: '4px', fontSize: '13px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {questions.map((q, idx) => {
              const qKey = q.label;
              const val = answers[qKey] ?? '';

              return (
                <div key={q.id || idx} className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor={`field_${idx}`} style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '4px' }}>
                    {idx + 1}. {q.label} {q.is_required && <span style={{ color: 'var(--color-error)' }}>*</span>}
                  </label>
                  {q.description && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      {q.description}
                    </div>
                  )}

                  {/* 1. Short Answer */}
                  {q.question_type === 'short_answer' && (
                    <input
                      id={`field_${idx}`}
                      type="text"
                      value={val}
                      onChange={(e) => handleAnswerChange(qKey, e.target.value)}
                      placeholder="Your answer"
                      required={q.is_required}
                    />
                  )}

                  {/* 2. Long Answer */}
                  {q.question_type === 'long_answer' && (
                    <textarea
                      id={`field_${idx}`}
                      rows={4}
                      value={val}
                      onChange={(e) => handleAnswerChange(qKey, e.target.value)}
                      placeholder="Detailed explanation..."
                      required={q.is_required}
                    />
                  )}

                  {/* 3. Phone */}
                  {q.question_type === 'phone' && (
                    <input
                      id={`field_${idx}`}
                      type="tel"
                      value={val}
                      onChange={(e) => handleAnswerChange(qKey, e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      required={q.is_required}
                    />
                  )}

                  {/* 4. Email */}
                  {q.question_type === 'email' && (
                    <input
                      id={`field_${idx}`}
                      type="email"
                      value={val}
                      onChange={(e) => handleAnswerChange(qKey, e.target.value)}
                      placeholder="contact@business.com"
                      required={q.is_required}
                    />
                  )}

                  {/* 5. Date */}
                  {q.question_type === 'date' && (
                    <input
                      id={`field_${idx}`}
                      type="date"
                      value={val}
                      onChange={(e) => handleAnswerChange(qKey, e.target.value)}
                      required={q.is_required}
                    />
                  )}

                  {/* 6. Dropdown */}
                  {q.question_type === 'dropdown' && (
                    <select
                      id={`field_${idx}`}
                      value={val}
                      onChange={(e) => handleAnswerChange(qKey, e.target.value)}
                      required={q.is_required}
                    >
                      <option value="">Select an option...</option>
                      {(q.options || []).map((opt, oIdx) => (
                        <option key={oIdx} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}

                  {/* 7. Multiple Choice */}
                  {q.question_type === 'multiple_choice' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      {(q.options || []).map((opt, oIdx) => (
                        <label key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-white)', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="radio"
                            name={`radio_${idx}`}
                            value={opt}
                            checked={val === opt}
                            onChange={() => handleAnswerChange(qKey, opt)}
                            required={q.is_required}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* 8. Checkboxes */}
                  {q.question_type === 'checkboxes' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      {(q.options || []).map((opt, oIdx) => {
                        const isChecked = Array.isArray(val) && val.includes(opt);
                        return (
                          <label key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: 'var(--text-white)', cursor: 'pointer', margin: 0 }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => handleCheckboxChange(qKey, opt, e.target.checked)}
                            />
                            <span>{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* 9. File Upload */}
                  {q.question_type === 'file_upload' && (
                    <div>
                      <input
                        id={`field_${idx}`}
                        type="file"
                        multiple
                        onChange={handleFileChange}
                        style={{ padding: '8px', cursor: 'pointer', width: '100%' }}
                      />
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Limits: 5 MB per individual file • 30 MB combined per submission
                      </div>
                      {uploadError && <div className="form-error" style={{ marginTop: '6px' }}>{uploadError}</div>}
                      {files.length > 0 && (
                        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ fontSize: '12px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)' }}>
                            {files.length} {files.length === 1 ? 'file' : 'files'} attached • {(files.reduce((a, b) => a + (b.size || 0), 0) / (1024 * 1024)).toFixed(2)} MB / 30 MB combined
                          </div>
                          {files.map((f, fIdx) => (
                            <div key={fIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', backgroundColor: '#0d0d0d', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                              <span style={{ fontSize: '12px' }}>{f.name} ({(f.size / (1024 * 1024) >= 1 ? `${(f.size / (1024 * 1024)).toFixed(2)} MB` : `${Math.round(f.size / 1024)} KB`)})</span>
                              <button type="button" onClick={() => removeFile(fIdx)} className="btn-danger" style={{ padding: '2px 6px', fontSize: '10px' }}>Remove</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '24px', marginTop: '30px' }}>
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
