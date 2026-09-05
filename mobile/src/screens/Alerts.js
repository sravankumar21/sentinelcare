import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Background, GlassCard } from '../components/Glass';
import { api } from '../services/api';
import { showSnackbar } from '../components/Snackbar';
import { resetNotificationMemory } from '../services/notifications';
import { useTheme } from '../theme';

export default function Alerts({ navigation }) {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const a = await api.getAlerts();
      setAlerts(a.alerts);
    } catch (e) {}
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, [refresh]);

  const filtered = filter === 'all' ? alerts : alerts.filter(a =>
    filter === 'pending' ? a.status === 'PENDING' : a.status === 'COMPLETED'
  );

  const acknowledge = async (id) => { await api.acknowledgeAlert(id); refresh(); };

  const clearAll = async () => {
    if (clearing || alerts.length === 0) return;
    setClearing(true);
    try {
      const r = await api.clearAlerts();
      resetNotificationMemory();
      refresh();
      showSnackbar(r.message || 'All alerts cleared.');
    } catch (e) {
      showSnackbar('Could not clear alerts.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <Background>
      <ScrollView
        style={styles.container} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accentCyan} />}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Alerts</Text>
          <TouchableOpacity
            style={[styles.clearBtn, (clearing || alerts.length === 0) && styles.clearBtnDisabled]}
            onPress={clearAll}
            disabled={clearing || alerts.length === 0}
          >
            <Text style={styles.clearText}>{clearing ? 'Clearing…' : 'Clear all'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filters}>
          {[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'completed', label: 'Completed' }].map(f => (
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
          return (
            <TouchableOpacity key={a.alert_id} onPress={() => navigation.navigate('PatientDetail', { patientId: a.patient_id })}>
              <GlassCard style={[styles.alertCard, pending && styles.pendingCard]}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertPatient}>{a.bed} · Ward {a.ward}</Text>
                    <Text style={[styles.badge, { color, backgroundColor: `${color}22` }]}>{a.status}</Text>
                  </View>
                  <Text style={styles.alertMessage}>{a.message}</Text>
                  <View style={styles.riskRow}>
                    <Text style={styles.riskText}>
                      Risk: {Math.round(a.risk_probability * 100)}%
                      {a.risk_change ? `  (↑ ${Math.round(a.risk_change * 100)}%)` : ''}
                    </Text>
                    <Text style={styles.time}>{new Date(a.created_at).toLocaleTimeString()}</Text>
                  </View>
                  {pending && (
                    <TouchableOpacity style={styles.ackBtn} onPress={() => acknowledge(a.alert_id)}>
                      <Text style={styles.ackText}>Acknowledge</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: colors.textPrimary },
  clearBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.chipBg, borderWidth: 1, borderColor: colors.chipBorder },
  clearBtnDisabled: { opacity: 0.4 },
  clearText: { fontSize: 13, color: colors.accentCyan, fontWeight: '700' },
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
});
