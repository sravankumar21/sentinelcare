import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Background, GlassCard } from '../components/Glass';
import { api } from '../services/api';
import { useTheme, getStatusColor } from '../theme';

export default function Simulator({ navigation }) {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [running, setRunning] = useState(false);
  const [simData, setSimData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [alertFired, setAlertFired] = useState(false);

  const refresh = useCallback(async () => {
    try { const p = await api.getPatients(); setPatients(p.patients); } catch (e) {}
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const selectedPatient = patients.find(p => p.patient_id === selected);
  const pct = selectedPatient ? Math.round(selectedPatient.risk_probability * 100) : 0;
  const color = selectedPatient ? getStatusColor(selectedPatient.risk_status) : colors.textMuted;

  const startSim = async (mode) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.simulateStart(selected, mode);
      setRunning(true);
      setSimData(null);
      setAlertFired(false);
    } catch (e) {}
    setBusy(false);
  };

  const stepSim = async () => {
    if (!selected || !running || busy) return;
    setBusy(true);
    try {
      const data = await api.simulateStep(selected);
      setSimData(data);
      if (data.new_alert) setAlertFired(true);
    } catch (e) {}
    setBusy(false);
  };

  const autoRun = async () => {
    for (let i = 0; i < 10; i++) {
      if (!running) break;
      await stepSim();
      await new Promise(r => setTimeout(r, 120));
    }
  };

  const reset = async () => {
    if (!selected) return;
    try { await api.simulateReset(selected); setRunning(false); setSimData(null); setAlertFired(false); } catch (e) {}
  };

  const vitals = selectedPatient ? [
    { label: 'SpO₂', value: `${selectedPatient.vitals.spo2_pct.toFixed(1)}%` },
    { label: 'HR', value: `${Math.round(selectedPatient.vitals.heart_rate)} bpm` },
    { label: 'RR', value: `${Math.round(selectedPatient.vitals.respiratory_rate)}/min` },
    { label: 'Temp', value: `${selectedPatient.vitals.temperature_c.toFixed(1)}°C` },
    { label: 'BP', value: `${Math.round(selectedPatient.vitals.systolic_bp)}/${Math.round(selectedPatient.vitals.diastolic_bp)}` },
    { label: 'Risk', value: `${pct}%`, color },
  ] : [];

  return (
    <Background>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Patient Simulator</Text>
        <Text style={styles.subtitle}>Simulate incoming observations through the real ML pipeline</Text>

        <GlassCard style={styles.selectCard}>
          <Text style={styles.label}>Select Patient</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
            {patients.map(p => (
              <TouchableOpacity key={p.patient_id} onPress={() => { setSelected(p.patient_id); setSimData(null); setRunning(false); setAlertFired(false); }}
                style={[styles.pill, selected === p.patient_id && styles.pillActive]}>
                <Text style={[styles.pillText, selected === p.patient_id && styles.pillTextActive]}>
                  {p.bed} · {Math.round(p.risk_probability * 100)}%
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </GlassCard>

        {selectedPatient && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {vitals.map(v => (
              <GlassCard key={v.label} style={styles.vitalCard}>
                <Text style={styles.vitalLabel}>{v.label}</Text>
                <Text style={[styles.vitalValue, { color: v.color || colors.textPrimary }]}>{v.value}</Text>
              </GlassCard>
            ))}
          </View>
        )}

        {selectedPatient && (
          <GlassCard style={[styles.riskPanel, { borderColor: `${color}44` }]}>
            <Text style={styles.riskLabel}>Current Risk</Text>
            <Text style={[styles.riskValue, { color }]}>{pct}%</Text>
            <Text style={[styles.riskStatus, { color }]}>{selectedPatient.risk_status}</Text>
          </GlassCard>
        )}

        <View style={styles.controls}>
          <TouchableOpacity style={[styles.btn, styles.btnStable, !selected && styles.btnDisabled]}
            onPress={() => startSim('stable')} disabled={!selected || busy}>
            <Text style={styles.btnStableText}>Simulate Normal</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnDanger, !selected && styles.btnDisabled]}
            onPress={() => startSim('deteriorate')} disabled={!selected || busy}>
            <Text style={styles.btnDangerText}>Simulate Deterioration</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnGhost, (!selected || !running) && styles.btnDisabled]}
            onPress={stepSim} disabled={!selected || !running || busy}>
            <Text style={styles.btnGhostText}>Step ›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnGhost, (!selected || !running) && styles.btnDisabled]}
            onPress={autoRun} disabled={!selected || !running || busy}>
            <Text style={styles.btnGhostText}>Auto 10 Steps</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnReset, !selected && styles.btnDisabled]}
            onPress={reset} disabled={!selected || busy}>
            <Text style={styles.btnGhostText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {busy && <ActivityIndicator color={colors.accentCyan} style={{ marginTop: 20 }} />}

        {alertFired && (
          <GlassCard style={styles.alertBanner}>
            <Text style={styles.alertTitle}>🚨 HIGH DETERIORATION RISK</Text>
            <Text style={styles.alertBody}>
              Bed {selectedPatient?.bed} — Ward {selectedPatient?.ward}
              {'\n'}Risk: {pct}%
              {'\n'}Clinical review recommended.
            </Text>
            <TouchableOpacity style={styles.viewBtn} onPress={() => navigation.navigate('PatientDetail', { patientId: selected, bed: selectedPatient?.bed })}>
              <Text style={styles.viewBtnText}>Open Patient ›</Text>
            </TouchableOpacity>
          </GlassCard>
        )}

        {simData && !alertFired && (
          <GlassCard style={styles.latestCard}>
            <Text style={styles.latestTitle}>Latest Observation Processed</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {[
                { l: 'SpO₂', v: `${simData.vitals.spo2_pct.toFixed(1)}%` },
                { l: 'HR', v: `${Math.round(simData.vitals.heart_rate)}` },
                { l: 'RR', v: `${Math.round(simData.vitals.respiratory_rate)}` },
                { l: 'BP', v: `${Math.round(simData.vitals.systolic_bp)}/${Math.round(simData.vitals.diastolic_bp)}` },
                { l: 'Risk', v: `${Math.round(simData.risk_probability * 100)}%`, c: getStatusColor(simData.risk_status) },
              ].map(x => (
                <View key={x.l} style={styles.stepItem}>
                  <Text style={styles.stepLabel}>{x.l}</Text>
                  <Text style={[styles.stepValue, { color: x.c || colors.textPrimary }]}>{x.v}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
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
  selectCard: { padding: 16 },
  label: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.glassBorder, marginRight: 8 },
  pillActive: { backgroundColor: colors.chipBg, borderColor: colors.chipBorder },
  pillText: { fontSize: 13, color: colors.textSecondary },
  pillTextActive: { color: colors.accentBlue, fontWeight: '600' },
  vitalCard: { width: '31%', alignItems: 'center', paddingVertical: 12 },
  vitalLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase' },
  vitalValue: { fontSize: 17, fontWeight: '700', marginTop: 3 },
  riskPanel: { alignItems: 'center', padding: 20, marginTop: 16, borderWidth: 1 },
  riskLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  riskValue: { fontSize: 48, fontWeight: '800', marginVertical: 4 },
  riskStatus: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  btn: { paddingVertical: 13, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnStable: { backgroundColor: 'rgba(34,197,94,0.12)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)' },
  btnStableText: { color: '#22c55e', fontWeight: '600', fontSize: 13 },
  btnDanger: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  btnDangerText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  btnGhost: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.glassBorder },
  btnGhostText: { color: colors.textPrimary, fontWeight: '600', fontSize: 13 },
  btnReset: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.glassBorder },
  btnDisabled: { opacity: 0.35 },
  alertBanner: { padding: 20, marginTop: 20, backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.4)' },
  alertTitle: { color: '#ef4444', fontSize: 17, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  alertBody: { color: colors.textPrimary, fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  viewBtn: { marginTop: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.2)', alignItems: 'center' },
  viewBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
  latestCard: { padding: 16, marginTop: 16 },
  latestTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  stepItem: { width: '30%', alignItems: 'center', paddingVertical: 8, backgroundColor: colors.cardBg, borderRadius: 8 },
  stepLabel: { fontSize: 10, color: colors.textMuted },
  stepValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
});
