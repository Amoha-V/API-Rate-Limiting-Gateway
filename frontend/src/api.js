// api.js
const API_BASE_URL = 'http://localhost:8000';


async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Something went wrong');
  }
  return response.json();
}

export async function login(username, password) {
  const response = await fetch(`${API_BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return handleResponse(response);
}


export async function getConfig(token) {
  const response = await fetch(`${API_BASE_URL}/api/config`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}

export async function updateConfig(token, config) {
  const response = await fetch(`${API_BASE_URL}/api/config`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(config),
  });
  return handleResponse(response);
}

export async function getEndpoints(token) {
  const response = await fetch(`${API_BASE_URL}/api/endpoints`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}

export async function updateEndpoint(token, endpointData) {
  const response = await fetch(`${API_BASE_URL}/api/endpoints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(endpointData),
  });
  return handleResponse(response);
}

export async function deleteEndpoint(token, endpoint, method) {
  const response = await fetch(`${API_BASE_URL}/api/endpoints/${endpoint}/${method}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}

export async function getUserOverrides(token) {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}

export async function updateUserOverride(token, userData) {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });
  return handleResponse(response);
}

export async function deleteUserOverride(token, userId) {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}

export async function getStats(token) {
  const response = await fetch(`${API_BASE_URL}/api/stats`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  return handleResponse(response);
}