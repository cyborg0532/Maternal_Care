import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, useWindowDimensions, Platform, Modal, Image
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch, AuthService } from '../../services/api';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../constants/theme';
import DashboardLayout from '../../components/DashboardLayout';
import { GlassCard, StatCard, SectionHeader, ProgressBar, Badge } from '../../components/PremiumUI';
import MedicineDashboardWidget from '../../components/MedicineDashboardWidget';
import { useMedicineReminders } from '../../hooks/useMedicineReminders';

interface DashboardData {
  week: number;
  trimester: number;
  days_until_due_date: number | null;
  due_date: string | null;
  baby_size: string;
  baby_emoji: string;
  weekly_tip: string;
  medicines_today: Array<{ name: string; dosage: string; schedule_time: string }>;
  last_mood_score: number | null;
}

const MOOD_EMOJI = ['', '😢', '😔', '😐', '😊', '🌟'];
const MOOD_LABEL = ['', 'Very Low', 'Low', 'Okay', 'Good', 'Excellent!'];
const MOOD_COLOR = ['', Colors.moodVeryLow, Colors.moodLow, Colors.moodOkay, Colors.moodGood, Colors.moodExcellent];

const TRIMESTER_LABELS = ['', 'First Trimester', 'Second Trimester', 'Third Trimester'];
const TRIMESTER_COLORS = ['', Colors.teal, Colors.lavender, Colors.primary];

