const API_BASE_URL = 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

/**
 * Register a new user.
 */
export async function register(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || 'Registration failed');
  }

  return response.json();
}

/**
 * Login a user.
 */
export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || 'Login failed');
  }

  return response.json();
}

/**
 * Uploads a PDF document to the backend API.
 *
 * @param {File} file - The PDF file object.
 * @returns {Promise<Object>} The response data from the server.
 */
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: 'POST',
    headers: { ...getAuthHeaders() },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Upload failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Submits a question to the backend RAG pipeline.
 *
 * @param {number} documentId - The ID of the document to query.
 * @param {string} query - The user's query/question.
 * @returns {Promise<Object>} The response data containing the answer.
 */
export async function askQuestion(documentId, query) {
  const response = await fetch(`${API_BASE_URL}/chat/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({
      documentId,
      query,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Fetches an AI-generated summary for a given document.
 */
export async function getSummary(documentId) {
  const response = await fetch(`${API_BASE_URL}/intelligence/summary/${documentId}`, {
    method: 'GET',
    headers: { ...getAuthHeaders() },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Summary request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Fetches an AI-generated quiz for a given document.
 * @param {number} documentId
 * @param {number} count - Number of questions (default 5)
 */
export async function getQuiz(documentId, count = 5) {
  const response = await fetch(`${API_BASE_URL}/intelligence/quiz/${documentId}?count=${count}`, {
    method: 'GET',
    headers: { ...getAuthHeaders() },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Quiz request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Compares two documents by their IDs and returns a structured diff report.
 */
export async function compareDocuments(documentIdA, documentIdB) {
  const response = await fetch(`${API_BASE_URL}/comparison/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ documentIdA, documentIdB }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `Comparison failed with status ${response.status}`);
  }
  return response.json();
}
