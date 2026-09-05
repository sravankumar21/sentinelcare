import { API_URL } from '../theme';

const request = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

export const api = {
  getPatients: () => request('/patients'),
  getDashboard: () => request('/dashboard/summary'),
  getPatient: (id) => request(`/patients/${id}`),
  getPatientExplanation: (id) => request(`/patients/${id}/explanation`),
  getAlerts: () => request('/alerts'),
  acknowledgeAlert: (id) => request(`/alerts/${id}/acknowledge`, { method: 'POST' }),
  registerDevice: (token, platform = 'android') =>
    request('/devices/register', { method: 'POST', body: JSON.stringify({ token, platform }) }),
  simulateStart: (patientId, mode) =>
    request('/simulate/start', { method: 'POST', body: JSON.stringify({ patient_id: patientId, mode }) }),
  simulateStep: (patientId) =>
    request('/simulate/step', { method: 'POST', body: JSON.stringify({ patient_id: patientId, mode: 'deteriorate' }) }),
  simulateReset: (patientId) => request(`/simulate/reset?patient_id=${patientId}`, { method: 'POST' }),
  resetSystem: () => request('/system/reset', { method: 'POST' }),
  clearAlerts: () => request('/system/clear-alerts', { method: 'POST' }),
  getRecommendations: (id) => request(`/patients/${id}/recommendations`),
  riskAnalyze: (vitals) =>
    request('/risk/analyze', { method: 'POST', body: JSON.stringify(vitals) }),
  riskSimulate: (vitals) =>
    request('/risk/simulate', { method: 'POST', body: JSON.stringify(vitals) }),
};
