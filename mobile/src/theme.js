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

// API base URL for the SentinelCare backend.
//
// The app connects to a backend running on your local network. To point the
// app at a different backend, change the value on the next line to your
// computer's IP address (which must end with :8000/api). An example:
//
//   export const API_URL = 'http://192.168.1.50:8000/api';
//
// You can also override it without editing this file by starting Expo with:
//
//   EXPO_PUBLIC_API_URL=http://<your-ip>:8000/api npx expo start
//
// The override only works for builds that inline the variable at bundle time.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.31.123:8000/api';

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