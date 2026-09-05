import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Background, GlassCard } from '../components/Glass';
import { showSnackbar } from '../components/Snackbar';
import { api } from '../services/api';
import { useTheme, getStatusColor } from '../theme';

const MAX_STEPS = 12;

export default function Simulator({ navigation }) {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const [patients, setPatients] = useState([]);
  const [alertPids, setAlertPids] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [runningPid, setRunningPid] = useState(null);
  const [outcome, setOutcome] = useState({});
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([api.getPatients(), api.getAlerts()]);
      setPatients(p.patients);
      setAlertPids((a.alerts || []).map(x => x.patient_id));
    } catch (e) {}
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const runPool = patients.filter(p => !alertPids.includes(p.patient_id));

  const runDeterioration = async (pid) => {
    if (busy) return;
    setBusy(true);
    setRunningPid(pid);
    setOutcome(prev => ({ ...prev, [pid]: null }));
    try {
      await api.simulateStart(pid, 'deteriorate');
      for (let i = 0; i < MAX_STEPS; i++) {
        const data = await api.simulateStep(pid);
        if (data.new_alert) {
          const p = runPool.find(x => x.patient_id === pid);
          showSnackbar(`Alert created for ${p?.bed || ''} — Ward ${p?.ward || ''} · Notification sent`);
          setOutcome(prev => ({ ...prev, [pid]: { ok: true, risk: data.risk_probability } }));
          setRunningPid(null);
          setBusy(false);
          refresh();
          return;
        }
        await new Promise(r => setTimeout(r, 120));
      }
      setOutcome(prev => ({ ...prev, [pid]: { ok: false } }));
    } catch (e) {
      setOutcome(prev => ({ ...prev, [pid]: { ok: false } }));
    }
    setRunningPid(null);
    setBusy(false);
  };

  return (
    <Background>
      <ScrollView
        style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentCyan} />}
      >
        <Text style={styles.title}>Run Simulator</Text>
        <Text style={styles.subtitle}>
          Patients below have no active alert. Run a deterioration simulation to create one.
        </Text>

        {runPool.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>All patients are covered</Text>
            <Text style={styles.emptyText}>Every patient already has an alert. Start fresh with the reset in the app, or acknowledge alerts to clear them.</Text>
          </GlassCard>
        ) : (
          runPool.map(p => {
            const color = getStatusColor(p.risk_status);
            const pct = Math.round(p.risk_probability * 100);
            const res = outcome[p.patient_id];
            return (
              <GlassCard key={p.patient_id} style={styles.patientCard}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bed}>{p.bed} · Ward {p.ward}</Text>
                    <Text style={[styles.risk, { color }]}>Risk {pct}% · {p.risk_status}</Text>
                  </View>
                  {runningPid === p.patient_id ? (
                    <ActivityIndicator color={colors.accentCyan} />
                  ) : (
                    <TouchableOpacity style={[styles.runBtn, busy && styles.btnDisabled]}
                      onPress={() => runDeterioration(p.patient_id)} disabled={busy}>
                      <Text style={styles.runBtnText}>Create Alert</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {res && res.ok && (
                  <View style={styles.okBanner}>
                    <Text style={styles.okText}>
                      🚨 Alert created — Risk {Math.round(res.risk * 100)}%. Tap the patient card to review.
                    </Text>
                  </View>
                )}
                {res && !res.ok && (
                  <View style={styles.failBanner}>
                    <Text style={styles.failText}>Simulation completed without crossing the alert threshold.</Text>
                  </View>
                )}
              </GlassCard>
            );
          })
        )}
      </ScrollView>
    </Background>
  );
}

const buildStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  emptyCard: { padding: 28, alignItems: 'center', borderColor: 'rgba(34,197,94,0.3)' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 13, color: colors.textSecondary, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  patientCard: { padding: 16, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bed: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  risk: { fontSize: 13, marginTop: 3, fontWeight: '600' },
  runBtn: {
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10,
    backgroundColor: '#f97316', alignItems: 'center',
  },
  runBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  okBanner: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.12)' },
  okText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  failBanner: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: 'rgba(234,179,8,0.12)' },
  failText: { color: '#b45309', fontSize: 13, fontWeight: '600' },
});