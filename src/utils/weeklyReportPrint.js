import { formatDateDDMMYYYY, getCategoryLabel, PAYMENT_METHOD_LABELS, INVOICE_TYPE_LABELS } from '../constants/expenseConstants';

const escapeHtml = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const formatMoney = (value) => {
  const num = Number(value || 0);
  return `€${num.toFixed(2)}`;
};

const safeDate = (value) => {
  if (!value) return '';
  try {
    return formatDateDDMMYYYY(new Date(value));
  } catch {
    return String(value);
  }
};

const safeDateTime = (value) => {
  if (!value) return '';
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  } catch {
    return String(value);
  }
};

const formatKm = (value) => {
  if (value == null || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  return `${num.toFixed(1)} km`;
};

const formatLocations = (locations) => {
  const entries = Object.entries(locations || {});
  const names = entries
    .filter(([, v]) => {
      if (!v) return false;
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') return v.trim().length > 0;
      if (typeof v === 'number') return v > 0;
      if (typeof v === 'object') {
        if ('selected' in v) return !!v.selected;
        if ('value' in v) return !!v.value;
        return true;
      }
      return false;
    })
    .map(([k]) => String(k))
    .filter(Boolean);
  return names.length ? names.join(', ') : '—';
};

const sumAmounts = (items) => {
  return (Array.isArray(items) ? items : []).reduce((sum, e) => sum + Number(e?.amount || 0), 0);
};

const buildExpensesTableRows = (expenses) => {
  const rows = (Array.isArray(expenses) ? expenses : [])
    .slice()
    .sort((a, b) => new Date(a?.date || 0) - new Date(b?.date || 0))
    .map((e) => {
      const date = escapeHtml(safeDate(e?.date));
      const category = escapeHtml(getCategoryLabel(e?.category));
      const desc = escapeHtml(e?.description || '');
      const payment = escapeHtml(PAYMENT_METHOD_LABELS?.[e?.paymentMethod] || e?.paymentMethod || '');
      const invoice = escapeHtml(INVOICE_TYPE_LABELS?.[e?.invoiceType] || e?.invoiceType || '');
      const amount = escapeHtml(formatMoney(e?.amount));

      return `
        <tr>
          <td class="mono">${date}</td>
          <td>${category}</td>
          <td>${desc}</td>
          <td>${payment}${invoice ? ` / ${invoice}` : ''}</td>
          <td class="amount">${amount}</td>
        </tr>
      `;
    })
    .join('');

  return rows || '<tr><td colspan="5" class="muted">Δεν υπάρχουν έξοδα.</td></tr>';
};

const buildDailyTotalsRows = (expensesByDay) => {
  const entries = Object.entries(expensesByDay || {})
    .filter(([k]) => Boolean(k))
    .sort((a, b) => new Date(a[0]) - new Date(b[0]));

  const rows = entries
    .map(([dateKey, items]) => {
      const total = sumAmounts(items);
      return `
        <tr>
          <td class="mono">${escapeHtml(safeDate(dateKey))}</td>
          <td class="amount">${escapeHtml(formatMoney(total))}</td>
        </tr>
      `;
    })
    .join('');

  return rows || '<tr><td colspan="2" class="muted">Δεν υπάρχουν δεδομένα.</td></tr>';
};

export const buildWeeklyReportHtml = ({
  title,
  companyName,
  companyLogoDataUri,
  reportCode,
  weekId,
  weekRange,
  statusLabel,
  status,
  generatedAt,
  userLabel,
  userEmail,
  salesman,
  car,
  mileage,
  locations,
  pettyCash,
  submittedAt,
  approvedAt,
  submittedBy,
  approvedBy,
  report,
  groupOrder,
}) => {
  const totalAmount = Number(report?.totalAmount || 0);
  const expenseCount = Number(report?.expenseCount || 0);

  const trackingMileage = mileage || report?.tracking?.mileage;
  const trackingPettyCash = pettyCash || report?.tracking?.pettyCash;
  const trackingLocations = locations || report?.tracking?.locations || {};

  const businessKm = trackingMileage?.businessKm;
  const pettyCashRemaining = trackingPettyCash?.remaining;
  const statusText = statusLabel || status || '';

  const salesmanLabel = salesman?.label || userLabel || '';
  const salesmanEmail = salesman?.email || userEmail || '';
  const carLabel = car?.label || car?.licensePlate || '';
  const submittedLine = submittedAt
    ? `${safeDateTime(submittedAt)}${submittedBy ? ` • ${submittedBy}` : ''}`
    : '';
  const approvedLine = approvedAt
    ? `${safeDateTime(approvedAt)}${approvedBy ? ` • ${approvedBy}` : ''}`
    : '';

  const groupSections = (Array.isArray(groupOrder) ? groupOrder : [])
    .map((group) => {
      const items = report?.expensesByGroup?.[group] || [];
      if (!Array.isArray(items) || items.length === 0) return '';

      const subtotal = sumAmounts(items);
      return `
        <section class="card" style="margin-top: 14px;">
          <div class="card-title">${escapeHtml(group)}</div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style="width: 92px;">Ημ/νία</th>
                  <th style="width: 160px;">Κατηγορία</th>
                  <th>Περιγραφή</th>
                  <th style="width: 150px;">Πληρωμή</th>
                  <th style="width: 92px;" class="amount">Ποσό</th>
                </tr>
              </thead>
              <tbody>
                ${buildExpensesTableRows(items)}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" class="tfoot-label">Σύνολο ${escapeHtml(group)}</td>
                  <td class="amount tfoot-value">${escapeHtml(formatMoney(subtotal))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      `;
    })
    .join('');

  const allExpenses = Array.isArray(report?.expenses) ? report.expenses : [];
  const hasDaily = report?.expensesByDay && Object.keys(report.expensesByDay).length > 0;

  return `
  <!doctype html>
  <html lang="el">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: A4; margin: 16mm; }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
          background: #ffffff;
        }
        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          padding-bottom: 12px;
          border-bottom: 1px solid #e2e8f0;
        }
        .brand {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .company-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .logo {
          width: 36px;
          height: 36px;
          object-fit: contain;
        }
        .company-name {
          font-size: 12px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: 0.2px;
        }
        .title {
          font-size: 18px;
          font-weight: 900;
          letter-spacing: 0.2px;
        }
        .subtitle {
          font-size: 12px;
          color: #475569;
          line-height: 1.35;
        }
        .meta {
          text-align: right;
          min-width: 220px;
        }
        .pill {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-weight: 800;
          font-size: 11px;
          border: 1px solid #dbeafe;
        }
        .meta-line {
          margin-top: 6px;
          font-size: 11px;
          color: #64748b;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 14px;
        }
        .card {
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px;
          background: #ffffff;
        }
        .card-title {
          font-weight: 900;
          font-size: 12px;
          margin-bottom: 8px;
          color: #0f172a;
        }
        .kv {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 6px 0;
          border-bottom: 1px dashed #e2e8f0;
        }
        .kv:last-child { border-bottom: 0; }
        .k { color: #64748b; font-size: 11px; font-weight: 700; }
        .v { font-size: 11px; font-weight: 900; color: #0f172a; }
        .big { font-size: 16px; }
        .muted { color: #94a3b8; font-size: 11px; text-align: center; padding: 10px 0; }

        .table-wrap { overflow: hidden; border-radius: 10px; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; }
        thead th {
          background: #f8fafc;
          color: #334155;
          font-size: 10px;
          text-align: left;
          padding: 8px 10px;
          border-bottom: 1px solid #e2e8f0;
        }
        tbody td {
          font-size: 10.5px;
          padding: 8px 10px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: top;
        }
        tfoot td {
          padding: 9px 10px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
          font-size: 10.5px;
        }
        .tfoot-label { font-weight: 800; color: #334155; }
        .tfoot-value { font-weight: 900; }
        .amount { text-align: right; font-variant-numeric: tabular-nums; }
        .mono { font-variant-numeric: tabular-nums; }

        .footer {
          margin-top: 16px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          font-size: 10px;
          color: #64748b;
          display: flex;
          justify-content: space-between;
          gap: 12px;
        }

        .section-heading {
          margin-top: 16px;
          font-weight: 900;
          font-size: 12px;
          color: #0f172a;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          ${(companyLogoDataUri || companyName) ? `
            <div class="company-row">
              ${companyLogoDataUri ? `<img class="logo" src="${companyLogoDataUri}" />` : ''}
              ${companyName ? `<div class="company-name">${escapeHtml(companyName)}</div>` : ''}
            </div>
          ` : ''}
          <div class="title">${escapeHtml(title || 'Εβδομαδιαίο Εξοδολόγιο')}</div>
          <div class="subtitle">
            <div><b>Εβδομάδα:</b> ${escapeHtml(weekId)}</div>
            <div><b>Διάστημα:</b> ${escapeHtml(weekRange)}</div>
            <div><b>Πωλητής:</b> ${escapeHtml(salesmanLabel)}${salesmanEmail ? ` (${escapeHtml(salesmanEmail)})` : ''}</div>
          </div>
        </div>
        <div class="meta">
          <div class="pill">${escapeHtml(statusText)}</div>
          ${reportCode ? `<div class="meta-line">Κωδικός: <b>${escapeHtml(reportCode)}</b></div>` : ''}
          <div class="meta-line">Παραγωγή PDF: ${escapeHtml(generatedAt || '')}</div>
          <div class="meta-line">Σύνολο εξόδων: <b>${escapeHtml(formatMoney(totalAmount))}</b></div>
          <div class="meta-line">Αριθμός εξόδων: <b>${escapeHtml(expenseCount)}</b></div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="card-title">Σύνοψη</div>
          <div class="kv"><div class="k">Σύνολο</div><div class="v big">${escapeHtml(formatMoney(totalAmount))}</div></div>
          <div class="kv"><div class="k">Έξοδα</div><div class="v">${escapeHtml(expenseCount)}</div></div>
          <div class="kv"><div class="k">Επαγγελματικά km</div><div class="v">${businessKm != null ? escapeHtml(`${Number(businessKm).toFixed(1)} km`) : '-'}</div></div>
          <div class="kv"><div class="k">Ταμείο υπόλοιπο</div><div class="v">${pettyCashRemaining != null ? escapeHtml(formatMoney(pettyCashRemaining)) : '-'}</div></div>
        </div>

        <div class="card">
          <div class="card-title">Στοιχεία</div>
          ${carLabel ? `<div class="kv"><div class="k">Αυτοκίνητο</div><div class="v">${escapeHtml(carLabel)}</div></div>` : ''}
          <div class="kv"><div class="k">Χιλιομετρ. αρχής</div><div class="v">${escapeHtml(trackingMileage?.startKm != null ? String(trackingMileage.startKm) : '-')}</div></div>
          <div class="kv"><div class="k">Χιλιομετρ. τέλους</div><div class="v">${escapeHtml(trackingMileage?.endKm != null ? String(trackingMileage.endKm) : '-')}</div></div>
          <div class="kv"><div class="k">Ιδιωτικά km</div><div class="v">${escapeHtml(formatKm(trackingMileage?.privateKm))}</div></div>
          <div class="kv"><div class="k">Επαγγελματικά km</div><div class="v">${escapeHtml(formatKm(trackingMileage?.businessKm))}</div></div>
          <div class="kv"><div class="k">Περιοχές</div><div class="v">${escapeHtml(formatLocations(trackingLocations))}</div></div>
          <div class="kv"><div class="k">Ταμείο (προηγ.)</div><div class="v">${escapeHtml(trackingPettyCash?.previousBalance != null ? formatMoney(trackingPettyCash.previousBalance) : '-')}</div></div>
          <div class="kv"><div class="k">Ταμείο (δόθηκε)</div><div class="v">${escapeHtml(trackingPettyCash?.given != null ? formatMoney(trackingPettyCash.given) : '-')}</div></div>
          <div class="kv"><div class="k">Ταμείο (μετρητά)</div><div class="v">${escapeHtml(trackingPettyCash?.spentCash != null ? formatMoney(trackingPettyCash.spentCash) : '-')}</div></div>
          <div class="kv"><div class="k">Ταμείο (τιμολόγια)</div><div class="v">${escapeHtml(trackingPettyCash?.invoiceTotal != null ? formatMoney(trackingPettyCash.invoiceTotal) : '-')}</div></div>
          <div class="kv"><div class="k">Ταμείο (αποδείξεις)</div><div class="v">${escapeHtml(trackingPettyCash?.receiptTotal != null ? formatMoney(trackingPettyCash.receiptTotal) : '-')}</div></div>
          <div class="kv"><div class="k">Ταμείο υπόλοιπο</div><div class="v">${escapeHtml(trackingPettyCash?.remaining != null ? formatMoney(trackingPettyCash.remaining) : '-')}</div></div>
          ${submittedLine ? `<div class="kv"><div class="k">Υποβολή</div><div class="v">${escapeHtml(submittedLine)}</div></div>` : ''}
          ${approvedLine ? `<div class="kv"><div class="k">Έγκριση</div><div class="v">${escapeHtml(approvedLine)}</div></div>` : ''}

          <div class="section-heading">Όλα τα έξοδα (${escapeHtml(allExpenses.length)})</div>
          <div class="subtitle">Ακολουθούν αναλυτικά ανά ομάδα κατηγορίας.</div>
        </div>
      </div>

      ${(report?.tracking?.review?.note || '').trim() ? `
        <section class="card" style="margin-top: 14px;">
          <div class="card-title">Παρατηρήσεις</div>
          <div class="subtitle" style="margin-top: 2px;">
            ${escapeHtml(String(report.tracking.review.note))}
          </div>
        </section>
      ` : ''}

      ${groupSections || ''}

      ${hasDaily ? `
        <section class="card" style="margin-top: 14px;">
          <div class="card-title">Ημερήσια Ανάλυση</div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ημέρα</th>
                  <th class="amount">Σύνολο</th>
                </tr>
              </thead>
              <tbody>
                ${buildDailyTotalsRows(report.expensesByDay)}
              </tbody>
            </table>
          </div>
        </section>
      ` : ''}

      <div class="footer">
        <div>${escapeHtml(companyName || 'MySalesApp')} • ${escapeHtml(title || 'Εβδομαδιαίο Εξοδολόγιο')}</div>
        <div>WeekId: ${escapeHtml(weekId)} • ${escapeHtml(weekRange)}</div>
      </div>
    </body>
  </html>
  `;
};
