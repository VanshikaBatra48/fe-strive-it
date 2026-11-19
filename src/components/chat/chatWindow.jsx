import { useEffect, useRef, useState } from 'react';
import AttachmentView from './attachmentView';

const formatTime = (iso) =>
  new Date(iso).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

/**
 * Props: group, me {id, role}, messages, hasMore, typingName,
 *        onLoadOlder(), onSend(body, files), onDelete(messageId), onTyping(), onToggleMembers()
 */
export default function ChatWindow({ 
  group,
  me,
  messages,
  hasMore,
  typingName,
  onLoadOlder,
  onSend,
  onDelete,
  onTyping,
  onToggleMembers,
}) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const lastTypingEmit = useRef(0);
  const fileInput = useRef(null);

  const isArchived = group.status === 'archived';
  const canDelete = (m) =>
    !m.deleted &&
    m.type !== 'system' &&
    !isArchived &&
    (m.senderId === me.id);

  // Scroll to bottom only when the NEWEST message changes (not when loading older ones)
  const newestId = messages[messages.length - 1]?.id;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [newestId, group.id]);

  const send = async () => {
    if (sending || (!text.trim() && files.length === 0)) return;
    setSending(true);
    setError('');
    try {
      await onSend(text, files);
      setText('');
      setFiles([]);
      if (fileInput.current) fileInput.current.value = '';
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleChange = (value) => {
    setText(value);
    const now = Date.now();
    if (now - lastTypingEmit.current > 2000) {
      lastTypingEmit.current = now;
      onTyping();
    }
  };

  return (
    <div className="chat-window">
      <header className="chat-header">
        <div>
          <strong>{group.name}</strong>
          {isArchived && <span className="chat-badge">Archived</span>}
          {group.description && <div className="chat-sub">{group.description}</div>}
        </div>
        <button type="button" onClick={onToggleMembers}>
          Members
        </button>
      </header>

      <div className="chat-messages">
        {hasMore && (
          <button type="button" className="chat-load-older" onClick={onLoadOlder}>
            Load older messages
          </button>
        )}

        {messages.map((m) =>
          m.type === 'system' ? (
            <div key={m.id} className="chat-system">
              {m.body}
            </div>
          ) : (
            <div key={m.id} className={`chat-msg ${m.senderId === me.id ? 'chat-msg--mine' : ''}`}>
              <div className="chat-meta">
                <span>{m.senderId === me.id ? 'You' : m.senderName}</span>
                <span>{formatTime(m.createdAt)}</span>
                {canDelete(m) && (
                  <button type="button" className="chat-del" onClick={() => onDelete(m.id)}>
                    Delete
                  </button>
                )}
              </div>
              {m.deleted ? (
                <em className="chat-deleted">This message was deleted</em>
              ) : (
                <>
                  {m.body && <div className="chat-body">{m.body}</div>}
                  {m.attachments.map((a) => (
                    <AttachmentView key={a.id} att={a} />
                  ))}
                </>
              )}
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-typing">{typingName ? `${typingName} is typing…` : '\u00A0'}</div>

      {isArchived ? (
        <div className="chat-readonly">This group is archived and read-only.</div>
      ) : (
        <div className="chat-composer">
          {files.length > 0 && (
            <div className="chat-files">
              {files.map((f, i) => (
                <span key={i} className="chat-chip">
                  {f.name}
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {error && <div className="chat-error">{error}</div>}
          <div className="chat-row">
            <button type="button" onClick={() => fileInput.current?.click()} title="Attach files (max 5, 10 MB each)">
              📎
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.docx,.xlsx,.pptx"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 5))}
            />
            <textarea
              value={text}
              rows={1}
              maxLength={2000}
              placeholder="Type a message…"
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <button type="button" onClick={send} disabled={sending}>
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}