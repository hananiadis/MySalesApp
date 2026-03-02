import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from './firebase';
import auth from '@react-native-firebase/auth';
import {
  EXPENSE_STATUS,
  EXPENSE_CURRENCY,
  INVOICE_TYPES,
  getWeekId,
  getWeekStartEnd,
  getMondayFromWeekId,
  calculateBusinessKm,
  calculateRemainingPettyCash
} from '../constants/expenseConstants';

// Firestore helpers
const Timestamp = firestore.Timestamp;
const expenseCollectionRef = (userId) =>
  firestore().collection('expenses').doc(userId).collection('records');
const weeklyTrackingCollectionRef = (userId) =>
  firestore().collection('weeklyTracking').doc(userId).collection('weeks');
const weeklyReportSubmissionsCollectionRef = () =>
  firestore().collection('weeklyReportSubmissions');
const weeklyReportSeriesCollectionRef = () =>
  firestore().collection('weeklyReportSeries');

const EXPENSES_CACHE_KEY = '@expenses_';
const WEEKLY_TRACKING_CACHE_KEY = '@weekly_tracking_';
const OFFLINE_QUEUE_KEY = '@offline_queue_';

/**
 * EXPENSE CRUD OPERATIONS
 */

/**
 * Add a new expense
 * @param {string} userId - User ID
 * @param {Object} expenseData - { category, amount, description, date, status }
 * @returns {Promise<Object>} Created expense with ID
 */
