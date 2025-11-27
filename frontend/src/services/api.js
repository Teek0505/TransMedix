// API service for frontend-backend communication

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Generic request method
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Session methods
  async createSession(sessionData) {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify(sessionData),
    });
  }

  async getSession(sessionId) {
    return this.request(`/sessions/${sessionId}`);
  }

  async getAllSessions(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/sessions${queryString ? `?${queryString}` : ''}`);
  }

  async updateSession(sessionId, updates) {
    return this.request(`/sessions/${sessionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async endSession(sessionId, notes = '') {
    return this.request(`/sessions/${sessionId}/end`, {
      method: 'PATCH',
      body: JSON.stringify({ notes }),
    });
  }

  async deleteSession(sessionId) {
    return this.request(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  // Transcription methods
  async uploadAudio(sessionId, audioFile) {
    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('sessionId', sessionId);

    return this.request('/transcribe/upload', {
      method: 'POST',
      headers: {}, // Remove Content-Type to let browser set it for FormData
      body: formData,
    });
  }

  async getTranscription(transcriptionId) {
    return this.request(`/transcribe/${transcriptionId}`);
  }

  async getSessionTranscriptions(sessionId, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    return this.request(`/sessions/${sessionId}/transcriptions${queryString ? `?${queryString}` : ''}`);
  }

  async updateTranscription(transcriptionId, updates) {
    return this.request(`/transcribe/${transcriptionId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTranscription(transcriptionId) {
    return this.request(`/transcribe/${transcriptionId}`, {
      method: 'DELETE',
    });
  }

  // Summary methods
  async generateSummary(sessionId, regenerate = false) {
    return this.request(`/sessions/${sessionId}/summary`, {
      method: 'POST',
      body: JSON.stringify({ regenerate }),
    });
  }

  async getSummary(summaryId, includeHistory = false) {
    return this.request(`/summaries/${summaryId}${includeHistory ? '?includeHistory=true' : ''}`);
  }

  async getSessionSummary(sessionId) {
    return this.request(`/sessions/${sessionId}/summary`);
  }

  async updateSummary(summaryId, updates) {
    return this.request(`/summaries/${summaryId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async approveSummary(summaryId, reviewedBy, reviewNotes = '') {
    return this.request(`/summaries/${summaryId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ reviewedBy, reviewNotes }),
    });
  }

  async exportSummary(summaryId, format = 'json') {
    const response = await fetch(`${this.baseURL}/summaries/${summaryId}/export/${format}`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Export failed');
    }

    if (format === 'json') {
      return response.json();
    } else {
      return response.blob();
    }
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Utility methods
  formatError(error) {
    return error.message || 'An unexpected error occurred';
  }

  isNetworkError(error) {
    return error.name === 'TypeError' && error.message.includes('fetch');
  }
}

// Export singleton instance
export default new ApiService();