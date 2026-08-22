import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Spacing, Radius, Typography, Shadows } from '../../constants/theme';
import { NFCService, NFCResolveResponse, HealthRecordItem } from '../../services/api';

export default function NFCHealthCardScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<NFCResolveResponse | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  
  // Add Record Modal / Form State (for Case 2 or adding new record)
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Ultrasound Scan');
  const [newNotes, setNewNotes] = useState('');
  const [newRisk, setNewRisk] = useState('Low Risk');
  const [newWeek, setNewWeek] = useState('24');
  const [newLabKey, setNewLabKey] = useState('');
  const [newLabVal, setNewLabVal] = useState('');

  const loadCardData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await NFCService.resolveToken(token as string);
      setData(res);
    } catch (err) {
      setData({
        valid: false,
        status: 'error',
        token: (token as string) || '',
        message: 'Could not communicate with MotherCare security server.',
        has_records: false,
        records: []
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCardData();
  }, [token]);

  const handleAddRecord = async () => {
    if (!newTitle.trim()) {
      alert('Please enter a record title');
      return;
    }
    setSubmitting(true);
    try {
      const labValues: Record<string, string> = {};
      if (newLabKey.trim() && newLabVal.trim()) {
        labValues[newLabKey.trim()] = newLabVal.trim();
      }

      await NFCService.addRecordViaNFC(token as string, {
        title: newTitle.trim(),
        category: newCategory,
        description: `Added via NFC Digital Card on ${new Date().toLocaleDateString()}`,
        gestational_week: parseInt(newWeek) || 24,
        risk_level: newRisk,
        doctor_notes: newNotes.trim(),
        lab_values: labValues,
        recommendations: ['Follow doctor instructions', 'Keep digital card updated']
      });

      setShowAddForm(false);
      setNewTitle('');
      setNewNotes('');
      setNewLabKey('');
      setNewLabVal('');
      // Reload token resolution to update UI immediately
      await loadCardData();
    } catch (err: any) {
      alert(err.message || 'Failed to add record');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Reading MotherCare Digital Health Card...</Text>
      </View>
    );
  }

  // ── CASE 3: INVALID OR REVOKED CARD ──────────────────────────────────────────
  if (!data || !data.valid) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.centerScroll}>
        <View style={styles.errorCard}>
          <View style={styles.errorIconBadge}>
            <Text style={styles.errorIconText}>⚠️</Text>
          </View>
          <Text style={styles.errorTitle}>MotherCare Card Inactive</Text>
          <Text style={styles.errorMessage}>
            {data?.message || 'This MotherCare card is invalid, expired, or no longer active.'}
          </Text>

          <View style={styles.securityBox}>
            <Text style={styles.securityBoxTitle}>🔒 Security Notice</Text>
            <Text style={styles.securityBoxBody}>
              No medical records are stored on physical NFC tags. All patient data remains safe and encrypted in the MotherCare database.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.primaryButtonText}>Log into MotherCare Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const { patient, pregnancy_profile, emergency_profile, records, has_records } = data;

  const categories = ['All', 'Ultrasound Scan', 'Blood Test', 'PCOS Assessment', 'Prescription', 'Clinical Note'];
  const filteredRecords = activeCategory === 'All' 
    ? records 
    : records.filter(r => r.category.toLowerCase().includes(activeCategory.toLowerCase()));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
      {/* ── TOP HEADER / TAP BANNER ──────────────────────────────────────── */}
      <View style={styles.headerBanner}>
        <View style={styles.nfcBadge}>
          <Text style={styles.nfcBadgeIcon}>📡</Text>
          <Text style={styles.nfcBadgeText}>NFC HEALTH CARD VERIFIED</Text>
        </View>
        <Text style={styles.headerTitle}>MotherCare Digital Health Profile</Text>
        <Text style={styles.headerSubtitle}>Tap-to-Scan Instant Health Access</Text>
      </View>

      <View style={styles.contentContainer}>
        {/* ── PATIENT SUMMARY CARD ────────────────────────────────────────── */}
        <View style={styles.patientCard}>
          <View style={styles.patientAvatarRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{patient?.name ? patient.name[0] : 'M'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.patientName}>{patient?.name || 'MotherCare Patient'}</Text>
              <Text style={styles.patientEmail}>{patient?.email}</Text>
              <View style={styles.patientTagsRow}>
                <View style={[styles.miniBadge, { backgroundColor: Colors.primaryLight + '30' }]}>
                  <Text style={[styles.miniBadgeText, { color: Colors.primaryDark }]}>
                    Week {pregnancy_profile?.current_week || 24} Pregnancy
                  </Text>
                </View>
                {emergency_profile?.blood_group && (
                  <View style={[styles.miniBadge, { backgroundColor: Colors.coralBg }]}>
                    <Text style={[styles.miniBadgeText, { color: Colors.coral }]}>
                      Blood Group: {emergency_profile.blood_group}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Emergency Info Summary */}
          {emergency_profile && (
            <View style={styles.emergSummaryBox}>
              <Text style={styles.emergLabel}>🏥 Preferred Hospital:</Text>
              <Text style={styles.emergVal}>{emergency_profile.preferred_hospital || 'St. Jude Maternity Hospital'}</Text>
              
              {emergency_profile.allergies ? (
                <Text style={[styles.emergLabel, { marginTop: 4 }]}>⚠️ Allergies: <Text style={styles.emergVal}>{emergency_profile.allergies}</Text></Text>
              ) : null}
            </View>
          )}
        </View>

        {/* ── CASE 2: NO HEALTH RECORDS YET ───────────────────────────────── */}
        {!has_records && !showAddForm ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No health records have been added yet</Text>
            <Text style={styles.emptySubtitle}>
              This NFC Digital Health Card is verified and active. You can initialize this patient profile by adding their first health record or report.
            </Text>

            <TouchableOpacity style={styles.primaryButton} onPress={() => setShowAddForm(true)}>
              <Text style={styles.primaryButtonText}>+ Add First Health Record</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── ADD RECORD FORM (INLINE / MODAL FOR CASE 2 & NEW RECORDS) ──── */}
        {showAddForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>➕ Add Record to Digital Card Profile</Text>

            <Text style={styles.inputLabel}>Record Title *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Trimester 2 Ultrasound Report"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.inputLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              {['Ultrasound Scan', 'Blood Test', 'PCOS Assessment', 'Prescription', 'Clinical Note'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, newCategory === cat && styles.chipActive]}
                  onPress={() => setNewCategory(cat)}
                >
                  <Text style={[styles.chipText, newCategory === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Gestational Week</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={newWeek}
                  onChangeText={setNewWeek}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Risk Level</Text>
                <TextInput
                  style={styles.textInput}
                  value={newRisk}
                  onChangeText={setNewRisk}
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Doctor Notes</Text>
            <TextInput
              style={[styles.textInput, { height: 70 }]}
              multiline
              placeholder="Enter clinical observations, notes, or findings..."
              value={newNotes}
              onChangeText={setNewNotes}
            />

            <Text style={styles.inputLabel}>Lab Value (Optional key & value)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Key (e.g. Hemoglobin)"
                value={newLabKey}
                onChangeText={setNewLabKey}
              />
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Value (e.g. 12.5 g/dL)"
                value={newLabVal}
                onChangeText={setNewLabVal}
              />
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.secondaryButton, { flex: 1 }]}
                onPress={() => setShowAddForm(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, { flex: 1 }]}
                onPress={handleAddRecord}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save to Card Profile</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── CASE 1: RECORDS AVAILABLE ────────────────────────────────────── */}
        {has_records && (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.sectionTitle}>Digital Health Records ({records.length})</Text>
              {!showAddForm && (
                <TouchableOpacity onPress={() => setShowAddForm(true)}>
                  <Text style={{ color: Colors.primary, fontWeight: '600' }}>+ Add Record</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Category Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.chip, activeCategory === cat && styles.chipActive]}
                  onPress={() => setActiveCategory(cat)}
                >
                  <Text style={[styles.chipText, activeCategory === cat && styles.chipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* List of Health Record Cards */}
            {filteredRecords.map((item) => (
              <View key={item.id} style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordTitle}>{item.title}</Text>
                    <Text style={styles.recordMeta}>
                      {item.category} • Week {item.gestational_week || 24}
                    </Text>
                  </View>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: item.status === 'verified' ? Colors.mintBg : Colors.warningLight }
                  ]}>
                    <Text style={[
                      styles.statusBadgeText,
                      { color: item.status === 'verified' ? Colors.mint : Colors.warning }
                    ]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {item.description ? (
                  <Text style={styles.recordDesc}>{item.description}</Text>
                ) : null}

                {/* Doctor Notes */}
                {item.doctor_notes ? (
                  <View style={styles.doctorNotesBox}>
                    <Text style={styles.notesTitle}>👨‍⚕️ Clinical / Doctor Notes:</Text>
                    <Text style={styles.notesBody}>{item.doctor_notes}</Text>
                  </View>
                ) : null}

                {/* Lab Values Grid */}
                {item.lab_values && Object.keys(item.lab_values).length > 0 ? (
                  <View style={styles.labValuesContainer}>
                    <Text style={styles.labHeaderTitle}>📊 Lab & Vital Parameters:</Text>
                    <View style={styles.labGrid}>
                      {Object.entries(item.lab_values).map(([k, v]) => (
                        <View key={k} style={styles.labChip}>
                          <Text style={styles.labKey}>{k}</Text>
                          <Text style={styles.labVal}>{String(v)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Recommendations */}
                {item.recommendations && item.recommendations.length > 0 ? (
                  <View style={styles.recsBox}>
                    <Text style={styles.recsTitle}>💡 Care Recommendations:</Text>
                    {item.recommendations.map((rec, idx) => (
                      <Text key={idx} style={styles.recItem}>• {rec}</Text>
                    ))}
                  </View>
                ) : null}

                {/* Attachment Link */}
                {item.attachment_url ? (
                  <TouchableOpacity
                    style={styles.attachmentButton}
                    onPress={() => Linking.openURL(item.attachment_url!)}
                  >
                    <Text style={styles.attachmentButtonText}>
                      📄 View Attached Document ({item.attachment_name || 'Report File'})
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
  },
  centerScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: Typography.body.fontSize,
  },
  headerBanner: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
  },
  nfcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    marginBottom: Spacing.xs,
  },
  nfcBadgeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  nfcBadgeText: {
    color: '#FFF',
    fontSize: Typography.label.fontSize,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: Typography.h1.fontSize,
    fontWeight: Typography.h1.fontWeight,
    textAlign: 'center',
    marginTop: 4,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: Typography.body.fontSize,
    marginTop: 2,
  },
  contentContainer: {
    paddingHorizontal: Spacing.md,
    marginTop: -Spacing.md,
  },
  patientCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
    marginBottom: Spacing.md,
  },
  patientAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
  },
  patientName: {
    fontSize: Typography.h2.fontSize,
    fontWeight: Typography.h2.fontWeight,
    color: Colors.textPrimary,
  },
  patientEmail: {
    fontSize: Typography.caption.fontSize,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  patientTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  miniBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emergSummaryBox: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  emergLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emergVal: {
    fontWeight: '400',
    color: Colors.textPrimary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    ...Shadows.sm,
    marginTop: Spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.h2.fontSize,
    fontWeight: Typography.h2.fontWeight,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  errorCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
    ...Shadows.lg,
  },
  errorIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.coralBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  errorIconText: {
    fontSize: 32,
  },
  errorTitle: {
    fontSize: Typography.h1.fontSize,
    fontWeight: Typography.h1.fontWeight,
    color: Colors.error,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: Typography.body.fontSize,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  securityBox: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    width: '100%',
    marginBottom: Spacing.lg,
  },
  securityBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  securityBoxBody: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    ...Shadows.md,
    marginBottom: Spacing.md,
  },
  formTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: Typography.h3.fontWeight,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceSecondary,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFF',
  },
  sectionTitle: {
    fontSize: Typography.h3.fontSize,
    fontWeight: Typography.h3.fontWeight,
    color: Colors.textPrimary,
  },
  recordCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.xs,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  recordTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recordMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.xs,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  recordDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  doctorNotesBox: {
    backgroundColor: Colors.lavenderBg,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: 8,
  },
  notesTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.lavender,
    marginBottom: 2,
  },
  notesBody: {
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  labValuesContainer: {
    marginBottom: 8,
  },
  labHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  labGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  labChip: {
    backgroundColor: Colors.surfaceSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.xs,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  labKey: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  labVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  recsBox: {
    backgroundColor: Colors.tealBg,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    marginBottom: 8,
  },
  recsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.teal,
    marginBottom: 2,
  },
  recItem: {
    fontSize: 12,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  attachmentButton: {
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: Radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  attachmentButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primaryDark,
  },
});
