const admin = require('firebase-admin');
const cors = require('cors');
const express = require('express');
const logger = require('firebase-functions/logger');
const { onRequest } = require('firebase-functions/v2/https');

if (!admin.apps.length) {
  admin.initializeApp();
}

const app = express();
const corsMiddleware = cors({ origin: true });
const db = admin.firestore();

const ADMIN_ROLES = new Set(['owner', 'admin', 'developer']);
const MANAGER_ROLES = new Set(['sales_manager', 'manager']);
const SALESMAN_ROLES = new Set(['salesman', 'sales_manager']);

app.use(corsMiddleware);
app.use(express.json());

function toErrorResponse(res, status, error, code) {
  return res.status(status).json({ error, code });
}

function normalizeBrands(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((brand) => String(brand || '').trim().toLowerCase())
    .filter(Boolean);
}

function normalizeRole(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeBrand(value) {
  return String(value || '').trim().toLowerCase();
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

function isManagerRole(role) {
  const normalizedRole = normalizeRole(role);
  return MANAGER_ROLES.has(normalizedRole) || isAdminRole(normalizedRole);
}

function assertManagerAccess(req, res) {
  if (!isManagerRole(req.authContext?.role)) {
    toErrorResponse(res, 403, 'You are not allowed to perform this action.', 'auth/forbidden');
    return false;
  }

  return true;
}

function resolveRequestedBrand(req) {
  const authContext = req.authContext || {};
  const requestedBrand = normalizeBrand(req.headers['x-brand']);

  if (requestedBrand) {
    return requestedBrand;
  }

  if (Array.isArray(authContext.brands) && authContext.brands.length > 0) {
    return normalizeBrand(authContext.brands[0]);
  }

  return '';
}

function assertBrandAccess(req, res) {
  const authContext = req.authContext || {};
  const requestedBrand = resolveRequestedBrand(req);

  if (!requestedBrand) {
    toErrorResponse(res, 400, 'Missing brand context. Please set x-brand header.', 'brand/missing');
    return null;
  }

  if (!isAdminRole(authContext.role) && !authContext.brands.includes(requestedBrand)) {
    toErrorResponse(res, 403, 'You are not allowed to access this brand.', 'brand/forbidden');
    return null;
  }

  return requestedBrand;
}

function getCustomerCollectionByBrand(brand) {
  switch (normalizeBrand(brand)) {
    case 'kivos':
      return 'customers_kivos';
    case 'john':
      return 'customers_john';
    case 'playmobil':
    default:
      return 'customers';
  }
}

function toIsoString(value) {
  if (!value) {
    return null;
  }

  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return null;
  }

  return asDate.toISOString();
}

function normalizeCustomerDoc(id, brand, data) {
  const customerCode = String(
    data.customerCode || data.code || data.customer_code || data.Payer || id
  ).trim();

  const customerName = String(
    data.name || data.customerName || data['Name Payer'] || data.companyName || ''
  ).trim();

  const email = String(data.email || data.mail || '').trim() || null;
  const phone = String(data.phone || data.telephone || data.mobile || '').trim() || null;
  const address = String(data.address || data.street || '').trim() || null;
  const city = String(data.city || data.region || '').trim() || null;
  const postalCode = String(data.postalCode || data.zip || data.zipCode || '').trim() || null;

  return {
    id,
    customerCode,
    name: customerName || customerCode,
    email,
    phone,
    address,
    city,
    postalCode,
    brand: normalizeBrand(brand),
    territoryId: data.territoryId || null,
    visitCadenceDays: Number.isFinite(Number(data.visitCadenceDays))
      ? Number(data.visitCadenceDays)
      : null,
    lastVisitAt: toIsoString(data.lastVisitAt),
    nextVisitDue: toIsoString(data.nextVisitDue),
    merch: data.merch || null,
    priority: String(data.priority || '').trim().toLowerCase() || null,
    updatedAt: toIsoString(data.updatedAt),
  };
}

function normalizeTerritoryDoc(id, brand, data) {
  return {
    id,
    brand: normalizeBrand(data.brand || brand),
    name: String(data.name || '').trim(),
    code: String(data.code || '').trim() || null,
    active: data.active !== false,
    priority: String(data.priority || '').trim().toLowerCase() || 'medium',
    visitLimit: Number.isFinite(Number(data.visitLimit)) ? Number(data.visitLimit) : null,
    postcodes: Array.isArray(data.postcodes) ? data.postcodes : [],
    assignedSalesman: data.assignedSalesman || null,
    customerCount: Number.isFinite(Number(data.customerCount)) ? Number(data.customerCount) : 0,
    geojson: data.geojson || null,
    centroid: data.centroid || null,
    updatedAt: toIsoString(data.updatedAt),
    createdAt: toIsoString(data.createdAt),
  };
}

function normalizeTerritoryAssignmentDoc(id, data) {
  return {
    id,
    territoryId: data.territoryId || null,
    salesmanId: data.salesmanId || null,
    salesmanName: data.salesmanName || null,
    brand: normalizeBrand(data.brand),
    startDate: toIsoString(data.startDate),
    endDate: toIsoString(data.endDate),
    status: String(data.status || 'active').trim().toLowerCase(),
    updatedAt: toIsoString(data.updatedAt),
    createdAt: toIsoString(data.createdAt),
  };
}

function normalizeScheduleDoc(id, data) {
  const territories = Array.isArray(data.territories)
    ? data.territories
        .map((territory) => ({
          id: String(territory?.id || '').trim() || null,
          name: String(territory?.name || '').trim() || null,
          plannedVisits: Number.isFinite(Number(territory?.plannedVisits))
            ? Number(territory.plannedVisits)
            : 0,
          conflicts: Number.isFinite(Number(territory?.conflicts)) ? Number(territory.conflicts) : 0,
        }))
        .filter((territory) => territory.id)
    : [];

  return {
    id,
    brand: normalizeBrand(data.brand),
    scheduleKey: String(data.scheduleKey || '').trim() || null,
    salesmanId: String(data.salesmanId || '').trim() || null,
    salesmanName: String(data.salesmanName || '').trim() || null,
    weekKey: String(data.weekKey || '').trim() || null,
    weekStartDate: toDateOnlyString(data.weekStartDate),
    weekEndDate: toDateOnlyString(data.weekEndDate),
    monthKey: String(data.monthKey || '').trim() || null,
    status: String(data.status || 'draft').trim().toLowerCase(),
    totalVisits: Number.isFinite(Number(data.totalVisits)) ? Number(data.totalVisits) : 0,
    territories,
    notes: String(data.notes || '').trim() || null,
    updatedAt: toIsoString(data.updatedAt),
    createdAt: toIsoString(data.createdAt),
    createdBy: String(data.createdBy || '').trim() || null,
  };
}

function toDateOnlyString(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString().slice(0, 10);
  }

  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return '';
  }

  return asDate.toISOString().slice(0, 10);
}

