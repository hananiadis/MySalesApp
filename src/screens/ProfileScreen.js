// src/screens/ProfileScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import SafeScreen from '../components/SafeScreen';
import { useAuth } from '../context/AuthProvider';

const STRINGS = {
  title: '\u03a0\u03c1\u03bf\u03c6\u03af\u03bb',
  firstName: '\u038c\u03bd\u03bf\u03bc\u03b1',
  lastName: '\u0395\u03c0\u03ce\u03bd\u03c5\u03bc\u03bf',
  email: 'Email',
  newPassword: '\u039d\u03ad\u03bf \u03ba\u03c9\u03b4\u03b9\u03ba\u03cc',
  confirmNewPassword: '\u0395\u03c0\u03b1\u03bb\u03ae\u03b8\u03b5\u03c5\u03c3\u03c4\u03b5 \u03bd\u03ad\u03bf \u03ba\u03c9\u03b4\u03b9\u03ba\u03cc',
  save: '\u0391\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7',
  signOut: '\u0391\u03c0\u03bf\u03c3\u03cd\u03bd\u03b4\u03b5\u03c3\u03b7',
  success: '\u03a4\u03b1 \u03c3\u03c4\u03bf\u03b9\u03c7\u03b5\u03af\u03b1 \u03b1\u03bd\u03b1\u03bd\u03b5\u03ce\u03b8\u03b7\u03ba\u03b1\u03bd.',
  validationFirstName: '\u03a3\u03c5\u03bc\u03c0\u03bb\u03b7\u03c1\u03ce\u03c3\u03c4\u03b5 \u03cc\u03bd\u03bf\u03bc\u03b1.',
  validationEmail: '\u0395\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03ad\u03b3\u03ba\u03c5\u03c1\u03bf email.',
  validationPassword: '\u039f \u03bd\u03ad\u03bf\u03c2 \u03ba\u03c9\u03b4\u03b9\u03ba\u03cc\u03c2 \u03c0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03c4\u03bf\u03c5\u03bb\u03ac\u03c7\u03b9\u03c3\u03c4\u03b1 6 \u03c7\u03b1\u03c1\u03b1\u03ba\u03c4\u03ae\u03c1\u03b5\u03c2.',
  validationMismatch: '\u039f\u03b9 \u03ba\u03c9\u03b4\u03b9\u03ba\u03bf\u03af \u03c0\u03b5\u03b4\u03af\u03b1 \u03b4\u03b5\u03bd \u03c4\u03b1\u03b9\u03c1\u03b9\u03ac\u03b6\u03bf\u03c5\u03bd.',
  signOutTitle: '\u0391\u03c0\u03bf\u03c3\u03cd\u03bd\u03b4\u03b5\u03c3\u03b7',
  signOutMessage: '\u0395\u03af\u03c3\u03c4\u03b5 \u03b2\u03ad\u03b2\u03b1\u03b9\u03bf\u03b9 \u03cc\u03c4\u03b9 \u03b8\u03ad\u03bb\u03b5\u03c4\u03b5 \u03bd\u03b1 \u03b1\u03c0\u03bf\u03c3\u03c5\u03bd\u03b4\u03b5\u03b8\u03b5\u03af\u03c4\u03b5;',
  cancel: '\u0386\u03ba\u03c5\u03c1\u03bf',
};

const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const splitName = (value) => {
  if (!value) {
    return { first: '', last: '' };
  }
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first: '', last: '' };
  }
  const [first, ...rest] = parts;
  return { first, last: rest.join(' ') };
};

const ProfileScreen = () => {
  const { profile, user, signOut, updateProfileInfo } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const brands = useMemo(() => (Array.isArray(profile?.brands) ? profile.brands.filter(Boolean) : []), [profile?.brands]);
  const role = profile?.role || '';

  const displayEmail = email.trim();
  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || displayEmail;

  useEffect(() => {
    const currentFirst = profile?.firstName || splitName(profile?.name).first || splitName(user?.displayName).first;
    const currentLast = profile?.lastName || splitName(profile?.name).last || splitName(user?.displayName).last;
    const currentEmail = profile?.email || user?.email || '';

    setFirstName(currentFirst || '');
    setLastName(currentLast || '');
    setEmail(currentEmail);
  }, [profile?.firstName, profile?.lastName, profile?.name, profile?.email, user?.displayName, user?.email]);

  const handleSave = useCallback(async () => {
    setStatus('');
    setError('');
    const trimmedFirst = firstName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst) {
      setError(STRINGS.validationFirstName);
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setError(STRINGS.validationEmail);
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError(STRINGS.validationPassword);
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError(STRINGS.validationMismatch);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await updateProfileInfo({
        firstName: trimmedFirst,
        lastName: lastName.trim(),
        email: trimmedEmail,
        password: newPassword || undefined,
      });
      setNewPassword('');
      setConfirmPassword('');
      setStatus(STRINGS.success);
    } catch (err) {
      setError(err?.message || STRINGS.genericError);
    } finally {
      setBusy(false);
    }
  }, [confirmPassword, email, firstName, lastName, newPassword, updateProfileInfo]);

  const handleSignOut = useCallback(() => {
    Alert.alert(STRINGS.signOutTitle, STRINGS.signOutMessage, [
      { text: STRINGS.cancel, style: 'cancel' },
      {
        text: STRINGS.signOut,
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  }, [signOut]);

  return (
    <SafeScreen title={STRINGS.title} style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(firstName[0] || '?').toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{displayEmail}</Text>
            {role ? (
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{role}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{STRINGS.title}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {status ? <Text style={styles.status}>{status}</Text> : null}

            <TextInput
              style={styles.input}
              placeholder={STRINGS.firstName}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder={STRINGS.lastName}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder={STRINGS.email}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder={STRINGS.newPassword}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              placeholder={STRINGS.confirmNewPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              returnKeyType="done"
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>{STRINGS.save}</Text>
              )}
            </TouchableOpacity>
          </View>

          {brands.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionSubtitle}>Brands</Text>
              <View style={styles.brandRow}>
                {brands.map((brand) => (
                  <View key={brand} style={styles.brandChip}>
                    <Text style={styles.brandChipText}>{brand}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color="#d32f2f" style={{ marginRight: 8 }} />
            <Text style={styles.signOutText}>{STRINGS.signOut}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f8fa' },
  content: { padding: 24, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f2ff',
    marginBottom: 12,
  },
  avatarText: { fontSize: 30, fontWeight: '700', color: '#1f4f8f' },
  name: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  email: { fontSize: 14, color: '#475569', marginTop: 4 },
  rolePill: { marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#e3f2fd' },
  rolePillText: { color: '#1f4f8f', fontWeight: '600' },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  sectionSubtitle: { fontSize: 16, fontWeight: '600', color: '#1f2937', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f8fafc',
  },
  saveButton: {
    backgroundColor: '#1976d2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  error: { color: '#b00020', marginBottom: 12, fontSize: 13 },
  status: { color: '#0f9d58', marginBottom: 12, fontSize: 13 },
  brandRow: { flexDirection: 'row', flexWrap: 'wrap' },
  brandChip: {
    backgroundColor: '#eef4ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  brandChipText: { color: '#1f4f8f', fontWeight: '600' },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#ffecec',
  },
  signOutText: { color: '#d32f2f', fontWeight: '700' },
});

export default ProfileScreen;
