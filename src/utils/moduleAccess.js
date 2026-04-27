const DEFAULT_MODULE_ACCESS = {
  fieldSalesProEnabled: true,
  expenseTrackerEnabled: true,
};

const toEnabledBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') return value;
  return fallback;
};

export const getModuleAccess = (entity) => {
  const rawAccess = entity?.moduleAccess;

  return {
    fieldSalesProEnabled: toEnabledBoolean(
      rawAccess?.fieldSalesProEnabled,
      toEnabledBoolean(entity?.fieldSalesProEnabled, DEFAULT_MODULE_ACCESS.fieldSalesProEnabled)
    ),
    expenseTrackerEnabled: toEnabledBoolean(
      rawAccess?.expenseTrackerEnabled,
      toEnabledBoolean(entity?.expenseTrackerEnabled, DEFAULT_MODULE_ACCESS.expenseTrackerEnabled)
    ),
  };
};

export { DEFAULT_MODULE_ACCESS };