function normalizeVisitPlanDoc(id, data) {
  const date = toDateOnlyString(data.date);
  const timeSlot = String(data.timeSlot || '').trim();
  const startTime = String(data.startTime || '').trim();
  const endTime = String(data.endTime || '').trim();

  return {
    id,
    brand: normalizeBrand(data.brand),
    territoryId: String(data.territoryId || '').trim() || null,
    customerId: String(data.customerId || '').trim() || null,
    customerCode: String(data.customerCode || '').trim() || null,
    customerName: String(data.customerName || '').trim() || null,
    company: String(data.company || '').trim() || null,
    location: String(data.location || '').trim() || null,
    address: String(data.address || '').trim() || null,
    phone: String(data.phone || '').trim() || null,
    salesmanId: String(data.salesmanId || '').trim() || null,
    salesmanName: String(data.salesmanName || '').trim() || null,
    date,
    startTime: startTime || null,
    endTime: endTime || null,
    timeSlot:
      timeSlot ||
      (startTime && endTime ? `${startTime}-${endTime}` : startTime || endTime || null),
    priority: String(data.priority || 'medium').trim().toLowerCase(),
    type: String(data.type || '').trim().toLowerCase() || null,
    duration: Number.isFinite(Number(data.duration)) ? Number(data.duration) : null,
    objective: String(data.objective || '').trim() || null,
    notes: String(data.notes || '').trim() || null,
    estimatedTravelTime: Number.isFinite(Number(data.estimatedTravelTime))
      ? Number(data.estimatedTravelTime)
      : null,
    distance: Number.isFinite(Number(data.distance)) ? Number(data.distance) : null,
    status: String(data.status || 'upcoming').trim().toLowerCase(),
    createdBy: String(data.createdBy || '').trim() || null,
    updatedAt: toIsoString(data.updatedAt),
    createdAt: toIsoString(data.createdAt),
  };
}

function normalizeVisitExecutionDoc(id, data) {
  return {
    id,
    brand: normalizeBrand(data.brand),
    visitPlanId: String(data.visitPlanId || '').trim() || null,
    territoryId: String(data.territoryId || '').trim() || null,
    customerId: String(data.customerId || '').trim() || null,
    customerCode: String(data.customerCode || '').trim() || null,
    customerName: String(data.customerName || '').trim() || null,
    company: String(data.company || '').trim() || null,
    location: String(data.location || '').trim() || null,
    address: String(data.address || '').trim() || null,
    phone: String(data.phone || '').trim() || null,
    salesmanId: String(data.salesmanId || '').trim() || null,
    salesmanName: String(data.salesmanName || '').trim() || null,
    date: toDateOnlyString(data.date),
    checkInAt: toIsoString(data.checkInAt),
    checkOutAt: toIsoString(data.checkOutAt),
    completedAt: toIsoString(data.completedAt),
    status: String(data.status || 'in-progress').trim().toLowerCase(),
    outcome: String(data.outcome || '').trim() || null,
    notes: String(data.notes || '').trim() || null,
    nextAction: String(data.nextAction || '').trim() || null,
    checklist: data.checklist && typeof data.checklist === 'object' ? data.checklist : {},
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    updatedAt: toIsoString(data.updatedAt),
    createdAt: toIsoString(data.createdAt),
  };
}

function getWeekRangeFromDate(dateString) {
  const baseDate = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }

  const dayOfWeek = baseDate.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const start = new Date(baseDate);
  start.setUTCDate(baseDate.getUTCDate() + diffToMonday);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function addUtcDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getDateRangeFromPreset(preset, customStart, customEnd) {
  const today = new Date();
  const utcToday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const toRange = (startDate, endDate) => ({
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  });

  switch (String(preset || 'last7days').trim().toLowerCase()) {
    case 'today':
      return toRange(utcToday, utcToday);
    case 'yesterday': {
      const yesterday = addUtcDays(utcToday, -1);
      return toRange(yesterday, yesterday);
    }
    case 'last30days':
      return toRange(addUtcDays(utcToday, -29), utcToday);
    case 'thismonth': {
      const start = new Date(Date.UTC(utcToday.getUTCFullYear(), utcToday.getUTCMonth(), 1));
      const end = new Date(Date.UTC(utcToday.getUTCFullYear(), utcToday.getUTCMonth() + 1, 0));
      return toRange(start, end);
    }
    case 'lastmonth': {
      const start = new Date(Date.UTC(utcToday.getUTCFullYear(), utcToday.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(utcToday.getUTCFullYear(), utcToday.getUTCMonth(), 0));
      return toRange(start, end);
    }
    case 'thisquarter': {
      const quarterStartMonth = Math.floor(utcToday.getUTCMonth() / 3) * 3;
      const start = new Date(Date.UTC(utcToday.getUTCFullYear(), quarterStartMonth, 1));
      const end = new Date(Date.UTC(utcToday.getUTCFullYear(), quarterStartMonth + 3, 0));
      return toRange(start, end);
    }
    case 'custom': {
      const start = toDateOnlyString(customStart);
      const end = toDateOnlyString(customEnd);
      if (!start || !end) {
        return null;
      }
      return { start, end };
    }
    case 'last7days':
    default:
      return toRange(addUtcDays(utcToday, -6), utcToday);
  }
}

function formatGreekDateLabel(dateString) {
  if (!dateString) {
    return '';
  }

  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return new Intl.DateTimeFormat('el-GR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

function getPercentDelta(current, previous) {
  if (!previous) {
    return current ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function formatSignedPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}

function normalizeOutcomeBucket(value, fallbackNextAction) {
  const combined = `${String(value || '')} ${String(fallbackNextAction || '')}`.trim().toLowerCase();
  if (!combined) {
    return 'follow-up';
  }

  if (/order|παραγγελ|sale|sold|deal/.test(combined)) {
    return 'order';
  }

  if (/quote|offer|προσφορ/.test(combined)) {
    return 'quote';
  }

  if (/no interest|not interested|χωρ|declin|reject|cancel/.test(combined)) {
    return 'no-interest';
  }

  if (/follow|next|παρακολ|επόμεν/.test(combined)) {
    return 'follow-up';
  }

  return 'follow-up';
}

function deriveFullName(decodedToken, profile) {
  const firstName = String(profile.firstName || profile.first_name || '').trim();
  const lastName = String(profile.lastName || profile.last_name || '').trim();
  const combined = `${firstName} ${lastName}`.trim();

  if (combined) {
    return combined;
  }

  const displayName = String(decodedToken.name || profile.name || '').trim();
  if (displayName) {
    return displayName;
  }

  return null;
}

async function authenticateRequest(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || '');
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return toErrorResponse(res, 401, 'Missing bearer token.', 'auth/missing-token');
    }

    const decodedToken = await admin.auth().verifyIdToken(match[1]);
    const userSnapshot = await db.collection('users').doc(decodedToken.uid).get();

    const profile = userSnapshot.exists ? userSnapshot.data() || {} : {};

    req.authContext = {
      uid: decodedToken.uid,
      email: decodedToken.email || profile.email || null,
      displayName: decodedToken.name || profile.name || null,
      fullName: deriveFullName(decodedToken, profile),
      role: profile.role || null,
      brands: normalizeBrands(profile.brands),
      token: decodedToken,
    };

    return next();
  } catch (error) {
    logger.error('Failed to authenticate request.', error);
    return toErrorResponse(res, 401, 'Invalid or expired token.', 'auth/invalid-token');
  }
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'fieldsales-pro-bff',
    timestamp: new Date().toISOString(),
  });
});

app.get('/me', authenticateRequest, (req, res) => {
  const authContext = req.authContext || {};

  res.json({
    ok: true,
    uid: authContext.uid || null,
    email: authContext.email || null,
    displayName: authContext.displayName || null,
    fullName: authContext.fullName || null,
    role: authContext.role || null,
    brands: authContext.brands || [],
  });
});

