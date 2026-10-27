import userApi from './userApi';

export const mentorApi = {
  /**
   * Fetch all mentors from backend
   * @param {object} params
   * @returns {Promise<Array>}
   */
  async getMentors(params = {}) {
    const res = await userApi.getUsers({ role: 'mentor', ...params });
    return res.data || [];
  },

  /**
   * Fetch mentees assigned to a specific mentor by mentor's name
   * @param {string} mentorName
   * @param {object} params
   * @returns {Promise<Array>}
   */
  async getAssignedMentees(mentorName, params = {}) {
    const res = await userApi.getUsers({
      role: 'mentee',
      assigned_to: mentorName,
      ...params,
    });
    return res.data || [];
  },

  /**
   * Assign a mentee to a mentor
   * @param {number|string} menteeId
   * @param {string} mentorName
   * @returns {Promise<object>}
   */
  async assignMentee(menteeId, mentorName) {
    return userApi.updateUser(menteeId, { assigned_to: mentorName });
  },
};

export default mentorApi;
