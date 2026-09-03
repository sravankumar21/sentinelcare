import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import CommandCenter from './src/screens/CommandCenter';
import PatientDetail from './src/screens/PatientDetail';
import Alerts from './src/screens/Alerts';
import Simulator from './src/screens/Simulator';
import { ThemeProvider, useTheme } from './src/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Stack = createNativeStackNavigator();

function ThemeToggle() {
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

function AppNavigator() {
  const { colors } = useTheme();
  const navTheme = {
    ...DefaultTheme,
    dark: colors.bg === '#0a0e1a',
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg,
      card: colors.bgSecondary,
      text: colors.textPrimary,
      border: colors.glassBorder,
      primary: colors.accentCyan,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <View style={{ flex: 1 }}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="CommandCenter" component={CommandCenter} />
          <Stack.Screen name="PatientDetail" component={PatientDetail} />
          <Stack.Screen name="Alerts" component={Alerts} />
          <Stack.Screen name="Simulator" component={Simulator} />
        </Stack.Navigator>
        <Disclaimer />
        <ThemeToggle />
      </View>
    </NavigationContainer>
  );
}

function Disclaimer() {
  const { colors } = useTheme();
  return (
    <View style={[styles.disclaimer, { backgroundColor: colors.bgSecondary, borderTopColor: colors.glassBorder }]}>
      <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
        SentinelCare is a research and educational prototype using simulated clinical data. Risk estimates are not
        medical diagnoses and must not be used independently for clinical decision-making.
      </Text>
    </View>
  );
}

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  disclaimer: {
    padding: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  disclaimerText: {
    fontSize: 10,
    textAlign: 'center',
  },
  toggle: {
    position: 'absolute',
    top: 54,
    right: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toggleIcon: { fontSize: 13 },
  toggleLabel: { fontSize: 12, fontWeight: '700' },
});
