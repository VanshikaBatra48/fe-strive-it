import { useCallback, useEffect, useState } from 'react';
import { chatApi } from '../../api/chatApi';

/** Props: groupId, me {id, role}, onClose(), onChanged(), onDeleted() */
export default function MembersPanel({ groupId, me, onClose, onChanged, onDeleted }) {
  const [group, setGroup] = useState(null);
  const [users, setUsers] = useState([]);
  const [toAdd, setToAdd] = useState('');
  const [error, setError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await chatApi.getGroup(groupId);
      setGroup(data);
      setNewName(data.name);
    } catch {
      setError('Could not load group');
    }
  }, [groupId]);

  useEffect(() => {
    let isMounted = true;
    chatApi
      .getGroup(groupId)
      .then((data) => {
        if (isMounted) {
          setGroup(data);
          setNewName(data.name);
        }
      })
      .catch(() => {
        if (isMounted) setError('Could not load group');
      });
    return () => {
      isMounted = false;
    };
  }, [groupId]);

  const canManage =
    !!group && group.status === 'active' && (me.role === 'admin' || group.myRole === 'owner');

  // Candidate list is only needed by managers
  useEffect(() => {
    if (canManage) chatApi.listUsers().then(setUsers).catch(() => { });
  }, [canManage]);

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
      onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Action failed');
    }
  };

  const handleRename = async (e) => {
    e?.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || trimmed === group.name) {
      setIsEditingName(false);
      return;
    }
    await run(async () => {
      await chatApi.renameGroup(groupId, trimmed);
      setIsEditingName(false);
    });
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        'Are you sure you want to permanently delete this group? All messages and attachments will be deleted.'
      )
    ) {
      return;
    }
    setError('');
    try {
      await chatApi.deleteGroup(groupId);
      if (onDeleted) {
        onDeleted(groupId);
      } else {
        onClose?.();
        onChanged?.();
      }
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to delete group');
    }
  };

  if (!group) return <aside className="chat-members">{error || 'Loading…'}</aside>;

  const memberIds = new Set(group.members.map((m) => m.userId));
  const candidates = users.filter((u) => !memberIds.has(u.id));

  return (
    <aside className="chat-members">
      <div className="chat-members-head">
        {isEditingName ? (
          <form onSubmit={handleRename} style={{ display: 'flex', gap: '4px', flex: 1, marginRight: '8px' }}>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '3px 6px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid #ccc',
              }}
              autoFocus
            />
            <button type="submit" style={{ fontSize: '11px', padding: '2px 6px' }}>Save</button>
            <button
              type="button"
              onClick={() => {
                setIsEditingName(false);
                setNewName(group.name);
              }}
              style={{ fontSize: '11px', padding: '2px 6px' }}
            >
              Cancel
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong>{group.name}</strong>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setIsEditingName(true);
                  setNewName(group.name);
                }}
                title="Rename group"
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: '12px',
                  opacity: 0.7,
                }}
              >
                ✏️
              </button>
            )}
          </div>
        )}
        <button type="button" onClick={onClose}>
          ✕
        </button>
      </div>

      {group.myRole === null && (
        <div className="chat-sub">
          You are not a member of this group, so you can manage it but not read it.
        </div>
      )}

      <ul>
        {group.members.map((m) => (
          <li key={m.userId}>
            <span>
              {m.name} {m.role === 'owner' && <small>(owner)</small>}
            </span>
            {canManage && m.userId !== me.id && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove ${m.name} from this group?`)) {
                    run(() => chatApi.removeMember(groupId, m.userId));
                  }
                }}
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <>
          <div className="chat-row">
            <select value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
              <option value="">Add a member…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!toAdd}
              onClick={() =>
                run(async () => {
                  await chatApi.addMembers(groupId, [Number(toAdd)]);
                  setToAdd('');
                })
              }
            >
              Add
            </button>
          </div>

          <button
            type="button"
            className="chat-danger"
            onClick={() => {
              if (window.confirm('Archive this group? It becomes read-only for everyone.')) {
                run(() => chatApi.archiveGroup(groupId));
              }
            }}
          >
            Archive group
          </button>

          <button
            type="button"
            className="chat-danger"
            style={{
              marginTop: '8px',
              backgroundColor: '#fee2e2',
              color: '#dc2626',
              border: '1px solid #fca5a5',
              padding: '6px 10px',
              borderRadius: '6px',
              width: '100%',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            onClick={handleDelete}
          >
            Delete group permanently
          </button>
        </>
      )}

      {error && <div className="chat-error">{error}</div>}
    </aside>
  );
}