// Daily checklist items (static)
const DAILY_CHECKLIST = [
  { icon: '💧', label: 'Drink 8 glasses of water', done: false },
  { icon: '💊', label: 'Take prenatal vitamins', done: false },
  { icon: '🚶', label: '30 min gentle walk', done: false },
  { icon: '😴', label: 'Rest 8 hours', done: false },
];

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checklist, setChecklist] = useState(DAILY_CHECKLIST);
  const [waterCount, setWaterCount] = useState(0);

  // Pandemic & Zero-Touch Passport Demo Modals
  const [showQRModal, setShowQRModal] = useState(false);
  const [showJudgeModal, setShowJudgeModal] = useState(false);
  const [nfcSimulating, setNfcSimulating] = useState(false);

  // Medicine reminders hook
  const { getDashboardStats } = useMedicineReminders();
  const medicineStats = getDashboardStats();

  const fetchDashboard = useCallback(async () => {
    try {
      const result = await apiFetch('/tracker/dashboard');
      setData(result);
    } catch (e: any) {
      console.error('Dashboard error:', e);
      if (e.message?.includes('401') || e.message?.includes('validate credentials') || e.message?.includes('token')) {
        await AuthService.logout();
        router.replace('/(auth)/login');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard();
    if (Platform.OS === 'android') {
      (async () => {
        try {
          const { PermissionsAndroid } = require('react-native');
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CALL_PHONE,
            PermissionsAndroid.PERMISSIONS.SEND_SMS,
          ]);
        } catch (e) {
          console.error('Error requesting SOS permissions on startup:', e);
        }
      })();
    }
  }, []);

  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  const handleLogout = async () => {
    await AuthService.logout();
    router.replace('/(auth)/login');
  };

  const toggleCheckItem = (index: number) => {
    setChecklist(prev => prev.map((item, i) => i === index ? { ...item, done: !item.done } : item));
  };

  if (loading) {
    return (
      <DashboardLayout title="Dashboard">
        <View style={styles.center}>
          <View style={styles.loadingCard}>
            <Text style={styles.loadingEmoji}>🌸</Text>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading your journey...</Text>
          </View>
        </View>
      </DashboardLayout>
    );
  }

  const progressPct = data ? Math.round((data.week / 40) * 100) : 0;
  const trimColor = TRIMESTER_COLORS[data?.trimester ?? 1];

  return (
    <DashboardLayout title="Dashboard">
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.inner}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Status Banner (Pandemic Isolation Mode) ──────────────────── */}
        <View style={styles.pandemicBanner}>
          <Text style={styles.pandemicBannerIcon}>🛡️</Text>
          <Text style={styles.pandemicBannerText}>
            Zero-Exposure Protocol Active: <Text style={styles.pandemicBannerHighlight}>Day-42 Isolation Mode</Text>
          </Text>
        </View>

        {/* ── Zero-Touch Medical Passport Dedicated Card ──────────────────── */}
        <View style={styles.zeroTouchPassportCard}>
          <View style={styles.passportHeaderRow}>
            <Text style={styles.passportCardEmoji}>🆔</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.passportCardTitle}>Zero-Touch Medical Passport</Text>
              <Text style={styles.passportCardSub}>Contactless paramedic vital sync via Dynamic QR & NFC</Text>
            </View>
            <View style={styles.activeTag}>
              <Text style={styles.activeTagText}>LIVE</Text>
            </View>
          </View>

          <View style={styles.passportActionButtons}>
            <TouchableOpacity style={styles.qrPassBtn} onPress={() => setShowQRModal(true)}>
              <Text style={styles.qrPassBtnText}>📲 View Emergency QR Pass</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.nfcPassBtn} 
              onPress={() => {
                setNfcSimulating(true);
                setTimeout(() => {
                  setNfcSimulating(false);
                  setShowJudgeModal(true);
                }, 1200);
              }}
            >
              <Text style={styles.nfcPassBtnText}>
                {nfcSimulating ? "📡 Syncing NFC..." : "💳 Tap NFC Medical Card"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Greeting Row ──────────────────────────────────────────────────── */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greeting}>Good morning, Mama! 🌸</Text>
            <Text style={styles.greetingSub}>
              {data
                ? `Week ${data.week} · ${TRIMESTER_LABELS[data.trimester]}`
                : 'Your pregnancy companion'}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero Pregnancy Card ───────────────────────────────────────────── */}
        <View style={[styles.heroCard, { borderTopColor: trimColor }]}>
          {/* Top row */}
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <View style={[styles.weekBadge, { backgroundColor: trimColor + '18' }]}>
                <Text style={[styles.weekBadgeText, { color: trimColor }]}>
                  {TRIMESTER_LABELS[data?.trimester ?? 1]}
                </Text>
              </View>
              <View style={styles.weekRow}>
                <Text style={[styles.weekNum, { color: trimColor }]}>{data?.week ?? '–'}</Text>
                <Text style={styles.weekUnit}>weeks</Text>
              </View>
              {data?.days_until_due_date !== null && data?.days_until_due_date !== undefined && (
                <Text style={styles.daysLeft}>
                  <Text style={styles.daysNum}>{data.days_until_due_date}</Text>
                  <Text style={styles.daysLabel}> days to go 🎀</Text>
                </Text>
              )}
            </View>

            {/* Baby info */}
            <View style={styles.babyCard}>
              <View style={styles.babyCircle}>
                <Text style={styles.babyEmoji}>{data?.baby_emoji ?? '👶'}</Text>
              </View>
              <Text style={styles.babySizeLbl}>Size of a</Text>
              <Text style={styles.babySize}>{data?.baby_size ?? '–'}</Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLbl}>Pregnancy Progress</Text>
              <Text style={[styles.progressPct, { color: trimColor }]}>{progressPct}%</Text>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${progressPct}%` as any, backgroundColor: trimColor }]} />
              <View style={[styles.progressMarker, { left: '33%' as any }]} />
              <View style={[styles.progressMarker, { left: '66%' as any }]} />
            </View>
            <View style={styles.progressTicks}>
              <Text style={styles.tickLabel}>Wk 1</Text>
              <Text style={[styles.tickLabel, { color: trimColor, fontWeight: '700' as const }]}>T1→T2</Text>
              <Text style={[styles.tickLabel, { color: trimColor, fontWeight: '700' as const }]}>T2→T3</Text>
              <Text style={styles.tickLabel}>Wk 40</Text>
            </View>
          </View>

          {/* Weekly tip strip */}
          {data?.weekly_tip && (
            <View style={styles.tipStrip}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipText} numberOfLines={2}>{data.weekly_tip}</Text>
            </View>
          )}
        </View>

        {/* ── Stats Row ─────────────────────────────────────────────────────── */}
        <View style={[styles.statsRow, isWide && styles.statsRowWide]}>
          <StatCard
            icon="💊"
            label="Medicines"
            value={data?.medicines_today?.length ?? 0}
            accent={Colors.lavender}
            onPress={() => router.push('/(tabs)/meds_mood' as any)}
            subLabel="today"
          />
          <StatCard
            icon={MOOD_EMOJI[data?.last_mood_score ?? 0] || '🌀'}
            label="Mood"
            value={data?.last_mood_score ? MOOD_LABEL[data.last_mood_score] : '–'}
            accent={MOOD_COLOR[data?.last_mood_score ?? 0] || Colors.primary}
            onPress={() => router.push('/(tabs)/meds_mood' as any)}
            subLabel="last logged"
          />
        </View>

        {/* ── Medicine Reminders Dashboard Widget ───────────────────────────── */}
        <MedicineDashboardWidget stats={medicineStats} />

        {/* ── Water Intake Tracker ──────────────────────────────────────────── */}
        <GlassCard>
          <SectionHeader title="Water Intake" icon="💧" />
          <Text style={styles.waterGoal}>
            <Text style={[styles.waterCount, { color: Colors.skyBlue }]}>{waterCount}</Text>
            <Text style={styles.waterOf}> / 8 glasses today</Text>
          </Text>
          <View style={styles.waterBubbles}>
            {Array.from({ length: 8 }).map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.waterBubble,
                  i < waterCount && { backgroundColor: Colors.skyBlue, borderColor: Colors.skyBlue },
                ]}
                onPress={() => setWaterCount(prev => i < prev ? i : i + 1)}
              >
                <Text style={styles.waterBubbleIcon}>{i < waterCount ? '💧' : '○'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ProgressBar progress={waterCount * 12.5} color={Colors.skyBlue} showLabel label="Daily goal" />
        </GlassCard>

        {/* ── Daily Checklist ───────────────────────────────────────────────── */}
        <GlassCard>
          <SectionHeader title="Daily Checklist" icon="✅" />
          {checklist.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={styles.checkItem}
              onPress={() => toggleCheckItem(i)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkCircle, item.done && styles.checkCircleDone]}>
                {item.done && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.checkIcon}>{item.icon}</Text>
              <Text style={[styles.checkLabel, item.done && styles.checkLabelDone]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </GlassCard>

        {/* ── Today's Medicines ─────────────────────────────────────────────── */}
        {(data?.medicines_today?.length ?? 0) > 0 && (
          <View>
            <SectionHeader
              title="Medicine Reminder"
              icon="💊"
              action="Manage"
              onAction={() => router.push('/(tabs)/meds_mood' as any)}
            />
            {data!.medicines_today.map((m, i) => (
              <View key={i} style={styles.medCard}>
                <View style={styles.medIconWrap}>
                  <Text style={styles.medIcon}>💊</Text>
                </View>
                <View style={styles.medInfo}>
                  <Text style={styles.medName}>{m.name}</Text>
                  <Text style={styles.medMeta}>{m.dosage} · {m.schedule_time}</Text>
                </View>
                <Badge label="Pending" color={Colors.warning} />
              </View>
            ))}
          </View>
        )}

        {/* ── AI Recommendations ───────────────────────────────────────────── */}
        <GlassCard accent={Colors.lavender}>
          <SectionHeader title="AI Pregnancy Buddy" icon="🤖" />
          <Text style={styles.aiTip}>
            Based on your Week {data?.week ?? '?'}, here are your personalized recommendations:
          </Text>
          {['Stay hydrated — aim for 10 cups of water daily.',
            'Light prenatal yoga improves circulation and reduces back pain.',
            'Iron-rich foods like spinach support your baby\'s development this week.'].map((tip, i) => (
            <View key={i} style={styles.aiTipItem}>
              <View style={styles.aiTipDot} />
              <Text style={styles.aiTipText}>{tip}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={styles.aiChatBtn}
            onPress={() => router.push('/(tabs)/ai-buddy' as any)}
          >
            <Text style={styles.aiChatBtnText}>💬 Ask AI Buddy</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* ── Medical Report Analyzer Shortcut ─────────────────────────────── */}
        <TouchableOpacity
          style={[styles.sosShortcut, { backgroundColor: Colors.lavenderBg, borderColor: Colors.lavender }]}
          onPress={() => router.push('/(tabs)/report-analyzer' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.sosIcon}>📄</Text>
          <View style={styles.sosInfo}>
            <Text style={[styles.sosTitle, { color: Colors.lavender }]}>Medical Report Analyzer</Text>
            <Text style={styles.sosSub}>Upload blood tests or ultrasounds for instant AI translation</Text>
          </View>
          <Text style={[styles.sosArrow, { color: Colors.lavender }]}>›</Text>
        </TouchableOpacity>

        {/* ── Emergency SOS ─────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.sosShortcut}
          onPress={() => router.push('/(tabs)/sos' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.sosIcon}>🚨</Text>
          <View style={styles.sosInfo}>
            <Text style={styles.sosTitle}>Emergency SOS</Text>
            <Text style={styles.sosSub}>Tap to access emergency features & red flags</Text>
          </View>
          <Text style={styles.sosArrow}>›</Text>
        </TouchableOpacity>

        <View style={{ height: Spacing.xxl }} />
      </ScrollView>

      {/* ── Emergency QR Modal ────────────────────────────────────────────── */}
      <Modal visible={showQRModal} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.qrModalContent}>
            <Text style={styles.modalTitle}>📲 Dynamic Emergency QR Pass</Text>
            <Text style={styles.modalSub}>First responders scan this code for zero-touch vital access</Text>
            
            <View style={styles.qrBox}>
              <Image
                source={{ uri: 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=https://maternalcare.app/m/med_pass_free_test_12345' }}
                style={styles.qrImage}
              />
              <Text style={styles.qrUrlText}>https://maternalcare.app/m/med_pass_free_test_12345</Text>
            </View>

            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowQRModal(false)}>
              <Text style={styles.closeModalBtnText}>Close Pass</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Judge NFC Simulation Paramedic Modal ─────────────────────────── */}
      <Modal visible={showJudgeModal} animationType="fade" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.paramedicModalContent}>
            <View style={styles.paramedicBadgeRow}>
              <Text style={styles.paramedicBadge}>🚨 FIRST-RESPONDER TRIAGE VIEW</Text>
              <TouchableOpacity onPress={() => setShowJudgeModal(false)}>
                <Text style={styles.closeX}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.patientNameHeader}>Free Mother (Patient)</Text>
            <Text style={styles.patientMetaText}>Age 29 · Blood O+ · Week 31 (Third Trimester)</Text>

            <View style={styles.riskAlertsBox}>
              <Text style={styles.riskAlertTitle}>⚠️ CRITICAL RISK FLAGS</Text>
              <Text style={styles.riskAlertItem}>• ALLERGIES: Penicillin, Shellfish</Text>
              <Text style={styles.riskAlertItem}>• Mild Gestational Diabetes Risk</Text>
              <Text style={styles.riskAlertItem}>• History of PCOS</Text>
            </View>

            <View style={styles.reportSummaryBox}>
              <Text style={styles.reportSummaryTitle}>📑 RECENT AI LAB ANALYSIS</Text>
              <Text style={styles.reportSummaryText}>
                Gestational Diabetes Screen: Mild elevation in Fasting Glucose (98 mg/dL). Recommended dietary monitoring. Fetal heart rate normal (142 bpm).
              </Text>
            </View>

            <View style={styles.actionButtonRow}>
              <TouchableOpacity style={styles.callPrimaryBtn}>
                <Text style={styles.callPrimaryText}>📞 Call Husband</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.callGynBtn}>
                <Text style={styles.callGynText}>🏥 Call OB-GYN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  // Pandemic Banner
  pandemicBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  pandemicBannerIcon: { fontSize: 16 },
  pandemicBannerText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  pandemicBannerHighlight: { color: '#bae6fd', fontWeight: '800' },

  // Zero-Touch Passport Card
  zeroTouchPassportCard: {
    backgroundColor: '#111827',
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#ef4444',
    ...Shadows.sm,
  },
  passportHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  passportCardEmoji: { fontSize: 24 },
  passportCardTitle: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
  passportCardSub: { color: '#9ca3af', fontSize: 11, marginTop: 2 },
  activeTag: { backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#ef4444' },
  activeTagText: { color: '#fca5a5', fontSize: 9, fontWeight: '800' },

  passportActionButtons: { flexDirection: 'row', gap: 10 },
  qrPassBtn: { flex: 1, backgroundColor: '#dc2626', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  qrPassBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },
  nfcPassBtn: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  nfcPassBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '800' },

  // Modals
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  qrModalContent: { backgroundColor: '#1e293b', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center' },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalSub: { color: '#94a3b8', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  qrBox: { backgroundColor: '#ffffff', borderRadius: 12, padding: 20, alignItems: 'center', width: '100%', marginBottom: 16 },
  qrImage: { width: 220, height: 220, borderRadius: 8, marginBottom: 12 },
  qrPlaceholderText: { color: '#0f172a', fontWeight: '900', fontSize: 16, marginVertical: 20 },
  qrUrlText: { color: '#64748b', fontSize: 10, fontWeight: '600' },
  closeModalBtn: { backgroundColor: '#475569', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  closeModalBtnText: { color: '#ffffff', fontWeight: '700' },

  paramedicModalContent: { backgroundColor: '#0f172a', borderRadius: 16, padding: 20, width: '100%', maxWidth: 450, borderWidth: 1.5, borderColor: '#ef4444' },
  paramedicBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  paramedicBadge: { color: '#ef4444', fontWeight: '900', fontSize: 12 },
  closeX: { color: '#94a3b8', fontSize: 18, fontWeight: '700' },
  patientNameHeader: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  patientMetaText: { color: '#38bdf8', fontSize: 12, marginTop: 2, marginBottom: 14 },
  riskAlertsBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ef4444', marginBottom: 12 },
  riskAlertTitle: { color: '#fca5a5', fontSize: 11, fontWeight: '800', marginBottom: 4 },
  riskAlertItem: { color: '#fecdd3', fontSize: 12, marginTop: 2 },
  reportSummaryBox: { backgroundColor: '#1e293b', padding: 12, borderRadius: 8, marginBottom: 16 },
  reportSummaryTitle: { color: '#94a3b8', fontSize: 10, fontWeight: '800', marginBottom: 4 },
  reportSummaryText: { color: '#e2e8f0', fontSize: 12, lineHeight: 18 },
  actionButtonRow: { flexDirection: 'row', gap: 10 },
  callPrimaryBtn: { flex: 1, backgroundColor: '#16a34a', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  callPrimaryText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  callGynBtn: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  callGynText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  container: { flex: 1, backgroundColor: Colors.background },
  inner: { padding: Spacing.md },
  center: {
    flex: 1, backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.md,
  },
  loadingEmoji: { fontSize: 52 },
  loadingText: { ...Typography.body, color: Colors.textSecondary },

  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  greeting: { ...Typography.h2, color: Colors.textPrimary },
  greetingSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  logoutBtn: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoutText: { ...Typography.caption, color: Colors.textMuted, fontWeight: '600' as const },

  // Hero Card
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 4,
    ...Shadows.md,
  },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.lg },
  heroLeft: { flex: 1 },
  weekBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  weekBadgeText: { ...Typography.label, fontSize: 10 },
  weekRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 6 },
  weekNum: { fontSize: 64, fontWeight: '900' as const, lineHeight: 72 },
  weekUnit: { ...Typography.h3, color: Colors.textMuted, marginBottom: 10 },
  daysLeft: { flexDirection: 'row' as const },
  daysNum: { ...Typography.h2, color: Colors.textPrimary, fontWeight: '800' as const },
  daysLabel: { ...Typography.body, color: Colors.textSecondary },

  babyCard: {
    alignItems: 'center',
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    width: 110,
  },
  babyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.lavenderBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 2,
    borderColor: Colors.lavenderLight,
  },
  babyEmoji: { fontSize: 32 },
  babySizeLbl: { ...Typography.micro, color: Colors.textMuted },
  babySize: { ...Typography.h4, color: Colors.textPrimary, textAlign: 'center' },

  // Progress
  progressSection: { marginBottom: Spacing.md },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLbl: { ...Typography.label, color: Colors.textMuted },
  progressPct: { ...Typography.label, fontWeight: '700' as const },
  progressBg: {
    height: 10,
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.full,
    overflow: 'hidden' as any,
    position: 'relative' as any,
  },
  progressFill: { height: '100%' as any, borderRadius: Radius.full },
  progressMarker: {
    position: 'absolute' as any,
    top: 0, bottom: 0,
    width: 2,
    backgroundColor: Colors.backgroundAlt,
    opacity: 0.6,
  },
  progressTicks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tickLabel: { ...Typography.micro, color: Colors.textMuted },

  tipStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.goldBg,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
  },
  tipIcon: { fontSize: 16 },
  tipText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },

  // Stats Row
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statsRowWide: { gap: Spacing.md },

  // Water
  waterGoal: { marginBottom: Spacing.sm },
  waterCount: { fontSize: 32, fontWeight: '800' as const },
  waterOf: { ...Typography.body, color: Colors.textMuted },
  waterBubbles: {
    flexDirection: 'row',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: Spacing.sm,
  },
  waterBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waterBubbleIcon: { fontSize: 16 },

  // Checklist
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircleDone: {
    backgroundColor: Colors.mint,
    borderColor: Colors.mint,
  },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' as const },
  checkIcon: { fontSize: 16 },
  checkLabel: { ...Typography.body, color: Colors.textPrimary, flex: 1 },
  checkLabelDone: { color: Colors.textMuted, textDecorationLine: 'line-through' },

  // Medicines
  medCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadows.xs,
  },
  medIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: Colors.lavenderBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medIcon: { fontSize: 20 },
  medInfo: { flex: 1 },
  medName: { ...Typography.bodyBold, color: Colors.textPrimary, fontSize: 14 },
  medMeta: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },

  // AI Card
  aiTip: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.sm },
  aiTipItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  aiTipDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.lavender,
    marginTop: 8,
  },
  aiTipText: { ...Typography.body, color: Colors.textSecondary, flex: 1, lineHeight: 22 },
  aiChatBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.lavenderBg,
    borderRadius: Radius.full,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.lavenderLight,
  },
  aiChatBtnText: { ...Typography.bodyBold, color: Colors.lavender },

  // SOS Shortcut
  sosShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.coralBg,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.coral + '40',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  sosIcon: { fontSize: 32 },
  sosInfo: { flex: 1 },
  sosTitle: { ...Typography.h4, color: Colors.danger, fontWeight: '700' as const },
  sosSub: { ...Typography.caption, color: Colors.textMuted, marginTop: 2 },
  sosArrow: { fontSize: 26, color: Colors.danger, fontWeight: '300' as const },
});