export const addExpense = async (userId, expenseData) => {
  try {
    const ref = expenseCollectionRef(userId).doc();
    const expenseId = ref.id;
    const expense = {
      id: expenseId,
      userId,
      category: expenseData.category,
      amount: parseFloat(expenseData.amount),
      currency: EXPENSE_CURRENCY,
      description: expenseData.description || '',
      date: new Date(expenseData.date),
      status: expenseData.status || EXPENSE_STATUS.DRAFT,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await ref.set({
      ...expense,
      date: Timestamp.fromDate(expense.date),
      createdAt: Timestamp.fromDate(expense.createdAt),
      updatedAt: Timestamp.fromDate(expense.updatedAt)
    });

    await updateExpenseCache(userId, expense, 'add');

    return expense;
  } catch (error) {
    console.error('Error adding expense:', error);
    throw error;
  }
};

/**
 * Update an existing expense
 * @param {string} userId - User ID
 * @param {string} expenseId - Expense ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated expense
 */
export const updateExpense = async (userId, expenseId, updates) => {
  try {
    const updateData = {
      ...updates,
      updatedAt: Timestamp.fromDate(new Date())
    };

    // Convert date to Timestamp if it exists
    if (updates.date) {
      updateData.date = Timestamp.fromDate(new Date(updates.date));
    }

    // Convert amount to float if it exists
    if (updates.amount) {
      updateData.amount = parseFloat(updates.amount);
    }

    await expenseCollectionRef(userId).doc(expenseId).update(updateData);

    const updatedExpense = await getExpense(userId, expenseId);
    return updatedExpense;
  } catch (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
};

/**
 * Delete an expense
 * @param {string} userId - User ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<void>}
 */
export const deleteExpense = async (userId, expenseId) => {
  try {
    await expenseCollectionRef(userId).doc(expenseId).delete();

    await updateExpenseCache(userId, { id: expenseId }, 'delete');
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
};

/**
 * Get a single expense by ID
 * @param {string} userId - User ID
 * @param {string} expenseId - Expense ID
 * @returns {Promise<Object>} Expense object
 */
export const getExpense = async (userId, expenseId) => {
  try {
    const docSnap = await expenseCollectionRef(userId).doc(expenseId).get();

    if (docSnap.exists) {
      return convertFirestoreExpense({ id: expenseId, ...docSnap.data() });
    }
    return null;
  } catch (error) {
    console.error('Error fetching expense:', error);
    throw error;
  }
};

/**
 * Get all expenses for a user within a date range
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of expenses
 */
export const getExpensesByDateRange = async (userId, startDate, endDate) => {
  try {
    const snapshot = await expenseCollectionRef(userId)
      .where('date', '>=', Timestamp.fromDate(startDate))
      .where('date', '<=', Timestamp.fromDate(endDate))
      .orderBy('date', 'desc')
      .get();

    const expenses = [];
    snapshot.forEach((docSnap) => {
      expenses.push(convertFirestoreExpense({ id: docSnap.id, ...docSnap.data() }));
    });

    return expenses;
  } catch (error) {
    console.error('Error fetching expenses by date range:', error);
    throw error;
  }
};

/**
 * Get expenses filtered by category within a date range
 * @param {string} userId - User ID
 * @param {string} categoryId - Category ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of expenses
 */
export const getExpensesByCategory = async (userId, categoryId, startDate, endDate) => {
  try {
    const snapshot = await expenseCollectionRef(userId)
      .where('category', '==', categoryId)
      .where('date', '>=', Timestamp.fromDate(startDate))
      .where('date', '<=', Timestamp.fromDate(endDate))
      .orderBy('date', 'desc')
      .get();

    const expenses = [];
    snapshot.forEach((docSnap) => {
      expenses.push(convertFirestoreExpense({ id: docSnap.id, ...docSnap.data() }));
    });

    return expenses;
  } catch (error) {
    console.error('Error fetching expenses by category:', error);
    throw error;
  }
};

/**
 * Get expenses for a specific week
 * @param {string} userId - User ID
 * @param {Date} weekStartDate - Monday of the week
 * @returns {Promise<Array>} Array of expenses
 */
export const getExpensesByWeek = async (userId, weekStartDate) => {
  try {
    const { start, end } = getWeekStartEnd(weekStartDate);
    return await getExpensesByDateRange(userId, start, end);
  } catch (error) {
    console.error('Error fetching expenses by week:', error);
    throw error;
  }
};

/**
 * WEEKLY TRACKING OPERATIONS
 */

/**
 * Save or update weekly tracking data
 * @param {string} userId - User ID
 * @param {string} weekId - Week ID (format: "2026-W03")
 * @param {Object} trackingData - { mileage, pettyCash, locations }
 * @returns {Promise<Object>} Saved tracking data with calculated fields
 */
export const saveWeeklyTracking = async (userId, weekId, trackingData) => {
  try {
    const weekStartDate = getMondayFromWeekId(weekId);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);

    // Preserve server-driven fields (status, review notes, createdAt)
    const existingSnap = await weeklyTrackingCollectionRef(userId).doc(weekId).get();
    const existing = existingSnap.exists ? (existingSnap.data() || {}) : {};
    const existingStatus = existing.status || EXPENSE_STATUS.DRAFT;
    const existingCreatedAt = existing.createdAt?.toDate ? existing.createdAt.toDate() : null;
    const existingReview = existing.review || null;

    const businessKm = calculateBusinessKm(trackingData.mileage);

    const given = parseFloat(trackingData?.pettyCash?.given) || 0;
    const previousBalance =
      parseFloat(trackingData?.pettyCash?.previousBalance) ||
      parseFloat(trackingData?.pettyCash?.previous) ||
      0;
    const spentCash =
      parseFloat(trackingData?.pettyCash?.spentCash) ||
      parseFloat(trackingData?.pettyCash?.spent) ||
      0;
    const invoiceTotal = parseFloat(trackingData?.pettyCash?.invoiceTotal) || 0;
    const receiptTotal = parseFloat(trackingData?.pettyCash?.receiptTotal) || 0;

    const tracking = {
      id: weekId,
      userId,
      weekId,
      weekStartDate,
      weekEndDate,
      status: trackingData?.status || existingStatus,
      review: trackingData?.review || existingReview || null,
      mileage: {
        startKm: parseFloat(trackingData.mileage.startKm),
        endKm: parseFloat(trackingData.mileage.endKm),
        privateKm: parseFloat(trackingData.mileage.privateKm),
        carId: trackingData?.mileage?.carId || null,
        businessKm
      },
      pettyCash: {
        previousBalance,
        given,
        spentCash,
        // keep legacy field name for compatibility
        spent: spentCash,
        invoiceTotal,
        receiptTotal,
        remaining: calculateRemainingPettyCash(given, spentCash, previousBalance)
      },
      locations: trackingData.locations || {},
      createdAt: existingCreatedAt || new Date(),
      updatedAt: new Date()
    };

    await weeklyTrackingCollectionRef(userId).doc(weekId).set(
      {
      ...tracking,
      weekStartDate: Timestamp.fromDate(tracking.weekStartDate),
      weekEndDate: Timestamp.fromDate(tracking.weekEndDate),
      createdAt: Timestamp.fromDate(tracking.createdAt),
      updatedAt: Timestamp.fromDate(tracking.updatedAt)
      },
      { merge: true }
    );

    await updateWeeklyTrackingCache(userId, tracking, 'save');

    return tracking;
  } catch (error) {
    console.error('Error saving weekly tracking:', error);
    throw error;
  }
};

/**
 * Get weekly tracking data for a specific week
 * @param {string} userId - User ID
 * @param {string} weekId - Week ID (format: "2026-W03")
 * @returns {Promise<Object>} Tracking data or null
 */
export const getWeeklyTracking = async (userId, weekId) => {
  try {
    const docSnap = await weeklyTrackingCollectionRef(userId).doc(weekId).get();

    if (docSnap.exists) {
      return convertFirestoreTracking({ id: weekId, ...docSnap.data() });
    }
    return null;
  } catch (error) {
    console.error('Error fetching weekly tracking:', error);
    throw error;
  }
};

/**
 * Get weekly tracking data within a date range
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of tracking data
 */
export const getWeeklyTrackingByDateRange = async (userId, startDate, endDate) => {
  try {
    const snapshot = await weeklyTrackingCollectionRef(userId)
      .where('weekStartDate', '>=', Timestamp.fromDate(startDate))
      .where('weekStartDate', '<=', Timestamp.fromDate(endDate))
      .orderBy('weekStartDate', 'desc')
      .get();

    const trackingData = [];
    snapshot.forEach((docSnap) => {
      trackingData.push(convertFirestoreTracking({ id: docSnap.id, ...docSnap.data() }));
    });

    return trackingData;
  } catch (error) {
    console.error('Error fetching weekly tracking by date range:', error);
    throw error;
  }
};

/**
 * AGGREGATION & ANALYTICS
 */

/**
 * Get expense summary by group within a date range
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Summary object { groupName: totalAmount, ... }
 */
export const getExpenseSummaryByGroup = async (userId, startDate, endDate) => {
  try {
    const expenses = await getExpensesByDateRange(userId, startDate, endDate);
    const summary = {};

    expenses.forEach(expense => {
      const { getCategoryGroup } = require('../constants/expenseConstants');
      const group = getCategoryGroup(expense.category);
      summary[group] = (summary[group] || 0) + expense.amount;
    });

    return summary;
  } catch (error) {
    console.error('Error calculating expense summary by group:', error);
    throw error;
  }
};

/**
 * Get expense summary by category within a date range
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Summary object { categoryId: totalAmount, ... }
 */
export const getExpenseSummaryByCategory = async (userId, startDate, endDate) => {
  try {
    const expenses = await getExpensesByDateRange(userId, startDate, endDate);
    const summary = {};

    expenses.forEach(expense => {
      summary[expense.category] = (summary[expense.category] || 0) + expense.amount;
    });

    return summary;
  } catch (error) {
    console.error('Error calculating expense summary by category:', error);
    throw error;
  }
};

/**
 * Get daily expense totals within a date range
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Summary object { "YYYY-MM-DD": totalAmount, ... }
 */
export const getExpenseSummaryByDay = async (userId, startDate, endDate) => {
  try {
    const expenses = await getExpensesByDateRange(userId, startDate, endDate);
    const summary = {};

    expenses.forEach(expense => {
      const dateKey = expense.date.toISOString().split('T')[0];
      summary[dateKey] = (summary[dateKey] || 0) + expense.amount;
    });

    return summary;
  } catch (error) {
    console.error('Error calculating expense summary by day:', error);
    throw error;
  }
};

/**
 * Get comprehensive report data for a week (expenses + tracking)
 * @param {string} userId - User ID
 * @param {Date} weekStartDate - Monday of the week
 * @returns {Promise<Object>} Report object with expenses and tracking
 */
export const getWeeklyReport = async (userId, weekStartDate) => {
  try {
    const weekId = getWeekId(weekStartDate);
    const { getCategoryGroup, getCategoryLabel } = require('../constants/expenseConstants');

    const expenses = await getExpensesByWeek(userId, weekStartDate);
    const tracking = await getWeeklyTracking(userId, weekId);

    // Organize expenses by group and category
    const expensesByGroup = {};
    const expensesByDay = {};
    let totalAmount = 0;

    expenses.forEach(expense => {
      const group = getCategoryGroup(expense.category);
      const dateKey = expense.date.toISOString().split('T')[0];

      if (!expensesByGroup[group]) {
        expensesByGroup[group] = [];
      }
      expensesByGroup[group].push(expense);

      if (!expensesByDay[dateKey]) {
        expensesByDay[dateKey] = [];
      }
      expensesByDay[dateKey].push(expense);

      totalAmount += expense.amount;
    });

    return {
      weekId,
      weekStartDate,
      expenses,
      expensesByGroup,
      expensesByDay,
      tracking,
      totalAmount,
      expenseCount: expenses.length
    };
  } catch (error) {
    console.error('Error fetching weekly report:', error);
    throw error;
  }
};

/**
 * Submit a weekly report to the manager(s) assigned to the user.
 * Creates/updates a submission document and marks weekly expenses/tracking as submitted.
 *
 * Firestore layout:
 * weeklyReportSubmissions/{userId}_{weekId}
 *   - managerIds: string[]
 *   - salesmanId: string
 *   - weekId: string
 *   - weekStartDate, weekEndDate: Timestamp
 *   - summary: { totalAmount, expenseCount, businessKm, pettyCashRemaining }
 *   - status: 'submitted'
 *   - submittedAt: Timestamp
 *   - updatedAt: Timestamp
 */
export const submitWeeklyReport = async (userId, weekId) => {
  try {
    const weekStartDate = getMondayFromWeekId(weekId);
    const { start, end } = getWeekStartEnd(weekStartDate);
    const submittedAt = new Date();

    // Generate report data (used only for summary)
    const report = await getWeeklyReport(userId, weekStartDate);

    const weeklyExpenses = Array.isArray(report?.expenses) ? report.expenses : [];
    const invoiceExpenses = weeklyExpenses.filter(
      (e) => (e?.invoiceType || INVOICE_TYPES.RECEIPT) === INVOICE_TYPES.INVOICE
    );
    const receiptExpenses = weeklyExpenses.filter(
      (e) => (e?.invoiceType || INVOICE_TYPES.RECEIPT) === INVOICE_TYPES.RECEIPT
    );
    const invoiceTotal = invoiceExpenses.reduce((sum, e) => sum + (Number(e?.amount) || 0), 0);
    const receiptTotal = receiptExpenses.reduce((sum, e) => sum + (Number(e?.amount) || 0), 0);
    const invoiceCount = invoiceExpenses.length;
    const receiptCount = receiptExpenses.length;

    // Fetch assigned managers from user profile
    const userSnap = await firestore().collection('users').doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : null;
    const managerIdsFromProfile = Array.isArray(userData?.managers) ? userData.managers : [];

    // Sales managers can be their own expense managers
    const isSalesManager = userData?.role === 'sales_manager';
    const managerIds = Array.from(
      new Set([
        ...managerIdsFromProfile,
        ...(isSalesManager ? [userId] : [])
      ].filter(Boolean))
    );

    // Mark all expenses for this week as submitted
    const expensesSnap = await expenseCollectionRef(userId)
      .where('date', '>=', Timestamp.fromDate(start))
      .where('date', '<=', Timestamp.fromDate(end))
      .get();

    const expenseDocs = expensesSnap.docs || [];
    for (let i = 0; i < expenseDocs.length; i += 450) {
      const chunk = expenseDocs.slice(i, i + 450);
      const batch = firestore().batch();
      chunk.forEach((doc) => {
        batch.update(doc.ref, {
          status: EXPENSE_STATUS.SUBMITTED,
          review: firestore.FieldValue.delete(),
          submittedAt: Timestamp.fromDate(submittedAt),
          updatedAt: Timestamp.fromDate(submittedAt)
        });
      });
      await batch.commit();
    }

    // Mark tracking as submitted (merge-safe)
    await weeklyTrackingCollectionRef(userId)
      .doc(weekId)
      .set(
        {
          status: EXPENSE_STATUS.SUBMITTED,
          review: firestore.FieldValue.delete(),
          submittedAt: Timestamp.fromDate(submittedAt),
          updatedAt: Timestamp.fromDate(submittedAt)
        },
        { merge: true }
      );

    // Create/Update submission doc (idempotent)
    const submissionId = `${userId}_${weekId}`;
    const submission = {
      id: submissionId,
      weekId,
      salesmanId: userId,
      managerIds,
      status: EXPENSE_STATUS.SUBMITTED,
      weekStartDate: Timestamp.fromDate(start),
      weekEndDate: Timestamp.fromDate(end),
      submittedAt: Timestamp.fromDate(submittedAt),
      updatedAt: Timestamp.fromDate(submittedAt),
      summary: {
        totalAmount: report?.totalAmount || 0,
        expenseCount: report?.expenseCount || 0,
        businessKm: report?.tracking?.mileage?.businessKm || 0,
        pettyCashRemaining: report?.tracking?.pettyCash?.remaining || 0,
        invoiceTotal,
        receiptTotal,
        invoiceCount,
        receiptCount
      }
    };

    await weeklyReportSubmissionsCollectionRef().doc(submissionId).set(submission, { merge: true });

    return submission;
  } catch (error) {
    console.error('Error submitting weekly report:', error);
    throw error;
  }
};

/**
 * Get weekly report submissions visible to a manager (inbox).
 * @param {string} managerId
 * @returns {Promise<Array>} submissions
 */
export const getManagerWeeklyReportSubmissions = async (managerId) => {
  try {
    const authUid = auth()?.currentUser?.uid || null;
    const authEmail = auth()?.currentUser?.email || null;
    const projectId = firestore()?.app?.options?.projectId || null;
    const appName = firestore()?.app?.name || null;

    if (__DEV__) {
      console.log('[expenseService] getManagerWeeklyReportSubmissions:start', {
        managerId,
        authUid,
        authEmail,
        projectId,
        appName,
        managerIdMatchesAuthUid: Boolean(authUid && managerId && authUid === managerId),
      });
      if (authUid && managerId && authUid !== managerId) {
        console.warn('[expenseService] getManagerWeeklyReportSubmissions:uid-mismatch', {
          managerId,
          authUid,
        });
      }
    }

    const snapshot = await weeklyReportSubmissionsCollectionRef()
      .where('managerIds', 'array-contains', managerId)
      .get();

    const submissions = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      submissions.push({ id: docSnap.id, ...data });
    });

    // Sort newest first (client-side to avoid composite index requirements)
    submissions.sort((a, b) => {
      const aTime = a.submittedAt?.toDate ? a.submittedAt.toDate().getTime() : new Date(a.submittedAt || 0).getTime();
      const bTime = b.submittedAt?.toDate ? b.submittedAt.toDate().getTime() : new Date(b.submittedAt || 0).getTime();
      return bTime - aTime;
    });

    if (__DEV__) {
      console.log('[expenseService] getManagerWeeklyReportSubmissions:success', {
        count: submissions.length,
        managerId,
        authUid,
      });
    }

    return submissions;
  } catch (error) {
    const authUid = auth()?.currentUser?.uid || null;
    const authEmail = auth()?.currentUser?.email || null;
    const projectId = firestore()?.app?.options?.projectId || null;
    const appName = firestore()?.app?.name || null;
    const code = error?.code;

    // Always log permission-denied context (even in release) so adb can capture it.
    if (code === 'firestore/permission-denied') {
      console.error('[expenseService] getManagerWeeklyReportSubmissions:PERMISSION_DENIED', {
        managerId,
        authUid,
        authEmail,
        projectId,
        appName,
        managerIdMatchesAuthUid: Boolean(authUid && managerId && authUid === managerId),
        message: error?.message,
      });

      // Probe whether single-doc GET is allowed by the currently deployed rules.
      // If this also fails with PERMISSION_DENIED, then the published rules likely
      // do not include `allow get: if isSignedIn();` for weeklyReportSubmissions.
      try {
        // NOTE: Avoid ids starting with '__' since some SDKs treat those as reserved.
        const probeId = 'permissionProbe';
        const probeSnap = await weeklyReportSubmissionsCollectionRef().doc(String(probeId)).get();
        console.error('[expenseService] weeklyReportSubmissions:get-probe', {
          probeId,
          exists: probeSnap?.exists === true,
          projectId,
          appName,
        });
      } catch (probeErr) {
        console.error('[expenseService] weeklyReportSubmissions:get-probe:FAILED', {
          probeId: 'permissionProbe',
          code: probeErr?.code,
          message: probeErr?.message,
          projectId,
          appName,
        });
      }
    } else if (__DEV__) {
      console.warn('[expenseService] getManagerWeeklyReportSubmissions:error', {
        code,
        message: error?.message,
        managerId,
        authUid,
      });
    }

    console.error('Error fetching manager weekly report submissions:', error);
    throw error;
  }
};

