// src/screens/LoginScreen.js
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
import { useAuth } from '../context/AuthProvider';
import SafeScreen from '../components/SafeScreen';

const STRINGS = {
  title: '\u0395\u03af\u03c3\u03bf\u03b4\u03bf\u03c2',
  emailPlaceholder: 'Email',
  passwordPlaceholder: '\u039a\u03c9\u03b4\u03b9\u03ba\u03cc\u03c2',
  login: '\u03a3\u03cd\u03bd\u03b4\u03b5\u03c3\u03b7',
  signupPrompt: '\u0394\u03b5\u03bd \u03ad\u03c7\u03b5\u03b9\u03c2 \u03bb\u03bf\u03b3\u03b1\u03c1\u03b9\u03b1\u03c3\u03bc\u03cc; \u0395\u03b3\u03b3\u03c1\u03b1\u03c6\u03ae',
  genericError: '\u03a3\u03c6\u03ac\u03bb\u03bc\u03b1 \u03c3\u03cd\u03bd\u03b4\u03b5\u03c3\u03b7\u03c2',
};

const EXIT_STRINGS = { exit: '\u0388\u03be\u03bf\u03b4\u03bf\u03c2' };

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onLogin = async () => {
    setErr('');
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setErr(error?.message || STRINGS.genericError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeScreen style={styles.safe} showUserMenu={false}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <View style={styles.form}>
          <Text style={styles.title}>{STRINGS.title}</Text>
          {!!err && <Text style={styles.error}>{err}</Text>}
          <TextInput
            style={styles.input}
            placeholder={STRINGS.emailPlaceholder}
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder={STRINGS.passwordPlaceholder}
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={onLogin} style={styles.btn} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{STRINGS.login}</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.replace('SignUp')}>
            <Text style={styles.link}>{STRINGS.signupPrompt}</Text>
          </TouchableOpacity>
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
}

const styles = StyleSheet.create({
  safe: { backgroundColor: '#fff' },
  container: { flex: 1, padding: 20, justifyContent: 'space-between' },
  form: { 
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  input: { 
    borderWidth: 2, 
    borderColor: '#1976d2', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: '#1f2937',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  btn: { backgroundColor: '#1976d2', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  link: { marginTop: 16, color: '#1976d2', textAlign: 'center', fontWeight: '600' },
  error: { color: '#b00020', marginBottom: 8, textAlign: 'center' },
  shutdownButton: {
    alignSelf: 'center',
    backgroundColor: '#d32f2f',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 22,
  },
  shutdownText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
