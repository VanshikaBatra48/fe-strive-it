import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams  } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import ThemeToggle from '../components/ThemeToggle';
import { chatApi } from '../api/chatApi';
import { useChatSocket } from '../hooks/useChatSocket';
import ChatWindow from '../components/chat/chatWindow';
import CreateGroupModal from '../components/chat/createGroupModal';
import MembersPanel from '../components/chat/membersPanel';
import '../components/chat/chat.css';
import { socket } from '../lib/socket';

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const notificationGroupId = searchParams.get('groupId');
  const { user } = useAuth();
  const me = { id: user?.id, role: user?.role, name: user?.name };
  const isManager = me.role === 'admin' || me.role === 'mentor';

  const [groups, setGroups] = useState([]);
  const [showAll, setShowAll] = useState(false); // admin: list every group for management
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState({}); // { [groupId]: Message[] }
  const [hasMore, setHasMore] = useState({}); // { [groupId]: boolean }
  const [typing, setTyping] = useState({}); // { [groupId]: name }
  const [showCreate, setShowCreate] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  // Refs so socket callbacks (created once) always see current values
  const activeIdRef = useRef(null);
  // activeIdRef.current = activeId;
  const showAllRef = useRef(false);
  // showAllRef.current = showAll;

  useEffect(() => {
    activeIdRef.current = activeId;
    showAllRef.current = showAll;
  }, [activeId, showAll]);
  const loadedRef = useRef(new Set());
  const typingTimers = useRef({});

  const handledNotificationGroupRef = useRef(null);

  // ---------- Loading ----------
  const loadGroups = useCallback(async () => {
    const data = await chatApi.listGroups(showAllRef.current);
    setGroups(data);
    // If the open group disappeared (we were removed), close it
    setActiveId((a) => (a && data.some((g) => g.id === a) ? a : null));
  }, []);

  const markReadUpTo = useCallback((groupId, list) => {
    const last = list[list.length - 1];
    if (!last) return;
    chatApi
      .markRead(groupId, last.id)
      .then(() =>
        setGroups((gs) => gs.map((g) => (g.id === groupId ? { ...g, unreadCount: 0 } : g)))
      )
      .catch(() => { });
  }, []);

  const loadMessages = useCallback(
    async (groupId) => {
      const res = await chatApi.getMessages(groupId);
      loadedRef.current.add(groupId);
      setMessages((m) => ({ ...m, [groupId]: res.messages }));
      setHasMore((h) => ({ ...h, [groupId]: res.hasMore }));
      markReadUpTo(groupId, res.messages);
    },
    [markReadUpTo]
  );

  useEffect(() => {
    loadGroups().catch(() => { });
  }, [loadGroups, showAll]);

  // ---------- Live events ----------
  const { emitTyping } = useChatSocket({
    onMessage: (m) => {
      setMessages((prev) => {
        const list = prev[m.groupId];
        if (!list || list.some((x) => x.id === m.id)) return prev; // not loaded yet, or duplicate
        return { ...prev, [m.groupId]: [...list, m] };
      });

      const isActive = activeIdRef.current === m.groupId;
      const mine = m.senderId === me.id;
      setGroups((gs) => {
        if (!gs.some((g) => g.id === m.groupId)) return gs;
        return gs.map((g) =>
          g.id === m.groupId
            ? {
              ...g,
              lastMessage: m,
              lastActivityAt: m.createdAt,
              unreadCount:
                isActive || mine || m.type === 'system'
                  ? g.unreadCount
                  : (g.unreadCount ?? 0) + 1,
            }
            : g
        );
      });
      if (isActive && !mine) chatApi.markRead(m.groupId, m.id).catch(() => { });
    },

    onMessageDeleted: ({ groupId, messageId }) => {
      setMessages((prev) => {
        const list = prev[groupId];
        if (!list) return prev;
        return {
          ...prev,
          [groupId]: list.map((x) =>
            x.id === messageId ? { ...x, deleted: true, body: null, attachments: [] } : x
          ),
        };
      });

      setGroups((gs) =>
        gs.map((g) =>
          g.id === groupId && g.lastMessage?.id === messageId
            ? { ...g, lastMessage: { ...g.lastMessage, deleted: true, body: null, attachments: [] } }
            : g
        )
      );
    },

    onGroupChanged: () => {
      loadGroups().catch(() => { });
    },

    onTyping: ({ groupId, userId, name }) => {
      if (userId === me.id) return;
      setTyping((t) => ({ ...t, [groupId]: name }));
      window.clearTimeout(typingTimers.current[groupId]);
      typingTimers.current[groupId] = window.setTimeout(
        () =>
          setTyping((t) => {
            const copy = { ...t };
            delete copy[groupId];
            return copy;
          }),
        3000
      );
    },

    // After a dropped connection: refetch what we may have missed
    onReconnect: () => {
      loadGroups().catch(() => { });
      const id = activeIdRef.current;
      if (id) loadMessages(id).catch(() => { });
    },
  });

  // ---------- Actions ----------
