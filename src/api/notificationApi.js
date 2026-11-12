// import apiClient from './axios'; // CHANGE: your axios instance with the auth header

// export const fetchNotifications = (limit = 20, offset = 0) =>
//   apiClient.get('/notifications', { params: { limit, offset } }).then((r) => r.data);

// export const fetchUnreadCount = () =>
//   apiClient.get('/notifications/unread-count').then((r) => r.data.count);

// export const markNotificationRead = (id) => apiClient.patch(`/notifications/${id}/read`);

// export const markAllNotificationsRead = () => apiClient.patch('/notifications/read-all')1
// ;

import apiClient from './axios';

export const fetchNotifications = (limit = 20, offset = 0) =>
  apiClient.get('/notifications', { params: { limit, offset } }).then((r) => r.data);

export const fetchUnreadCount = () =>
  apiClient.get('/notifications/unread-count').then((r) => r.data.count);

export const markNotificationRead = (id) => apiClient.patch(`/notifications/${id}/read`);

export const markAllNotificationsRead = () => apiClient.patch('/notifications/read-all');