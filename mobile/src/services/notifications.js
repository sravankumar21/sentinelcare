import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { showSnackbar } from '../components/Snackbar';

let seenAlertIds = new Set();
let baselineAlertId = null;

const alertSubscribers = new Set();

export function onNewAlert(cb) {
  alertSubscribers.add(cb);
  return () => alertSubscribers.delete(cb);
}

function emitNewAlert(alert) {
  alertSubscribers.forEach(cb => {
    try { cb(alert); } catch (e) {}
  });
}

export function resetNotificationMemory() {
  seenAlertIds.clear();
  baselineAlertId = null;
}

async function ensureDeteriorationChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('deterioration', {
      name: 'Deterioration alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  } catch (e) {}
}

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('deterioration', {
        name: 'Deterioration alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    } catch (e) {}
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    let token = null;
    try {
      const { data } = await Notifications.getExpoPushTokenAsync({
        projectId: '08ad090c-eded-4631-9e7f-85f6a73c51c4',
      });
      token = data;
    } catch (e) {
      try {
        const { data } = await Notifications.getDevicePushTokenAsync();
        token = data;
      } catch (e2) {}
    }
    if (token) {
      api.registerDevice(token, Platform.OS).catch(() => {});
    }
    return token;
  } catch (e) {
    return null;
  }
}

/**
 * Schedules a single local notification for a new PENDING alert. Idempotent per
 * alert within a session: once notified, it is never scheduled again until
 * resetNotificationMemory() is called. Returns true only if a notification was
 * actually scheduled.
 */
export async function notifyForAlert(alert) {
  if (!alert || alert.status !== 'PENDING' || seenAlertIds.has(`alert-${alert.alert_id}`)) return false;
  seenAlertIds.add(`alert-${alert.alert_id}`);
  // The in-app doctor alert (banner + vibration) fires synchronously, before any
  // async permission/scheduling work — this is the reliable, deterministic path.
  emitNewAlert(alert);
  try {
    await ensureDeteriorationChannel();
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) return false;
    }
    const vs = alert.vitals_snapshot || {};
    const hr = Math.round(Number(vs.heart_rate) || 0);
    const spo2 = Number(vs.spo2_pct);
    const temp = Number(vs.temperature_c);
    const pct = Math.round((alert.risk_probability || 0) * 100);
    const vitalBits = [
      hr ? `HR ${hr} bpm` : null,
      Number.isFinite(spo2) ? `SpO₂ ${spo2.toFixed(1)}%` : null,
      Number.isFinite(temp) ? `Temp ${temp.toFixed(1)}°C` : null,
    ].filter(Boolean).join(' · ');
    const content = {
      title: `PATIENT ${alert.patient_id} — ${alert.risk_status || 'HIGH RISK'} ${pct}%`,
      body: `Bed ${alert.bed} · Ward ${alert.ward}${vitalBits ? ` · ${vitalBits}` : ''}. Patient is ${(alert.risk_status || 'HIGH RISK').toLowerCase()} — clinical review and acknowledgement required now.`,
      sound: 'default',
      channelId: 'deterioration',
      data: { alert_id: alert.alert_id, patient_id: alert.patient_id },
    };
    // Prefer immediate delivery; fall back to a 1s trigger if unsupported.
    try {
      await Notifications.scheduleNotificationAsync({ content, trigger: null });
      return true;
    } catch (e) {
      try {
        await Notifications.scheduleNotificationAsync({ content, trigger: { seconds: 1 } });
        return true;
      } catch (e2) {
        return false;
      }
    }
  } catch (e) {
    return false;
  }
}

/**
 * Global alert watcher: polls on an interval and schedules a notification for
 * every NEW pending alert, no matter which screen is loaded. The first fetch
 * only establishes a baseline so alerts that already existed before launch are
 * never re-notified. After that, any PENDING alert not handled this session
 * triggers a notification — this also covers alert IDs that restart after a
 * system reset.
 */
export function AlertWatcher() {
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await api.getAlerts();
        if (!active) return;
        const pending = (res.alerts || []).filter(a => a.status === 'PENDING');
        if (baselineAlertId === null) {
          (res.alerts || []).forEach(a => seenAlertIds.add(`alert-${a.alert_id}`));
          const ids = (res.alerts || []).map(a => a.alert_id);
          baselineAlertId = ids.length ? Math.max(...ids) : 0;
          return;
        }
        for (const a of pending) {
          if (seenAlertIds.has(`alert-${a.alert_id}`)) continue;
          const sent = await notifyForAlert(a);
          if (sent) {
            showSnackbar(`New alert — ${a.bed} · Ward ${a.ward}`);
          }
        }
      } catch (e) {}
    };
    check();
    const interval = setInterval(check, 6000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return null;
}