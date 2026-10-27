import apiClient from './axios';

export const authApi = {
  /**
   * Log in user with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, message: string, token: string, user: object, redirectTo: string}>}
   */
  async login(email, password) {
    const response = await apiClient.post('/users/login', { email, password });
    return response.data;
  },

  /**
   * Fetch current authenticated user profile
   * @returns {Promise<{success: boolean, user: object}>}
   */
  async getCurrentUser() {
    const response = await apiClient.get('/users/me');
    return response.data;
  },

  /**
   * Change current user's password (supports first login password setup)
   * @param {string} newPassword
   * @returns {Promise<{success: boolean, message: string, firstLogin: boolean}>}
   */
  async changePassword(newPassword) {
    const response = await apiClient.patch('/users/change-password', { newPassword });
    return response.data;
  },

  /**
   * Mark first login as completed for a user ID
   * @param {number|string} id
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async completeFirstLogin(id) {
    const url = id ? `/users/${id}/complete-first-login` : '/users/complete-first-login';
    const response = await apiClient.patch(url);
    return response.data;
  },
};

export default authApi;
