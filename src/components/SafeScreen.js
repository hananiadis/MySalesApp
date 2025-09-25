// src/components/SafeScreen.js
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import GlobalUserMenu from './GlobalUserMenu';

/**
 * Reusable safe-area screen wrapper with a centered header title.
 *
 * Props:
 * - title: string (centered header text)
 * - headerLeft: ReactNode (optional)
 * - headerRight: ReactNode | ReactNode[] (optional, rendered in a row)
 * - scroll: boolean (wrap content in ScrollView if true)
 * - style: style override for SafeAreaView container
 * - bodyStyle: style override for the body View/ScrollView
 * - contentContainerStyle: ScrollView content style when scroll is true
 * - showUserMenu: boolean (defaults to true)
 * - children
 */
export default function SafeScreen({
  title = '',
  headerLeft = null,
  headerRight = null,
  scroll = false,
  style,
  bodyStyle,
  contentContainerStyle,
  showUserMenu = true,
  children,
}) {
  const insets = useSafeAreaInsets();
  const Content = scroll ? ScrollView : View;
  const actions = React.Children.toArray(headerRight).filter(Boolean);

  if (showUserMenu) {
    actions.push(<GlobalUserMenu key="global-user-menu" />);
  }

  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <SafeAreaView style={[styles.root, style]} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerSide}>{headerLeft}</View>
        <View style={styles.headerCenter}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.headerTitle}>
            {title}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {actions.map((action, index) => {
            const key = action && typeof action === 'object' && 'key' in action && action.key != null
              ? action.key
              : `action-${index}`;
            return (
              <View key={key} style={styles.headerActionSlot}>
                {action}
              </View>
            );
          })}
        </View>
      </View>

      <Content
        style={[
          styles.body,
          !scroll && { paddingBottom: bottomPadding },
          bodyStyle,
        ]}
        contentContainerStyle={
          scroll
            ? [styles.scrollContent, { paddingBottom: bottomPadding }, contentContainerStyle]
            : undefined
        }
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Content>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f8fa' },
  header: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e6eef7',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerSide: {
    minWidth: 56,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 56,
    marginLeft: 8,
  },
  headerActionSlot: { marginLeft: 8 },
  body: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
  },
});
