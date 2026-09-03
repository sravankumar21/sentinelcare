import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, getStatusColor } from '../theme';

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
          <View style={styles.footerTag}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={[styles.trend, { color }]}>{arrow}</Text>
          </View>
          <Text style={styles.pctSmall}>{pct}% risk</Text>
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
  footerTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pctSmall: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  trend: { fontSize: 12, color: colors.textSecondary },
});