/**
 * Get weekly report submissions for a specific week (admin/owner view).
 * @param {string} weekId
 * @returns {Promise<Array>} submissions
 */
export const getWeeklyReportSubmissionsByWeekId = async (weekId) => {
  try {
    if (!weekId) return [];

    if (__DEV__) {
      console.log('[expenseService] getWeeklyReportSubmissionsByWeekId:start', { weekId });
    }

    const snapshot = await weeklyReportSubmissionsCollectionRef()
      .where('weekId', '==', weekId)
      .get();

    const submissions = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      submissions.push({ id: docSnap.id, ...data });
    });

    submissions.sort((a, b) => {
      const aTime = a.submittedAt?.toDate ? a.submittedAt.toDate().getTime() : new Date(a.submittedAt || 0).getTime();
      const bTime = b.submittedAt?.toDate ? b.submittedAt.toDate().getTime() : new Date(b.submittedAt || 0).getTime();
      return bTime - aTime;
    });

    if (__DEV__) {
      console.log('[expenseService] getWeeklyReportSubmissionsByWeekId:success', { count: submissions.length });
    }

    return submissions;
  } catch (error) {
    if (__DEV__) {
      console.warn('[expenseService] getWeeklyReportSubmissionsByWeekId:error', {
        code: error?.code,
        message: error?.message,
        weekId,
      });
    }
    console.error('Error fetching weekly report submissions by weekId:', error);
    throw error;
  }
};

