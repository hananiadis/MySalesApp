import { normalizeBrandKey } from './brands';

const DEFAULT_PAYMENT_OPTIONS = [
  { key: 'prepaid_cash', label: 'Προπληρωμή (Έκπτωση 3%)' },
  { key: 'free_shipping', label: 'Ελεύθερα' },
  { key: 'premium_invoicing', label: 'Προνομιακή Πιστωτική Πολιτική' },
  { key: 'bank_cheque', label: 'Επιταγή Ροής' },
];

const KIVOS_PAYMENT_OPTIONS = [
  { key: 'cash', label: 'Μετρητά' },
  { key: 'credit', label: 'Επί Πιστώσει' },
  { key: 'pod_cash', label: 'Αντικαταβολή Μετρητά' },
  { key: 'pod_check', label: 'Αντικαταβολή Επιταγή' },
  { key: 'pod_bill', label: 'Αντικαταβολή Συναλλαγματική' },
];

const JOHN_PAYMENT_OPTIONS = [
  { key: 'cash', label: 'Μετρητά' },
  { key: 'credit', label: 'Επί Πιστώσει' },
  { key: 'cheque', label: 'Επιταγή' },
  { key: 'bill_of_exchange', label: 'Συναλλαγματική' },
];

export const PAYMENT_OPTIONS_BY_BRAND = {
  default: DEFAULT_PAYMENT_OPTIONS,
  playmobil: DEFAULT_PAYMENT_OPTIONS,
  kivos: KIVOS_PAYMENT_OPTIONS,
  john: JOHN_PAYMENT_OPTIONS,
};

const PAYMENT_LABEL_INDEX = Object.values(PAYMENT_OPTIONS_BY_BRAND).reduce((acc, list) => {
  list.forEach((option) => {
    if (!acc[option.key]) {
      acc[option.key] = option.label;
    }
  });
  return acc;
}, {});

export function getPaymentOptions(brand) {
  const normalized = normalizeBrandKey(brand);
  return PAYMENT_OPTIONS_BY_BRAND[normalized] || DEFAULT_PAYMENT_OPTIONS;
}

export function getPaymentLabel(key, brand) {
  if (!key) {
    return '';
  }
  const normalized = normalizeBrandKey(brand);
  const scopedOptions = PAYMENT_OPTIONS_BY_BRAND[normalized] || [];
  const direct = scopedOptions.find((option) => option.key === key);
  if (direct) {
    return direct.label;
  }
  return PAYMENT_LABEL_INDEX[key] || key;
}

