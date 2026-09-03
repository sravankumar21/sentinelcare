import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Background, GlassCard } from '../components/Glass';
import { api } from '../services/api';
import { useTheme } from '../theme';

export default function Alerts({ navigation }) {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [doctors, setDoctors] = useState({});

  const refresh = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([
        api.getAlerts(),
        api.getDoctors().catch(() => ({ doctors: [] })),
      ]);
      setAlerts(a.alerts);
      const map = {};
      (d.doctors || []).forEach(doc => { map[doc.id] = doc.name; });
      setDoctors(map);
    } catch (e) {}
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, [refresh]);

  const filtered = filter === 'all' ? alerts : alerts.filter(a =>
    filter === 'pending' ? a.status === 'PENDING' : a.status === 'ACKNOWLEDGED'
  );

  const acknowledge = async (id) => { await api.acknowledgeAlert(id); refresh(); };

  return (
    <Background>
      <ScrollView
        style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentCyan} />}
      >
        <Text style={styles.title}>Alerts</Text>

        <View style={styles.filters}>
          {[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'ack', label: 'Acknowledged' }].map(f => (
            <TouchableOpacity key={f.key} style={[styles.filterBtn, filter === f.key && styles.filterActive]} onPress={() => setFilter(f.key)}>
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {filtered.length === 0 && (
          <GlassCard style={styles.empty}><Text style={styles.emptyText}>No alerts</Text></GlassCard>
        )}

        {filtered.map(a => {
          const pending = a.status === 'PENDING';
          const color = pending ? '#ef4444' : '#22c55e';
          const doctorName = a.assigned_doctor_id && doctors[a.assigned_doctor_id]
            ? doctors[a.assigned_doctor_id] : null;
          const firstRec = a.recommendations?.[0]?.action || null;
          return (
            <TouchableOpacity key={a.alert_id} onPress={() => navigation.navigate('PatientDetail', { patientId: a.patient_id })}>
              <GlassCard style={[styles.alertCard, pending && styles.pendingCard]}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertPatient}>{a.bed} · Ward {a.ward}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                      {a.escalated && (
                        <View style={styles.escalBadge}>
                          <Text style={styles.escalBadgeText}>ESCALATED</Text>
                        </View>
                      )}
                      <Text style={[styles.badge, { color, backgroundColor: `${color}22` }]}>{a.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.alertMessage}>{a.message}</Text>
                  {doctorName && <Text style={styles.doctorName}>Dr. {doctorName}</Text>}
                  {firstRec && <Text style={styles.recSummary}>Recommended: {firstRec}</Text>}
                  <View style={styles.riskRow}>
                    <Text style={styles.riskText}>
                      Risk: {Math.round(a.risk_probability * 100)}%
                      {a.risk_change ? `  (↑ ${Math.round(a.risk_change * 100)}%)` : ''}
                    </Text>
                    <Text style={styles.time}>{new Date(a.created_at).toLocaleTimeString()}</Text>
                  </View>
                  {pending && (
                    <TouchableOpacity style={styles.ackBtn} onPress={() => acknowledge(a.alert_id)}>
                      <Text style={styles.ackText}>✓ Acknowledge</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </GlassCard>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Background>
  );
}

const buildStyles = (colors) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.glassBorder },
  filterActive: { backgroundColor: colors.chipBg, borderColor: colors.chipBorder },
  filterText: { fontSize: 13, color: colors.textSecondary },
  filterTextActive: { color: colors.accentBlue, fontWeight: '600' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  alertCard: { flexDirection: 'row', padding: 14, marginBottom: 10 },
  pendingCard: { borderColor: 'rgba(239,68,68,0.35)' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12, marginTop: 4 },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertPatient: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, fontSize: 10, fontWeight: '700', overflow: 'hidden' },
  alertMessage: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  riskRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  riskText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  time: { fontSize: 11, color: colors.textMuted },
  ackBtn: { marginTop: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.12)', alignItems: 'center' },
  ackText: { color: '#22c55e', fontWeight: '600', fontSize: 13 },
  escalBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, backgroundColor: 'rgba(239,68,68,0.15)' },
  escalBadgeText: { color: '#ef4444', fontSize: 10, fontWeight: '700' },
  doctorName: { fontSize: 12, color: colors.accentCyan, fontWeight: '600', marginTop: 4 },
  recSummary: { fontSize: 11, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
});
