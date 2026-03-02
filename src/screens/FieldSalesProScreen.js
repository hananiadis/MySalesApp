// src/screens/FieldSalesProScreen.js
import React, { useRef, useState } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useAuth } from '../context/AuthProvider';
import colors from '../theme/colors';

export default function FieldSalesProScreen({ navigation }) {
  const { user } = useAuth();
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // Inject Firebase auth token into the WebView for API calls
  const injectedJavaScript = `
    (function() {
      // Store Firebase user info for the web app
      window.FIREBASE_USER_TOKEN = "${user?.uid || ''}";
      window.FIREBASE_USER_EMAIL = "${user?.email || ''}";
      
      // Signal that the app is ready
      window.REACT_NATIVE_WEBVIEW = true;
      
      // Handle back navigation from WebView
      window.goBack = function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'NAVIGATE_BACK' }));
      };
      
      console.log('FieldSales Pro: Firebase user injected', window.FIREBASE_USER_TOKEN);
    })();
    true; // Required for iOS
  `;

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[FieldSalesPro] Message from WebView:', data);
      
      // Handle specific messages from the web app
      if (data.type === 'NAVIGATE_BACK') {
        navigation.goBack();
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

  if (error) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to Load FieldSales Pro</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading FieldSales Pro...</Text>
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        source={{ 
          uri: getLocalUri(),
          baseUrl: baseUrl
        }}
        style={styles.webview}
        injectedJavaScript={injectedJavaScript}
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
            <Text style={styles.loadingText}>Loading FieldSales Pro...</Text>
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
  debugText: {
    marginTop: 8,
    fontSize: 11,
    color: colors.textSecondary,
    opacity: 0.6,
  },
    backgroundColor: colors.background,
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
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
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