app.get('/customers', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const collectionName = getCustomerCollectionByBrand(brand);
    const territoryId = String(req.query.territoryId || '').trim();
    const salesmanId = String(req.query.salesmanId || '').trim();
    const search = String(req.query.search || '').trim().toLowerCase();
    const limitParam = Number(req.query.limit || 300);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 300;

    let query = db.collection(collectionName);
    if (territoryId) {
      query = query.where('territoryId', '==', territoryId);
    }
    query = query.limit(limit);

    const snapshot = await query.get();
    let customers = snapshot.docs.map((doc) => normalizeCustomerDoc(doc.id, brand, doc.data() || {}));

    if (salesmanId) {
      customers = customers.filter((customer) => {
        if (Array.isArray(customer.merch)) {
          return customer.merch.map((value) => String(value)).includes(salesmanId);
        }

        return String(customer.merch || '') === salesmanId;
      });
    }

    if (search) {
      customers = customers.filter((customer) => {
        const haystack = [
          customer.name,
          customer.customerCode,
          customer.city,
          customer.postalCode,
          customer.address,
        ]
          .map((value) => String(value || '').toLowerCase())
          .join(' ');

        return haystack.includes(search);
      });
    }

    return res.json({ ok: true, brand, items: customers });
  } catch (error) {
    logger.error('Failed to load customers', error);
    return toErrorResponse(res, 500, 'Failed to load customers.', 'customers/load-failed');
  }
});

app.get('/territories', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const activeFilter = String(req.query.active || '').trim().toLowerCase();
    let query = db.collection('territories').where('brand', '==', brand);
    if (activeFilter === 'true') {
      query = query.where('active', '==', true);
    }
    if (activeFilter === 'false') {
      query = query.where('active', '==', false);
    }

    const snapshot = await query.get();
    const territories = snapshot.docs.map((doc) => normalizeTerritoryDoc(doc.id, brand, doc.data() || {}));
    return res.json({ ok: true, brand, items: territories });
  } catch (error) {
    logger.error('Failed to load territories', error);
    return toErrorResponse(res, 500, 'Failed to load territories.', 'territories/load-failed');
  }
});

app.post('/territories', authenticateRequest, async (req, res) => {
  try {
    if (!assertManagerAccess(req, res)) {
      return;
    }

    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const payload = req.body || {};
    const name = String(payload.name || '').trim();

    if (!name) {
      return toErrorResponse(res, 400, 'Territory name is required.', 'territories/name-required');
    }

    const documentId = String(payload.id || '').trim();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const data = {
      brand,
      name,
      code: String(payload.code || '').trim() || null,
      active: payload.active !== false,
      priority: String(payload.priority || '').trim().toLowerCase() || 'medium',
      visitLimit: Number.isFinite(Number(payload.visitLimit)) ? Number(payload.visitLimit) : null,
      postcodes: Array.isArray(payload.postcodes) ? payload.postcodes : [],
      assignedSalesman: payload.assignedSalesman || null,
      customerCount: Number.isFinite(Number(payload.customerCount)) ? Number(payload.customerCount) : 0,
      geojson: payload.geojson || null,
      centroid: payload.centroid || null,
      updatedAt: now,
    };

    let ref;
    if (documentId) {
      ref = db.collection('territories').doc(documentId);
      await ref.set(data, { merge: true });
    } else {
      ref = db.collection('territories').doc();
      await ref.set({ ...data, createdAt: now }, { merge: true });
    }

    const saved = await ref.get();
    return res.status(201).json({
      ok: true,
      brand,
      item: normalizeTerritoryDoc(saved.id, brand, saved.data() || {}),
    });
  } catch (error) {
    logger.error('Failed to save territory', error);
    return toErrorResponse(res, 500, 'Failed to save territory.', 'territories/save-failed');
  }
});

app.get('/territory-assignments', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const territoryId = String(req.query.territoryId || '').trim();
    const salesmanId = String(req.query.salesmanId || '').trim();
    const status = String(req.query.status || '').trim().toLowerCase();

    let query = db.collection('territoryAssignments').where('brand', '==', brand);
    if (territoryId) {
      query = query.where('territoryId', '==', territoryId);
    }
    if (salesmanId) {
      query = query.where('salesmanId', '==', salesmanId);
    }
    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const assignments = snapshot.docs.map((doc) =>
      normalizeTerritoryAssignmentDoc(doc.id, doc.data() || {})
    );

    return res.json({ ok: true, brand, items: assignments });
  } catch (error) {
    logger.error('Failed to load territory assignments', error);
    return toErrorResponse(
      res,
      500,
      'Failed to load territory assignments.',
      'assignments/load-failed'
    );
  }
});

app.post('/territory-assignments', authenticateRequest, async (req, res) => {
  try {
    if (!assertManagerAccess(req, res)) {
      return;
    }

    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const payload = req.body || {};
    const territoryId = String(payload.territoryId || '').trim();
    const salesmanId = String(payload.salesmanId || '').trim();

    if (!territoryId || !salesmanId) {
      return toErrorResponse(
        res,
        400,
        'territoryId and salesmanId are required.',
        'assignments/invalid-payload'
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const baseData = {
      territoryId,
      salesmanId,
      salesmanName: String(payload.salesmanName || '').trim() || null,
      brand,
      status: String(payload.status || 'active').trim().toLowerCase(),
      startDate: payload.startDate ? new Date(payload.startDate) : now,
      endDate: payload.endDate ? new Date(payload.endDate) : null,
      updatedAt: now,
    };

    const documentId = String(payload.id || '').trim();
    let ref;
    if (documentId) {
      ref = db.collection('territoryAssignments').doc(documentId);
      await ref.set(baseData, { merge: true });
    } else {
      ref = db.collection('territoryAssignments').doc();
      await ref.set({ ...baseData, createdAt: now }, { merge: true });
    }

    const saved = await ref.get();
    return res.status(201).json({
      ok: true,
      brand,
      item: normalizeTerritoryAssignmentDoc(saved.id, saved.data() || {}),
    });
  } catch (error) {
    logger.error('Failed to save territory assignment', error);
    return toErrorResponse(res, 500, 'Failed to save territory assignment.', 'assignments/save-failed');
  }
});

app.get('/schedules', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    if (!assertManagerAccess(req, res)) {
      return;
    }

    const requestedStatus = String(req.query.status || '').trim().toLowerCase();
    const rangeStart = toDateOnlyString(req.query.rangeStart);
    const rangeEnd = toDateOnlyString(req.query.rangeEnd);
    const limitParam = Number(req.query.limit || 500);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 500;

    const snapshot = await db.collection('schedules').where('brand', '==', brand).limit(limit).get();
    let items = snapshot.docs.map((doc) => normalizeScheduleDoc(doc.id, doc.data() || {}));

    if (requestedStatus) {
      items = items.filter((item) => item.status === requestedStatus);
    }

    if (rangeStart) {
      items = items.filter((item) => !item.weekEndDate || item.weekEndDate >= rangeStart);
    }

    if (rangeEnd) {
      items = items.filter((item) => !item.weekStartDate || item.weekStartDate <= rangeEnd);
    }

    items.sort((a, b) => {
      const left = `${a.weekStartDate || ''} ${a.salesmanName || ''}`.trim();
      const right = `${b.weekStartDate || ''} ${b.salesmanName || ''}`.trim();
      return left.localeCompare(right);
    });

    return res.json({ ok: true, brand, items });
  } catch (error) {
    logger.error('Failed to load schedules', error);
    return toErrorResponse(res, 500, 'Failed to load schedules.', 'schedules/load-failed');
  }
});

