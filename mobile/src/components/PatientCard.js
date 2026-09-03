import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, getStatusColor } from '../theme';

const RISK_LABELS = { STABLE: 'Stable', WATCH: 'Watch', HIGH: 'High Risk', CRITICAL: 'Critical Review' };
const TREND_ARROWS = { 'RAPIDLY INCREASING': '↑↑', INCREASING: '↑', DECREASING: '↓', STABLE: '→' };

export const PatientCard = ({ patient, onPress }) => {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const color = getStatusColor(patient.risk_status);
  const arrow = TREND_ARROWS[patient.risk_trend] || '→';
  const pct = Math.round(patient.risk_probability * 100);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <Text style={styles.bed}>{patient.bed}</Text>
            <Text style={styles.ward}>Ward {patient.ward}</Text>
          </View>
          <View style={[styles.riskBadge, { backgroundColor: `${color}22` }]}>
            <Text style={[styles.riskText, { color }]}>{pct}%</Text>
          </View>
        </View>

        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.status, { color }]}>{RISK_LABELS[patient.risk_status]}</Text>
          <Text style={[styles.trend, { color }]}>{arrow} {patient.risk_trend}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const buildStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: 14,
    marginBottom: 10,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bed: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  ward: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  riskBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  riskText: { fontSize: 16, fontWeight: '800' },
  bar: { height: 5, borderRadius: 3, backgroundColor: colors.cardBg, marginTop: 12, overflow: 'hidden' },
  barFill: { height: 5, borderRadius: 3 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  status: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  trend: { fontSize: 11, color: colors.textSecondary },
});
