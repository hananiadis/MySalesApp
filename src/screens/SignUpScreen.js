import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  BackHandler,
} from 'react-native';

import SafeScreen from '../components/SafeScreen';
import { useAuth } from '../context/AuthProvider';

const STRINGS = {
  title: '\u0395\u03b3\u03b3\u03c1\u03b1\u03c6\u03ae',
  firstName: '\u038c\u03bd\u03bf\u03bc\u03b1',
  lastName: '\u0395\u03c0\u03ce\u03bd\u03c5\u03bc\u03bf',
  email: 'Email',
  password: '\u039a\u03c9\u03b4\u03b9\u03ba\u03cc\u03c2',
  confirmPassword: '\u0395\u03c0\u03b1\u03bb\u03ae\u03b8\u03b5\u03c5\u03c3\u03c4\u03b5 \u03ba\u03c9\u03b4\u03b9\u03ba\u03cc',
  submit: '\u0394\u03b7\u03bc\u03b9\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 \u03bb\u03bf\u03b3\u03b1\u03c1\u03b9\u03b1\u03c3\u03bc\u03bf\u03cd',
  haveAccount: '\u0388\u03c7\u03b5\u03c4\u03b5 \u03bb\u03bf\u03b3\u03b1\u03c1\u03b9\u03b1\u03c3\u03bc\u03cc; \u03a3\u03cd\u03bd\u03b4\u03b5\u03c3\u03b7',
  validationFirstName: '\u03a3\u03c5\u03bc\u03c0\u03bb\u03b7\u03c1\u03ce\u03c3\u03c4\u03b5 \u03cc\u03bd\u03bf\u03bc\u03b1.',
  validationEmail: '\u0395\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03ad\u03b3\u03ba\u03c5\u03c1\u03bf email.',
  validationPassword: '\u039f \u03ba\u03c9\u03b4\u03b9\u03ba\u03cc\u03c2 \u03c0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03c4\u03bf\u03c5\u03bb\u03ac\u03c7\u03b9\u03c3\u03c4\u03b1 6 \u03c7\u03b1\u03c1\u03b1\u03ba\u03c4\u03ae\u03c1\u03b5\u03c2.',
  validationMismatch: '\u039f\u03b9 \u03ba\u03c9\u03b4\u03b9\u03ba\u03bf\u03af \u03c0\u03b5\u03b4\u03af\u03b1 \u03b4\u03b5\u03bd \u03c4\u03b1\u03b9\u03c1\u03b9\u03ac\u03b6\u03bf\u03c5\u03bd.',
  genericError: '\u039f\u03bb\u03bf\u03ba\u03bb\u03b7\u03c1\u03c9\u03bc\u03ad\u03bd\u03bf \u03c3\u03c6\u03ac\u03bb\u03bc\u03b1.',
};

const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const SignUpScreen = ({ navigation }) => {
  const { signUp } = useAuth();
  const EXIT_STRINGS = { exit: '\u0388\u03be\u03bf\u03b4\u03bf\u03c2' };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
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

    if (password.length < 6) {
      setError(STRINGS.validationPassword);
      return;
    }

    if (password !== confirmPassword) {
      setError(STRINGS.validationMismatch);
      return;
    }

    setBusy(true);
    setError('');
    try {
      await signUp(trimmedFirst, lastName.trim(), trimmedEmail, password);
    } catch (err) {
      setError(err?.message || STRINGS.genericError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeScreen style={styles.safe} showUserMenu={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.form}>
          <Text style={styles.title}>{STRINGS.title}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

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
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder={STRINGS.password}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            secureTextEntry
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder={STRINGS.confirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
            secureTextEntry
            returnKeyType="done"
          />

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{STRINGS.submit}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.linkWrapper}>
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={styles.link}>{STRINGS.haveAccount}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.shutdownButton}
          onPress={() => BackHandler.exitApp()}
          activeOpacity={0.85}
        >
          <Text style={styles.shutdownText}>{EXIT_STRINGS.exit}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 24 },
  form: { justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 20, color: '#1f2d3d' },
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
  button: {
    backgroundColor: '#1976d2',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  linkWrapper: { marginTop: 18, alignItems: 'center' },
  link: { color: '#1976d2', fontWeight: '600', fontSize: 14 },
  error: { color: '#b00020', textAlign: 'center', marginBottom: 12, fontSize: 13 },
  shutdownButton: {
    alignSelf: 'center',
    backgroundColor: '#d32f2f',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 22,
    marginBottom: 24,
  },
  shutdownText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

export default SignUpScreen;
