import React, { createContext, useContext } from 'react';

export const palettes = {
  light: {
    bg: '#eef2f7',
    bgSecondary: '#ffffff',
    glass: 'rgba(255, 255, 255, 0.72)',
    glassBorder: 'rgba(15, 23, 42, 0.08)',
    glassShadow: 'rgba(15, 23, 42, 0.12)',
    glowBlue: 'rgba(59,130,246,0.16)',
    glowCyan: 'rgba(6,182,212,0.12)',
    textPrimary: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    accentBlue: '#2563eb',
    accentCyan: '#0891b2',
    accentIndigo: '#4f46e5',
    chipBg: 'rgba(37,99,235,0.10)',
    chipBorder: 'rgba(37,99,235,0.28)',
    cardBg: 'rgba(255,255,255,0.6)',
  },
};

export const STATUS_COLORS = {
  STABLE: '#22c55e',
  WATCH: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444',
};

export const getStatusColor = (status) => STATUS_COLORS[status] || '#6b7280';

// API base URL. Override per build with EXPO_PUBLIC_API_URL (e.g.
// EXPO_PUBLIC_API_URL=https://sentinelcare-backend-ncwo.onrender.com/api)
// so native builds can target the deployed backend without code changes.
export const API_URL =
  'http://192.168.31.123:8000/api';

const ThemeContext = createContext({ mode: 'light', colors: palettes.light, toggle: () => {} });

export const ThemeProvider = ({ children }) => {
  const colors = palettes.light;
  return (
    <ThemeContext.Provider value={{ mode: 'light', colors, toggle: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Backwards-compat alias so existing render-time COLORS references still resolve.
export const COLORS = palettes.light;