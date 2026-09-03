import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

const buildStyles = (colors) => StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  glowTop: {
    position: 'absolute',
    top: -120,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.glowBlue,
    shadowColor: '#3b82f6',
    shadowOpacity: 0.2,
    shadowRadius: 80,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -120,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.glowCyan,
    shadowColor: '#06b6d4',
    shadowOpacity: 0.15,
    shadowRadius: 80,
  },
  card: {
    backgroundColor: colors.glass,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: colors.glassShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
});

export const GlassCard = ({ children, style, glow = null }) => {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  return (
    <View style={[styles.card, glow ? { shadowColor: glow, shadowOpacity: 0.4 } : null, style]}>
      {children}
    </View>
  );
};

export const Background = ({ children }) => {
  const { colors } = useTheme();
  const styles = buildStyles(colors);
  return (
    <View style={styles.background}>
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      {children}
    </View>
  );
};