const openGroup = (g) => {
  setActiveId(g.id);
  setShowMembers(g.myRole === null);

  // Admin viewing a group without membership
  if (g.myRole === null) {
    socket.emit('chat:inactive');
    return;
  }

  // Tell the backend that this user is viewing this group
  socket.emit('chat:active', {
    groupId: g.id,
  });

  if (loadedRef.current.has(g.id)) {
    markReadUpTo(g.id, messages[g.id] ?? []);
  } else {
    loadMessages(g.id).catch((err) => {
      console.error('Failed to load messages:', err);
    });
  }
};

  useEffect(() => {
  console.log('ChatPage opened');
  console.log('Notification group ID:', notificationGroupId);
  console.log('Available groups:', groups);

  if (!notificationGroupId || groups.length === 0) return;

  if (handledNotificationGroupRef.current === notificationGroupId) return;

  const group = groups.find(
    (g) => Number(g.id) === Number(notificationGroupId)
  );

  console.log('Matched group:', group);

  if (!group) {
    console.error('Group not found!');
    return;
  }

  handledNotificationGroupRef.current = notificationGroupId;
  openGroup(group);
}, [notificationGroupId, groups]);

useEffect(() => {
  return () => {
    socket.emit('chat:inactive');
  };
}, []);

  const loadOlder = async () => {
    if (!activeId) return;
    const list = messages[activeId] ?? [];
    if (!list.length) return;
    const res = await chatApi.getMessages(activeId, list[0].id);
    setMessages((m) => ({ ...m, [activeId]: [...res.messages, ...(m[activeId] ?? [])] }));
    setHasMore((h) => ({ ...h, [activeId]: res.hasMore }));
  };

  const send = async (body, files) => {
    if (!activeId) return;
    const msg = await chatApi.sendMessage(activeId, body, files);
    // The socket event also arrives; onMessage de-duplicates by id
    setMessages((prev) => {
      const list = prev[activeId] ?? [];
      return list.some((x) => x.id === msg.id) ? prev : { ...prev, [activeId]: [...list, msg] };
    });
  };

  const remove = async (messageId) => {
    if (!activeId || !window.confirm('Delete this message for everyone?')) return;
    try {
      await chatApi.deleteMessage(activeId, messageId);
    } catch (e) {
      window.alert(e?.response?.data?.message ?? 'Could not delete message');
    }
  };

  const active = groups.find((g) => g.id === activeId) ?? null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 p-3 sm:p-4 flex flex-col gap-3 font-sans">
      {/* Top Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-800 px-4 sm:px-5 py-3 rounded-xl shadow-xs border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Dashboard</span>
          </button>
          <div className="h-5 w-px bg-slate-300 dark:bg-slate-600" />
          <h1 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            TMS Messaging & Groups
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Signed in as</span>
            <strong className="text-slate-800 dark:text-slate-200">{me.name || 'User'}</strong>
            <span className="capitalize px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {me.role}
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Chat Layout */}
      <div className="chat-layout shadow-xs border border-slate-200 dark:border-slate-700">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-head">
            <strong>Groups</strong>
            {isManager && (
              <button type="button" onClick={() => setShowCreate(true)}>
                + New
              </button>
            )}
          </div>

          {me.role === 'admin' && (
            <label className="chat-toggle">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              Show all groups (manage)
            </label>
          )}

          <ul>
            {groups.map((g) => (
              <li
                key={g.id}
                className={g.id === activeId ? 'chat-group chat-group--active' : 'chat-group'}
                onClick={() => openGroup(g)}
              >
                <div className="chat-group-name">
                  {g.name}
                  {g.status === 'archived' && <span className="chat-badge">Archived</span>}
                  {!!g.unreadCount && <span className="chat-unread">{g.unreadCount}</span>}
                </div>
                <div className="chat-group-last">
                  {g.myRole === null
                    ? `${g.memberCount ?? 0} members · not a member`
                    : g.lastMessage
                      ? g.lastMessage.deleted
                        ? 'Message deleted'
                        : g.lastMessage.body || '📎 Attachment'
                      : 'No messages yet'}
                </div>
              </li>
            ))}
            {groups.length === 0 && <li className="chat-empty">You are not in any group yet.</li>}
          </ul>
        </aside>

        <main className="chat-main">
          {active && active.myRole !== null ? (
            <ChatWindow
              group={active}
              me={me}
              messages={messages[active.id] ?? []}
              hasMore={!!hasMore[active.id]}
              typingName={typing[active.id]}
              onLoadOlder={loadOlder}
              onSend={send}
              onDelete={remove}
              onTyping={() => emitTyping(active.id)}
              onToggleMembers={() => setShowMembers((s) => !s)}
            />
          ) : (
            <div className="chat-placeholder">
              {active
                ? 'Open the members panel to manage this group.'
                : 'Select a group to start chatting'}
            </div>
          )}
        </main>

        {active && showMembers && (
          <MembersPanel
            groupId={active.id}
            me={me}
            onClose={() => setShowMembers(false)}
            onChanged={() => loadGroups().catch(() => { })}
          />
        )}

        {showCreate && (
          <CreateGroupModal
            meId={me.id}
            onClose={() => setShowCreate(false)}
            onCreated={async (id) => {
              setShowCreate(false);
              await loadGroups();
              setActiveId(id);
              loadMessages(id).catch(() => { });
            }}
          />
        )}
      </div>
    </div>
  );
}