import React, { useEffect, useRef } from 'react';
import {
  Animated, Easing, StyleSheet, Text, View,
} from 'react-native';

// ---- ECG waveform generation (deterministic, module-scope) ----
// Offsets from baseline, positive = deflection upward (R spike, P, T).
const STEP = 2;          // px per sample column
const WAVE_H = 132;      // waveform canvas height
const CENTER_Y = WAVE_H / 2 - 4;

function buildBeat() {
  const b = [];
  const flat = (n, v = 0) => { for (let i = 0; i < n; i++) b.push(v); };
  const bump = (n, peak) => { for (let i = 0; i < n; i++) b.push(Math.round(Math.sin((Math.PI * i) / n) * peak)); };
  flat(30);
  bump(15, 9);          // P wave
  flat(14);
  b.push(-2, -7, -11, -9, 5, 38, 16, -3, -10, -13, -8, -3);   // QRS
  flat(12, 1);          // ST segment
  bump(26, 13);         // T wave
  flat(15);
  return b;
}

const BEAT = buildBeat();

function buildSegments(beats) {
  const offs = [];
  for (let c = 0; c < beats; c++) offs.push(...BEAT);
  const segs = [];
  for (let i = 0; i < offs.length; i++) {
    const y = CENTER_Y - offs[i];
    const ny = i + 1 < offs.length ? CENTER_Y - offs[i + 1] : y;
    const top = Math.min(y, ny);
    const h = Math.max(1.5, Math.abs(ny - y));
    segs.push({ left: i * STEP - 0.75, top, h });
  }
  return { segs, width: offs.length * STEP };
}

const STRIP_A = buildSegments(4);
const STRIP_B = buildSegments(5);

// ---- grid geometry ----
const GRID_MAJOR = 25;
const MINOR = 5;
const majors = [];
const minors = [];
for (let x = 0; x <= 260; x += GRID_MAJOR) majors.push(x);
for (let x = 0; x <= 260; x += MINOR) minors.push(x);
for (let y = 0; y <= WAVE_H; y += GRID_MAJOR) majors.push(y);

const MON = {
  bg: '#04130d',
  grid: 'rgba(61,252,107,0.10)',
  gridMinor: 'rgba(61,252,107,0.045)',
  wave: '#3dfc6b',
  waveAlarm: '#ff4d5e',
  cyan: '#4de3ff',
  amber: '#ffb84d',
  green: '#3dfc6b',
  red: '#ff4d5e',
  text: '#d8fff0',
  dim: 'rgba(216,255,240,0.55)',
  faint: 'rgba(216,255,240,0.28)',
};

function VitalsCell({ label, value, unit, color, sub }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={[styles.cellSub, { color: sub === 'ALARM' ? MON.red : MON.dim }]}>{sub}</Text>
      ) : (
        <Text style={styles.cellUnit}>{unit}</Text>
      )}
    </View>
  );
}