app.post('/schedules', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    if (!assertManagerAccess(req, res)) {
      return;
    }

    const authContext = req.authContext || {};
    const payload = req.body || {};
    const salesmanId = String(payload.salesmanId || '').trim();
    const weekStartDate = toDateOnlyString(payload.weekStartDate);
    const weekEndDate = toDateOnlyString(payload.weekEndDate);

    if (!salesmanId || !weekStartDate || !weekEndDate) {
      return toErrorResponse(
        res,
        400,
        'salesmanId, weekStartDate and weekEndDate are required.',
        'schedules/missing-fields'
      );
    }

    const scheduleKey = `${brand}:${salesmanId}:${weekStartDate}`;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const territories = Array.isArray(payload.territories)
      ? payload.territories
          .map((territory) => ({
            id: String(territory?.id || '').trim() || null,
            name: String(territory?.name || '').trim() || null,
            plannedVisits: Number.isFinite(Number(territory?.plannedVisits))
              ? Number(territory.plannedVisits)
              : 0,
            conflicts: Number.isFinite(Number(territory?.conflicts)) ? Number(territory.conflicts) : 0,
          }))
          .filter((territory) => territory.id)
      : [];

    const totalVisits = territories.reduce(
      (sum, territory) => sum + (Number(territory.plannedVisits) || 0),
      0
    );

    let ref = null;
    const requestedId = String(payload.id || '').trim();
    if (requestedId) {
      ref = db.collection('schedules').doc(requestedId);
    } else {
      const existing = await db
        .collection('schedules')
        .where('brand', '==', brand)
        .where('scheduleKey', '==', scheduleKey)
        .limit(1)
        .get();

      ref = existing.empty ? db.collection('schedules').doc() : existing.docs[0].ref;
    }

    const data = {
      brand,
      scheduleKey,
      salesmanId,
      salesmanName: String(payload.salesmanName || '').trim() || null,
      weekKey: String(payload.weekKey || '').trim() || null,
      weekStartDate,
      weekEndDate,
      monthKey: String(payload.monthKey || '').trim() || weekStartDate.slice(0, 7),
      status: String(payload.status || 'draft').trim().toLowerCase(),
      territories,
      totalVisits,
      notes: String(payload.notes || '').trim() || null,
      updatedAt: now,
      createdBy: authContext.uid,
    };

    await ref.set({ ...data, createdAt: now }, { merge: true });

    const saved = await ref.get();
    return res.status(201).json({
      ok: true,
      brand,
      item: normalizeScheduleDoc(saved.id, saved.data() || {}),
    });
  } catch (error) {
    logger.error('Failed to save schedule', error);
    return toErrorResponse(res, 500, 'Failed to save schedule.', 'schedules/save-failed');
  }
});

app.post('/schedules/:id/status', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    if (!assertManagerAccess(req, res)) {
      return;
    }

    const scheduleId = String(req.params.id || '').trim();
    const nextStatus = String(req.body?.status || '').trim().toLowerCase();
    const allowedStatuses = new Set(['draft', 'pending', 'approved', 'rejected']);

    if (!scheduleId || !allowedStatuses.has(nextStatus)) {
      return toErrorResponse(
        res,
        400,
        'A valid schedule id and status are required.',
        'schedules/invalid-status'
      );
    }

    const ref = db.collection('schedules').doc(scheduleId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return toErrorResponse(res, 404, 'Schedule not found.', 'schedules/not-found');
    }

    const existing = snapshot.data() || {};
    if (normalizeBrand(existing.brand) !== brand) {
      return toErrorResponse(res, 403, 'You are not allowed to update this schedule.', 'schedules/forbidden');
    }

    await ref.set(
      {
        status: nextStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const saved = await ref.get();
    return res.json({ ok: true, brand, item: normalizeScheduleDoc(saved.id, saved.data() || {}) });
  } catch (error) {
    logger.error('Failed to update schedule status', error);
    return toErrorResponse(
      res,
      500,
      'Failed to update schedule status.',
      'schedules/update-status-failed'
    );
  }
});

