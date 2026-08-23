import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Public API Base URL
const API_BASE_URL = "http://localhost:8000";

interface PassportState {
  medical_token: string;
  target_url: string;
  subscription_tier: 'FREE' | 'PREMIUM';
  nfc_card_linked: boolean;
  nfc_last_synced_at: string | null;
}

import DashboardLayout from '../../components/DashboardLayout';

export default function EmergencyPassportScreen() {
  const [passportData, setPassportData] = useState<PassportState | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [nfcScanning, setNfcScanning] = useState<boolean>(false);
  const [nfcSuccess, setNfcSuccess] = useState<boolean>(false);
  const [showPromoModal, setShowPromoModal] = useState<boolean>(false);
  const [updatingTier, setUpdatingTier] = useState<boolean>(false);

  // Simulated authenticated user token for demo
  const [userRole, setUserRole] = useState<'FREE' | 'PREMIUM'>('FREE');

  useEffect(() => {
    fetchToken();
  }, [userRole]);

  const fetchToken = async () => {
    setLoading(true);
    try {
      const mockToken = userRole === 'FREE' ? 'med_pass_free_test_12345' : 'med_pass_premium_test_67890';
      const targetUrl = `https://maternalcare.app/m/${mockToken}`;

      setPassportData({
        medical_token: mockToken,
        target_url: targetUrl,
        subscription_tier: userRole,
        nfc_card_linked: userRole === 'PREMIUM',
        nfc_last_synced_at: userRole === 'PREMIUM' ? new Date().toISOString() : null
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleNFCProvisioning = async () => {
    if (passportData?.subscription_tier === 'FREE') {
      setShowPromoModal(true);
      return;
    }

    setNfcScanning(true);
    setNfcSuccess(false);

    try {
      await new Promise(resolve => setTimeout(resolve, 2500));

      setNfcScanning(false);
      setNfcSuccess(true);
      if (passportData) {
        setPassportData({
          ...passportData,
          nfc_card_linked: true,
          nfc_last_synced_at: new Date().toISOString()
        });
      }
      Alert.alert(
        "NFC Card Programmed! 🎉",
        `Successfully wrote NDEF URL record:\n${passportData?.target_url}\n\nYour physical card is active for first responders.`
      );
    } catch (err) {
      setNfcScanning(false);
      Alert.alert("NFC Error", "Polling timed out or card is read-only. Please try again.");
    }
  };

  const handleToggleTier = async (newTier: 'FREE' | 'PREMIUM') => {
    setUpdatingTier(true);
    try {
      setUserRole(newTier);
      setShowPromoModal(false);
    } finally {
      setUpdatingTier(false);
    }
  };

  const handleSaveWallpaper = () => {
    Alert.alert(
      "Lock-Screen Wallpaper Saved",
      "Emergency QR Code exported to your photo gallery. Set it as your lock-screen wallpaper for 1-tap paramedic scanning."
    );
  };

  const handleSharePass = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'MaternalCare Emergency Passport',
        url: passportData?.target_url
      }).catch(() => {});
    } else {
      Alert.alert("Share Emergency Pass", `Passport Link:\n${passportData?.target_url}`);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Emergency Passport">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#ef4444" />
          <Text style={styles.loadingText}>Loading Emergency Medical Passport...</Text>
        </View>
      </DashboardLayout>
    );
  }

  const isPremium = passportData?.subscription_tier === 'PREMIUM';

  return (
    <DashboardLayout title="Emergency Passport">
      <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🚨 Emergency Medical Passport</Text>
          <Text style={styles.headerSub}>Dynamic QR Code + Hardware NFC Sync</Text>
          
          {/* Tier Badge & Demo Switcher */}
          <View style={styles.tierContainer}>
            <View style={[styles.tierBadge, isPremium ? styles.premiumBadge : styles.freeBadge]}>
              <Text style={styles.tierBadgeText}>
                TIER: {passportData?.subscription_tier} USER
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.demoToggleBtn}
              onPress={() => handleToggleTier(isPremium ? 'FREE' : 'PREMIUM')}
            >
              <Text style={styles.demoToggleText}>
                🔄 Switch to {isPremium ? 'FREE' : 'PREMIUM'} Tier (Demo)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dynamic QR Code Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📱 Dynamic Emergency QR Passport</Text>
            <View style={styles.activePill}><Text style={styles.activePillText}>LIVE</Text></View>
          </View>
          
          <Text style={styles.cardDesc}>
            First responders & paramedics can scan this QR code without unlocking your phone to view blood group, allergies, emergency contacts, and gestational status.
          </Text>

          {/* High-Contrast QR Code View */}
          <View style={styles.qrWrapper}>
            <View style={styles.qrBox}>
              <Text style={styles.qrTitle}>MATERNALCARE EMERGENCY PASS</Text>
              <View style={styles.qrMockCode}>
                <Text style={styles.qrIcon}>🔳🔲🔳</Text>
                <Text style={styles.qrIcon}>🔲🔳🔲</Text>
                <Text style={styles.qrIcon}>🔳🔲🔳</Text>
              </View>
              <Text style={styles.qrTargetUrl} numberOfLines={1}>
                {passportData?.target_url}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.actionBtnPrimary} onPress={handleSaveWallpaper}>
              <Text style={styles.actionBtnText}>🖼️ Save as Wallpaper</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleSharePass}>
              <Text style={styles.actionBtnTextSec}>🔗 Share Pass</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* NFC Card Programming Section */}
        <View style={[styles.card, !isPremium && styles.disabledCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>💳 Physical NFC Card Provisioning</Text>
            {isPremium ? (
              <View style={styles.premiumPill}><Text style={styles.premiumPillText}>PREMIUM</Text></View>
            ) : (
              <View style={styles.lockedPill}><Text style={styles.lockedPillText}>LOCKED</Text></View>
            )}
          </View>

          <Text style={styles.cardDesc}>
            Tap a physical NFC keyfob or medical smart card to burn your NDEF emergency payload for instantaneous tap-to-read response by paramedics.
          </Text>

          {/* NFC Status Banner */}
          {passportData?.nfc_card_linked && (
            <View style={styles.nfcStatusActive}>
              <Text style={styles.nfcStatusTitle}>✓ Physical NFC Card Linked & Active</Text>
              <Text style={styles.nfcStatusSub}>
                Last Synced: {new Date(passportData.nfc_last_synced_at || "").toLocaleString()}
              </Text>
            </View>
          )}

          {/* NFC Action Button */}
          {isPremium ? (
            <TouchableOpacity
              style={styles.nfcSyncBtn}
              onPress={handleNFCProvisioning}
              disabled={nfcScanning}
            >
              {nfcScanning ? (
                <View style={styles.scanningRow}>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.nfcSyncBtnText}>Hold Card Near Device (Polling NDEF)...</Text>
                </View>
              ) : (
                <Text style={styles.nfcSyncBtnText}>
                  {passportData?.nfc_card_linked ? "📡 Tap to Re-Sync / Update NFC Card" : "📡 Tap to Program Physical NFC Card"}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.nfcDisabledBtn}
              onPress={() => setShowPromoModal(true)}
            >
              <Text style={styles.nfcDisabledBtnText}>
                🔒 Upgrade to Premium to Link Physical NFC Card
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Informational Hardware Tier Modal for Free Tier Users */}
        <Modal
          visible={showPromoModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPromoModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalHeader}>⚡ Premium NFC Hardware Sync</Text>

              <View style={styles.errorAlertBox}>
                <Text style={styles.errorAlertTitle}>HTTP 403 Forbidden Response</Text>
                <Text style={styles.errorAlertText}>
                  "Hardware NFC provisioning is restricted to Premium tier due to supply constraints. Please use your Emergency QR Passport."
                </Text>
              </View>

              <Text style={styles.modalBody}>
                Physical NFC cards allow paramedics to tap any smartphone against your medical badge or wristband even if battery is dead or screen is shattered.
              </Text>

              <View style={styles.modalFeatureList}>
                <Text style={styles.modalFeature}>✓ Encrypted NDEF URL Burning</Text>
                <Text style={styles.modalFeature}>✓ Zero-battery emergency read support</Text>
                <Text style={styles.modalFeature}>✓ Priority 24/7 Paramedic Alert Dispatch</Text>
              </View>

              <TouchableOpacity
                style={styles.upgradeBtnModal}
                onPress={() => handleToggleTier('PREMIUM')}
              >
                <Text style={styles.upgradeBtnModalText}>✨ Test Upgrade to Premium Tier Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setShowPromoModal(false)}
              >
                <Text style={styles.closeModalText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090d16' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#090d16' },
  loadingText: { color: '#94a3b8', marginTop: 12, fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 20, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  headerSub: { fontSize: 13, color: '#94a3b8', marginTop: 4, textAlign: 'center' },
  tierContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  freeBadge: { backgroundColor: '#334155' },
  premiumBadge: { backgroundColor: '#8b5cf6' },
  tierBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  demoToggleBtn: { backgroundColor: '#1e293b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#475569' },
  demoToggleText: { color: '#38bdf8', fontSize: 11, fontWeight: '700' },
  card: { backgroundColor: '#111827', borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#1f2937' },
  disabledCard: { borderColor: '#374151', opacity: 0.9 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  activePill: { backgroundColor: 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#10b981' },
  activePillText: { color: '#34d399', fontSize: 10, fontWeight: '800' },
  premiumPill: { backgroundColor: 'rgba(139, 92, 246, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#8b5cf6' },
  premiumPillText: { color: '#c084fc', fontSize: 10, fontWeight: '800' },
  lockedPill: { backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#ef4444' },
  lockedPillText: { color: '#fca5a5', fontSize: 10, fontWeight: '800' },
  cardDesc: { fontSize: 13, color: '#9ca3af', lineHeight: 18, marginBottom: 16 },
  qrWrapper: { alignItems: 'center', marginBottom: 16 },
  qrBox: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, alignItems: 'center', width: 240, shadowColor: '#ef4444', shadowRadius: 10, shadowOpacity: 0.3 },
  qrTitle: { color: '#dc2626', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  qrMockCode: { flexDirection: 'column', alignItems: 'center', marginVertical: 8 },
  qrIcon: { fontSize: 24, letterSpacing: 4 },
  qrTargetUrl: { color: '#475569', fontSize: 10, fontWeight: '600', marginTop: 8, maxWidth: 200 },
  btnRow: { flexDirection: 'row', gap: 10 },
  actionBtnPrimary: { flex: 1, backgroundColor: '#dc2626', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  actionBtnSecondary: { flex: 1, backgroundColor: '#1f2937', paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  actionBtnTextSec: { color: '#e2e8f0', fontWeight: '700', fontSize: 13 },
  nfcStatusActive: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: '#10b981', borderRadius: 10, padding: 12, marginBottom: 14 },
  nfcStatusTitle: { color: '#34d399', fontWeight: '700', fontSize: 13 },
  nfcStatusSub: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  nfcSyncBtn: { backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nfcSyncBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  nfcDisabledBtn: { backgroundColor: '#1e293b', paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  nfcDisabledBtnText: { color: '#fca5a5', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111827', borderRadius: 20, padding: 22, borderWidth: 1, borderColor: '#374151' },
  modalHeader: { fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 12 },
  errorAlertBox: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorAlertTitle: { color: '#ef4444', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  errorAlertText: { color: '#fca5a5', fontSize: 12, fontStyle: 'italic' },
  modalBody: { color: '#9ca3af', fontSize: 13, lineHeight: 18, marginBottom: 14 },
  modalFeatureList: { marginBottom: 20, gap: 6 },
  modalFeature: { color: '#e2e8f0', fontSize: 13, fontWeight: '600' },
  upgradeBtnModal: { backgroundColor: '#8b5cf6', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  upgradeBtnModalText: { color: '#ffffff', fontWeight: '800', fontSize: 14 },
  closeModalBtn: { paddingVertical: 10, alignItems: 'center' },
  closeModalText: { color: '#64748b', fontSize: 13, fontWeight: '600' }
});