/**
 * Approve a submitted weekly report.
 * Updates submission doc + marks salesman weekly expenses and tracking as approved.
 * @param {Object} params
 * @param {string} params.managerId
 * @param {string} params.salesmanId
 * @param {string} params.weekId
 */
export const approveWeeklyReportSubmission = async ({ managerId, salesmanId, weekId }) => {
  try {
    const weekStartDate = getMondayFromWeekId(weekId);
    const { start, end } = getWeekStartEnd(weekStartDate);
    const approvedAt = new Date();

    if (!managerId) throw new Error('Missing managerId');
    if (!salesmanId) throw new Error('Missing salesmanId');
    if (!weekId) throw new Error('Missing weekId');

    const seriesYear = Number(String(weekId).split('-')[0]) || approvedAt.getFullYear();
    const submissionId = `${salesmanId}_${weekId}`;
    const submissionRef = weeklyReportSubmissionsCollectionRef().doc(submissionId);

    // Allocate an annual sequential code per approver (letter + number), idempotent if already assigned.
    const seriesResult = await firestore().runTransaction(async (tx) => {
      const [submissionSnap, managerSnap] = await Promise.all([
        tx.get(submissionRef),
        tx.get(firestore().collection('users').doc(managerId)),
      ]);

      const submissionData = submissionSnap.exists ? (submissionSnap.data() || {}) : {};
      const existingCode = submissionData.seriesCode || submissionData.reportCode || '';
      const existingApprovedAt = submissionData.approvedAt || null;
      const existingApprovedBy = submissionData.approvedBy || null;

      const letterFromManager = (managerSnap.exists ? (managerSnap.data()?.reportSeriesLetter || managerSnap.data()?.seriesLetter) : null);
      const fallbackLetter = (String(letterFromManager || 'A').trim().toUpperCase().slice(0, 1) || 'A');

      if (existingCode) {
        tx.set(
          submissionRef,
          {
            status: EXPENSE_STATUS.APPROVED,
            review: firestore.FieldValue.delete(),
            approvedAt: existingApprovedAt || Timestamp.fromDate(approvedAt),
            approvedBy: existingApprovedBy || managerId,
            updatedAt: Timestamp.fromDate(approvedAt)
          },
          { merge: true }
        );
        return {
          seriesCode: existingCode,
          seriesLetter: submissionData.seriesLetter || fallbackLetter,
          seriesNumber: submissionData.seriesNumber || null,
          approvedAt: existingApprovedAt || Timestamp.fromDate(approvedAt),
          approvedBy: existingApprovedBy || managerId,
        };
      }

      const seriesRef = weeklyReportSeriesCollectionRef().doc(`${managerId}_${seriesYear}`);
      const seriesSnap = await tx.get(seriesRef);
      const seriesData = seriesSnap.exists ? (seriesSnap.data() || {}) : {};

      const letter = String(seriesData.letter || fallbackLetter).trim().toUpperCase().slice(0, 1) || 'A';
      const nextNumber = Number(seriesData.lastNumber || 0) + 1;
      const seriesCode = `${letter}${nextNumber}`;

      tx.set(
        seriesRef,
        {
          managerId,
          year: seriesYear,
          letter,
          lastNumber: nextNumber,
          updatedAt: Timestamp.fromDate(approvedAt)
        },
        { merge: true }
      );

      tx.set(
        submissionRef,
        {
          status: EXPENSE_STATUS.APPROVED,
          review: firestore.FieldValue.delete(),
          approvedAt: Timestamp.fromDate(approvedAt),
          approvedBy: managerId,
          updatedAt: Timestamp.fromDate(approvedAt),
          seriesYear,
          seriesLetter: letter,
          seriesNumber: nextNumber,
          seriesCode,
        },
        { merge: true }
      );

      return {
        seriesCode,
        seriesLetter: letter,
        seriesNumber: nextNumber,
        approvedAt: Timestamp.fromDate(approvedAt),
        approvedBy: managerId,
      };
    });

    const approvedAtTs = seriesResult?.approvedAt || Timestamp.fromDate(approvedAt);
    const approvedByFinal = seriesResult?.approvedBy || managerId;

    // Update expenses to approved
    const expensesSnap = await expenseCollectionRef(salesmanId)
      .where('date', '>=', Timestamp.fromDate(start))
      .where('date', '<=', Timestamp.fromDate(end))
      .get();

    const expenseDocs = expensesSnap.docs || [];
    for (let i = 0; i < expenseDocs.length; i += 450) {
      const chunk = expenseDocs.slice(i, i + 450);
      const batch = firestore().batch();
      chunk.forEach((doc) => {
        batch.update(doc.ref, {
          status: EXPENSE_STATUS.APPROVED,
          review: firestore.FieldValue.delete(),
          approvedAt: approvedAtTs,
          approvedBy: approvedByFinal,
          updatedAt: approvedAtTs
        });
      });
      await batch.commit();
    }

    // Update tracking status (merge-safe)
    await weeklyTrackingCollectionRef(salesmanId)
      .doc(weekId)
      .set(
        {
          status: EXPENSE_STATUS.APPROVED,
          review: firestore.FieldValue.delete(),
          approvedAt: approvedAtTs,
          approvedBy: approvedByFinal,
          updatedAt: approvedAtTs,
          seriesCode: seriesResult?.seriesCode || null,
          seriesYear: seriesYear,
          seriesLetter: seriesResult?.seriesLetter || null,
          seriesNumber: seriesResult?.seriesNumber || null,
        },
        { merge: true }
      );

    return { id: submissionId, salesmanId, weekId, status: EXPENSE_STATUS.APPROVED, seriesCode: seriesResult?.seriesCode || null };
  } catch (error) {
    console.error('Error approving weekly report submission:', error);
    throw error;
  }
};

