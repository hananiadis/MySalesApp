import firestore from '@react-native-firebase/firestore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getWeeklyReport } from '../services/expenseService';
import { EXPENSE_GROUPS, getMondayFromWeekId, getWeekStartEnd, formatDateDDMMYYYY } from '../constants/expenseConstants';
import { moduleAssetToDataUri } from './assetDataUri';
import { buildWeeklyReportHtml } from './weeklyReportPrint';

const DEFAULT_GROUP_ORDER = [EXPENSE_GROUPS.TRAVEL, EXPENSE_GROUPS.ACCOMMODATION_FOOD, EXPENSE_GROUPS.MISCELLANEOUS];

const COMPANY_BY_BRAND = {
  kivos: { name: 'Ανανιαδου Αναστασια Κ ΣΙΑ ΟΕ', logo: require('../../assets/kivos_logo.png') },
  john: { name: 'JOHN HELLAS', logo: require('../../assets/john_hellas_logo.png') },
};

const pickPrimaryBrand = (brands) => {
  const list = Array.isArray(brands) ? brands.filter(Boolean) : [];
  if (list.includes('kivos')) return 'kivos';
  return list[0] || null;
};

const userLabelFromDoc = (data, fallbackId) => {
  const name = data?.name || `${data?.firstName || ''} ${data?.lastName || ''}`.trim();
  return name || data?.email || fallbackId || '';
};

const formatDateTime = (value) => {
  if (!value) return '';
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

const getCarLabel = (carData) => {
  if (!carData) return '';
  const plate = carData.licensePlate ? String(carData.licensePlate) : '';
  const make = carData.make ? String(carData.make) : '';
  const model = carData.model ? String(carData.model) : '';
  const parts = [make, model].filter(Boolean).join(' ');
  return [plate, parts].filter(Boolean).join(' • ');
};

export const generateWeeklyReportPdf = async ({
  salesmanId,
  weekId,
  report: existingReport = null,
  viewerManagerId = null,
  forceShare = true,
}) => {
  if (!salesmanId) throw new Error('Missing salesmanId');
  if (!weekId) throw new Error('Missing weekId');

  const weekStart = getMondayFromWeekId(weekId);
  const { start, end } = getWeekStartEnd(weekStart);
  const weekRange = `${formatDateDDMMYYYY(start)} - ${formatDateDDMMYYYY(end)}`;

  const [salesmanSnap, submissionSnap] = await Promise.all([
    firestore().collection('users').doc(salesmanId).get(),
    firestore().collection('weeklyReportSubmissions').doc(`${salesmanId}_${weekId}`).get(),
  ]);

  const salesmanData = salesmanSnap.exists ? salesmanSnap.data() : null;
  const primaryBrand = pickPrimaryBrand(salesmanData?.brands);
  const company = (primaryBrand && COMPANY_BY_BRAND[primaryBrand]) || { name: 'MySalesApp', logo: null };
  const logoDataUri = company.logo ? await moduleAssetToDataUri(company.logo) : null;

  const submission = submissionSnap.exists ? submissionSnap.data() : null;
  const approvedById = submission?.approvedBy || null;

  const approvedBySnap = approvedById
    ? await firestore().collection('users').doc(approvedById).get()
    : null;
  const approvedByData = approvedBySnap?.exists ? approvedBySnap.data() : null;

  const report = existingReport || (await getWeeklyReport(salesmanId, weekStart));

  const carId = report?.tracking?.mileage?.carId;
  const carSnap = carId ? await firestore().collection('cars').doc(String(carId)).get() : null;
  const carData = carSnap?.exists ? carSnap.data() : null;

  const html = buildWeeklyReportHtml({
    title: 'Εβδομαδιαίο Εξοδολόγιο',
    companyName: company.name,
    companyLogoDataUri: logoDataUri,
    primaryBrand,

    weekId,
    weekRange,

    reportCode: submission?.seriesCode || submission?.reportCode || '',

    salesman: {
      id: salesmanId,
      label: userLabelFromDoc(salesmanData, salesmanId),
      email: salesmanData?.email || '',
    },

    car: {
      id: carId || null,
      label: getCarLabel(carData),
      licensePlate: carData?.licensePlate || '',
    },

    mileage: report?.tracking?.mileage || null,
    locations: report?.tracking?.locations || {},
    pettyCash: report?.tracking?.pettyCash || null,

    submittedAt: submission?.submittedAt || null,
    approvedAt: submission?.approvedAt || null,
    submittedBy: userLabelFromDoc(salesmanData, salesmanId),
    approvedBy: approvedById ? userLabelFromDoc(approvedByData, approvedById) : '',

    generatedAt: formatDateTime(new Date()),
    status: submission?.status || report?.tracking?.status || '',

    report,
    groupOrder: DEFAULT_GROUP_ORDER,
  });

  const { uri } = await Print.printToFileAsync({ html });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare || !forceShare) {
    return { uri };
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Κοινή χρήση PDF',
  });

  return { uri };
};

export const formatDateTimeForReport = formatDateTime;