app.get('/analytics/overview', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    if (!assertManagerAccess(req, res)) {
      return;
    }

    const preset = String(req.query.range || 'last7days').trim().toLowerCase();
    const territoryId = String(req.query.territoryId || '').trim();
    const salesmanId = String(req.query.salesmanId || '').trim();
    const customerSegment = String(req.query.customerSegment || '').trim() || null;
    const range = getDateRangeFromPreset(preset, req.query.startDate, req.query.endDate);

    if (!range) {
      return toErrorResponse(res, 400, 'Invalid analytics date range.', 'analytics/invalid-range');
    }

    const startDate = new Date(`${range.start}T00:00:00.000Z`);
    const endDate = new Date(`${range.end}T00:00:00.000Z`);
    const daySpan = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
    const previousEnd = addUtcDays(startDate, -1);
    const previousStart = addUtcDays(previousEnd, -(daySpan - 1));
    const previousRange = {
      start: previousStart.toISOString().slice(0, 10),
      end: previousEnd.toISOString().slice(0, 10),
    };

    const [territoriesSnapshot, salesmenSnapshot, plansSnapshot, executionsSnapshot] = await Promise.all([
      db.collection('territories').where('brand', '==', brand).limit(500).get(),
      db.collection('users').where('brands', 'array-contains', brand).limit(300).get(),
      db.collection('visitPlans').where('brand', '==', brand).limit(2000).get(),
      db.collection('visitExecutions').where('brand', '==', brand).limit(2000).get(),
    ]);

    const territoryItems = territoriesSnapshot.docs.map((doc) => normalizeTerritoryDoc(doc.id, brand, doc.data() || {}));
    const salesmanItems = salesmenSnapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((user) => SALESMAN_ROLES.has(normalizeRole(user.role)))
      .map((user) => {
        const firstName = String(user.firstName || user.first_name || '').trim();
        const lastName = String(user.lastName || user.last_name || '').trim();
        const fullName = `${firstName} ${lastName}`.trim();
        return {
          id: user.id,
          name: fullName || String(user.name || user.email || user.id),
        };
      });

    const normalizedPlans = plansSnapshot.docs.map((doc) => normalizeVisitPlanDoc(doc.id, doc.data() || {}));
    const normalizedExecutions = executionsSnapshot.docs.map((doc) => normalizeVisitExecutionDoc(doc.id, doc.data() || {}));

    const applyFilters = (item, activeRange) => {
      if (!item?.date || item.date < activeRange.start || item.date > activeRange.end) {
        return false;
      }
      if (territoryId && item.territoryId !== territoryId) {
        return false;
      }
      if (salesmanId && item.salesmanId !== salesmanId) {
        return false;
      }
      return true;
    };

    const currentPlans = normalizedPlans.filter((item) => applyFilters(item, range));
    const currentExecutions = normalizedExecutions.filter((item) => applyFilters(item, range));
    const previousPlans = normalizedPlans.filter((item) => applyFilters(item, previousRange));
    const previousExecutions = normalizedExecutions.filter((item) => applyFilters(item, previousRange));

    const completedExecutions = currentExecutions.filter((item) => item.status === 'completed');
    const previousCompletedExecutions = previousExecutions.filter((item) => item.status === 'completed');

    const orderExecutions = completedExecutions.filter(
      (item) => normalizeOutcomeBucket(item.outcome, item.nextAction) === 'order'
    );
    const previousOrderExecutions = previousCompletedExecutions.filter(
      (item) => normalizeOutcomeBucket(item.outcome, item.nextAction) === 'order'
    );

    const visitedTerritoryIds = new Set(currentExecutions.map((item) => item.territoryId).filter(Boolean));
    const activeTerritoryItems = territoryItems.filter((item) => !territoryId || item.id === territoryId);
    const previousVisitedTerritoryIds = new Set(previousExecutions.map((item) => item.territoryId).filter(Boolean));
    const previousActiveTerritoryItems = territoryItems.filter((item) => !territoryId || item.id === territoryId);

    const durationMinutes = completedExecutions
      .map((item) => {
        const start = item.checkInAt ? new Date(item.checkInAt).getTime() : null;
        const end = item.completedAt
          ? new Date(item.completedAt).getTime()
          : item.checkOutAt
            ? new Date(item.checkOutAt).getTime()
            : null;
        if (!start || !end || end <= start) {
          return null;
        }
        return Math.round((end - start) / 60000);
      })
      .filter((value) => Number.isFinite(value));

    const previousDurationMinutes = previousCompletedExecutions
      .map((item) => {
        const start = item.checkInAt ? new Date(item.checkInAt).getTime() : null;
        const end = item.completedAt
          ? new Date(item.completedAt).getTime()
          : item.checkOutAt
            ? new Date(item.checkOutAt).getTime()
            : null;
        if (!start || !end || end <= start) {
          return null;
        }
        return Math.round((end - start) / 60000);
      })
      .filter((value) => Number.isFinite(value));

    const currentCompletionRate = currentPlans.length
      ? (completedExecutions.length / currentPlans.length) * 100
      : 0;
    const previousCompletionRate = previousPlans.length
      ? (previousCompletedExecutions.length / previousPlans.length) * 100
      : 0;
    const currentAvgDuration = durationMinutes.length
      ? durationMinutes.reduce((sum, value) => sum + value, 0) / durationMinutes.length
      : 0;
    const previousAvgDuration = previousDurationMinutes.length
      ? previousDurationMinutes.reduce((sum, value) => sum + value, 0) / previousDurationMinutes.length
      : 0;
    const currentCoverageRate = activeTerritoryItems.length
      ? (visitedTerritoryIds.size / activeTerritoryItems.length) * 100
      : 0;
    const previousCoverageRate = previousActiveTerritoryItems.length
      ? (previousVisitedTerritoryIds.size / previousActiveTerritoryItems.length) * 100
      : 0;
    const currentOrderRate = completedExecutions.length
      ? (orderExecutions.length / completedExecutions.length) * 100
      : 0;
    const previousOrderRate = previousCompletedExecutions.length
      ? (previousOrderExecutions.length / previousCompletedExecutions.length) * 100
      : 0;

    const dailyTrend = [];
    for (let cursor = new Date(startDate); cursor <= endDate; cursor = addUtcDays(cursor, 1)) {
      const day = cursor.toISOString().slice(0, 10);
      const dayPlans = currentPlans.filter((item) => item.date === day);
      const dayCompleted = completedExecutions.filter((item) => item.date === day);
      dailyTrend.push({
        date: day,
        label: formatGreekDateLabel(day),
        planned: dayPlans.length,
        completed: dayCompleted.length,
        efficiency: dayPlans.length ? Math.round((dayCompleted.length / dayPlans.length) * 100) : 0,
      });
    }

    const territoryAnalytics = activeTerritoryItems
      .map((territory) => {
        const territoryPlans = currentPlans.filter((item) => item.territoryId === territory.id);
        const territoryCompleted = completedExecutions.filter((item) => item.territoryId === territory.id);
        const territoryOrders = orderExecutions.filter((item) => item.territoryId === territory.id);
        const uniqueVisitedCustomers = new Set(
          currentExecutions
            .filter((item) => item.territoryId === territory.id)
            .map((item) => item.customerId || item.customerCode)
            .filter(Boolean)
        );
        const baselineCustomerCount = Math.max(Number(territory.customerCount || 0), uniqueVisitedCustomers.size, 1);
        return {
          id: territory.id,
          name: territory.name,
          visits: territoryPlans.length,
          completed: territoryCompleted.length,
          orders: territoryOrders.length,
          efficiency: territoryPlans.length ? Math.round((territoryCompleted.length / territoryPlans.length) * 100) : 0,
          coverage: Math.round((uniqueVisitedCustomers.size / baselineCustomerCount) * 100),
        };
      })
      .sort((a, b) => b.completed - a.completed);

    const salesmanAnalytics = salesmanItems
      .filter((item) => !salesmanId || item.id === salesmanId)
      .map((salesman) => {
        const salesmanPlans = currentPlans.filter((item) => item.salesmanId === salesman.id);
        const salesmanCompleted = completedExecutions.filter((item) => item.salesmanId === salesman.id);
        const salesmanOrders = orderExecutions.filter((item) => item.salesmanId === salesman.id);
        const estimatedTravelMinutes = salesmanPlans
          .map((item) => Number(item.estimatedTravelTime || 0))
          .filter((value) => Number.isFinite(value) && value > 0);
        const avgTravelTimeHours = estimatedTravelMinutes.length
          ? estimatedTravelMinutes.reduce((sum, value) => sum + value, 0) / estimatedTravelMinutes.length / 60
          : 0;
        return {
          id: salesman.id,
          name: salesman.name,
          visits: salesmanPlans.length,
          orders: salesmanOrders.length,
          efficiency: salesmanPlans.length ? Math.round((salesmanCompleted.length / salesmanPlans.length) * 100) : 0,
          conversionRate: salesmanCompleted.length
            ? Math.round((salesmanOrders.length / salesmanCompleted.length) * 1000) / 10
            : 0,
          travelTime: Math.round(avgTravelTimeHours * 10) / 10,
        };
      })
      .sort((a, b) => b.visits - a.visits);

    const outcomeDefinitions = [
      { bucket: 'order', name: 'Επιτυχείς Παραγγελίες', color: '#059669' },
      { bucket: 'follow-up', name: 'Απαιτείται Follow-up', color: '#F59E0B' },
      { bucket: 'quote', name: 'Εκκρεμείς Προσφορές', color: '#2563EB' },
      { bucket: 'no-interest', name: 'Χωρίς Ενδιαφέρον', color: '#EF4444' },
    ];

    const conversionOutcomes = outcomeDefinitions.map((definition) => {
      const count = completedExecutions.filter(
        (item) => normalizeOutcomeBucket(item.outcome, item.nextAction) === definition.bucket
      ).length;
      return {
        name: definition.name,
        value: count,
        color: definition.color,
        percentage: completedExecutions.length
          ? Math.round((count / completedExecutions.length) * 1000) / 10
          : 0,
      };
    });

    const conversionPipeline = [
      {
        outcome: 'Άμεσες Παραγγελίες',
        visits: orderExecutions.length,
        averagePerVisit: completedExecutions.length
          ? Math.round((orderExecutions.length / completedExecutions.length) * 1000) / 10
          : 0,
        icon: 'ShoppingCart',
        color: 'text-success',
        bgColor: 'bg-success/10',
      },
      {
        outcome: 'Pipeline Παρακολούθησης',
        visits: conversionOutcomes.find((item) => item.name === 'Απαιτείται Follow-up')?.value || 0,
        averagePerVisit: completedExecutions.length
          ? Math.round(
              ((conversionOutcomes.find((item) => item.name === 'Απαιτείται Follow-up')?.value || 0) /
                completedExecutions.length) *
                1000
            ) / 10
          : 0,
        icon: 'Clock',
        color: 'text-warning',
        bgColor: 'bg-warning/10',
      },
      {
        outcome: 'Αιτήματα Προσφοράς',
        visits: conversionOutcomes.find((item) => item.name === 'Εκκρεμείς Προσφορές')?.value || 0,
        averagePerVisit: completedExecutions.length
          ? Math.round(
              ((conversionOutcomes.find((item) => item.name === 'Εκκρεμείς Προσφορές')?.value || 0) /
                completedExecutions.length) *
                1000
            ) / 10
          : 0,
        icon: 'FileText',
        color: 'text-primary',
        bgColor: 'bg-primary/10',
      },
    ];

    const completedNotes = completedExecutions.map(
      (item) => `${String(item.notes || '')} ${String(item.nextAction || '')}`.toLowerCase()
    );
    const completedCount = Math.max(completedExecutions.length, 1);
    const engagement = [
      {
        label: 'Συνάντηση με Αποφασίζοντα',
        value: Math.round(
          (completedNotes.filter((text) => /decision|αποφασ/.test(text)).length / completedCount) * 100
        ),
        icon: 'Users',
      },
      {
        label: 'Παρουσίαση Προϊόντος',
        value: Math.round(
          (completedNotes.filter((text) => /presentation|demo|παρουσια/.test(text)).length / completedCount) * 100
        ),
        icon: 'Monitor',
      },
      {
        label: 'Συζήτηση Τιμολόγησης',
        value: Math.round(
          (completedNotes.filter((text) => /price|pricing|cost|τιμ/.test(text)).length / completedCount) * 100
        ),
        icon: 'DollarSign',
      },
      {
        label: 'Προγραμματισμός Επόμενης Συνάντησης',
        value: Math.round(
          (completedExecutions.filter((item) => String(item.nextAction || '').trim()).length / completedCount) * 100
        ),
        icon: 'Calendar',
      },
    ];

    return res.json({
      ok: true,
      brand,
      range: {
        preset,
        start: range.start,
        end: range.end,
      },
      filters: {
        territoryId: territoryId || null,
        salesmanId: salesmanId || null,
        customerSegment,
      },
      options: {
        territories: territoryItems.map((item) => ({ value: item.id, label: item.name })),
        salesmen: salesmanItems.map((item) => ({ value: item.id, label: item.name })),
      },
      overview: {
        visitCompletionRate: Math.round(currentCompletionRate * 10) / 10,
        visitCompletionRateChange: formatSignedPercent(getPercentDelta(currentCompletionRate, previousCompletionRate)),
        averageVisitDurationMinutes: Math.round(currentAvgDuration),
        averageVisitDurationChange: formatSignedPercent(getPercentDelta(currentAvgDuration, previousAvgDuration)),
        territoryCoverageRate: Math.round(currentCoverageRate * 10) / 10,
        territoryCoverageRateChange: formatSignedPercent(getPercentDelta(currentCoverageRate, previousCoverageRate)),
        visitToOrderRate: Math.round(currentOrderRate * 10) / 10,
        visitToOrderRateChange: formatSignedPercent(getPercentDelta(currentOrderRate, previousOrderRate)),
        totals: {
          plannedVisits: currentPlans.length,
          completedVisits: completedExecutions.length,
          coveredTerritories: visitedTerritoryIds.size,
          activeTerritories: activeTerritoryItems.length,
          orderVisits: orderExecutions.length,
        },
      },
      trends: dailyTrend,
      territories: territoryAnalytics,
      salesmen: salesmanAnalytics,
      conversion: {
        outcomes: conversionOutcomes,
        pipeline: conversionPipeline,
        engagement,
      },
    });
  } catch (error) {
    logger.error('Failed to load analytics overview', error);
    return toErrorResponse(res, 500, 'Failed to load analytics overview.', 'analytics/load-failed');
  }
});

