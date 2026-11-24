import React, { useState, useEffect } from 'react';
import { DataService, DEFAULT_LOOPX_QUESTIONS } from '../services/dataService';

const QUESTION_TYPES = [
  { value: 'short_answer', label: 'Short Answer (Single line)' },
  { value: 'long_answer', label: 'Long Answer (Paragraph)' },
  { value: 'multiple_choice', label: 'Multiple Choice (Single select radio)' },
  { value: 'checkboxes', label: 'Checkboxes (Multi-select)' },
  { value: 'dropdown', label: 'Dropdown Menu' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'email', label: 'Email Address' },
  { value: 'date', label: 'Date Picker' },
  { value: 'file_upload', label: 'File Upload (Max 5MB each, 30MB combined)' }
];

export default function FormBuilder({ activeProfile, onLinkGenerated }) {
  const [formTitle, setFormTitle] = useState('LoopX Client Intake Questionnaire');
  const [formDescription, setFormDescription] = useState('Please provide complete business and technical details for your project onboarding.');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  // Load shared questionnaire on mount
  useEffect(() => {
    async function loadConfig() {
      try {
        setLoading(true);
        const config = await DataService.getFormConfig();
        if (config) {
          setFormTitle(config.title || 'LoopX Client Intake Questionnaire');
          setFormDescription(config.description || '');
          setQuestions(config.questions || DEFAULT_LOOPX_QUESTIONS);
        }
      } catch (err) {
        console.error('Failed to load questionnaire config:', err);
        setQuestions(DEFAULT_LOOPX_QUESTIONS);
      } finally {
        setLoading(false);
      }
    }
    loadConfig();
  }, []);

  // Question manipulation handlers
  const handleAddQuestion = () => {
    const newQ = {
      id: 'q_' + Date.now(),
      label: 'New Question',
      description: '',
      question_type: 'short_answer',
      options: ['Option 1', 'Option 2'],
      is_required: false,
      order_index: questions.length
    };
    setQuestions([...questions, newQ]);
  };

  const handleDeleteQuestion = (index) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  const handleMoveQuestion = (index, direction) => {
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= questions.length) return;
    const updated = [...questions];
    const temp = updated[index];
    updated[index] = updated[newIdx];
    updated[newIdx] = temp;
    setQuestions(updated);
  };

  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };

    // If changing to choice type and no options exist, seed default options
    if (['multiple_choice', 'checkboxes', 'dropdown'].includes(value) && (!updated[index].options || updated[index].options.length === 0)) {
      updated[index].options = ['Option 1', 'Option 2'];
    }

    setQuestions(updated);
  };

  // Option manipulation handlers
  const handleAddOption = (qIndex) => {
    const updated = [...questions];
    const opts = updated[qIndex].options || [];
    updated[qIndex].options = [...opts, `Option ${opts.length + 1}`];
    setQuestions(updated);
  };

  const handleUpdateOption = (qIndex, optIndex, value) => {
    const updated = [...questions];
    const opts = [...(updated[qIndex].options || [])];
    opts[optIndex] = value;
    updated[qIndex].options = opts;
    setQuestions(updated);
  };

  const handleDeleteOption = (qIndex, optIndex) => {
    const updated = [...questions];
    const opts = updated[qIndex].options.filter((_, i) => i !== optIndex);
    updated[qIndex].options = opts;
    setQuestions(updated);
  };

  // Save shared questionnaire
  const handleSaveForm = async () => {
    setError('');
    setSaveMessage('');
    setSaving(true);
    try {
      const res = await DataService.saveFormConfig({
        title: formTitle,
        description: formDescription,
        questions: questions,
        author: activeProfile?.name || 'Team Member'
      });
      if (!res.success) {
        setError(res.error || 'Failed to save questionnaire.');
        return false;
      }
      setSaveMessage('✓ Shared questionnaire configuration saved successfully! (Available to all team members)');
      setTimeout(() => setSaveMessage(''), 4000);
      return true;
    } catch (err) {
      setError(err.message || 'Failed to save questionnaire.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Save & Generate Client Link
  const handleSaveAndGenerateLink = async () => {
    setError('');
    const saved = await handleSaveForm();
    if (!saved) return;

    setGenerating(true);
    try {
      const linkRecord = await DataService.createClientLink(
        activeProfile.id,
        activeProfile.name,
        questions
      );
      const subPath = window.location.pathname.startsWith('/loopx44') ? '/loopx44' : '';
      const fullUrl = `${window.location.origin}${subPath}/submit/${linkRecord.token}`;
      if (onLinkGenerated) {
        onLinkGenerated({
          ...linkRecord,
          url: fullUrl
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to generate link.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading shared questionnaire configuration...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto' }}>
      {/* Builder Header Card */}
      <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '4px' }}>
              SHARED INTAKE QUESTIONNAIRE BUILDER
            </div>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--text-white)' }}>
              Configure Client Questionnaire
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Customize questions, types, options, and required fields. All changes automatically sync for all employees.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '13px' }}
            >
              {previewMode ? '✎ Back to Editor' : '👁 Preview Client Form'}
            </button>
            <button
              type="button"
              onClick={handleSaveForm}
              disabled={saving}
              className="btn-outline-green"
              style={{ padding: '8px 14px', fontSize: '13px' }}
            >
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ backgroundColor: '#1a0505', border: '1px solid #661111', color: 'var(--color-error)', padding: '10px 14px', borderRadius: '4px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {saveMessage && (
          <div style={{ backgroundColor: '#0c1a05', border: '1px solid #234f07', color: 'var(--color-green)', padding: '10px 14px', borderRadius: '4px', fontSize: '13px', marginBottom: '16px' }}>
            {saveMessage}
          </div>
        )}

        {!previewMode ? (
          <div>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="formTitle">Questionnaire Title</label>
              <input
                id="formTitle"
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                style={{ fontSize: '16px', fontWeight: 600 }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: '0' }}>
              <label htmlFor="formDesc">Form Instructions / Description (Shown to Client)</label>
              <textarea
                id="formDesc"
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div style={{ backgroundColor: '#0d0d0d', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '16px' }}>
            <h1 style={{ fontSize: '1.4rem', color: 'var(--color-green)', marginBottom: '8px' }}>{formTitle}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{formDescription}</p>
          </div>
        )}
      </div>

      {/* PREVIEW MODE */}
      {previewMode ? (
        <div className="card" style={{ padding: '28px', marginBottom: '24px' }}>
          <div style={{ fontSize: '12px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: '18px' }}>
            Interactive Client Preview ({questions.length} Questions)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {questions.map((q, idx) => (
              <div key={q.id || idx} style={{ backgroundColor: '#0d0d0d', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-green)', fontWeight: 700, fontSize: '13px' }}>
                    {idx + 1}.
                  </span>
                  <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-white)', margin: 0 }}>
                    {q.label} {q.is_required && <span style={{ color: 'var(--color-error)' }}>*</span>}
                  </label>
                </div>
                {q.description && (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    {q.description}
                  </p>
                )}

                {/* Question Type Inputs */}
                {q.question_type === 'short_answer' && (
                  <input type="text" placeholder="Short answer text" disabled style={{ opacity: 0.7 }} />
                )}
                {q.question_type === 'long_answer' && (
                  <textarea rows={3} placeholder="Detailed paragraph response..." disabled style={{ opacity: 0.7 }} />
                )}
                {q.question_type === 'phone' && (
                  <input type="tel" placeholder="+1 (555) 000-0000" disabled style={{ opacity: 0.7 }} />
                )}
                {q.question_type === 'email' && (
                  <input type="email" placeholder="client@example.com" disabled style={{ opacity: 0.7 }} />
                )}
                {q.question_type === 'date' && (
                  <input type="date" disabled style={{ opacity: 0.7 }} />
                )}
                {q.question_type === 'dropdown' && (
                  <select disabled style={{ opacity: 0.7 }}>
                    <option value="">Select an option...</option>
                    {(q.options || []).map((opt, oIdx) => (
                      <option key={oIdx} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
                {q.question_type === 'multiple_choice' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    {(q.options || []).map((opt, oIdx) => (
                      <label key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-white)', cursor: 'default' }}>
                        <input type="radio" name={`prev_${idx}`} disabled /> {opt}
                      </label>
                    ))}
                  </div>
                )}
                {q.question_type === 'checkboxes' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    {(q.options || []).map((opt, oIdx) => (
                      <label key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-white)', cursor: 'default' }}>
                        <input type="checkbox" disabled /> {opt}
                      </label>
                    ))}
                  </div>
                )}
                {q.question_type === 'file_upload' && (
                  <div style={{ border: '1px dashed var(--border-strong)', padding: '16px', borderRadius: '4px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    📁 Attach photo, schematic, or document (Max 15MB)
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* QUESTION LIST EDITOR */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {questions.map((q, idx) => (
            <div
              key={q.id || idx}
              className="card"
              style={{
                padding: '20px',
                borderLeft: q.is_required ? '3px solid var(--color-green)' : '3px solid var(--border-subtle)',
                backgroundColor: '#0a0a0a'
              }}
            >
              {/* Question Header Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-green)', fontWeight: 700, fontSize: '13px' }}>
                    Q{idx + 1}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {QUESTION_TYPES.find((t) => t.value === q.question_type)?.label || q.question_type}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Reorder Buttons */}
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(idx, -1)}
                    disabled={idx === 0}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    title="Move Question Up"
                  >
                    ↑ Up
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveQuestion(idx, 1)}
                    disabled={idx === questions.length - 1}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    title="Move Question Down"
                  >
                    ↓ Down
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(idx)}
                    className="btn-danger"
                    style={{ padding: '4px 8px', fontSize: '11px', marginLeft: '6px' }}
                  >
                    ✕ Delete
                  </button>
                </div>
              </div>

              {/* Question Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px' }}>Question Title / Label *</label>
                  <input
                    type="text"
                    value={q.label}
                    onChange={(e) => handleUpdateQuestion(idx, 'label', e.target.value)}
                    placeholder="e.g. Target Delivery Date"
                  />
                </div>

                <div>
                  <label style={{ fontSize: '12px' }}>Question Type</label>
                  <select
                    value={q.question_type}
                    onChange={(e) => handleUpdateQuestion(idx, 'question_type', e.target.value)}
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px' }}>Description / Helper text (Optional)</label>
                <input
                  type="text"
                  value={q.description || ''}
                  onChange={(e) => handleUpdateQuestion(idx, 'description', e.target.value)}
                  placeholder="Instructions or context for client..."
                />
              </div>

              {/* Options Editor for Choice Types */}
              {['multiple_choice', 'checkboxes', 'dropdown'].includes(q.question_type) && (
                <div style={{ backgroundColor: '#111', padding: '12px 16px', borderRadius: '4px', marginBottom: '12px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-white)' }}>
                      Answer Options ({(q.options || []).length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddOption(idx)}
                      className="btn-outline-green"
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      + Add Option
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(q.options || []).map((opt, oIdx) => (
                      <div key={oIdx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', width: '20px' }}>
                          {oIdx + 1}.
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => handleUpdateOption(idx, oIdx, e.target.value)}
                          placeholder={`Option ${oIdx + 1}`}
                          style={{ padding: '6px 10px', fontSize: '13px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteOption(idx, oIdx)}
                          className="btn-danger"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          title="Remove Option"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer controls: Required toggle */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(q.is_required)}
                    onChange={(e) => handleUpdateQuestion(idx, 'is_required', e.target.checked)}
                  />
                  <span>Required answer</span>
                </label>
              </div>
            </div>
          ))}

          {/* Add Question Button */}
          <button
            type="button"
            onClick={handleAddQuestion}
            className="btn-secondary"
            style={{ padding: '14px', borderStyle: 'dashed', borderColor: 'var(--border-strong)', width: '100%' }}
          >
            + Add New Question
          </button>
        </div>
      )}

      {/* Action Bar / Generate Link Card */}
      <div className="card" style={{ padding: '24px', backgroundColor: '#0d0d0d', border: '1px solid var(--border-green)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--color-green)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
              READY TO DISPATCH?
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-white)', marginTop: '2px' }}>
              Save this questionnaire configuration and generate a unique client intake URL.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleSaveForm}
              disabled={saving}
              className="btn-secondary"
              style={{ padding: '12px 18px' }}
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              type="button"
              onClick={handleSaveAndGenerateLink}
              disabled={generating || saving}
              className="btn-primary"
              style={{ padding: '12px 22px', fontSize: '14px' }}
            >
              {generating ? 'Generating Link...' : '🔗 Save & Generate Client Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
