import React, { createContext, useCallback, useEffect, useReducer, useMemo } from 'react';
import {
  addExpense,
  updateExpense,
  deleteExpense,
  getExpensesByDateRange,
  getExpensesByCategory,
  saveWeeklyTracking,
  getWeeklyTracking,
  getExpenseSummaryByGroup,
  getExpenseSummaryByCategory,
  getExpenseSummaryByDay,
  getWeeklyReport,
  submitWeeklyReport,
  getMultiUserExpenseReport,
  getMultiUserWeeklyReport,
  getManagerAssignedSalesmen,
  getCachedExpenses,
  getCachedWeeklyTracking
} from '../services/expenseService';
import { initializeDefaultCars } from '../services/carsService';
import { getWeekId, getWeekStartEnd, getMondayFromWeekId, calculateRemainingPettyCash } from '../constants/expenseConstants';
import { isExpenseApproverRole } from '../constants/roles';

export const ExpenseContext = createContext();

const initialState = {
  // Current user's expenses
  expenses: [],
  filteredExpenses: [],

  // Current week's tracking
  currentWeekTracking: null,
  currentWeekId: null,

  // Current filters
  filters: {
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)), // Last 30 days
    endDate: new Date(),
    categories: [], // Empty = all
    status: 'all', // 'all', 'draft', 'submitted', 'approved'
    sortBy: 'date_desc',
    weekId: null
  },

  // Analytics data
  summary: {
    totalByGroup: {},
    totalByCategory: {},
    totalByDay: {},
    grandTotal: 0,
    expenseCount: 0
  },

  // Multi-user reporting (manager mode)
  selectedSalesmen: [],
  managerReport: null,

  // Salesmen available for manager
  availableSalesmen: [],

  // Assigned salesmen fetch state (manager mode)
  salesmenLoading: false,
  salesmenError: null,

  // Loading & sync states
  loading: false,
  syncing: false,
  error: null,

  // Current user
  currentUserId: null,
  userRole: 'salesman' // 'salesman' or 'manager'
};

// Action types
const ACTIONS = {
  SET_USER: 'SET_USER',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_EXPENSES: 'SET_EXPENSES',
  ADD_EXPENSE: 'ADD_EXPENSE',
  UPDATE_EXPENSE_ITEM: 'UPDATE_EXPENSE_ITEM',
  DELETE_EXPENSE_ITEM: 'DELETE_EXPENSE_ITEM',
  SET_CURRENT_WEEK_TRACKING: 'SET_CURRENT_WEEK_TRACKING',
  UPDATE_WEEK_TRACKING: 'UPDATE_WEEK_TRACKING',
  SET_DATE_RANGE: 'SET_DATE_RANGE',
  SET_WEEK_FILTER: 'SET_WEEK_FILTER',
  SET_CATEGORY_FILTER: 'SET_CATEGORY_FILTER',
  SET_STATUS_FILTER: 'SET_STATUS_FILTER',
  SET_SORT_BY: 'SET_SORT_BY',
  SET_SUMMARY: 'SET_SUMMARY',
  SET_SELECTED_SALESMEN: 'SET_SELECTED_SALESMEN',
  SET_MANAGER_REPORT: 'SET_MANAGER_REPORT',
  SET_AVAILABLE_SALESMEN: 'SET_AVAILABLE_SALESMEN',
  SET_SALESMEN_LOADING: 'SET_SALESMEN_LOADING',
  SET_SALESMEN_ERROR: 'SET_SALESMEN_ERROR',
  CLEAR_FILTERS: 'CLEAR_FILTERS'
};

