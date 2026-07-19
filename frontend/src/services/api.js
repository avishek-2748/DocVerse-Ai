const API_BASE_URL = 'http://localhost:5000/api';

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
