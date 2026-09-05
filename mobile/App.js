import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import CommandCenter from './src/screens/CommandCenter';
import PatientDetail from './src/screens/PatientDetail';
import Alerts from './src/screens/Alerts';
import Simulator from './src/screens/Simulator';
import RiskAnalyzer from './src/screens/RiskAnalyzer';
import { ThemeProvider, useTheme } from './src/theme';
import { api } from './src/services/api';
import ErrorBoundary from './src/components/ErrorBoundary';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('deterioration', {
        name: 'Deterioration alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    } catch (e) {}
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    // Prefer the Expo push token: it works in Expo Go AND native builds via
    // the free Expo push service (no Firebase needed). Falls back to the raw
    // device token (FCM/APNs) for native EAS builds.
    let token = null;
    try {
      const { data } = await Notifications.getExpoPushTokenAsync({
        projectId: '08ad090c-eded-4631-9e7f-85f6a73c51c4',
      });
      token = data;
    } catch (e) {
      try {
        const { data } = await Notifications.getDevicePushTokenAsync();
        token = data;
      } catch (e2) {}
    }
    if (token) {
      api.registerDevice(token, Platform.OS).catch(() => {});
    }
    return token;
  } catch (e) {
    return null;
  }
}

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { colors } = useTheme();
  const navTheme = {
    ...DefaultTheme,
    dark: false,
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
          <Stack.Screen name="RiskAnalyzer" component={RiskAnalyzer} />
        </Stack.Navigator>
        <Disclaimer />
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

let seenAlertIds = new Set();

async function notifyForAlert(alert) {
  if (!alert || alert.status !== 'PENDING' || seenAlertIds.has(`alert-${alert.alert_id}`)) return;
  seenAlertIds.add(`alert-${alert.alert_id}`);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚨 Deterioration alert — ${alert.bed} (Ward ${alert.ward})`,
        body: `Risk ${Math.round(alert.risk_probability * 100)}%. Clinical review recommended.`,
        sound: true,
        data: { alert_id: alert.alert_id, patient_id: alert.patient_id },
      },
      trigger: null,
    });
  } catch (e) {}
}

/**
 * Global alert watcher: polls the backend on an interval and fires an in-app
 * (local) notification whenever a NEW pending alert appears, no matter which
 * screen the user is on. This is the reliable, zero-config fallback push path.
 */
function AlertWatcher() {
  const firedRef = useRef(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const res = await api.getAlerts();
        if (!active) return;
        const pending = (res.alerts || []).filter(a => a.status === 'PENDING');
        // First poll: just seed the seen-set so pre-existing alerts do NOT
        // re-notify users every time the app opens.
        if (!firedRef.current) {
          firedRef.current = true;
          pending.forEach(a => seenAlertIds.add(`alert-${a.alert_id}`));
          return;
        }
        pending.forEach(notifyForAlert);
      } catch (e) {}
    };
    check();
    const interval = setInterval(check, 8000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return null;
}

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    registerForPushNotificationsAsync();
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
        <ErrorBoundary>
          <StatusBar style="dark" />
          <AppNavigator />
          <AlertWatcher />
        </ErrorBoundary>
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
});
