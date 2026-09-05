import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme';

const ZONES = [
  { key: 'SAFE', label: 'Safe', max: 34 },
  { key: 'WATCH', label: 'Watch', max: 67 },
  { key: 'HIGH', label: 'High', max: 86 },
  { key: 'CRITICAL', label: 'Critical', max: 101 },
];

const zoneFor = (pct) => ZONES.find(z => pct < z.max).key;

const buildStyles = (colors) => StyleSheet.create({
  barWrap: { width: '100%', marginTop: 4 },
  track: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 7 },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  scaleItem: { fontSize: 12, color: colors.textMuted },
  scaleActive: { fontWeight: '800' },
});

export const RiskMeter = ({ value = 0, color = '#ef4444' }) => {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const zone = zoneFor(pct);

  return (
    <View style={styles.barWrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.scaleRow}>
        {ZONES.map(z => (
          <Text
            key={z.key}
            style={[styles.scaleItem, z.key === zone && { color, ...styles.scaleActive }]}
          >
            {z.label}
          </Text>
        ))}
      </View>
    </View>
  );
};