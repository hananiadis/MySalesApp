// src/components/CurvedBottomBar.js
// Custom curved bottom navigation bar shared between main and brand navigators.
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Path } from 'react-native-svg';

import colors from '../theme/colors';

const DEFAULT_FAB_SIZE = 68;
const MAX_BAR_WIDTH = 720;

const DEFAULT_LAYOUT = (routes) => {
  const splitIndex = Math.ceil(routes.length / 2);
  return {
    leftRoutes: routes.slice(0, splitIndex),
    rightRoutes: routes.slice(splitIndex),
  };
};

const getOptionLabel = (route, options) => {
  if (typeof options.tabBarLabel === 'string') {
    return options.tabBarLabel;
  }
  if (typeof options.title === 'string') {
    return options.title;
  }
  return route.name;
};

const getIconFromOptions = (options, { focused, color, size }) => {
  if (typeof options.tabBarIcon === 'function') {
    return options.tabBarIcon({ focused, color, size });
  }
  return null;
};

export default function CurvedBottomBar({
  state,
  descriptors,
  navigation,
  fab,
  layoutStrategy,
  activeColor = colors.tabActive,
  inactiveColor = colors.tabInactive,
  barStyle,
  testIDPrefix = 'tab',
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 700;

  const visibleRoutes = useMemo(
    () =>
      state.routes.filter((route) => {
        const options = descriptors[route.key]?.options || {};
        return options.tabBarVisible !== false;
      }),
    [descriptors, state.routes]
  );

  const { leftRoutes, rightRoutes } = useMemo(() => {
    if (typeof layoutStrategy === 'function') {
      return layoutStrategy(visibleRoutes, { isTablet });
    }
    return DEFAULT_LAYOUT(visibleRoutes);
  }, [layoutStrategy, visibleRoutes, isTablet]);

  const barWidth = Math.min(screenWidth * 0.96, MAX_BAR_WIDTH);
  const hasFab = Boolean(fab);
  const fabSize = hasFab ? fab?.size || DEFAULT_FAB_SIZE : DEFAULT_FAB_SIZE;
  const notchDepth = hasFab ? fabSize / 2 + 12 : 0;
  const barHeight = 74 + Math.max(insets.bottom, 12);
  const svgHeight = barHeight + notchDepth + 12;
  const notchWidth = hasFab ? fabSize + 28 : 0;
  const radius = 26;

  const centerX = barWidth / 2;
  const maxNotchHalfWidth = Math.max(
    42,
    Math.min((barWidth / 2) - (radius + 16), notchWidth / 2)
  );
  const notchHalfWidth = hasFab ? Math.min(notchWidth / 2, maxNotchHalfWidth) : 0;
  const notchLeft = centerX - notchHalfWidth;
  const notchRight = centerX + notchHalfWidth;

  const horizontalPadding = Math.max(12, Math.min(24, screenWidth * 0.04));
  const pathD = hasFab
    ? `
      M0,${radius}
      Q0,0 ${radius},0
      L${notchLeft},0
      C${notchLeft + 18},0 ${centerX - 10},-${notchDepth} ${centerX},-${notchDepth}
      C${centerX + 10},-${notchDepth} ${notchRight - 18},0 ${notchRight},0
      L${barWidth - radius},0
      Q${barWidth},0 ${barWidth},${radius}
      L${barWidth},${svgHeight}
      L0,${svgHeight}
      Z
    `
    : `
      M0,${radius}
      Q0,0 ${radius},0
      L${barWidth - radius},0
      Q${barWidth},0 ${barWidth},${radius}
      L${barWidth},${svgHeight}
      L0,${svgHeight}
      Z
    `;

  const fabBottom = insets.bottom + 24;

  const handleTabPress = (route, isFocused) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    }
  };

  const renderRoute = (route, index) => {
    const options = descriptors[route.key]?.options || {};
    const isFocused = state.index === state.routes.indexOf(route);
    const color = isFocused ? activeColor : inactiveColor;
    const label = getOptionLabel(route, options);
    const icon =
      getIconFromOptions(options, {
        focused: isFocused,
        color,
        size: 24,
      }) || (
        <Ionicons
          name="ellipse-outline"
          size={22}
          color={color}
        />
      );

    const onPress = () => handleTabPress(route, isFocused);

    return (
      <TouchableOpacity
        key={route.key}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        testID={options.tabBarTestID ?? `${testIDPrefix}-${route.name}`}
        style={[
          styles.tabButton,
          isFocused && styles.tabButtonActive,
        ]}
      >
        {icon}
        <Text
          style={[
            styles.tabLabel,
            { color },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        { paddingBottom: Math.max(insets.bottom, 12) },
        barStyle,
      ]}
    >
      <View
        style={[
          styles.barContainer,
          { width: barWidth, height: barHeight },
        ]}
      >
        <Svg
          width={barWidth}
          height={svgHeight}
          style={[
            styles.svg,
            { top: hasFab ? -notchDepth : 0 },
          ]}
        >
          <Path d={pathD} fill={colors.white} />
        </Svg>

        <View
          style={[
            styles.tabRow,
            { paddingHorizontal: horizontalPadding },
          ]}
        >
          <View style={[styles.sideGroup, styles.leftGroup]}>
            {leftRoutes.map(renderRoute)}
          </View>
          {hasFab ? (
            <View style={[styles.centerSpacer, { width: fabSize + 24 }]} />
          ) : (
            <View style={styles.spacer} />
          )}
          <View style={[styles.sideGroup, styles.rightGroup]}>
            {rightRoutes.map(renderRoute)}
          </View>
        </View>
      </View>

      {hasFab ? (
        <TouchableOpacity
          style={[
            styles.fab,
            {
              width: fabSize,
              height: fabSize,
              borderRadius: fabSize / 2,
              bottom: fabBottom,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={fab.accessibilityLabel ?? 'Primary action'}
          onPress={fab.onPress}
          activeOpacity={0.9}
          testID={fab.testID ?? 'curved-fab'}
        >
          <Ionicons
            name={fab?.icon ?? 'add'}
            size={fab?.iconSize ?? 30}
            color={colors.white}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  svg: {
    position: 'absolute',
    left: 0,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingTop: 18,
    paddingBottom: 10,
  },
  sideGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  leftGroup: {
    justifyContent: 'flex-end',
  },
  rightGroup: {
    justifyContent: 'flex-start',
  },
  spacer: {
    width: 24,
  },
  centerSpacer: {
    flexShrink: 0,
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    paddingHorizontal: 4,
    flexShrink: 1,
  },
  tabButtonActive: {
    transform: [{ translateY: -2 }],
  },
  tabLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 12,
  },
});
