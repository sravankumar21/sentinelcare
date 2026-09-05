import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Background, GlassCard } from '../components/Glass';
import { showSnackbar } from '../components/Snackbar';
import { notifyForAlert, resetNotificationMemory } from '../services/notifications';
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
        setOutcome(prev => ({ ...prev, [pid]: { running: true, risk: data.risk_probability } }));
        if (data.new_alert) {
          const p = runPool.find(x => x.patient_id === pid);
          const alertRisk = data.alert?.risk_probability ?? data.risk_probability;
          showSnackbar(`Alert created for ${p?.bed || ''} — alerting doctor…`);
          const sent = await notifyForAlert(data.alert);
          if (!sent) showSnackbar(`Alert raised for ${p?.bed || ''} — Ward ${p?.ward || ''} (notifications blocked in settings)`);
          setOutcome(prev => ({ ...prev, [pid]: { ok: true, risk: alertRisk } }));
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

  const resetData = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.resetSystem();
      resetNotificationMemory();
      setOutcome({});
      showSnackbar('Demo data reset — patients restored to original state');
    } catch (e) {
      showSnackbar('Reset failed — check backend connection');
    }
    setBusy(false);
    refresh();
  };

  return (
    <Background>
      <ScrollView
        style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentCyan} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>Run Simulator</Text>
          <TouchableOpacity style={[styles.resetBtn, busy && styles.btnDisabled]}
            onPress={resetData} disabled={busy}>
            <Text style={styles.resetBtnText}>Reset</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Patients below have no active alert. Run a deterioration simulation to create one — the run drives the patient's risk upward, and the alert records the risk exactly at the moment it spikes.
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
            const isStable = p.risk_status === 'STABLE';
            return (
              <TouchableOpacity
                key={p.patient_id}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PatientDetail', { patientId: p.patient_id, bed: p.bed })}
              >
                <GlassCard style={styles.patientCard}>
                  <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bed}>{p.bed} · Ward {p.ward}</Text>
                      <Text style={[styles.risk, { color }]}>Risk {pct}% · {p.risk_status}</Text>
                    </View>
                    {runningPid === p.patient_id ? (
                      <View style={{ alignItems: 'flex-end', gap: 6 }}>
                        {res?.running && (
                          <Text style={styles.runProgress}>
                            Risk climbing… {Math.round(res.risk * 100)}%
                          </Text>
                        )}
                        <ActivityIndicator color={colors.accentCyan} />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.runBtn, (busy || isStable) && styles.btnDisabled]}
                        onPress={isStable ? undefined : () => runDeterioration(p.patient_id)}
                        disabled={busy || isStable}>
                        <Text style={styles.runBtnText}>{isStable ? '● Stable' : 'Create Alert'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {res && res.ok && (
                    <View style={styles.okBanner}>
                      <Text style={styles.okText}>
                        Alert created — Risk {Math.round(res.risk * 100)}%. Matches the alert shown in Home. Tap the patient card to review.
                      </Text>
                    </View>
                  )}
                  {res && !res.ok && (
                    <View style={styles.failBanner}>
                      <Text style={styles.failText}>Simulation completed without crossing the alert threshold.</Text>
                    </View>
                  )}
                </GlassCard>
              </TouchableOpacity>
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginRight: 2 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  resetBtn: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10,
    borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.chipBg,
  },
  resetBtnText: { color: colors.accentCyan, fontWeight: '700', fontSize: 13 },
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
  runProgress: { color: colors.accentCyan, fontSize: 12, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
  okBanner: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.12)' },
  okText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  failBanner: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: 'rgba(234,179,8,0.12)' },
  failText: { color: '#b45309', fontSize: 13, fontWeight: '600' },
});