export default function MonitorPanel({ result }) {
  const sweep = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(1)).current;

  const status = (result?.risk_status || 'STABLE');
  const alarm = status === 'HIGH' || status === 'CRITICAL';
  const waveColor = alarm ? MON.waveAlarm : MON.wave;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(sweep, { toValue: -STRIP_A.width, duration: 11000, easing: Easing.linear, useNativeDriver: true }),
      { resetBeforeIteration: true },
    );
    anim.start();
    return () => anim.stop();
  }, [sweep]);

  useEffect(() => {
    if (!alarm) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.12, duration: 350, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [alarm, blink]);

  const v = result?.vitals || {};
  const hr = v.heart_rate, spo2 = v.spo2_pct, rr = v.respiratory_rate;
  const sbp = v.systolic_bp, dbp = v.diastolic_bp, temp = v.temperature_c;

  const riskPct = result?.risk_percentage ?? 0;
  const statusColor = status === 'CRITICAL' ? MON.red : status === 'HIGH' ? MON.red : status === 'WATCH' ? MON.amber : MON.green;

  const renderStrip = (strip, key) => (
    <View key={key} style={{ width: strip.width }}>
      {strip.segs.map((s, i) => (
        <View key={i} style={{ position: 'absolute', left: s.left, top: s.top, width: 1.6, height: s.h, backgroundColor: waveColor, borderRadius: 0.5 }} />
      ))}
    </View>
  );

  return (
    <View style={styles.monitor}>
      {/* top status bar */}
      <View style={styles.topBar}>
        <Text style={styles.device}>SENTINELCARE · BEDSIDE MONITOR</Text>
        <Text style={[styles.lead, alarm && styles.leadAlarm]}>LEAD II · DEMO</Text>
      </View>

      {/* waveform pane */}
      <View style={styles.wavePane}>
        {minors.map((x, i) => <View key={`mi${i}`} style={[styles.vMinor, { left: x }]} />)}
        {majors.map((x, i) => <View key={`mj${i}`} style={[styles.vMajor, { left: x }]} />)}
        {majors.map((y, i) => <View key={`mh${i}`} style={[styles.hMajor, { top: y }]} />)}
        <View style={styles.centerLine} />

        <Animated.View style={[styles.sweep, { transform: [{ translateX: sweep }] }]}>
          {renderStrip(STRIP_A, 'a')}
          {renderStrip(STRIP_B, 'b')}
        </Animated.View>

        <View style={styles.sweepLine} pointerEvents="none" />
      </View>

      {/* alarm banner */}
      {alarm ? (
        <Animated.View style={[styles.alarmBanner, { opacity: blink }]}>
          <Text style={styles.alarmText}>⚠ ALARM · DETERIORATION RISK {status}</Text>
        </Animated.View>
      ) : (
        <View style={styles.alarmBanner}>
          <Text style={[styles.alarmText, { color: MON.green }]}>MONITORING</Text>
        </View>
      )}

      {/* numeric readouts */}
      <View style={styles.row}>
        <VitalsCell label="HR" value={hr != null ? Math.round(hr) : '—'} unit="bpm" color={MON.wave} />
        <VitalsCell label="SpO₂" value={spo2 != null ? spo2.toFixed(1) : '—'} unit="%" color={MON.cyan} />
        <VitalsCell label="RR" value={rr != null ? Math.round(rr) : '—'} unit="/min" color={MON.wave} />
        <VitalsCell label="NIBP" value={sbp != null && dbp != null ? `${Math.round(sbp)}/${Math.round(dbp)}` : '—'} unit="mmHg" color={MON.wave} />
      </View>
      <View style={[styles.row, styles.rowLast]}>
        <VitalsCell label="TEMP" value={temp != null ? temp.toFixed(1) : '—'} unit="°C" color={MON.amber} />
        <VitalsCell label="RISK" value={`${riskPct}%`} unit="" color={statusColor} />
        <VitalsCell label="STATUS" value={status} unit="" color={statusColor === MON.green ? MON.green : MON.red}
          sub={alarm ? 'ALARM' : undefined} />
        <VitalsCell label="MODEL" value={result?.model_version || 'RF-v2'} unit="" color={MON.cyan} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monitor: {
    backgroundColor: MON.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(61,252,107,0.35)',
    overflow: 'hidden',
    marginBottom: 4,
    alignSelf: 'stretch',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(61,252,107,0.25)',
  },
  device: { color: MON.faint, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  lead: { color: MON.dim, fontSize: 10, letterSpacing: 1 },
  leadAlarm: { color: MON.red, fontWeight: '800' },
  wavePane: { height: WAVE_H, overflow: 'hidden', position: 'relative' },
  vMinor: { position: 'absolute', top: 0, bottom: 0, width: 0.5, backgroundColor: MON.gridMinor },
  vMajor: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: MON.grid },
  hMajor: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: MON.grid },
  centerLine: { position: 'absolute', left: 0, right: 0, top: CENTER_Y, height: 1, backgroundColor: 'rgba(61,252,107,0.22)' },
  sweep: { position: 'absolute', top: 0, left: 0, flexDirection: 'row' },
  sweepLine: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  alarmBanner: {
    backgroundColor: 'rgba(255,77,94,0.16)',
    paddingVertical: 5,
    alignItems: 'center',
  },
  alarmText: { color: MON.red, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  row: { flexDirection: 'row' },
  rowLast: { borderTopWidth: 1, borderTopColor: 'rgba(61,252,107,0.22)' },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  cellLabel: { color: MON.faint, fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  cellValue: { fontSize: 22, fontWeight: '800', marginTop: 3, fontVariant: ['tabular-nums'] },
  cellUnit: { color: MON.dim, fontSize: 9, marginTop: 1 },
  cellSub: { fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 1 },
});