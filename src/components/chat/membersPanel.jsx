import { useCallback, useEffect, useState } from 'react';
import { chatApi } from '../../api/chatApi';

/** Props: groupId, me {id, role}, onClose(), onChanged() */
export default function MembersPanel({ groupId, me, onClose, onChanged }) {
  const [group, setGroup] = useState(null);
  const [users, setUsers] = useState([]);
  const [toAdd, setToAdd] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await chatApi.getGroup(groupId);
      setGroup(data);
    } catch {
      setError('Could not load group');
    }
  }, [groupId]);

  useEffect(() => {
    let isMounted = true;
    chatApi
      .getGroup(groupId)
      .then((data) => {
        if (isMounted) setGroup(data);
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
    if (canManage) chatApi.listUsers().then(setUsers).catch(() => {});
  }, [canManage]);

  const run = async (fn) => {
    setError('');
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Action failed');
    }
  };

  if (!group) return <aside className="chat-members">{error || 'Loading…'}</aside>;

  const memberIds = new Set(group.members.map((m) => m.userId));
  const candidates = users.filter((u) => !memberIds.has(u.id));

  return (
    <aside className="chat-members">
      <div className="chat-members-head">
        <strong>{group.name}</strong>
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
        </>
      )}
      {error && <div className="chat-error">{error}</div>}
    </aside>
  );
}