import { useEffect, useState } from 'react';
import { chatApi } from '../../api/chatApi';

export default function CreateGroupModal({ meId, onClose, onCreated }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    chatApi
      .listUsers()
      .then((list) => setUsers(list.filter((u) => u.id !== meId)))
      .catch(() => setError('Could not load users'));
  }, [meId]);

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    if (name.trim().length < 2) return setError('Enter a group name');
    if (selected.length < 2) {
      return setError('Select at least 2 members (one-to-one chats are not allowed)');
    }
    setBusy(true);
    setError('');
    try {
      const group = await chatApi.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: selected,
      });
      onCreated(group.id);
    } catch (e) {
      setError(e?.response?.data?.message ?? 'Failed to create group');
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div className="chat-modal-backdrop" onClick={onClose}>
      <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
        <h3>New group</h3>
        <input placeholder="Group name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="Description (optional)"
          value={description}
          maxLength={500}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="chat-pick-title">Members ({selected.length} selected, minimum 2)</div>
        <div className="chat-pick-list">
          {users.map((u) => (
            <label key={u.id}>
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
              {u.name} <small>{u.email}</small>
            </label>
          ))}
          {users.length === 0 && !error && <small>No users available.</small>}
        </div>

        {error && <div className="chat-error">{error}</div>}
        <div className="chat-modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}