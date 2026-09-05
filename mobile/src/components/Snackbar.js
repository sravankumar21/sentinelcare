import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

let emit = null;

/**
 * Fire an in-app snackbar from anywhere with a single call. Requires <Snackbar/>
 * to be mounted (it is, at the root of the app).
 */
export function showSnackbar(message) {
  if (emit) emit(message);
}

export default function Snackbar() {
  const [msg, setMsg] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const timer = useRef(null);

  useEffect(() => {
    emit = (text) => setMsg(text);
    return () => { emit = null; };
  }, []);

  useEffect(() => {
    if (msg === null) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 16, duration: 250, useNativeDriver: true }),
      ]).start(() => setMsg(null));
    }, 3200);
    return () => clearTimeout(timer.current);
  }, [msg, opacity, translateY]);

  if (msg === null) return null;

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]} pointerEvents="none">
      <Text style={styles.text}>{msg}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 56,
    backgroundColor: 'rgba(15,23,42,0.92)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  text: { color: '#ffffff', fontSize: 13, fontWeight: '600', textAlign: 'center' },
});