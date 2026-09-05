import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Background, GlassCard } from '../components/Glass';
import { PatientCard } from '../components/PatientCard';
import { api } from '../services/api';
import { useTheme } from '../theme';

export default function CommandCenter({ navigation }) {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const [patients, setPatients] = useState([]);
  const [summary, setSummary] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [p, s, a] = await Promise.all([
        api.getPatients(), api.getDashboard(), api.getAlerts(),
      ]);
      setPatients(p.patients);
      setSummary(s);
      setAlerts(a.alerts);
      setOffline(false);
      setLoading(false);
    } catch (e) {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, [refresh]);

  const stats = [
    { label: 'Stable', value: summary.stable ?? 0, color: '#22c55e' },
    { label: 'Watch', value: summary.watch ?? 0, color: '#eab308' },
    { label: 'High Risk', value: summary.high ?? 0, color: '#f97316' },
    { label: 'Critical', value: summary.critical ?? 0, color: '#ef4444' },
  ];

  const priority = [...(patients || [])]
    .filter(p => ['HIGH', 'CRITICAL'].includes(p.risk_status))
    .sort((a, b) => b.risk_probability - a.risk_probability);

  const pendingAlerts = (alerts || []).filter(a => a.status === 'PENDING');

  return (
    <Background>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentCyan} />}
      >
        {offline && (
          <GlassCard style={styles.offline}>
            <Text style={styles.offlineText}>⚠ Connection unavailable — retrying…</Text>
          </GlassCard>
        )}

        {loading ? (
          <GlassCard style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accentCyan} size="large" />
            <Text style={{ color: colors.textMuted, marginTop: 12, fontSize: 13 }}>Connecting to SentinelCare backend...</Text>
            <Text style={{ color: colors.textMuted, marginTop: 4, fontSize: 11 }}>Loading patient data and ML model predictions</Text>
          </GlassCard>
        ) : (
        <>
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>SentinelCare</Text>
              <Text style={styles.purposeText}>AI-Powered Early Warning System</Text>
              <Text style={styles.subtitle}>
                {summary.total_patients ?? 0} patients monitored · {summary.critical ?? 0} critical
              </Text>
            </View>
          </View>
          <Text style={styles.priorityText}>
            {(priority.length || 0)} patients requiring attention
          </Text>
        </View>

        <View style={styles.statsRow}>
          {stats.map(s => (
            <GlassCard key={s.label} style={styles.statCard}>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </GlassCard>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Priority Patients</Text>
        </View>
        {priority.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyText}>No critical patients at the moment</Text>
          </GlassCard>
        ) : (
          priority.map(p => (
            <PatientCard key={p.patient_id} patient={p}
              onPress={() => navigation.navigate('PatientDetail', { patientId: p.patient_id, bed: p.bed })} />
          ))
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Alerts ({pendingAlerts.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Alerts')}>
            <Text style={styles.seeAll}>See all ›</Text>
          </TouchableOpacity>
        </View>
        {pendingAlerts.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyText}>No pending alerts — all clear</Text>
          </GlassCard>
        ) : (
          pendingAlerts.slice(0, 3).map(a => (
            <TouchableOpacity key={a.alert_id} onPress={() => navigation.navigate('PatientDetail', { patientId: a.patient_id })}>
              <GlassCard style={[styles.alertCard, styles.alertPending]}>
                <View style={[styles.alertDot, { backgroundColor: '#ef4444' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>{a.bed} · Ward {a.ward}</Text>
                  <Text style={styles.alertMsg} numberOfLines={2}>{a.message}</Text>
                  <Text style={styles.alertTime}>
                    {new Date(a.created_at).toLocaleTimeString()} · PENDING
                  </Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))
        )}

        <GlassCard style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionColumn}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('RiskAnalyzer')}>
              <Text style={styles.actionText}>Test Risk Analysis</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Simulator')}>
              <Text style={styles.actionText}>▶ Run Simulator</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Alerts')}>
              <Text style={styles.actionText}>Alerts Center</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
        </>
        )}
      </ScrollView>
    </Background>
  );
}

const buildStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  offline: { padding: 12, marginBottom: 12, borderColor: 'rgba(239,68,68,0.3)' },
  offlineText: { color: '#ef4444', fontSize: 13, textAlign: 'center' },
  hero: { marginBottom: 18 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  greeting: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  purposeText: { fontSize: 13, color: colors.accentCyan, marginTop: 2, fontWeight: '600' },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  priorityText: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 1 },
  seeAll: { fontSize: 13, color: colors.accentCyan },
  emptyCard: { padding: 20, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 13 },
  alertCard: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 8 },
  alertPending: { borderColor: 'rgba(239,68,68,0.35)' },
  alertDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  alertTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  alertMsg: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  alertTime: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  quickActions: { padding: 16, marginTop: 10 },
  actionColumn: { gap: 10, marginTop: 12 },
  actionBtn: {
    padding: 14, borderRadius: 12,
    backgroundColor: colors.chipBg, borderWidth: 1, borderColor: colors.chipBorder,
    alignItems: 'center',
  },
  actionText: { color: colors.accentBlue, fontWeight: '600', fontSize: 13 },
});
