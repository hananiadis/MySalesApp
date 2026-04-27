import { getRuntimeConfig, requestIdTokenRefresh } from './nativeRuntime';

function toQueryString(query = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    params.set(key, String(value));
  });

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

async function fetchJson(
  path,
  { method = 'GET', body, query, retryOnUnauthorized = true } = {}
) {
  const runtime = getRuntimeConfig();

  if (!runtime.bffBaseUrl) {
    throw new Error('Missing BFF base URL.');
  }

  if (!runtime.idToken) {
    throw new Error('Missing Firebase ID token.');
  }

  const headers = {
    Authorization: `Bearer ${runtime.idToken}`,
    'Content-Type': 'application/json',
  };

  if (runtime.defaultBrand) {
    headers['x-brand'] = runtime.defaultBrand;
  }

  const response = await fetch(`${runtime.bffBaseUrl}${path}${toQueryString(query)}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && retryOnUnauthorized) {
    await requestIdTokenRefresh();
    return fetchJson(path, { method, body, query, retryOnUnauthorized: false });
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

export function fetchSessionContext() {
  return fetchJson('/me');
}

export function fetchCustomers(params = {}) {
  return fetchJson('/customers', { query: params });
}

export function fetchTerritories(params = {}) {
  return fetchJson('/territories', { query: params });
}

export function saveTerritory(payload) {
  return fetchJson('/territories', {
    method: 'POST',
    body: payload,
  });
}

export function fetchTerritoryAssignments(params = {}) {
  return fetchJson('/territory-assignments', { query: params });
}

export function saveTerritoryAssignment(payload) {
  return fetchJson('/territory-assignments', {
    method: 'POST',
    body: payload,
  });
}

export function fetchSalesmen() {
  return fetchJson('/salesmen');
}

export function fetchVisitPlans(params = {}) {
  return fetchJson('/visit-plans', { query: params });
}

export function saveVisitPlan(payload) {
  return fetchJson('/visit-plans', {
    method: 'POST',
    body: payload,
  });
}

export function fetchVisitExecutions(params = {}) {
  return fetchJson('/visit-executions', { query: params });
}

export function createVisitExecution(payload) {
  return fetchJson('/visit-executions', {
    method: 'POST',
    body: payload,
  });
}

export function updateVisitExecution(executionId, payload) {
  return fetchJson(`/visit-executions/${executionId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export function fetchManagerTeamStatus(date) {
  return fetchJson('/manager/team-status', { query: date ? { date } : {} });
}

export function fetchManagerActivity({ since, limit } = {}) {
  return fetchJson('/manager/activity', { query: { since, limit } });
}

export function fetchSchedules(params = {}) {
  return fetchJson('/schedules', { query: params });
}

export function saveSchedule(payload) {
  return fetchJson('/schedules', {
    method: 'POST',
    body: payload,
  });
}

export function updateScheduleStatus(scheduleId, status) {
  return fetchJson(`/schedules/${scheduleId}/status`, {
    method: 'POST',
    body: { status },
  });
}

export function fetchAnalyticsOverview(params = {}) {
  return fetchJson('/analytics/overview', { query: params });
}