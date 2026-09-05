import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

/**
 * Catches render errors in the navigation tree so the app never goes to a
 * blank white screen. Falls back to a friendly error card with a reload button.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error ? String(error.message || error) : null };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  reset = () => this.setState({ hasError: false, message: null });

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.wrap}>
          <View style={styles.card}>
            <Text style={styles.title}>SentinelCare hit an issue</Text>
            <Text style={styles.body}>
              Something went wrong while rendering this screen.
            </Text>
            {this.state.message ? (
              <Text style={styles.detail}>{this.state.message}</Text>
            ) : null}
            <TouchableOpacity style={styles.btn} onPress={this.reset}>
              <Text style={styles.btnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#eef2f7', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 18, padding: 28, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(15,23,42,0.08)', shadowColor: '#0f172a',
    shadowOpacity: 0.1, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  body: { fontSize: 13, color: '#475569', marginTop: 8, textAlign: 'center' },
  detail: { fontSize: 11, color: '#ef4444', marginTop: 10, textAlign: 'center' },
  btn: { marginTop: 18, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 10, backgroundColor: '#2563eb' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});