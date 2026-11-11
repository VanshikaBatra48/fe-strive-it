import apiClient from './axios';

export const taskApi = {
  /**
   * Fetch all tasks with optional filters from backend database
   * @param {object} filters { menteeEmail, mentorEmail, menteeName, mentorName, status, priority }
   * @returns {Promise<Array>}
   */
  async getTasks(filters = {}) {
    const response = await apiClient.get('/tasks', { params: filters });
    return response.data?.data || [];
  },

  /**
   * Fetch task by ID
   * @param {number|string} id
   * @returns {Promise<object>}
   */
  async getTaskById(id) {
    const response = await apiClient.get(`/tasks/${id}`);
    return response.data?.data;
  },

  /**
   * Create and assign a new task in backend database
   * @param {object} taskData
   * @returns {Promise<object>}
   */
  async createTask(taskData) {
    const response = await apiClient.post('/tasks', taskData);
    return response.data?.data;
  },

  /**
   * Update an existing task in backend database
   * @param {number|string} id
   * @param {object} updates
   * @returns {Promise<object>}
   */
  async updateTask(id, updates) {
    const response = await apiClient.patch(`/tasks/${id}`, updates);
    return response.data?.data;
  },

  /**
   * Submit task assignment deliverables (Mentee action)
   * @param {number|string} id
   * @param {object} submissionData { repoUrl, demoUrl, notes }
   * @returns {Promise<object>}
   */
  async submitTask(id, submissionData) {
    const response = await apiClient.patch(`/tasks/${id}/submit`, submissionData);
    return response.data?.data;
  },

  /**
   * Evaluate task submission (Mentor action)
   * @param {number|string} id
   * @param {object} evalData { score, feedback, status }
   * @returns {Promise<object>}
   */
  async evaluateTask(id, evalData) {
    const response = await apiClient.patch(`/tasks/${id}/evaluate`, evalData);
    return response.data?.data;
  },

  /**
   * Delete a task from database
   * @param {number|string} id
   * @returns {Promise<boolean>}
   */
  async deleteTask(id) {
    const response = await apiClient.delete(`/tasks/${id}`);
    return response.data?.success;
  },
};

export default taskApi;
