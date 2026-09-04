import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Background, GlassCard } from '../components/Glass';
import { api } from '../services/api';
import { useTheme, getStatusColor } from '../theme';

const DEFAULTS = {
  spo2_pct: 97, heart_rate: 82, respiratory_rate: 18, temperature_c: 37.0,
  systolic_bp: 122, diastolic_bp: 78, oxygen_flow: 0, oxygen_device: 'none',
  lactate: 1.0, wbc_count: 8.0, creatinine: 0.9, crp_level: 5.0, hemoglobin: 13.0,
  age: 60, gender: 'M', admission_type: 'ED', comorbidity_index: 0,
  sepsis_risk_score: 0.1, nurse_alert: 0, mobility_score: 3.0, baseline_risk_score: 0.05, los_hours: 24,
};

const VITAL_FIELDS = [
  { key: 'spo2_pct', label: 'SpO₂', unit: '%', step: 0.1 },
  { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', step: 1 },
  { key: 'respiratory_rate', label: 'Resp Rate', unit: '/min', step: 1 },
  { key: 'temperature_c', label: 'Temperature', unit: '°C', step: 0.1 },
  { key: 'systolic_bp', label: 'Systolic BP', unit: 'mmHg', step: 1 },
  { key: 'diastolic_bp', label: 'Diastolic BP', unit: 'mmHg', step: 1 },
];
const OXYGEN_FIELDS = [
  { key: 'oxygen_flow', label: 'O₂ Flow', unit: 'L/min', step: 0.5 },
];
const LAB_FIELDS = [
  { key: 'lactate', label: 'Lactate', unit: 'mmol/L', step: 0.1 },
  { key: 'wbc_count', label: 'WBC', unit: 'K/µL', step: 0.1 },
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', step: 0.1 },
  { key: 'crp_level', label: 'CRP', unit: 'mg/L', step: 0.1 },
  { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', step: 0.1 },
];
const CONTEXT_FIELDS = [
  { key: 'age', label: 'Age', unit: 'yrs', step: 1 },
  { key: 'comorbidity_index', label: 'Comorbidity', unit: '0-10', step: 1 },
  { key: 'sepsis_risk_score', label: 'Sepsis Risk', unit: '0-1', step: 0.01 },
  { key: 'nurse_alert', label: 'Nurse Alert', unit: '0/1', step: 1 },
  { key: 'mobility_score', label: 'Mobility', unit: '0-5', step: 0.5 },
  { key: 'baseline_risk_score', label: 'Baseline Risk', unit: '0-1', step: 0.01 },
  { key: 'los_hours', label: 'LOS Hours', unit: 'hrs', step: 1 },
];
const SELECTS = [
  { key: 'oxygen_device', label: 'O₂ Device', options: ['none', 'nasal', 'hfnc', 'mask', 'niv'] },
  { key: 'gender', label: 'Gender', options: ['M', 'F'] },
  { key: 'admission_type', label: 'Admission', options: ['ED', 'Elective', 'Transfer'] },
];

export default function RiskAnalyzer({ navigation }) {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const [values, setValues] = useState({ ...DEFAULTS });
  const [result, setResult] = useState(null);
  const [simResult, setSimResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [errors, setErrors] = useState({});

  const update = (key, val) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setErrors(prev => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const e = {};
    if (values.spo2_pct < 0 || values.spo2_pct > 100) e.spo2_pct = '0-100';
    if (values.heart_rate < 20 || values.heart_rate > 250) e.heart_rate = '20-250';
    if (values.respiratory_rate < 4 || values.respiratory_rate > 60) e.respiratory_rate = '4-60';
    if (values.temperature_c < 30 || values.temperature_c > 44) e.temperature_c = '30-44';
    if (values.systolic_bp < 40 || values.systolic_bp > 300) e.systolic_bp = '40-300';
    if (values.diastolic_bp < 20 || values.diastolic_bp > 200) e.diastolic_bp = '20-200';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const analyze = async () => {
    if (!validate()) return;
    setAnalyzing(true);
    setResult(null);
    setSimResult(null);
    try {
      const data = await api.riskAnalyze(values);
      setResult(data);
    } catch (e) {}
    setAnalyzing(false);
  };

  const simulateForPatient = async () => {
    setSimulating(true);
    try {
      const data = await api.riskSimulate(values);
      setSimResult(data);
    } catch (e) {}
    setSimulating(false);
  };

  const canSimulate = result && (result.risk_status === 'HIGH' || result.risk_status === 'CRITICAL');
  const color = result ? result.risk_color : colors.textMuted;

  const renderField = (f) => (
    <View key={f.key} style={styles.field}>
      <Text style={styles.fieldLabel}>{f.label} <Text style={styles.fieldUnit}>{f.unit}</Text></Text>
      <TextInput
        style={[styles.input, errors[f.key] && styles.inputError]}
        keyboardType="decimal-pad"
        value={String(values[f.key])}
        onChangeText={v => update(f.key, parseFloat(v) || 0)}
      />
      {errors[f.key] && <Text style={styles.fieldError}>{errors[f.key]}</Text>}
    </View>
  );

  const renderSelect = (s) => (
    <View key={s.key} style={styles.field}>
      <Text style={styles.fieldLabel}>{s.label}</Text>
      <View style={styles.selectRow}>
        {s.options.map(o => (
          <TouchableOpacity key={o} style={[styles.selectPill, values[s.key] === o && styles.selectPillActive]}
            onPress={() => update(s.key, o)}>
            <Text style={[styles.selectPillText, values[s.key] === o && styles.selectPillTextActive]}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Background>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Text style={styles.backText}>‹ Back</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Test Risk Analysis</Text>
          </View>
          <Text style={styles.subtitle}>
            Research / Demonstration Model — Enter observations to test the ML predictor.
          </Text>

          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Vital Signs</Text>
            {VITAL_FIELDS.map(renderField)}
          </GlassCard>

          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Oxygen Support</Text>
            {OXYGEN_FIELDS.map(renderField)}
            {renderSelect(SELECTS[0])}
          </GlassCard>

          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Laboratory Values</Text>
            {LAB_FIELDS.map(renderField)}
          </GlassCard>

          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Patient Context</Text>
            {CONTEXT_FIELDS.map(renderField)}
            {renderSelect(SELECTS[1])}
            {renderSelect(SELECTS[2])}
          </GlassCard>

          <TouchableOpacity style={[styles.analyzeBtn, analyzing && styles.btnDisabled]}
            onPress={analyze} disabled={analyzing}>
            {analyzing ? <ActivityIndicator color="#fff" /> : <Text style={styles.analyzeBtnText}>ANALYZE RISK</Text>}
          </TouchableOpacity>

          {result && (
            <GlassCard style={[styles.resultCard, { borderColor: `${color}44` }]}>
              <Text style={styles.resultLabel}>Deterioration Risk</Text>
              <Text style={[styles.resultValue, { color }]}>{result.risk_percentage}%</Text>
              <View style={[styles.statusPill, { backgroundColor: `${color}22` }]}>
                <Text style={[styles.statusText, { color }]}>{result.risk_status}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Model</Text>
                <Text style={styles.metaValue}>{result.model_version}</Text>
              </View>

              <Text style={styles.sectionTitle}>Current Observations</Text>
              <View style={styles.obsGrid}>
                {Object.entries(result.vitals || {}).map(([k, v]) => (
                  <View key={k} style={styles.obsItem}>
                    <Text style={styles.obsLabel}>{k.replace(/_/g, ' ').toUpperCase()}</Text>
                    <Text style={styles.obsValue}>{typeof v === 'number' ? v.toFixed(1) : v}</Text>
                  </View>
                ))}
              </View>

              {result.factors && result.factors.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Model Contributors</Text>
                  {result.factors.map((f, i) => (
                    <View key={i} style={styles.factorRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.factorName}>{f.feature}</Text>
                        <Text style={styles.factorDetail}>{f.direction === 'up' ? '↑' : '↓'} {f.magnitude} change</Text>
                      </View>
                      <View style={[styles.impactPill, {
                        backgroundColor: f.impact === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
                      }]}>
                        <Text style={[styles.impactText, { color: f.impact === 'high' ? '#ef4444' : '#eab308' }]}>
                          {f.impact.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {result.recommendations && result.recommendations.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Recommendations</Text>
                  {result.recommendations.map((r, i) => (
                    <View key={i} style={styles.recRow}>
                      <View style={[styles.recBadge, { backgroundColor: `${r.priority === 'HIGH' || r.priority === 'CRITICAL' ? '#ef4444' : '#eab308'}22` }]}>
                        <Text style={[styles.recBadgeText, { color: r.priority === 'HIGH' || r.priority === 'CRITICAL' ? '#ef4444' : '#eab308' }]}>{r.priority}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recAction}>{r.action}</Text>
                        <Text style={styles.recRationale}>{r.rationale}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}

              <View style={styles.simSection}>
                <Text style={styles.simLabel}>Simulate for Patient</Text>
                <TouchableOpacity style={[styles.simBtn, (!canSimulate || simulating) && styles.btnDisabled]}
                  onPress={simulateForPatient} disabled={!canSimulate || simulating}>
                  {simulating ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.simBtnText}>SIMULATE FOR PATIENT</Text>
                  )}
                </TouchableOpacity>
                {!canSimulate && <Text style={styles.simHint}>Enable when risk is HIGH or CRITICAL</Text>}
              </View>
            </GlassCard>
          )}

          {simResult && (
            <GlassCard style={[styles.simResultCard, { borderColor: simResult.new_alert ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)' }]}>
              {simResult.new_alert ? (
                <>
                  <Text style={styles.simResultTitle}>🚨 ALERT GENERATED</Text>
                  <Text style={styles.simResultBody}>
                    Bed {simResult.alert?.bed} — Ward {simResult.alert?.ward}
                    {'\n'}Risk: {simResult.risk_percentage}%
                    {'\n'}Clinical review recommended.
                  </Text>
                  <TouchableOpacity style={styles.viewBtn}
                    onPress={() => navigation.navigate('PatientDetail', { patientId: simResult.patient_id, bed: simResult.alert?.bed })}>
                    <Text style={styles.viewBtnText}>Open Patient ›</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.simResultStable}>
                  Patient updated. Risk: {simResult.risk_percentage}% ({simResult.risk_status}). No alert threshold crossed.
                </Text>
              )}
            </GlassCard>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Background>
  );
}

const buildStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: { paddingVertical: 4 },
  backText: { color: colors.accentCyan, fontSize: 15, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  section: { padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.accentCyan, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  field: { marginBottom: 10 },
  fieldLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  fieldUnit: { fontSize: 10, color: colors.textMuted },
  input: {
    padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.glassBorder,
    backgroundColor: colors.cardBg, color: colors.textPrimary, fontSize: 15,
  },
  inputError: { borderColor: '#ef4444' },
  fieldError: { fontSize: 10, color: '#ef4444', marginTop: 2 },
  selectRow: { flexDirection: 'row', gap: 8 },
  selectPill: {
    flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.glassBorder,
    backgroundColor: colors.cardBg, alignItems: 'center',
  },
  selectPillActive: { backgroundColor: colors.chipBg, borderColor: colors.chipBorder },
  selectPillText: { fontSize: 13, color: colors.textSecondary },
  selectPillTextActive: { color: colors.accentBlue, fontWeight: '600' },
  analyzeBtn: {
    paddingVertical: 16, borderRadius: 12, backgroundColor: '#f97316',
    alignItems: 'center', marginBottom: 16,
  },
  analyzeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.5 },
  btnDisabled: { opacity: 0.5 },
  resultCard: { padding: 20, borderWidth: 1, alignItems: 'center', marginBottom: 12 },
  resultLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 },
  resultValue: { fontSize: 56, fontWeight: '800', marginVertical: 6 },
  statusPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, marginBottom: 12 },
  statusText: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 16, marginBottom: 8 },
  metaLabel: { fontSize: 12, color: colors.textMuted },
  metaValue: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  obsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  obsItem: { width: '30%', alignItems: 'center', paddingVertical: 8, backgroundColor: colors.cardBg, borderRadius: 8 },
  obsLabel: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase' },
  obsValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  factorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  factorName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  factorDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  impactPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  impactText: { fontSize: 10, fontWeight: '700' },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.glassBorder, gap: 10 },
  recBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, minWidth: 60, alignItems: 'center' },
  recBadgeText: { fontSize: 10, fontWeight: '700' },
  recAction: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  recRationale: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  simSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.glassBorder, alignItems: 'center' },
  simLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  simBtn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, backgroundColor: '#f97316', alignItems: 'center', width: '100%' },
  simBtnText: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
  simHint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  simResultCard: { padding: 20, borderWidth: 1, marginTop: 12 },
  simResultTitle: { color: '#ef4444', fontSize: 17, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  simResultBody: { color: colors.textPrimary, fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 },
  simResultStable: { color: '#22c55e', fontSize: 14, fontWeight: '600', textAlign: 'center', padding: 8 },
  viewBtn: { marginTop: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.2)', alignItems: 'center' },
  viewBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 14 },
});
