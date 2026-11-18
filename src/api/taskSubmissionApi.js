import axios from "axios";

const API_URL = "http://localhost:3000/api";

const getHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

// Submit or resubmit a task
export const submitTaskVersion = async (taskId, data) => {
  const response = await axios.post(
    `${API_URL}/tasks/${taskId}/submit`,
    data,
    { headers: getHeaders() }
  );

  return response.data;
};

// Get all submission versions of a task
export const getTaskSubmissionHistory = async (taskId) => {
  const response = await axios.get(
    `${API_URL}/tasks/${taskId}/submissions`,
    { headers: getHeaders() }
  );

  return response.data;
};

// Mentor requests changes on a submission
export const requestChangesApi = async (submissionId, { feedback, score }) => {
  const response = await axios.patch(
    `${API_URL}/submissions/${submissionId}/request-changes`,
    { feedback, score },
    { headers: getHeaders() }
  );
  return response.data;
};

// Mentor approves a submission
export const approveSubmissionApi = async (submissionId, { feedback, score }) => {
  const response = await axios.patch(
    `${API_URL}/submissions/${submissionId}/approve`,
    { feedback, score },
    { headers: getHeaders() }
  );
  return response.data;
};