app.get('/salesmen', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const snapshot = await db
      .collection('users')
      .where('brands', 'array-contains', brand)
      .limit(300)
      .get();

    const users = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((user) => SALESMAN_ROLES.has(normalizeRole(user.role)))
      .map((user) => {
        const firstName = String(user.firstName || user.first_name || '').trim();
        const lastName = String(user.lastName || user.last_name || '').trim();
        const fullName = `${firstName} ${lastName}`.trim();

        return {
          id: user.id,
          name: fullName || String(user.name || user.email || user.id),
          role: normalizeRole(user.role),
          brands: normalizeBrands(user.brands),
        };
      });

    return res.json({ ok: true, brand, items: users });
  } catch (error) {
    logger.error('Failed to load salesmen', error);
    return toErrorResponse(res, 500, 'Failed to load salesmen.', 'salesmen/load-failed');
  }
});

app.get('/visit-plans', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const authContext = req.authContext || {};
    const requestedSalesmanId = String(req.query.salesmanId || '').trim();
    const requestedDate = toDateOnlyString(req.query.date);
    const weekOf = toDateOnlyString(req.query.weekOf);
    const limitParam = Number(req.query.limit || 500);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 500;

    let effectiveSalesmanId = requestedSalesmanId || authContext.uid;
    if (isManagerRole(authContext.role) && !requestedSalesmanId) {
      effectiveSalesmanId = '';
    }

    if (
      requestedSalesmanId &&
      requestedSalesmanId !== authContext.uid &&
      !isManagerRole(authContext.role)
    ) {
      return toErrorResponse(
        res,
        403,
        'You are not allowed to access other salesmen visit plans.',
        'visit-plans/forbidden-salesman'
      );
    }

    let query = db.collection('visitPlans').where('brand', '==', brand);
    if (effectiveSalesmanId) {
      query = query.where('salesmanId', '==', effectiveSalesmanId);
    }

    const snapshot = await query.limit(limit).get();
    let items = snapshot.docs.map((doc) => normalizeVisitPlanDoc(doc.id, doc.data() || {}));

    if (requestedDate) {
      items = items.filter((item) => item.date === requestedDate);
    }

    if (weekOf) {
      const range = getWeekRangeFromDate(weekOf);
      if (!range) {
        return toErrorResponse(res, 400, 'weekOf must be a valid YYYY-MM-DD date.', 'visit-plans/invalid-week');
      }
      items = items.filter((item) => item.date && item.date >= range.start && item.date <= range.end);
    }

    items.sort((a, b) => {
      const left = `${a.date || ''} ${a.startTime || a.timeSlot || ''}`.trim();
      const right = `${b.date || ''} ${b.startTime || b.timeSlot || ''}`.trim();
      return left.localeCompare(right);
    });

    return res.json({
      ok: true,
      brand,
      salesmanId: effectiveSalesmanId || null,
      items,
    });
  } catch (error) {
    logger.error('Failed to load visit plans', error);
    return toErrorResponse(res, 500, 'Failed to load visit plans.', 'visit-plans/load-failed');
  }
});

app.post('/visit-plans', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const authContext = req.authContext || {};
    const payload = req.body || {};
    const requestedSalesmanId = String(payload.salesmanId || '').trim() || authContext.uid;

    if (requestedSalesmanId !== authContext.uid && !isManagerRole(authContext.role)) {
      return toErrorResponse(
        res,
        403,
        'You are not allowed to save visit plans for other salesmen.',
        'visit-plans/forbidden-write'
      );
    }

    const date = toDateOnlyString(payload.date);
    if (!date) {
      return toErrorResponse(res, 400, 'Visit date is required (YYYY-MM-DD).', 'visit-plans/date-required');
    }

    const customerId = String(payload.customerId || '').trim();
    const customerName = String(payload.customerName || '').trim();
    if (!customerId && !customerName) {
      return toErrorResponse(
        res,
        400,
        'Either customerId or customerName is required.',
        'visit-plans/customer-required'
      );
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const documentId = String(payload.id || '').trim();

    const data = {
      brand,
      territoryId: String(payload.territoryId || '').trim() || null,
      customerId: customerId || null,
      customerCode: String(payload.customerCode || '').trim() || null,
      customerName: customerName || null,
      company: String(payload.company || '').trim() || null,
      location: String(payload.location || '').trim() || null,
      address: String(payload.address || '').trim() || null,
      phone: String(payload.phone || '').trim() || null,
      salesmanId: requestedSalesmanId,
      salesmanName: String(payload.salesmanName || '').trim() || null,
      date,
      startTime: String(payload.startTime || '').trim() || null,
      endTime: String(payload.endTime || '').trim() || null,
      timeSlot: String(payload.timeSlot || '').trim() || null,
      priority: String(payload.priority || 'medium').trim().toLowerCase(),
      type: String(payload.type || '').trim().toLowerCase() || null,
      duration: Number.isFinite(Number(payload.duration)) ? Number(payload.duration) : null,
      objective: String(payload.objective || '').trim() || null,
      notes: String(payload.notes || '').trim() || null,
      estimatedTravelTime: Number.isFinite(Number(payload.estimatedTravelTime))
        ? Number(payload.estimatedTravelTime)
        : null,
      distance: Number.isFinite(Number(payload.distance)) ? Number(payload.distance) : null,
      status: String(payload.status || 'upcoming').trim().toLowerCase(),
      createdBy: authContext.uid,
      updatedAt: now,
    };

    let ref;
    if (documentId) {
      ref = db.collection('visitPlans').doc(documentId);
      await ref.set(data, { merge: true });
    } else {
      ref = db.collection('visitPlans').doc();
      await ref.set({ ...data, createdAt: now }, { merge: true });
    }

    const saved = await ref.get();
    return res.status(201).json({
      ok: true,
      brand,
      item: normalizeVisitPlanDoc(saved.id, saved.data() || {}),
    });
  } catch (error) {
    logger.error('Failed to save visit plan', error);
    return toErrorResponse(res, 500, 'Failed to save visit plan.', 'visit-plans/save-failed');
  }
});

