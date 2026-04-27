import React, { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import CurvedBottomBar from '../components/CurvedBottomBar';
import ExpenseTrackerScreen from '../screens/ExpenseTrackerScreen';
import ExpenseReportsScreen from '../screens/ExpenseReportsScreen';
import WeeklyTrackingScreen from '../screens/WeeklyTrackingScreen';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import ManagerInboxScreen from '../screens/ManagerInboxScreen';
import ManagerWeeklyReportScreen from '../screens/ManagerWeeklyReportScreen';
import { useExpense } from '../context/ExpenseContext';
import { isExpenseApproverRole } from '../constants/roles';

const Tab = createBottomTabNavigator();

const LABELS = {
  tracker: 'Εξοδολόγιο',
  reports: 'Αναφορές',
  tracking: 'Καταγραφή',
  weekly: 'Εβδομάδα',
  inbox: 'Εισερχόμενα',
  manager: 'Ομάδα',
};

const iconForRoute = (name, focused, color, size) => {
  const map = {
    ExpenseTracker: focused ? 'wallet' : 'wallet-outline',
    ExpenseReports: focused ? 'document-text' : 'document-text-outline',
    WeeklyTracking: focused ? 'calendar' : 'calendar-outline',
    WeeklyReport: focused ? 'file-tray-full' : 'file-tray-full-outline',
    ManagerInbox: focused ? 'mail' : 'mail-outline',
    ManagerWeeklyReport: focused ? 'people' : 'people-outline',
  };

  return <Ionicons name={map[name] || 'ellipse-outline'} size={size} color={color} />;
};

export default function ExpenseTabsNavigator() {
  const { userRole } = useExpense();
  const canManageExpenses = isExpenseApproverRole(userRole);

  const layoutStrategy = useCallback((routes) => {
    const leftCount = Math.ceil(routes.length / 2);
    return {
      leftRoutes: routes.slice(0, leftCount),
      rightRoutes: routes.slice(leftCount),
    };
  }, []);

  return (
    <Tab.Navigator
      initialRouteName="ExpenseTracker"
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
      tabBar={(props) => (
        <CurvedBottomBar
          {...props}
          fab={{
            icon: 'add',
            onPress: () => props.navigation.navigate('ExpenseTracker', { openAddMenu: true }),
            accessibilityLabel: 'Προσθήκη εξόδου',
            testID: 'expense-fab',
          }}
          layoutStrategy={layoutStrategy}
          testIDPrefix="expense"
        />
      )}
    >
      <Tab.Screen
        name="ExpenseTracker"
        component={ExpenseTrackerScreen}
        options={{
          tabBarLabel: LABELS.tracker,
          tabBarVisible: true,
          tabBarIcon: ({ color, size, focused }) => iconForRoute('ExpenseTracker', focused, color, size),
          unmountOnBlur: false,
        }}
      />
      <Tab.Screen
        name="ExpenseReports"
        component={ExpenseReportsScreen}
        options={{
          tabBarLabel: LABELS.reports,
          tabBarVisible: true,
          tabBarIcon: ({ color, size, focused }) => iconForRoute('ExpenseReports', focused, color, size),
          unmountOnBlur: false,
        }}
      />
      <Tab.Screen
        name="WeeklyTracking"
        component={WeeklyTrackingScreen}
        options={{
          tabBarLabel: LABELS.tracking,
          tabBarVisible: true,
          tabBarIcon: ({ color, size, focused }) => iconForRoute('WeeklyTracking', focused, color, size),
          unmountOnBlur: false,
        }}
      />
      <Tab.Screen
        name="WeeklyReport"
        component={WeeklyReportScreen}
        options={{
          tabBarLabel: LABELS.weekly,
          tabBarVisible: true,
          tabBarIcon: ({ color, size, focused }) => iconForRoute('WeeklyReport', focused, color, size),
          unmountOnBlur: false,
        }}
      />

      {canManageExpenses ? (
        <Tab.Screen
          name="ManagerInbox"
          component={ManagerInboxScreen}
          options={{
            tabBarLabel: LABELS.inbox,
            tabBarVisible: true,
            tabBarIcon: ({ color, size, focused }) => iconForRoute('ManagerInbox', focused, color, size),
            unmountOnBlur: false,
          }}
        />
      ) : null}

      {canManageExpenses ? (
        <Tab.Screen
          name="ManagerWeeklyReport"
          component={ManagerWeeklyReportScreen}
          options={{
            tabBarLabel: LABELS.manager,
            tabBarVisible: true,
            tabBarIcon: ({ color, size, focused }) => iconForRoute('ManagerWeeklyReport', focused, color, size),
            unmountOnBlur: false,
          }}
        />
      ) : null}
    </Tab.Navigator>
  );
}