const filterAndSortExpenses = (expenses, filters) => {
  let filtered = [...expenses];

  // Filter by category
  if (filters.categories && filters.categories.length > 0) {
    filtered = filtered.filter(exp => filters.categories.includes(exp.category));
  }

  // Filter by status
  if (filters.status && filters.status !== 'all') {
    filtered = filtered.filter(exp => exp.status === filters.status);
  }

  // Sort
  filtered.sort((a, b) => {
    if (filters.sortBy === 'date_desc') {
      return new Date(b.date) - new Date(a.date);
    } else if (filters.sortBy === 'date_asc') {
      return new Date(a.date) - new Date(b.date);
    } else if (filters.sortBy === 'amount_desc') {
      return b.amount - a.amount;
    } else if (filters.sortBy === 'amount_asc') {
      return a.amount - b.amount;
    }
    return 0;
  });

  return filtered;
};

const calculateSummary = (expenses) => {
  const totalByGroup = {};
  const totalByCategory = {};
  const totalByDay = {};
  let grandTotal = 0;

  expenses.forEach(expense => {
    const { getCategoryGroup } = require('../constants/expenseConstants');
    const group = getCategoryGroup(expense.category);
    const dateKey = expense.date.toISOString().split('T')[0];

    totalByGroup[group] = (totalByGroup[group] || 0) + expense.amount;
    totalByCategory[expense.category] = (totalByCategory[expense.category] || 0) + expense.amount;
    totalByDay[dateKey] = (totalByDay[dateKey] || 0) + expense.amount;
    grandTotal += expense.amount;
  });

  return {
    totalByGroup,
    totalByCategory,
    totalByDay,
    grandTotal,
    expenseCount: expenses.length
  };
};

const expenseReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_USER:
      return {
        ...state,
        currentUserId: action.payload.userId,
        userRole: action.payload.role
      };

    case ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };

    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload
      };

    case ACTIONS.SET_EXPENSES:
      const filteredExpenses = filterAndSortExpenses(action.payload, state.filters);
      const summary = calculateSummary(filteredExpenses);
      return {
        ...state,
        expenses: action.payload,
        filteredExpenses,
        summary
      };

    case ACTIONS.ADD_EXPENSE:
      const newExpenses = [action.payload, ...state.expenses];
      const newFilteredExpenses = filterAndSortExpenses(newExpenses, state.filters);
      const newSummary = calculateSummary(newFilteredExpenses);
      return {
        ...state,
        expenses: newExpenses,
        filteredExpenses: newFilteredExpenses,
        summary: newSummary
      };

    case ACTIONS.UPDATE_EXPENSE_ITEM:
      const updatedExpenses = state.expenses.map(exp =>
        exp.id === action.payload.id ? action.payload : exp
      );
      const updatedFilteredExpenses = filterAndSortExpenses(updatedExpenses, state.filters);
      const updatedSummary = calculateSummary(updatedFilteredExpenses);
      return {
        ...state,
        expenses: updatedExpenses,
        filteredExpenses: updatedFilteredExpenses,
        summary: updatedSummary
      };

    case ACTIONS.DELETE_EXPENSE_ITEM:
      const deletedExpenses = state.expenses.filter(exp => exp.id !== action.payload);
      const deletedFilteredExpenses = filterAndSortExpenses(deletedExpenses, state.filters);
      const deletedSummary = calculateSummary(deletedFilteredExpenses);
      return {
        ...state,
        expenses: deletedExpenses,
        filteredExpenses: deletedFilteredExpenses,
        summary: deletedSummary
      };

    case ACTIONS.SET_CURRENT_WEEK_TRACKING:
      return {
        ...state,
        currentWeekTracking: action.payload,
        currentWeekId: action.payload ? action.payload.weekId : null
      };

    case ACTIONS.UPDATE_WEEK_TRACKING:
      return {
        ...state,
        currentWeekTracking: action.payload
      };

    case ACTIONS.SET_DATE_RANGE:
      return {
        ...state,
        filters: {
          ...state.filters,
          startDate: action.payload.startDate,
          endDate: action.payload.endDate
        }
      };

    case ACTIONS.SET_WEEK_FILTER:
      return {
        ...state,
        filters: {
          ...state.filters,
          weekId: action.payload
        }
      };

    case ACTIONS.SET_CATEGORY_FILTER:
      return {
        ...state,
        filters: {
          ...state.filters,
          categories: action.payload
        }
      };

    case ACTIONS.SET_STATUS_FILTER:
      return {
        ...state,
        filters: {
          ...state.filters,
          status: action.payload
        }
      };

    case ACTIONS.SET_SORT_BY:
      return {
        ...state,
        filters: {
          ...state.filters,
          sortBy: action.payload
        }
      };

    case ACTIONS.SET_SUMMARY:
      return {
        ...state,
        summary: action.payload
      };

    case ACTIONS.SET_SELECTED_SALESMEN:
      return {
        ...state,
        selectedSalesmen: action.payload
      };

    case ACTIONS.SET_MANAGER_REPORT:
      return {
        ...state,
        managerReport: action.payload
      };

    case ACTIONS.SET_AVAILABLE_SALESMEN:
      return {
        ...state,
        availableSalesmen: action.payload
      };

    case ACTIONS.SET_SALESMEN_LOADING:
      return {
        ...state,
        salesmenLoading: action.payload
      };

    case ACTIONS.SET_SALESMEN_ERROR:
      return {
        ...state,
        salesmenError: action.payload
      };

    case ACTIONS.CLEAR_FILTERS:
      const { start, end } = getWeekStartEnd(new Date());
      const clearedFilters = {
        startDate: start,
        endDate: end,
        categories: [],
        status: 'all',
        sortBy: 'date_desc',
        weekId: null
      };
      const resetFilteredExpenses = filterAndSortExpenses(state.expenses, clearedFilters);
      return {
        ...state,
        filters: clearedFilters,
        filteredExpenses: resetFilteredExpenses
      };

    default:
      return state;
  }
};