/**
 * Manager requests review for specific expenses in a submitted weekly report.
 * - Marks selected expenses back to DRAFT with review info
 * - Marks weekly tracking + submission back to DRAFT with a review note
 */
export const requestWeeklyReportReview = async ({ managerId, salesmanId, weekId, expenseIds, note }) => {
  try {
    if (!managerId) throw new Error('Missing managerId');
    if (!salesmanId) throw new Error('Missing salesmanId');
    if (!weekId) throw new Error('Missing weekId');
    const ids = Array.isArray(expenseIds) ? expenseIds.filter(Boolean) : [];
    if (ids.length === 0) throw new Error('Select at least one expense to review');

    const weekStartDate = getMondayFromWeekId(weekId);
    const { start, end } = getWeekStartEnd(weekStartDate);
    const requestedAt = new Date();

    // Update only the selected expenses (ensure they belong to that week)
    const expensesSnap = await expenseCollectionRef(salesmanId)
      .where('date', '>=', Timestamp.fromDate(start))
      .where('date', '<=', Timestamp.fromDate(end))
      .get();

    const byId = new Map((expensesSnap.docs || []).map((d) => [d.id, d]));

    for (let i = 0; i < ids.length; i += 450) {
      const chunk = ids.slice(i, i + 450);
      const batch = firestore().batch();
      chunk.forEach((id) => {
        const docSnap = byId.get(id);
        if (!docSnap) return;
        batch.update(docSnap.ref, {
          status: EXPENSE_STATUS.DRAFT,
          review: {
            required: true,
            note: String(note || '').trim(),
            requestedBy: managerId,
            requestedAt: Timestamp.fromDate(requestedAt)
          },
          updatedAt: Timestamp.fromDate(requestedAt)
        });
      });
      await batch.commit();
    }

    const review = {
      required: true,
      note: String(note || '').trim(),
      expenseIds: ids,
      requestedBy: managerId,
      requestedAt: Timestamp.fromDate(requestedAt)
    };

    // Update tracking status (merge-safe)
    await weeklyTrackingCollectionRef(salesmanId)
      .doc(weekId)
      .set(
        {
          status: EXPENSE_STATUS.DRAFT,
          review,
          updatedAt: Timestamp.fromDate(requestedAt)
        },
        { merge: true }
      );

    // Update submission doc (merge-safe)
    const submissionId = `${salesmanId}_${weekId}`;
    await weeklyReportSubmissionsCollectionRef()
      .doc(submissionId)
      .set(
        {
          status: EXPENSE_STATUS.DRAFT,
          review,
          updatedAt: Timestamp.fromDate(requestedAt)
        },
        { merge: true }
      );

    return { id: submissionId, salesmanId, weekId, status: EXPENSE_STATUS.DRAFT, review };
  } catch (error) {
    console.error('Error requesting weekly report review:', error);
    throw error;
  }
};

