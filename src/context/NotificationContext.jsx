import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { socket } from '../lib/socket';
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '../api/notificationApi';

const NotificationContext = createContext(null);
const PAGE_SIZE = 20;

export function NotificationProvider({ token, children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Load from REST (history + unread count)
  const loadInitial = useCallback(async () => {
    try {
      const [list, count] = await Promise.all([
        fetchNotifications(PAGE_SIZE, 0),
        fetchUnreadCount(),
      ]);
      setNotifications(list);
      setUnreadCount(count);
      setHasMore(list.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  }, []);

  useEffect(() => {
    // Logged out: clear everything and disconnect
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      socket.disconnect();
      return;
    }

    loadInitial();

    socket.auth = { token };
    socket.connect();

    const onNew = (n) => {
      setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
      setUnreadCount((c) => c + 1);
      // optional toast: toast(n.title)
    };

    // After a reconnect, refetch anything missed while offline
    const onConnect = () => loadInitial();

    socket.on('notification:new', onNew);
    socket.on('connect', onConnect);
    socket.on('connect_error', (err) => console.error('Socket error:', err.message));

    return () => {
      socket.off('notification:new', onNew);
      socket.off('connect', onConnect);
      socket.off('connect_error');
      socket.disconnect();
    };
  }, [token, loadInitial]);

  const markAsRead = useCallback(async (id) => {
    let wasUnread = false;
    setNotifications((prev) =>
      prev.map((n) => {
        if (n.id === id && !n.is_read) {
          wasUnread = true;
          return { ...n, is_read: true };
        }
        return n;
      })
    );
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await markNotificationRead(id);
    } catch (err) {
      console.error('Failed to mark as read', err);
      loadInitial(); // roll back to server state
    }
  }, [loadInitial]);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch (err) {
      console.error('Failed to mark all as read', err);
      loadInitial();
    }
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    try {
      const more = await fetchNotifications(PAGE_SIZE, notifications.length);
      setNotifications((prev) => [...prev, ...more.filter((m) => !prev.some((p) => p.id === m.id))]);
      setHasMore(more.length === PAGE_SIZE);
    } catch (err) {
      console.error('Failed to load more', err);
    }
  }, [notifications.length]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, hasMore, markAsRead, markAllAsRead, loadMore }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}