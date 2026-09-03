import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Background, GlassCard } from '../components/Glass';
import { api } from '../services/api';
import { useTheme, getStatusColor } from '../theme';

const RISK_LABELS = { STABLE: 'Stable', WATCH: 'Watch', HIGH: 'High Risk', CRITICAL: 'Critical Review' };

function RiskSparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const height = 120;
  const width = null;
  const max = 100;
  const min = 0;
  const step = 100 / (data.length - 1);
  const pts = data.map((v, i) => ({ x: i * step, y: height - ((v - min) / (max - min)) * height }));
  return (
    <View style={{ height, justifyContent: 'space-between', marginVertical: 8 }}>
      {[0, 1, 2].map(r => (
        <View key={r} style={styles.gridline} />
      ))}
      <View style={[StyleSheet.absoluteFill, styles.sparkline]} pointerEvents="none">
        {pts.map((p, i) => (
          <View key={i} style={[styles.sparkPoint, { left: `${p.x}%`, top: p.y, backgroundColor: color }]}>
            {i < pts.length - 1 && (
              <View style={{
                position: 'absolute', left: 0, top: (p.y - pts[i + 1].y) / 2,
                width: `${step}%`, height: Math.abs(p.y - pts[i + 1].y),
                backgroundColor: color, borderRadius: 1, opacity: 0.7,
              }} />
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PatientDetail({ route, navigation }) {
  const { patientId, bed } = route.params;
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const [patient, setPatient] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [trajectory, setTrajectory] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [p, e, recs, traj] = await Promise.all([
          api.getPatient(patientId), api.getPatientExplanation(patientId),
          api.getRecommendations(patientId).catch(() => ({ recommendations: [] })),
          api.getTrajectory(patientId).catch(() => null),
        ]);
        if (active) {
          setPatient(p);
          setExplanation(e);
          setRecommendations(recs.recommendations || []);
          setTrajectory(traj);
        }
      } catch (e) {}
    };
    load();
    const interval = setInterval(load, 6000);
    return () => { active = false; clearInterval(interval); };
  }, [patientId]);

  const PRIORITY_COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#6b7280' };
  const PRIORITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedRecs = [...recommendations].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4));

  if (!patient) {
    return (
      <Background>
        <View style={styles.loading}><ActivityIndicator color={colors.accentCyan} size="large" /></View>
      </Background>
    );
  }

  const color = getStatusColor(patient.risk_status);
  const riskPct = Math.round(patient.risk_probability * 100);
  const riskHistory = patient.risk_history || [];
  const hasTrend = riskHistory.length > 1;

  const vitals = [
    { label: 'SpO₂', value: `${patient.vitals.spo2_pct.toFixed(1)}%`, unit: '', color: patient.vitals.spo2_pct < 92 ? '#ef4444' : '#22c55e' },
    { label: 'Heart Rate', value: Math.round(patient.vitals.heart_rate).toString(), unit: 'bpm', color: patient.vitals.heart_rate > 120 ? '#f97316' : '#22c55e' },
    { label: 'Resp Rate', value: Math.round(patient.vitals.respiratory_rate).toString(), unit: '/min', color: patient.vitals.respiratory_rate > 28 ? '#f97316' : '#22c55e' },
    { label: 'Temperature', value: patient.vitals.temperature_c.toFixed(1), unit: '°C', color: colors.textPrimary },
    { label: 'Blood Pressure', value: `${Math.round(patient.vitals.systolic_bp)}/${Math.round(patient.vitals.diastolic_bp)}`, unit: '', color: colors.textPrimary },
    { label: 'Oxygen', value: String(patient.oxygen_device || 'none'), unit: '', color: colors.textPrimary },
  ];

  return (
    <Background>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.patientId}>PATIENT #{patient.patient_id}</Text>
        </View>
        <Text style={styles.location}>
          {bed || `Ward ${patient.ward}`} {bed ? `· Bed ${patient.bed}` : ''} · {patient.age}y {patient.gender}
        </Text>

        <GlassCard style={styles.riskPanel}>
          <Text style={styles.riskLabel}>Deterioration Risk</Text>
          <Text style={[styles.riskValue, { color }]}>{riskPct}%</Text>
          <View style={[styles.statusPill, { backgroundColor: `${color}22` }]}>
            <Text style={[styles.statusText, { color }]}>{RISK_LABELS[patient.risk_status]}</Text>
          </View>
          <Text style={[styles.trend, { color }]}>
            {patient.trend_arrow} {patient.risk_trend}
          </Text>
        </GlassCard>

        <Text style={styles.sectionTitle}>Current Observations</Text>
        <View style={styles.vitalsGrid}>
          {vitals.map(v => (
            <GlassCard key={v.label} style={styles.vitalCard}>
              <Text style={styles.vitalLabel}>{v.label}</Text>
              <Text style={[styles.vitalValue, { color: v.color }]}>
                {v.value} <Text style={styles.vitalUnit}>{v.unit}</Text>
              </Text>
            </GlassCard>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Risk Trajectory</Text>
        <GlassCard style={styles.chartCard}>
          {(trajectory?.risk_history?.length > 1 || riskHistory.length > 1) ? (
            <RiskSparkline
              data={(trajectory?.risk_history?.length > 1 ? trajectory.risk_history : riskHistory).map(r => r * 100)}
              color={color}
            />
          ) : (
            <Text style={styles.noTrend}>Collecting more observations…</Text>
          )}
          <View style={styles.chartAxis}>
            <Text style={styles.axisLabel}>0%</Text>
            <Text style={styles.axisLabel}>100%</Text>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>Why This Patient Was Flagged</Text>
        <GlassCard style={styles.explainCard}>
          <Text style={styles.explainNote}>
            These features contributed most strongly to the model's current risk estimate.
          </Text>
          {(explanation?.factors || []).map((f, i) => (
            <View key={i} style={styles.factorRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.factorName}>{f.feature}</Text>
                <Text style={styles.factorDetail}>{f.direction === 'up' ? '↑' : '↓'} {f.magnitude} change</Text>
              </View>
              <View style={[styles.impactPill, {
                backgroundColor: f.impact === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
              }]}>
                <Text style={[styles.impactText, { color: f.impact === 'high' ? '#ef4444' : '#eab308' }]}>
                  {f.impact === 'high' ? 'HIGH' : 'MODERATE'}
                </Text>
              </View>
            </View>
          ))}
          {(!explanation?.factors || explanation.factors.length === 0) && (
            <Text style={styles.noFactors}>No significant changes detected recently.</Text>
          )}
        </GlassCard>

        <Text style={styles.sectionTitle}>Recommended Actions</Text>
        <GlassCard style={styles.recCard}>
          {sortedRecs.length > 0 ? sortedRecs.map((r, i) => (
            <View key={i} style={styles.recRow}>
              <View style={[styles.recBadge, { backgroundColor: `${PRIORITY_COLORS[r.priority] || '#6b7280'}22` }]}>
                <Text style={[styles.recBadgeText, { color: PRIORITY_COLORS[r.priority] || '#6b7280' }]}>
                  {r.priority}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recAction}>{r.action}</Text>
                {r.rationale ? <Text style={styles.recRationale}>{r.rationale}</Text> : null}
              </View>
            </View>
          )) : (
            <Text style={styles.emptyText}>No recommendations at this time.</Text>
          )}
        </GlassCard>

        <GlassCard style={styles.actionCard}>
          <Text style={styles.actionText}>⚠ Elevated deterioration risk detected.</Text>
          <Text style={styles.actionText}>Clinical review recommended.</Text>
        </GlassCard>
      </ScrollView>
    </Background>
  );
}

const buildStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  backBtn: { paddingVertical: 4, paddingRight: 12 },
  backText: { color: colors.accentCyan, fontSize: 15, fontWeight: '600' },
  patientId: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  location: { fontSize: 13, color: colors.textSecondary, marginBottom: 14 },
  riskPanel: { alignItems: 'center', padding: 24, marginBottom: 16 },
  riskLabel: { fontSize: 12, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 },
  riskValue: { fontSize: 64, fontWeight: '800', marginVertical: 8 },
  statusPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
  statusText: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  trend: { fontSize: 13, fontWeight: '600', marginTop: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, marginTop: 16, textTransform: 'uppercase', letterSpacing: 1 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  vitalCard: { width: '31.5%', alignItems: 'center', paddingVertical: 14, marginBottom: 4 },
  vitalLabel: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  vitalValue: { fontSize: 20, fontWeight: '700', marginTop: 4 },
  vitalUnit: { fontSize: 11, color: colors.textSecondary, fontWeight: '400' },
  chartCard: { padding: 16 },
  gridline: { height: 1, backgroundColor: 'rgba(128,128,128,0.15)', marginVertical: 0 },
  sparkline: { width: '100%' },
  sparkPoint: { position: 'absolute', width: 6, height: 6, borderRadius: 3, marginLeft: -3, marginTop: -3 },
  noTrend: { color: colors.textMuted, textAlign: 'center', paddingVertical: 60, fontSize: 13 },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisLabel: { fontSize: 10, color: colors.textMuted },
  explainCard: { padding: 16 },
  explainNote: { fontSize: 12, color: colors.textMuted, marginBottom: 12, fontStyle: 'italic' },
  factorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  factorName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  factorDetail: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  impactPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  impactText: { fontSize: 10, fontWeight: '700' },
  noFactors: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  actionCard: { padding: 16, marginTop: 16, borderColor: 'rgba(239,68,68,0.3)' },
  actionText: { color: '#f97316', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  recCard: { padding: 16 },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.glassBorder, gap: 10 },
  recBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, minWidth: 68, alignItems: 'center' },
  recBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  recAction: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  recRationale: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 12 },
});
