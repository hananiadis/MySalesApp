// src/screens/FieldSalesProScreen.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthProvider';
import { getFunctionUrl } from '../config/firebase';
import colors from '../theme/colors';
import { getModuleAccess } from '../utils/moduleAccess';
import { navigateToMainHome } from '../utils/navigationHelpers';

export default function FieldSalesProScreen({ navigation }) {
  const { user, profile } = useAuth();
  const moduleAccess = getModuleAccess(profile);
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [runtimeContext, setRuntimeContext] = useState(null);
  const [webViewKey, setWebViewKey] = useState(0);

  const normalizedBrands = useMemo(
    () =>
      (Array.isArray(profile?.brands) ? profile.brands : [])
        .map((brand) => String(brand || '').trim().toLowerCase())
        .filter(Boolean),
    [profile?.brands]
  );

  const buildRuntimeContext = useCallback(
    async (forceRefresh = false) => {
      if (!user) {
        throw new Error('No authenticated user available for FieldSales Pro.');
      }

      const idToken = await user.getIdToken(forceRefresh);

      return {
        idToken,
        uid: user.uid || '',
        email: user.email || '',
        role: profile?.role || '',
        brands: normalizedBrands,
        defaultBrand: normalizedBrands[0] || '',
        bffBaseUrl: getFunctionUrl('api'),
      };
    },
    [normalizedBrands, profile?.role, user]
  );

  const buildInjectedRuntimeScript = useCallback((context, announceUpdate = false) => {
    const payload = JSON.stringify(context || {});
    const shouldAnnounce = announceUpdate ? 'true' : 'false';

    return `
      (function() {
        var runtime = ${payload};
        window.__MYSALES_RUNTIME = runtime;
        window.MYSALES_ID_TOKEN = runtime.idToken || '';
        window.MYSALES_UID = runtime.uid || '';
        window.MYSALES_EMAIL = runtime.email || '';
        window.MYSALES_ROLE = runtime.role || '';
        window.MYSALES_BRANDS = Array.isArray(runtime.brands) ? runtime.brands : [];
        window.MYSALES_DEFAULT_BRAND = runtime.defaultBrand || '';
        window.MYSALES_BFF_BASE_URL = runtime.bffBaseUrl || '';
        window.REACT_NATIVE_WEBVIEW = true;
        window.goBack = function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'NAVIGATE_BACK' }));
        };
        if (${shouldAnnounce}) {
          window.dispatchEvent(new CustomEvent('mysales-runtime-updated', { detail: runtime }));
        }
        console.log('FieldSales Pro runtime injected', {
          uid: window.MYSALES_UID,
          role: window.MYSALES_ROLE,
          brands: window.MYSALES_BRANDS,
          bffBaseUrl: window.MYSALES_BFF_BASE_URL,
        });
      })();
      true;
    `;
  }, []);

  useEffect(() => {
    let active = true;

    const prepareRuntimeContext = async () => {
      if (!moduleAccess.fieldSalesProEnabled || !user) {
        return;
      }

      try {
        setLoading(true);
        const nextRuntimeContext = await buildRuntimeContext(false);
        if (!active) {
          return;
        }
        setRuntimeContext(nextRuntimeContext);
        setError(null);
      } catch (runtimeError) {
        console.error('[FieldSalesPro] Failed to build runtime context:', runtimeError);
        if (active) {
          setError(runtimeError.message || 'Failed to prepare FieldSales Pro session.');
        }
      }
    };

    prepareRuntimeContext();

    return () => {
      active = false;
    };
  }, [buildRuntimeContext, moduleAccess.fieldSalesProEnabled, user]);

  if (!moduleAccess.fieldSalesProEnabled) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Μη διαθέσιμη ενότητα</Text>
        <Text style={styles.errorMessage}>
          Η ενότητα Διαχείριση Επισκέψεων είναι απενεργοποιημένη για τον λογαριασμό σας.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigateToMainHome(navigation) || navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Επιστροφή</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Construct the local file path for the WebView
  const getLocalUri = () => {
    // Try different possible paths based on where the build folder was copied
    if (Platform.OS === 'android') {
      // baseUrl is needed so relative asset paths work correctly
      return 'file:///android_asset/build/index.html';
    } else {
      // iOS - adjust path if needed based on your bundle structure
      return 'file:///build/index.html';
    }
  };
  
  const baseUrl = Platform.OS === 'android' 
    ? 'file:///android_asset/build/' 
    : 'file:///build/';
  
  console.log('[FieldSalesPro] Loading from URI:', getLocalUri());
  console.log('[FieldSalesPro] Base URL:', baseUrl);

  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[FieldSalesPro] Message from WebView:', data);
      
      // Handle specific messages from the web app
      if (data.type === 'NAVIGATE_BACK') {
        navigation.goBack();
        return;
      }

      if (data.type === 'REQUEST_ID_TOKEN') {
        const refreshedRuntimeContext = await buildRuntimeContext(true);
        setRuntimeContext(refreshedRuntimeContext);
        webViewRef.current?.injectJavaScript(
          buildInjectedRuntimeScript(refreshedRuntimeContext, true)
        );
      }
    } catch (err) {
      console.warn('[FieldSalesPro] Failed to parse WebView message:', err);
    }
  };

  const handleError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('[FieldSalesPro] WebView error:', nativeEvent);
    setError(`Failed to load FieldSales Pro.\n\nError: ${nativeEvent.description || nativeEvent.code || 'Unknown'}\n\nPath: ${getLocalUri()}\n\nPlease ensure the build folder is copied correctly to:\nandroid/app/src/main/assets/build/`);
    setLoading(false);
  };

  const handleLoad = () => {
    console.log('[FieldSalesPro] WebView loaded successfully');
    setLoading(false);
    setError(null);
  };
  
  const handleLoadStart = () => {
    console.log('[FieldSalesPro] WebView load started');
    setLoading(true);
  };
  
  const handleLoadEnd = () => {
    console.log('[FieldSalesPro] WebView load ended');
    setLoading(false);
  };

  const handleRetry = async () => {
    try {
      setLoading(true);
      setError(null);
      const refreshedRuntimeContext = await buildRuntimeContext(true);
      setRuntimeContext(refreshedRuntimeContext);
      setWebViewKey((value) => value + 1);
    } catch (retryError) {
      setError(retryError?.message || 'Failed to refresh FieldSales Pro session.');
      setLoading(false);
    }
  };

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to Load FieldSales Pro</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <View style={styles.errorActionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleRetry}>
            <Text style={styles.secondaryButtonText}>Προσπάθεια ξανά</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigateToMainHome(navigation) || navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Αρχική</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!runtimeContext) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Προετοιμασία συνεδρίας FieldSales Pro...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Φόρτωση FieldSales Pro...</Text>
        </View>
      )}
      
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ 
          uri: getLocalUri(),
          baseUrl: baseUrl
        }}
        style={styles.webview}
        injectedJavaScriptBeforeContentLoaded={buildInjectedRuntimeScript(runtimeContext, false)}
        onMessage={handleWebViewMessage}
        onError={handleError}
        onLoad={handleLoad}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        allowFileAccessFromFileURLs={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        startInLoadingState={true}
        onConsoleMessage={(event) => {
          console.log('[FieldSalesPro WebView Console]', event.nativeEvent.message);
        }}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Φόρτωση FieldSales Pro...</Text>
            <Text style={styles.debugText}>{getLocalUri()}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  debugText: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textSecondary,
    opacity: 0.6,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 10,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