app.get('/visit-executions', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const authContext = req.authContext || {};
    const requestedSalesmanId = String(req.query.salesmanId || '').trim();
    const requestedDate = toDateOnlyString(req.query.date);
    const requestedWeekOf = toDateOnlyString(req.query.weekOf);
    const requestedVisitPlanId = String(req.query.visitPlanId || '').trim();
    const requestedStatus = String(req.query.status || '').trim().toLowerCase();
    const limitParam = Number(req.query.limit || 500);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 500;

    let effectiveSalesmanId = requestedSalesmanId || authContext.uid;
    if (isManagerRole(authContext.role) && !requestedSalesmanId) {
      effectiveSalesmanId = '';
    }

    if (
      requestedSalesmanId &&
      requestedSalesmanId !== authContext.uid &&
      !isManagerRole(authContext.role)
    ) {
      return toErrorResponse(
        res,
        403,
        'You are not allowed to access other salesmen visit executions.',
        'visit-executions/forbidden-salesman'
      );
    }

    let query = db.collection('visitExecutions').where('brand', '==', brand);
    if (effectiveSalesmanId) {
      query = query.where('salesmanId', '==', effectiveSalesmanId);
    }

    const snapshot = await query.limit(limit).get();
    let items = snapshot.docs.map((doc) => normalizeVisitExecutionDoc(doc.id, doc.data() || {}));

    if (requestedDate) {
      items = items.filter((item) => item.date === requestedDate);
    }

    if (requestedWeekOf) {
      const range = getWeekRangeFromDate(requestedWeekOf);
      if (!range) {
        return toErrorResponse(res, 400, 'weekOf must be a valid YYYY-MM-DD date.', 'visit-executions/invalid-week');
      }
      items = items.filter((item) => item.date && item.date >= range.start && item.date <= range.end);
    }

    if (requestedVisitPlanId) {
      items = items.filter((item) => item.visitPlanId === requestedVisitPlanId);
    }

    if (requestedStatus) {
      items = items.filter((item) => item.status === requestedStatus);
    }

    items.sort((a, b) => {
      const left = `${a.date || ''} ${a.checkInAt || ''} ${a.updatedAt || ''}`.trim();
      const right = `${b.date || ''} ${b.checkInAt || ''} ${b.updatedAt || ''}`.trim();
      return left.localeCompare(right);
    });

    return res.json({
      ok: true,
      brand,
      salesmanId: effectiveSalesmanId || null,
      items,
    });
  } catch (error) {
    logger.error('Failed to load visit executions', error);
    return toErrorResponse(
      res,
      500,
      'Failed to load visit executions.',
      'visit-executions/load-failed'
    );
  }
});

app.post('/visit-executions', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const authContext = req.authContext || {};
    const payload = req.body || {};
    const requestedSalesmanId = String(payload.salesmanId || '').trim() || authContext.uid;

    if (requestedSalesmanId !== authContext.uid && !isManagerRole(authContext.role)) {
      return toErrorResponse(
        res,
        403,
        'You are not allowed to create visit executions for other salesmen.',
        'visit-executions/forbidden-write'
      );
    }

    const date = toDateOnlyString(payload.date) || new Date().toISOString().slice(0, 10);

    const now = admin.firestore.FieldValue.serverTimestamp();
    const data = {
      brand,
      visitPlanId: String(payload.visitPlanId || '').trim() || null,
      territoryId: String(payload.territoryId || '').trim() || null,
      customerId: String(payload.customerId || '').trim() || null,
      customerCode: String(payload.customerCode || '').trim() || null,
      customerName: String(payload.customerName || '').trim() || null,
      company: String(payload.company || '').trim() || null,
      location: String(payload.location || '').trim() || null,
      address: String(payload.address || '').trim() || null,
      phone: String(payload.phone || '').trim() || null,
      salesmanId: requestedSalesmanId,
      salesmanName: String(payload.salesmanName || '').trim() || null,
      date,
      checkInAt: payload.checkInAt ? new Date(payload.checkInAt) : now,
      checkOutAt: payload.checkOutAt ? new Date(payload.checkOutAt) : null,
      completedAt: payload.completedAt ? new Date(payload.completedAt) : null,
      status: String(payload.status || 'in-progress').trim().toLowerCase(),
      outcome: String(payload.outcome || '').trim() || null,
      notes: String(payload.notes || '').trim() || null,
      nextAction: String(payload.nextAction || '').trim() || null,
      checklist: payload.checklist && typeof payload.checklist === 'object' ? payload.checklist : {},
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      updatedAt: now,
      createdBy: authContext.uid,
    };

    const ref = db.collection('visitExecutions').doc();
    await ref.set({ ...data, createdAt: now }, { merge: true });

    const visitPlanId = String(payload.visitPlanId || '').trim();
    if (visitPlanId) {
      await db.collection('visitPlans').doc(visitPlanId).set(
        {
          status: data.status,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    const saved = await ref.get();
    return res.status(201).json({
      ok: true,
      brand,
      item: normalizeVisitExecutionDoc(saved.id, saved.data() || {}),
    });
  } catch (error) {
    logger.error('Failed to create visit execution', error);
    return toErrorResponse(
      res,
      500,
      'Failed to create visit execution.',
      'visit-executions/create-failed'
    );
  }
});

app.patch('/visit-executions/:id', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) {
      return;
    }

    const executionId = String(req.params.id || '').trim();
    if (!executionId) {
      return toErrorResponse(res, 400, 'Execution id is required.', 'visit-executions/id-required');
    }

    const ref = db.collection('visitExecutions').doc(executionId);
    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return toErrorResponse(res, 404, 'Visit execution not found.', 'visit-executions/not-found');
    }

    const existing = snapshot.data() || {};
    const authContext = req.authContext || {};
    const existingSalesmanId = String(existing.salesmanId || '').trim();
    if (existingSalesmanId && existingSalesmanId !== authContext.uid && !isManagerRole(authContext.role)) {
      return toErrorResponse(
        res,
        403,
        'You are not allowed to update this visit execution.',
        'visit-executions/forbidden-update'
      );
    }

    const payload = req.body || {};
    const now = admin.firestore.FieldValue.serverTimestamp();
    const patch = {
      updatedAt: now,
    };

    if (payload.status !== undefined) {
      patch.status = String(payload.status || existing.status || 'in-progress').trim().toLowerCase();
    }
    if (payload.checkInAt !== undefined) {
      patch.checkInAt = payload.checkInAt ? new Date(payload.checkInAt) : null;
    }
    if (payload.checkOutAt !== undefined) {
      patch.checkOutAt = payload.checkOutAt ? new Date(payload.checkOutAt) : null;
    }
    if (payload.completedAt !== undefined) {
      patch.completedAt = payload.completedAt ? new Date(payload.completedAt) : null;
    }
    if (payload.outcome !== undefined) {
      patch.outcome = String(payload.outcome || '').trim() || null;
    }
    if (payload.notes !== undefined) {
      patch.notes = String(payload.notes || '').trim() || null;
    }
    if (payload.nextAction !== undefined) {
      patch.nextAction = String(payload.nextAction || '').trim() || null;
    }
    if (payload.checklist !== undefined) {
      patch.checklist = payload.checklist && typeof payload.checklist === 'object' ? payload.checklist : {};
    }
    if (payload.attachments !== undefined) {
      patch.attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
    }

    await ref.set(patch, { merge: true });

    const visitPlanId = String(existing.visitPlanId || '').trim();
    if (visitPlanId && patch.status) {
      await db.collection('visitPlans').doc(visitPlanId).set(
        {
          status: patch.status,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    const saved = await ref.get();
    return res.json({
      ok: true,
      brand,
      item: normalizeVisitExecutionDoc(saved.id, saved.data() || {}),
    });
  } catch (error) {
    logger.error('Failed to update visit execution', error);
    return toErrorResponse(
      res,
      500,
      'Failed to update visit execution.',
      'visit-executions/update-failed'
    );
  }
});

