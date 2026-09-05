import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
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
import { AlertWatcher, registerForPushNotificationsAsync } from './src/services/notifications';
import ErrorBoundary from './src/components/ErrorBoundary';
import Snackbar, { showSnackbar } from './src/components/Snackbar';
import DoctorAlert from './src/components/DoctorAlert';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
        <Snackbar />
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
    registerForPushNotificationsAsync();
    Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const alertId = response?.notification?.request?.content?.data?.alert_id;
      if (alertId) {
        api.acknowledgeAlert(alertId)
          .then(() => showSnackbar('Alert acknowledged'))
          .catch(() => {});
      }
    });
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
          <DoctorAlert />
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
