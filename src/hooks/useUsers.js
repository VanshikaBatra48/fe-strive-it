import { useState, useEffect, useCallback } from 'react';
import userApi from '../api/userApi';

const AVATAR_COLORS = [
  'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
];

// Helper to format ISO date to readable string
function formatJoinedDate(dateStr) {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Normalize user object so UI components have consistent property access
export function normalizeUser(rawUser, index = 0) {
  if (!rawUser) return null;
  const statusFormatted =
    rawUser.status && rawUser.status.toLowerCase() === 'inactive'
      ? 'Inactive'
      : 'Active';

  const assignedMentor =
    rawUser.assigned_to &&
    rawUser.assigned_to.toLowerCase() !== 'admin' &&
    rawUser.assigned_to.toLowerCase() !== 'unassigned' &&
    rawUser.assigned_to.toLowerCase() !== 'null'
      ? rawUser.assigned_to
      : null;

  return {
    ...rawUser,
    id: rawUser.id,
    name: rawUser.name || 'User',
    email: rawUser.email || '',
    password: rawUser.password || rawUser.raw_password || '',
    role: rawUser.role?.toLowerCase() || 'mentee',
    status: statusFormatted,
    mentor: assignedMentor,
    assigned_to: assignedMentor,
    track: rawUser.track || 'Fullstack Engineering',
    progress: rawUser.progress !== undefined ? rawUser.progress : 0,
    attendance: rawUser.attendance || '100%',
    currentTask: rawUser.currentTask || 'No active task',
    pendingReviews: rawUser.pendingReviews || 0,
    joinedOn: formatJoinedDate(rawUser.joined || rawUser.createdAt || rawUser.joinedOn),
    avatarBg:
      rawUser.avatarBg ||
      AVATAR_COLORS[(rawUser.id || index) % AVATAR_COLORS.length],
  };
}

export const useUsers = (initialFilters = {}, autoFetch = true) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async (filters) => {
    setLoading(true);
    setError(null);
    try {
      const res = await userApi.getUsers(filters || {});
      if (res?.success && Array.isArray(res.data)) {
        const normalized = res.data.map((u, idx) => normalizeUser(u, idx));
        setUsers(normalized);
        return normalized;
      }
      setUsers([]);
      return [];
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to fetch users';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const serializedFilters = JSON.stringify(initialFilters);

  useEffect(() => {
    let isMounted = true;
    if (autoFetch) {
      const parsedFilters = serializedFilters ? JSON.parse(serializedFilters) : {};
      userApi
        .getUsers(parsedFilters)
        .then((res) => {
          if (isMounted) {
            if (res?.success && Array.isArray(res.data)) {
              const normalized = res.data.map((u, idx) => normalizeUser(u, idx));
              setUsers(normalized);
            } else {
              setUsers([]);
            }
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err.response?.data?.message || err.message || 'Failed to fetch users');
            setLoading(false);
          }
        });
    }
    return () => {
      isMounted = false;
    };
  }, [autoFetch, serializedFilters]);

  // Create user
  const createUser = useCallback(async (userData) => {
    setError(null);
    try {
      const res = await userApi.createUser({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role || 'mentee',
        assigned_to: userData.mentor || userData.assigned_to || 'admin',
        assignedMentees: userData.assignedMentees || [],
      });
      if (res?.success && res.data) {
        await fetchUsers();
        return { success: true, data: res.data };
      }
      throw new Error(res?.message || 'Failed to create user');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error creating user';
      setError(msg);
      return { success: false, error: msg };
    }
  }, [fetchUsers]);

  // Update user
  const updateUser = useCallback(async (id, updateData) => {
    setError(null);
    try {
      const payload = {
        name: updateData.name,
        email: updateData.email,
        status: updateData.status ? updateData.status.toLowerCase() : undefined,
        role: updateData.role ? updateData.role.toLowerCase() : undefined,
        assigned_to: updateData.mentor || updateData.assigned_to,
        password: updateData.password ? updateData.password.trim() : undefined,
      };

      const res = await userApi.updateUser(id, payload);
      if (res?.success && res.data) {
        const normalized = normalizeUser(res.data);
        setUsers((prev) =>
          prev.map((u) => (u.id === Number(id) ? { ...u, ...normalized } : u))
        );
        return { success: true, data: normalized };
      }
      throw new Error(res?.message || 'Failed to update user');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error updating user';
      setError(msg);
      return { success: false, error: msg };
    }
  }, []);

  // Delete user
  const deleteUser = useCallback(async (id) => {
    setError(null);
    try {
      const userToDelete = users.find((u) => u.id === Number(id));
      const res = await userApi.deleteUser(id);
      if (res?.success) {
        setUsers((prev) =>
          prev
            .filter((u) => u.id !== Number(id))
            .map((u) => {
              if (
                userToDelete &&
                userToDelete.role === 'mentor' &&
                u.mentor &&
                u.mentor.toLowerCase() === userToDelete.name.toLowerCase()
              ) {
                return { ...u, mentor: null, assigned_to: null };
              }
              return u;
            })
        );
        return { success: true };
      }
      throw new Error(res?.message || 'Failed to delete user');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Error deleting user';
      setError(msg);
      return { success: false, error: msg };
    }
  }, [users]);

  return {
    users,
    setUsers,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    refetch: fetchUsers,
  };
};

export default useUsers;
