import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Vibration } from 'react-native';
import { onNewAlert } from '../services/notifications';
import { api } from '../services/api';
import { showSnackbar } from '../components/Snackbar';
import { useTheme, getStatusColor } from '../theme';

/**
 * Physical, deterministic "notify the doctor" alarm: the moment a new alert is
 * created or detected, an urgent banner slides in from the top and the phone
 * vibrates — no dependence on the flaky OS notification scheduling in Expo Go.
 * Tap the banner to acknowledge the alert (visible "way acknowledged" state).
 */
export default function DoctorAlert() {
  const { colors } = useTheme();
  const [alert, setAlert] = useState(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState('show'); // show | acking | acked | failed
  const translateY = useRef(new Animated.Value(-140)).current;
  const autoHide = useRef(null);

  const hide = () => {
    clearTimeout(autoHide.current);
    Animated.timing(translateY, { toValue: -140, duration: 250, useNativeDriver: true })
      .start(() => setVisible(false));
  };

  const showAlert = (a) => {
    if (visible) return;
    setAlert(a);
    setState('show');
    setVisible(true);
    Vibration.vibrate([0, 350, 180, 350, 180, 500]);
    Animated.spring(translateY, { toValue: 0, speed: 30, bounciness: 6, useNativeDriver: true }).start();
  };

  useEffect(() => {
    const off = onNewAlert(a => { showAlert(a); });
    return off;
  }, [visible]);

  useEffect(() => {
    if (!visible || state === 'acking') return;
    const delay = state === 'acked' ? 2200 : 6000;
    clearTimeout(autoHide.current);
    autoHide.current = setTimeout(hide, delay);
    return () => clearTimeout(autoHide.current);
  }, [visible, state]);

  const acknowledge = async () => {
    if (state === 'acking') return;
    setState('acking');
    try {
      await api.acknowledgeAlert(alert.alert_id);
      setState('acked');
      showSnackbar(`Alert acknowledged — ${alert.bed} · Ward ${alert.ward}`);
    } catch (e) {
      setState('failed');
    }
  };

  if (!visible || !alert) return null;

  const pct = Math.round((alert.risk_probability || 0) * 100);
  const baseColor = getStatusColor(alert.risk_status || 'HIGH');
  const vs = alert.vitals_snapshot || {};
  const hr = Math.round(Number(vs.heart_rate) || 0);
  const spo2 = Number.isFinite(Number(vs.spo2_pct)) ? Number(vs.spo2_pct) : null;

  const acked = state === 'acked';
  const stripColor = acked ? '#22c55e' : baseColor;
  const title = acked
    ? `Alert acknowledged — ${alert.bed} · Ward ${alert.ward}`
    : state === 'failed'
      ? 'Acknowledgment failed — tap to retry'
      : `PATIENT ${alert.patient_id} — ${alert.risk_status || 'HIGH RISK'} ${pct}%`;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY }], backgroundColor: acked ? '#0b2a1a' : '#1e1b2e' }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={state === 'acked' ? hide : acknowledge} style={styles.touch}>
        <View style={[styles.strip, { backgroundColor: stripColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, acked && styles.titleAcked]}>{title}</Text>
          {!acked && (
            <>
              <Text style={styles.body}>
                Bed {alert.bed} · Ward {alert.ward}
                {hr ? ` · HR ${hr} bpm` : ''}
                {spo2 !== null ? ` · SpO₂ ${spo2.toFixed(1)}%` : ''}
              </Text>
              <Text style={[styles.hint, { color: colors.accentCyan }]}>
                {state === 'failed' ? 'TAP TO RETRY ACKNOWLEDGEMENT' : 'TAP TO ACKNOWLEDGE'}
              </Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 20,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  touch: { flexDirection: 'row', paddingVertical: 14, paddingRight: 16 },
  strip: { width: 6, marginLeft: 14, borderRadius: 3 },
  title: { color: '#fff', fontSize: 16, fontWeight: '800', marginLeft: 12 },
  titleAcked: { color: '#4ade80' },
  body: { color: '#cbd5e1', fontSize: 13, marginTop: 4, marginLeft: 12 },
  hint: { fontSize: 11, fontWeight: '700', marginTop: 6, marginLeft: 12, letterSpacing: 1 },
});