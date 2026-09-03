import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet, Modal, FlatList,
} from 'react-native';
import { Background, GlassCard } from '../components/Glass';
import { PatientCard } from '../components/PatientCard';
import { api } from '../services/api';
import { useTheme, getStatusColor } from '../theme';
import ThemeToggle from '../components/ThemeToggle';
import * as Notifications from 'expo-notifications';

export default function CommandCenter({ navigation }) {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const [patients, setPatients] = useState([]);
  const [summary, setSummary] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const lastAlertCount = useRef(0);
  const [hospitals, setHospitals] = useState([]);
  const [currentHospitalId, setCurrentHospitalId] = useState(null);
  const [showHospitalModal, setShowHospitalModal] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [escalation, setEscalation] = useState(null);

  const selectedHospital = hospitals.find(h => h.id === currentHospitalId)
    || hospitals.find(h => h.selected) || null;

  const refresh = useCallback(async () => {
    try {
      const [p, s, a] = await Promise.all([
        api.getPatients(), api.getDashboard(), api.getAlerts(),
      ]);
      setPatients(p.patients);
      setSummary(s);
      setAlerts(a.alerts);
      setOffline(false);

      if (a.alerts.length > lastAlertCount.current) {
        const newAlerts = a.alerts.slice(0, a.alerts.length - lastAlertCount.current);
        newAlerts.forEach(showNotification);
      }
      lastAlertCount.current = a.alerts.length;
    } catch (e) {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    const loadHospitals = async () => {
      try {
        const h = await api.getHospitals();
        setHospitals(h.hospitals || []);
        if (h.current_hospital_id) setCurrentHospitalId(h.current_hospital_id);
      } catch (e) {}
    };
    loadHospitals();
  }, []);

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const [d, esc] = await Promise.all([api.getDoctors(), api.getEscalation()]);
        setDoctors(d.doctors || []);
        setEscalation(esc);
      } catch (e) {}
    };
    loadStaff();
    const interval = setInterval(loadStaff, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectHospital = async (id) => {
    try {
      await api.selectHospital(id);
      setShowHospitalModal(false);
      const h = await api.getHospitals();
      setHospitals(h.hospitals || []);
      if (h.current_hospital_id) setCurrentHospitalId(h.current_hospital_id);
      refresh();
    } catch (e) {}
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 6000);
    return () => clearInterval(interval);
  }, [refresh]);

  const showNotification = async (alert) => {
    if (!alert || alert.status !== 'PENDING') return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🚨 Deterioration alert — ${alert.bed}`,
          body: `Risk ${Math.round(alert.risk_probability * 100)}%. Clinical review recommended.`,
          sound: true,
        },
        trigger: null,
      });
    } catch (e) {}
  };

  const stats = [
    { label: 'Stable', value: summary.stable ?? 0, color: '#22c55e' },
    { label: 'Watch', value: summary.watch ?? 0, color: '#eab308' },
    { label: 'High Risk', value: summary.high ?? 0, color: '#f97316' },
    { label: 'Critical', value: summary.critical ?? 0, color: '#ef4444' },
  ];

  const priority = [...(patients || [])]
    .filter(p => ['HIGH', 'CRITICAL'].includes(p.risk_status))
    .sort((a, b) => b.risk_probability - a.risk_probability);

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

        <Modal visible={showHospitalModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Hospital</Text>
              {hospitals.map(h => (
                <TouchableOpacity
                  key={h.id}
                  style={[styles.modalItem, h.id === currentHospitalId && styles.modalItemActive]}
                  onPress={() => handleSelectHospital(h.id)}
                >
                  <Text style={[styles.modalItemText, h.id === currentHospitalId && styles.modalItemTextActive]}>
                    {h.name}
                  </Text>
                  {h.id === currentHospitalId && <Text style={styles.modalCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={styles.modalClose} onPress={() => setShowHospitalModal(false)}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>Good Morning, Doctor</Text>
              <TouchableOpacity onPress={() => setShowHospitalModal(true)}>
                <Text style={styles.hospital}>
                  {selectedHospital ? selectedHospital.name : 'Select Hospital'} ▾
                </Text>
              </TouchableOpacity>
            </View>
            <ThemeToggle />
          </View>
          <Text style={styles.subtitle}>
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
          <Text style={styles.sectionTitle}>Recent Alerts ({alerts.length})</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Alerts')}>
            <Text style={styles.seeAll}>See all ›</Text>
          </TouchableOpacity>
        </View>
        {alerts.slice(0, 3).map(a => (
          <TouchableOpacity key={a.alert_id} onPress={() => navigation.navigate('PatientDetail', { patientId: a.patient_id })}>
            <GlassCard style={[styles.alertCard, a.status === 'PENDING' && styles.alertPending]}>
              <View style={[styles.alertDot, { backgroundColor: a.status === 'PENDING' ? '#ef4444' : '#22c55e' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>{a.bed} · Ward {a.ward}</Text>
                <Text style={styles.alertMsg} numberOfLines={2}>{a.message}</Text>
                <Text style={styles.alertTime}>
                  {new Date(a.created_at).toLocaleTimeString()} · {a.status}
                </Text>
              </View>
            </GlassCard>
          </TouchableOpacity>
        ))}

        <GlassCard style={styles.staffSection}>
          <Text style={styles.sectionTitle}>Staff / Escalation</Text>
          {escalation ? (
            <View style={{ marginTop: 8 }}>
              <Text style={styles.staffStat}>
                {escalation.num_critical ?? 0} critical patient{(escalation.num_critical ?? 0) !== 1 ? 's' : ''}
              </Text>
              <View style={[styles.escalPill, { backgroundColor: escalation.needs_escalation ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)' }]}>
                <Text style={[styles.escalText, { color: escalation.needs_escalation ? '#ef4444' : '#22c55e' }]}>
                  {escalation.needs_escalation ? 'ESCALATION ACTIVE' : 'Normal load'}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>Loading…</Text>
          )}
          {doctors.length > 0 && (
            <View style={{ marginTop: 10 }}>
              {doctors.filter(d => d.on_duty).map(d => (
                <Text key={d.id} style={styles.doctorLine}>
                  Dr. {d.name} · {d.active_alerts ?? 0} alert{(d.active_alerts ?? 0) !== 1 ? 's' : ''}
                </Text>
              ))}
            </View>
          )}
        </GlassCard>

        <GlassCard style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Simulator')}>
              <Text style={styles.actionText}>▶ Run Simulator</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Alerts')}>
              <Text style={styles.actionText}>Alerts Center</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
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
  hospital: { fontSize: 14, color: colors.accentCyan, fontWeight: '600', marginTop: 4, letterSpacing: 1 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6 },
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
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1, padding: 14, borderRadius: 12,
    backgroundColor: colors.chipBg, borderWidth: 1, borderColor: colors.chipBorder,
    alignItems: 'center',
  },
  actionText: { color: colors.accentBlue, fontWeight: '600', fontSize: 13 },
  staffSection: { padding: 16, marginTop: 10 },
  staffStat: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  escalPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, marginTop: 8, alignSelf: 'flex-start' },
  escalText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  doctorLine: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', maxHeight: '70%', backgroundColor: colors.bgSecondary, borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 16 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalItemActive: { backgroundColor: colors.chipBg },
  modalItemText: { fontSize: 15, color: colors.textPrimary },
  modalItemTextActive: { color: colors.accentCyan, fontWeight: '700' },
  modalCheck: { color: colors.accentCyan, fontSize: 16, fontWeight: '700' },
  modalClose: { marginTop: 12, paddingVertical: 12, alignItems: 'center' },
  modalCloseText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