export const ExpenseProvider = ({ children, userId, userRole = 'salesman' }) => {
  const [state, dispatch] = useReducer(expenseReducer, initialState);

  // Initialize cars on mount
  useEffect(() => {
    const initCars = async () => {
      try {
        await initializeDefaultCars();
      } catch (error) {
        console.error('Error initializing cars:', error);
      }
    };
    initCars();
  }, []);

  // Set user on mount
  useEffect(() => {
    if (userId) {
      dispatch({
        type: ACTIONS.SET_USER,
        payload: { userId, role: userRole }
      });
    }
  }, [userId, userRole]);

  // Load expenses when user changes or filters change
  useEffect(() => {
    if (!state.currentUserId) return;

    const loadExpenses = async () => {
      try {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });
        dispatch({ type: ACTIONS.SET_ERROR, payload: null });

        const expenses = await getExpensesByDateRange(
          state.currentUserId,
          state.filters.startDate,
          state.filters.endDate
        );

        dispatch({ type: ACTIONS.SET_EXPENSES, payload: expenses });
      } catch (error) {
        console.error('Error loading expenses:', error);
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    };

    loadExpenses();
  }, [state.currentUserId, state.filters.startDate, state.filters.endDate]);

  // Load current week tracking
  useEffect(() => {
    if (!state.currentUserId) return;

    const loadWeeklyTracking = async () => {
      try {
        const weekId = getWeekId(new Date());
        const tracking = await getWeeklyTracking(state.currentUserId, weekId);
        dispatch({ type: ACTIONS.SET_CURRENT_WEEK_TRACKING, payload: tracking });
      } catch (error) {
        console.error('Error loading weekly tracking:', error);
      }
    };

    loadWeeklyTracking();
  }, [state.currentUserId]);

  // Load available salesmen for managers
  useEffect(() => {
    if (!isExpenseApproverRole(state.userRole) || !state.currentUserId) return;

    const loadSalesmen = async () => {
      try {
        dispatch({ type: ACTIONS.SET_SALESMEN_LOADING, payload: true });
        dispatch({ type: ACTIONS.SET_SALESMEN_ERROR, payload: null });
        const salesmen = await getManagerAssignedSalesmen(state.currentUserId);
        dispatch({ type: ACTIONS.SET_AVAILABLE_SALESMEN, payload: salesmen });
      } catch (error) {
        console.error('Error loading assigned salesmen:', error);
        dispatch({ type: ACTIONS.SET_AVAILABLE_SALESMEN, payload: [] });
        dispatch({
          type: ACTIONS.SET_SALESMEN_ERROR,
          payload: error?.message || 'Αποτυχία φόρτωσης πωλητών.'
        });
      } finally {
        dispatch({ type: ACTIONS.SET_SALESMEN_LOADING, payload: false });
      }
    };

    loadSalesmen();
  }, [state.currentUserId, state.userRole]);

  const reloadAssignedSalesmen = useCallback(async () => {
    if (!isExpenseApproverRole(state.userRole) || !state.currentUserId) return [];

    try {
      dispatch({ type: ACTIONS.SET_SALESMEN_LOADING, payload: true });
      dispatch({ type: ACTIONS.SET_SALESMEN_ERROR, payload: null });
      const salesmen = await getManagerAssignedSalesmen(state.currentUserId);
      dispatch({ type: ACTIONS.SET_AVAILABLE_SALESMEN, payload: salesmen });
      return salesmen;
    } catch (error) {
      console.error('Error reloading assigned salesmen:', error);
      dispatch({ type: ACTIONS.SET_AVAILABLE_SALESMEN, payload: [] });
      dispatch({
        type: ACTIONS.SET_SALESMEN_ERROR,
        payload: error?.message || 'Αποτυχία φόρτωσης πωλητών.'
      });
      return [];
    } finally {
      dispatch({ type: ACTIONS.SET_SALESMEN_LOADING, payload: false });
    }
  }, [state.currentUserId, state.userRole]);

  // Memoized action functions
  const addNewExpense = useCallback(
    async (expenseData) => {
      if (!state.currentUserId) throw new Error('No user ID');
      try {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });
        const expense = await addExpense(state.currentUserId, expenseData);
        dispatch({ type: ACTIONS.ADD_EXPENSE, payload: expense });
        return expense;
      } catch (error) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
        throw error;
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    },
    [state.currentUserId]
  );

  const updateExistingExpense = useCallback(
    async (expenseId, updates) => {
      if (!state.currentUserId) throw new Error('No user ID');
      try {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });
        const updated = await updateExpense(state.currentUserId, expenseId, updates);
        dispatch({ type: ACTIONS.UPDATE_EXPENSE_ITEM, payload: updated });
        return updated;
      } catch (error) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
        throw error;
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    },
    [state.currentUserId]
  );

  const deleteExistingExpense = useCallback(
    async (expenseId) => {
      if (!state.currentUserId) throw new Error('No user ID');
      try {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });
        await deleteExpense(state.currentUserId, expenseId);
        dispatch({ type: ACTIONS.DELETE_EXPENSE_ITEM, payload: expenseId });
      } catch (error) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
        throw error;
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    },
    [state.currentUserId]
  );

  const saveTracking = useCallback(
    async (trackingData) => {
      if (!state.currentUserId) throw new Error('No user ID');
      try {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });
        const weekId = getWeekId(trackingData.weekStartDate || new Date());
        const tracking = await saveWeeklyTracking(state.currentUserId, weekId, trackingData);
        dispatch({ type: ACTIONS.UPDATE_WEEK_TRACKING, payload: tracking });
        return tracking;
      } catch (error) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
        throw error;
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    },
    [state.currentUserId]
  );

  const fetchWeeklyTracking = useCallback(
    async (weekId) => {
      if (!state.currentUserId) throw new Error('No user ID');
      try {
        const tracking = await getWeeklyTracking(state.currentUserId, weekId);
        return tracking;
      } catch (error) {
        console.error('Error fetching tracking:', error);
        throw error;
      }
    },
    [state.currentUserId]
  );

  const submitWeeklyReportToManager = useCallback(
    async (weekId) => {
      if (!state.currentUserId) throw new Error('No user ID');
      try {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });
        const submission = await submitWeeklyReport(state.currentUserId, weekId);

        // Refresh local expenses so UI reflects submitted statuses
        const weekStartDate = getMondayFromWeekId(weekId);
        const { start, end } = getWeekStartEnd(weekStartDate);
        const updated = await getExpensesByDateRange(state.currentUserId, start, end);

        // Merge updated weekly expenses into existing list
        const updatedById = new Map(updated.map((e) => [e.id, e]));
        const merged = state.expenses.map((e) => updatedById.get(e.id) || e);
        dispatch({ type: ACTIONS.SET_EXPENSES, payload: merged });

        return submission;
      } catch (error) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
        throw error;
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    },
    [state.currentUserId, state.expenses]
  );

  const setDateRange = useCallback((startDate, endDate) => {
    dispatch({
      type: ACTIONS.SET_DATE_RANGE,
      payload: { startDate, endDate }
    });
  }, []);

  const setWeekFilter = useCallback((weekId) => {
    dispatch({ type: ACTIONS.SET_WEEK_FILTER, payload: weekId });
  }, []);

  const setCategoryFilter = useCallback((categoryIds) => {
    dispatch({ type: ACTIONS.SET_CATEGORY_FILTER, payload: categoryIds });
  }, []);

  const setStatusFilter = useCallback((status) => {
    dispatch({ type: ACTIONS.SET_STATUS_FILTER, payload: status });
  }, []);

  const setSortBy = useCallback((sortOption) => {
    dispatch({ type: ACTIONS.SET_SORT_BY, payload: sortOption });
  }, []);

  const loadManagerReport = useCallback(
    async (userIds, weekStartDate) => {
      try {
        dispatch({ type: ACTIONS.SET_LOADING, payload: true });
        const report = await getMultiUserWeeklyReport(userIds, weekStartDate);
        dispatch({ type: ACTIONS.SET_MANAGER_REPORT, payload: report });
        return report;
      } catch (error) {
        dispatch({ type: ACTIONS.SET_ERROR, payload: error.message });
        throw error;
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    },
    []
  );

  const selectSalesmen = useCallback((salesmenIds) => {
    dispatch({ type: ACTIONS.SET_SELECTED_SALESMEN, payload: salesmenIds });
  }, []);

  const clearFilters = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_FILTERS });
  }, []);

  const value = useMemo(
    () => ({
      // State
      expenses: state.expenses,
      filteredExpenses: state.filteredExpenses,
      currentWeekTracking: state.currentWeekTracking,
      currentWeekId: state.currentWeekId,
      filters: state.filters,
      summary: state.summary,
      selectedSalesmen: state.selectedSalesmen,
      managerReport: state.managerReport,
      availableSalesmen: state.availableSalesmen,
      salesmenLoading: state.salesmenLoading,
      salesmenError: state.salesmenError,
      loading: state.loading,
      syncing: state.syncing,
      error: state.error,
      currentUserId: state.currentUserId,
      userRole: state.userRole,

      // Actions
      addNewExpense,
      updateExistingExpense,
      deleteExistingExpense,
      saveTracking,
      fetchWeeklyTracking,
      submitWeeklyReportToManager,
      setDateRange,
      setWeekFilter,
      setCategoryFilter,
      setStatusFilter,
      setSortBy,
      loadManagerReport,
      selectSalesmen,
      clearFilters,
      reloadAssignedSalesmen
    }),
    [
      state,
      addNewExpense,
      updateExistingExpense,
      deleteExistingExpense,
      saveTracking,
      fetchWeeklyTracking,
      submitWeeklyReportToManager,
      setDateRange,
      setWeekFilter,
      setCategoryFilter,
      setStatusFilter,
      setSortBy,
      loadManagerReport,
      selectSalesmen,
      clearFilters,
      reloadAssignedSalesmen
    ]
  );

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
};

export const useExpense = () => {
  const context = React.useContext(ExpenseContext);
  if (!context) {
    throw new Error('useExpense must be used within an ExpenseProvider');
  }
  return context;
};
