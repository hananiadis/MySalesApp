import { useMemo } from 'react';
import { useQuery } from 'react-query';
import KpiCard from '../../components/KpiCard/KpiCard';
import MonthlyAdjustmentsChart from '../../components/Charts/MonthlyAdjustmentsChart';
import RotationChart from '../../components/Charts/RotationChart';
import t from '../../utils/translations';
import {
  getFastMovers,
  getLowStockStats,
  getMonthlyAdjustments,
  getOpenSupplierOrders,
  getPackedOrdersToday,
  getRotationScore,
  getSlowMovers,
  getStockValue,
} from '../../services/warehouseKpiService';
import el from '../../utils/translations';

const formatCurrency = (value) =>
  typeof value === 'number' ? value.toLocaleString('en-IE', { style: 'currency', currency: 'EUR' }) : '—';

const formatNumber = (value) =>
  typeof value === 'number' ? value.toLocaleString('en-US') : '—';

const WarehouseDashboard = () => {
  const lowStockQuery = useQuery(['lowStock'], getLowStockStats);
  const stockValueQuery = useQuery(['stockValue'], getStockValue);
  const adjustmentsQuery = useQuery(['monthlyAdjustments'], getMonthlyAdjustments);
  const rotationQuery = useQuery(['rotationScore'], getRotationScore);
  const fastMoversQuery = useQuery(['fastMovers'], getFastMovers);
  const slowMoversQuery = useQuery(['slowMovers'], getSlowMovers);
  const openOrdersQuery = useQuery(['openSupplierOrders'], getOpenSupplierOrders);
  const packedTodayQuery = useQuery(['packedOrdersToday'], getPackedOrdersToday);

  const kpis = useMemo(() => {
    const lowStockCount = lowStockQuery.data?.count ?? 0;
    const stockValue = stockValueQuery.data?.totalValue ?? 0;
    const openOrders = openOrdersQuery.data?.count ?? 0;
    const packedToday = packedTodayQuery.data?.count ?? 0;

    return [
      {
        title: t.dashboard.lowStockCount,
        value: formatNumber(lowStockCount),
        variant: lowStockCount > 0 ? 'warning' : 'good',
        hint: t.dashboard.skusUnderThreshold,
      },
      {
        title: t.dashboard.stockValue,
        value: formatCurrency(stockValue),
        variant: 'default',
      },
      {
        title: t.dashboard.openSupplierOrders,
        value: formatNumber(openOrders),
        variant: openOrders > 15 ? 'warning' : 'good',
      },
      {
        title: t.dashboard.packedToday,
        value: formatNumber(packedToday),
        variant: packedToday < 10 ? 'warning' : 'good',
      },
    ];
  }, [
    lowStockQuery.data?.count,
    stockValueQuery.data?.totalValue,
    openOrdersQuery.data?.count,
    packedTodayQuery.data?.count,
  ]);

  const isLoading =
    lowStockQuery.isLoading ||
    stockValueQuery.isLoading ||
    adjustmentsQuery.isLoading ||
    rotationQuery.isLoading ||
    fastMoversQuery.isLoading ||
    slowMoversQuery.isLoading ||
    openOrdersQuery.isLoading ||
    packedTodayQuery.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">{t.nav.dashboard}</p>
        <h1 className="text-2xl font-bold text-slate-900">{t.dashboard.title}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {t.dashboard.subtitle}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                {t.dashboard.monthlyAdjustments}
              </p>
              <h2 className="text-lg font-bold text-slate-900">Μηνιαίες IN/OUT</h2>
            </div>
          </div>
          {adjustmentsQuery.data && adjustmentsQuery.data.length > 0 ? (
            <MonthlyAdjustmentsChart data={adjustmentsQuery.data} />
          ) : (
            <p className="mt-4 text-sm text-slate-500">Δεν υπάρχουν διαθέσιμα δεδομένα προσαρμογής.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                {t.dashboard.rotationScore}
              </p>
              <h2 className="text-lg font-bold text-slate-900">
                Κορυφαίοι · Μ.Ο {rotationQuery.data?.average ?? '—'}
              </h2>
            </div>
          </div>
          {rotationQuery.data?.items?.length ? (
            <RotationChart data={rotationQuery.data.items} />
          ) : (
            <p className="mt-4 text-sm text-slate-500">Δεν υπάρχουν διαθέσιμα δεδομένα κυκλοφορίας.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">{t.dashboard.fastMovers} (Top 10)</h3>
            <p className="text-xs text-slate-500">Ταχύτητα</p>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {fastMoversQuery.data?.map((item) => (
              <li key={item.productCode} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-slate-500">{item.productCode}</p>
                </div>
                <p className="font-semibold text-slate-800">{formatNumber(item.velocity)}</p>
              </li>
            )) || <p className="mt-2 text-sm text-slate-500">Δεν υπάρχουν δεδομένα.</p>}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">{t.dashboard.slowMovers} (Top 10)</h3>
            <p className="text-xs text-slate-500">Ταχύτητα</p>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {slowMoversQuery.data?.map((item) => (
              <li key={item.productCode} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-slate-500">{item.productCode}</p>
                </div>
                <p className="font-semibold text-slate-800">{formatNumber(item.velocity)}</p>
              </li>
            )) || <p className="mt-2 text-sm text-slate-500">Δεν υπάρχουν δεδομένα.</p>}
          </ul>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Φόρτωση δεδομένων…</p> : null}
    </div>
  );
};

export default WarehouseDashboard;

