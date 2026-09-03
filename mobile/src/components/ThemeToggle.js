import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export default function ThemeToggle() {
  const { mode, colors, toggle } = useTheme();
  return (
    <TouchableOpacity style={[styles.toggle, { borderColor: colors.glassBorder, backgroundColor: colors.chipBg }]}
      onPress={toggle} activeOpacity={0.8}>
      <Text style={styles.toggleIcon}>{mode === 'dark' ? '☀️' : '🌙'}</Text>
      <Text style={[styles.toggleLabel, { color: colors.accentBlue }]}>
        {mode === 'dark' ? 'Light' : 'Dark'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggle: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  toggleIcon: { fontSize: 13 },
  toggleLabel: { fontSize: 12, fontWeight: '700' },
});