/**
 * MANAGER / MULTI-USER OPERATIONS
 */

/**
 * Get aggregated expense report for multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} Aggregated report
 */
export const getMultiUserExpenseReport = async (userIds, startDate, endDate) => {
  try {
    const allExpenses = [];
    const userExpenseData = {};
    let grandTotal = 0;

    for (const userId of userIds) {
      const expenses = await getExpensesByDateRange(userId, startDate, endDate);
      const userTotal = expenses.reduce((sum, exp) => sum + exp.amount, 0);

      userExpenseData[userId] = {
        expenses,
        total: userTotal,
        count: expenses.length
      };

      allExpenses.push(...expenses);
      grandTotal += userTotal;
    }

    // Calculate group summaries
    const { getCategoryGroup } = require('../constants/expenseConstants');
    const totalByGroup = {};

    allExpenses.forEach(expense => {
      const group = getCategoryGroup(expense.category);
      totalByGroup[group] = (totalByGroup[group] || 0) + expense.amount;
    });

    return {
      startDate,
      endDate,
      userCount: userIds.length,
      userExpenseData,
      allExpenses,
      grandTotal,
      averagePerUser: userIds.length > 0 ? grandTotal / userIds.length : 0,
      totalByGroup,
      totalCount: allExpenses.length
    };
  } catch (error) {
    console.error('Error fetching multi-user expense report:', error);
    throw error;
  }
};