// ── Manager: Team Status ─────────────────────────────────────────────────────
app.get('/manager/team-status', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) return;

    const authContext = req.authContext || {};
    if (!isManagerRole(authContext.role)) {
      return toErrorResponse(res, 403, 'Manager access required.', 'manager/forbidden');
    }

    const date = toDateOnlyString(req.query.date) || new Date().toISOString().slice(0, 10);

    // Fetch salesmen, visit plans for date, and visit executions for date in parallel
    const [salesmenSnap, plansSnap, execSnap] = await Promise.all([
      db.collection('users').where('brands', 'array-contains', brand).limit(300).get(),
      db.collection('visitPlans').where('brand', '==', brand).limit(500).get(),
      db.collection('visitExecutions').where('brand', '==', brand).limit(500).get(),
    ]);

    // Build salesman map from users collection
    const salesmenMap = {};
    salesmenSnap.docs.forEach((doc) => {
      const u = doc.data() || {};
      const role = normalizeRole(u.role);
      if (!SALESMAN_ROLES.has(role)) return;
      const firstName = String(u.firstName || u.first_name || '').trim();
      const lastName = String(u.lastName || u.last_name || '').trim();
      const name = `${firstName} ${lastName}`.trim() || String(u.name || u.email || doc.id);
      salesmenMap[doc.id] = {
        uid: doc.id,
        displayName: name,
        territory: String(u.territory || u.territoryName || '').trim() || null,
        visitsPlanned: 0,
        visitsCompleted: 0,
        visitsInProgress: 0,
        visitsMissed: 0,
        lastActivityAt: null,
      };
    });

    // Count visit plans per salesman for the requested date
    plansSnap.docs.forEach((doc) => {
      const p = doc.data() || {};
      const planDate = toDateOnlyString(p.date);
      if (planDate !== date) return;
      const sid = String(p.salesmanId || '').trim();
      if (!salesmenMap[sid]) return;
      salesmenMap[sid].visitsPlanned += 1;
    });

    // Count executions per salesman for the requested date
    execSnap.docs.forEach((doc) => {
      const e = doc.data() || {};
      const execDate = toDateOnlyString(e.date);
      if (execDate !== date) return;
      const sid = String(e.salesmanId || '').trim();
      if (!salesmenMap[sid]) return;
      const status = String(e.status || '').toLowerCase();
      if (status === 'completed') {
        salesmenMap[sid].visitsCompleted += 1;
      } else if (status === 'in-progress') {
        salesmenMap[sid].visitsInProgress += 1;
      } else if (status === 'missed' || status === 'cancelled') {
        salesmenMap[sid].visitsMissed += 1;
      }
      const updatedAt = toIsoString(e.updatedAt) || toIsoString(e.createdAt);
      if (updatedAt && (!salesmenMap[sid].lastActivityAt || updatedAt > salesmenMap[sid].lastActivityAt)) {
        salesmenMap[sid].lastActivityAt = updatedAt;
      }
    });

    const salesmen = Object.values(salesmenMap).map((s) => ({
      ...s,
      efficiency: s.visitsPlanned > 0 ? Math.round((s.visitsCompleted / s.visitsPlanned) * 100) : 0,
    }));

    const totalPlanned = salesmen.reduce((acc, s) => acc + s.visitsPlanned, 0);
    const totalCompleted = salesmen.reduce((acc, s) => acc + s.visitsCompleted, 0);
    const totalInProgress = salesmen.reduce((acc, s) => acc + s.visitsInProgress, 0);
    const activeSalesmen = salesmen.filter((s) => s.visitsCompleted > 0 || s.visitsInProgress > 0).length;

    return res.json({
      ok: true,
      brand,
      date,
      salesmen,
      summary: {
        totalSalesmen: salesmen.length,
        activeSalesmen,
        totalVisitsPlanned: totalPlanned,
        totalVisitsCompleted: totalCompleted,
        totalVisitsInProgress: totalInProgress,
        planVsActual: totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0,
      },
    });
  } catch (error) {
    logger.error('Failed to load manager team status', error);
    return toErrorResponse(res, 500, 'Failed to load team status.', 'manager/team-status-failed');
  }
});

// ── Manager: Activity Feed ────────────────────────────────────────────────────
app.get('/manager/activity', authenticateRequest, async (req, res) => {
  try {
    const brand = assertBrandAccess(req, res);
    if (!brand) return;

    const authContext = req.authContext || {};
    if (!isManagerRole(authContext.role)) {
      return toErrorResponse(res, 403, 'Manager access required.', 'manager/forbidden');
    }

    const limitParam = Number(req.query.limit || 30);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;
    const since = req.query.since ? new Date(req.query.since) : null;

    const snapshot = await db
      .collection('visitExecutions')
      .where('brand', '==', brand)
      .limit(200)
      .get();

    let items = snapshot.docs.map((doc) => normalizeVisitExecutionDoc(doc.id, doc.data() || {}));

    // Filter by since if provided
    if (since && !Number.isNaN(since.getTime())) {
      items = items.filter((item) => item.updatedAt && item.updatedAt >= since.toISOString());
    }

    // Sort by updatedAt desc
    items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    items = items.slice(0, limit);

    const activities = items.map((item) => {
      let type = 'check_in';
      if (item.status === 'completed') type = 'visit_completed';
      else if (item.status === 'missed' || item.status === 'cancelled') type = 'visit_missed';

      const customerLabel = item.customerName || item.company || item.customerCode || item.customerId || 'Πελάτης';
      const outcome = item.status === 'completed' ? 'positive' : item.status === 'missed' ? 'negative' : 'neutral';

      return {
        id: item.id,
        type,
        salesmanName: item.salesmanName || item.salesmanId || 'Πωλητής',
        customerName: customerLabel,
        timestamp: item.updatedAt || item.checkInAt || item.createdAt,
        outcome,
        status: item.status,
        date: item.date,
      };
    });

    return res.json({ ok: true, brand, activities });
  } catch (error) {
    logger.error('Failed to load manager activity', error);
    return toErrorResponse(res, 500, 'Failed to load activity.', 'manager/activity-failed');
  }
});

app.use((error, req, res, next) => {
  logger.error('Unhandled functions error.', error);
  return toErrorResponse(res, 500, 'Internal server error.', 'server/internal');
});

exports.api = onRequest({ region: 'europe-west1' }, app);