const rawApiBase = import.meta.env.VITE_API_URL || '/api';
const API_BASE = rawApiBase.endsWith('/') ? rawApiBase.slice(0, -1) : rawApiBase;

let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = handler;
};

export const isAuthError = (error) => error instanceof ApiError && (error.status === 401 || error.status === 403);

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
};

export const apiRequest = async (path, options = {}) => {
  const {
    method = 'GET',
    headers = {},
    body,
    auth = true,
    ...rest
  } = options;

  const requestHeaders = { ...headers };
  if (body !== undefined && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = localStorage.getItem('token');
    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const response = await fetch(`${API_BASE}${normalizedPath}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });

  const data = await parseResponse(response);

  if (!response.ok) {
    const hasDataObject = typeof data === 'object' && data !== null;
    const context = hasDataObject ? data.context : null;
    const details = hasDataObject ? data.details : null;
    const baseMessage = hasDataObject && data.error ? data.error : `Request failed with status ${response.status}`;
    const message = context ? `${baseMessage} (${context})` : baseMessage;

    const error = new ApiError(message, response.status, data);

    if (isAuthError(error) && typeof unauthorizedHandler === 'function') {
      unauthorizedHandler();
    }

    throw error;
  }

  return data;
};