/**
 * Get aggregated weekly report for multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Date} weekStartDate - Monday of the week
 * @returns {Promise<Object>} Aggregated weekly report
 */
export const getMultiUserWeeklyReport = async (userIds, weekStartDate) => {
  try {
    const weekId = getWeekId(weekStartDate);
    const userReports = {};
    let grandTotal = 0;
    let totalMileage = 0;

    const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
    const concurrency = 6;
    const results = [];

    for (let i = 0; i < ids.length; i += concurrency) {
      const chunk = ids.slice(i, i + concurrency);
      // eslint-disable-next-line no-await-in-loop
      const chunkResults = await Promise.all(
        chunk.map(async (userId) => ({ userId, report: await getWeeklyReport(userId, weekStartDate) }))
      );
      results.push(...chunkResults);
    }

    results.forEach(({ userId, report }) => {
      userReports[userId] = report;
      grandTotal += report?.totalAmount || 0;
      totalMileage += report?.tracking?.mileage?.businessKm || 0;
    });

    return {
      weekId,
      weekStartDate,
      userCount: userIds.length,
      userReports,
      grandTotal,
      averagePerUser: userIds.length > 0 ? grandTotal / userIds.length : 0,
      totalMileage,
      totalExpenseCount: Object.values(userReports).reduce((sum, r) => sum + r.expenseCount, 0)
    };
  } catch (error) {
    console.error('Error fetching multi-user weekly report:', error);
    throw error;
  }
};

/**
 * Get list of salesmen assigned to a manager
 * @param {string} managerId - Manager's user ID
 * @returns {Promise<Array>} Array of salesman objects
 */
