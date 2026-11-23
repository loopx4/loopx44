import React, { useState, useEffect, useRef } from 'react';
import { DataService } from '../services/dataService';

export default function TeamDiscussion({ currentUserDisplayName, currentUserRole }) {
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allMsgs, allProfiles] = await Promise.all([
        DataService.getChatMessages(),
        DataService.getProfiles()
      ]);
      setMessages(allMsgs || []);
      setProfiles(allProfiles || []);
    } catch (err) {
      console.error('Failed to load team discussion:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to real-time chat updates
    const unsubscribe = DataService.subscribeToChat((newMsg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    const cleanMsg = inputText.trim();
    if (!cleanMsg) return;

    setIsSending(true);

    // Extract @mentions from message text
    const mentionsFound = [];
    profiles.forEach((p) => {
      const regex = new RegExp(`@${p.name}\\b`, 'i');
      if (regex.test(cleanMsg)) {
        mentionsFound.push(p.name);
      }
    });

    try {
      const saved = await DataService.sendChatMessage({
        senderName: currentUserDisplayName,
        senderRole: currentUserRole,
        message: cleanMsg,
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              sender_name: replyingTo.sender_name,
              snippet: replyingTo.message.slice(0, 80)
            }
          : null,
        mentions: mentionsFound
      });

      if (saved) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === saved.id)) return prev;
          return [...prev, saved];
        });
      }

      setInputText('');
      setReplyingTo(null);
      setShowMentionMenu(false);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleInsertMention = (profileName) => {
    setInputText((prev) => `${prev}@${profileName} `);
    setShowMentionMenu(false);
  };

  // Render message body with @mentions highlighted in LoopX green
  const renderMessageBody = (text) => {
    const parts = text.split(/(@[A-Za-z0-9_ -]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={index}
            style={{
              color: 'var(--color-green)',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)'
            }}
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '640px' }}>
      {/* Discussion Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0c0c0c'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--text-white)' }}>Shared Team Discussion</h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Real-time internal updates • Active Sender: <strong style={{ color: 'var(--color-green)' }}>{currentUserDisplayName}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="btn-secondary"
          style={{ padding: '4px 10px', fontSize: '11px' }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Message List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          backgroundColor: '#050505'
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }}>
            Loading discussion feed...
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-state" style={{ margin: 'auto', width: '100%', maxWidth: '420px', padding: '30px' }}>
            <div className="empty-state-title">Zero Chat Messages</div>
            <div className="empty-state-desc">
              No messages have been posted in the team channel yet. Send an update or mention an employee to start.
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_name === currentUserDisplayName;
            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  alignSelf: isMe ? 'flex-end' : 'flex-start'
                }}
              >
                {/* Sender & Timestamp */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '12px' }}>
                  <span style={{ fontWeight: 600, color: isMe ? 'var(--color-green)' : 'var(--text-white)' }}>
                    {msg.sender_name}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      padding: '1px 5px',
                      borderRadius: '2px',
                      backgroundColor: msg.sender_role === 'owner' ? '#1a1f0a' : '#141414',
                      color: msg.sender_role === 'owner' ? 'var(--color-green)' : 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {msg.sender_role}
                  </span>
                  <span style={{ color: 'var(--text-subtle)', fontSize: '11px' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Reply-To Snippet if any */}
                {msg.reply_to && (
                  <div
                    style={{
                      borderLeft: '2px solid var(--color-green)',
                      backgroundColor: '#0a0a0a',
                      padding: '4px 8px',
                      marginBottom: '4px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      borderRadius: '0 4px 4px 0',
                      maxWidth: '100%'
                    }}
                  >
                    <strong style={{ color: 'var(--text-white)' }}>{msg.reply_to.sender_name}:</strong> {msg.reply_to.snippet}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  style={{
                    backgroundColor: isMe ? '#11170d' : '#121212',
                    border: `1px solid ${isMe ? '#253d16' : 'var(--border-subtle)'}`,
                    borderRadius: '6px',
                    padding: '10px 14px',
                    color: 'var(--text-white)',
                    fontSize: '14px',
                    lineHeight: '1.45',
                    wordBreak: 'break-word',
                    position: 'relative'
                  }}
                >
                  <div>{renderMessageBody(msg.message)}</div>

                  <div style={{ marginTop: '6px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(msg)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: '0'
                      }}
                    >
                      ↩ Reply
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div
          style={{
            backgroundColor: '#0d130a',
            borderTop: '1px solid #234f07',
            padding: '8px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px'
          }}
        >
          <div>
            Replying to <strong style={{ color: 'var(--color-green)' }}>{replyingTo.sender_name}</strong>: "{replyingTo.message.slice(0, 60)}..."
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-error)',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Cancel ✕
          </button>
        </div>
      )}

      {/* Mention helper bar */}
      {showMentionMenu && (
        <div
          style={{
            backgroundColor: '#0e0e0e',
            borderTop: '1px solid var(--border-subtle)',
            padding: '8px 16px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center',
            overflowX: 'auto'
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Mention Employee:
          </span>
          {profiles.length === 0 ? (
            <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>No employee profiles created yet.</span>
          ) : (
            profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleInsertMention(p.name)}
                className="btn-secondary"
                style={{ padding: '3px 8px', fontSize: '11px' }}
              >
                @{p.name}
              </button>
            ))
          )}
        </div>
      )}

      {/* Composer Input Form */}
      <form
        onSubmit={handleSend}
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '14px 16px',
          display: 'flex',
          gap: '10px',
          backgroundColor: '#0a0a0a',
          alignItems: 'center'
        }}
      >
        <button
          type="button"
          onClick={() => setShowMentionMenu(!showMentionMenu)}
          className="btn-secondary"
          title="Mention an employee"
          style={{ padding: '10px 12px', fontSize: '12px', flexShrink: 0 }}
        >
          @ Mention
        </button>

        <input
          type="text"
          placeholder={`Type message as ${currentUserDisplayName}... Use @Name to mention`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isSending}
          style={{ flex: 1, padding: '10px 14px' }}
        />

        <button
          type="submit"
          className="btn-primary"
          disabled={isSending || !inputText.trim()}
          style={{ padding: '10px 18px', flexShrink: 0 }}
        >
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
