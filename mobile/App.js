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
    // Expo Go cannot init the native FCM token; only a real EAS build can.
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

    // Register the native device (FCM) token with the backend so it can push
    // directly through Firebase Cloud Messaging.
    const { data: token } = await Notifications.getDevicePushTokenAsync();
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
});