export const getManagerAssignedSalesmen = async (managerId) => {
  try {
    const managerKey = String(managerId || '').trim();
    if (!managerKey) return [];

    const managerDoc = await firestore().collection('users').doc(managerKey).get();

    // Preferred (users collection only): manager doc holds assignedSalesmen: string[]
    const assignedSalesmen = managerDoc.exists ? managerDoc.data()?.assignedSalesmen : null;
    const assignedIds = Array.isArray(assignedSalesmen) ? assignedSalesmen.filter(Boolean) : [];
    if (assignedIds.length > 0) {
      const results = [];

      // Use per-doc reads to avoid query permission issues on /users list rules.
      // eslint-disable-next-line no-restricted-syntax
      for (let i = 0; i < assignedIds.length; i += 10) {
        const chunk = assignedIds.slice(i, i + 10);
        // eslint-disable-next-line no-await-in-loop
        const snaps = await Promise.all(
          chunk.map((userId) => firestore().collection('users').doc(userId).get())
        );
        snaps.forEach((docSnap) => {
          if (!docSnap?.exists) return;
          results.push({ id: docSnap.id, ...docSnap.data() });
        });
      }

      return results;
    }

    // Fallback compatibility:
    // Some installations stored managers[] using users/{uid}.uid instead of the doc id (auth uid).
    // In that case, querying only with auth uid returns 0 results.
    const legacyManagerKeyRaw = managerDoc.exists ? managerDoc.data()?.uid : null;
    const legacyManagerKey = typeof legacyManagerKeyRaw === 'string' ? legacyManagerKeyRaw.trim() : null;

    const keys = Array.from(new Set([managerKey, legacyManagerKey].filter(Boolean)));

    const query = keys.length > 1
      ? firestore().collection('users').where('managers', 'array-contains-any', keys)
      : firestore().collection('users').where('managers', 'array-contains', keys[0]);

    const snapshot = await query.get();

    const salesmen = [];

    snapshot.forEach((docSnap) => {
      salesmen.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    return salesmen;
  } catch (error) {
    console.error('Error fetching manager assigned salesmen:', error);
    throw error;
  }
};

/**
 * CACHE OPERATIONS
 */

/**
 * Update expense in local cache
 * @param {string} userId - User ID
 * @param {Object} expense - Expense object
 * @param {string} action - 'add', 'update', or 'delete'
 */
const updateExpenseCache = async (userId, expense, action) => {
  try {
    const cacheKey = EXPENSES_CACHE_KEY + userId;
    const cached = await AsyncStorage.getItem(cacheKey);
    let expenses = cached ? JSON.parse(cached) : [];

    if (action === 'add' || action === 'update') {
      const index = expenses.findIndex(e => e.id === expense.id);
      if (index >= 0) {
        expenses[index] = expense;
      } else {
        expenses.push(expense);
      }
    } else if (action === 'delete') {
      expenses = expenses.filter(e => e.id !== expense.id);
    }

    await AsyncStorage.setItem(cacheKey, JSON.stringify(expenses));
  } catch (error) {
    console.error('Error updating expense cache:', error);
  }
};

/**
 * Update weekly tracking in local cache
 * @param {string} userId - User ID
 * @param {Object} tracking - Tracking object
 * @param {string} action - 'save' or 'delete'
 */
const updateWeeklyTrackingCache = async (userId, tracking, action) => {
  try {
    const cacheKey = WEEKLY_TRACKING_CACHE_KEY + userId;
    const cached = await AsyncStorage.getItem(cacheKey);
    let trackingData = cached ? JSON.parse(cached) : [];

    if (action === 'save') {
      const index = trackingData.findIndex(t => t.weekId === tracking.weekId);
      if (index >= 0) {
        trackingData[index] = tracking;
      } else {
        trackingData.push(tracking);
      }
    } else if (action === 'delete') {
      trackingData = trackingData.filter(t => t.weekId !== tracking.weekId);
    }

    await AsyncStorage.setItem(cacheKey, JSON.stringify(trackingData));
  } catch (error) {
    console.error('Error updating weekly tracking cache:', error);
  }
};

/**
 * Get cached expenses for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Cached expenses or empty array
 */
export const getCachedExpenses = async (userId) => {
  try {
    const cacheKey = EXPENSES_CACHE_KEY + userId;
    const cached = await AsyncStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('Error getting cached expenses:', error);
    return [];
  }
};

/**
 * Get cached weekly tracking data for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Cached tracking data or empty array
 */
export const getCachedWeeklyTracking = async (userId) => {
  try {
    const cacheKey = WEEKLY_TRACKING_CACHE_KEY + userId;
    const cached = await AsyncStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    console.error('Error getting cached weekly tracking:', error);
    return [];
  }
};

/**
 * HELPER FUNCTIONS
 */

/**
 * Convert Firestore expense document to JS object
 */
const convertFirestoreExpense = (data) => {
  return {
    ...data,
    date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
  };
};

/**
 * Convert Firestore tracking document to JS object
 */
const convertFirestoreTracking = (data) => {
  return {
    ...data,
    weekStartDate: data.weekStartDate?.toDate ? data.weekStartDate.toDate() : new Date(data.weekStartDate),
    weekEndDate: data.weekEndDate?.toDate ? data.weekEndDate.toDate() : new Date(data.weekEndDate),
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
  };
};
