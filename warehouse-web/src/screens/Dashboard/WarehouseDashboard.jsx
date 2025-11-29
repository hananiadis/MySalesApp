import { useMemo } from 'react';
import { useQuery } from 'react-query';
import KpiCard from '../../components/KpiCard/KpiCard';
import MonthlyAdjustmentsChart from '../../components/Charts/MonthlyAdjustmentsChart';
import RotationChart from '../../components/Charts/RotationChart';
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
        title: 'Low Stock Count',
        value: formatNumber(lowStockCount),
        variant: lowStockCount > 0 ? 'warning' : 'good',
        hint: 'SKUs under threshold',
      },
      {
        title: 'Stock Value (€)',
        value: formatCurrency(stockValue),
        variant: 'default',
      },
      {
        title: 'Open Supplier Orders',
        value: formatNumber(openOrders),
        variant: openOrders > 15 ? 'warning' : 'good',
      },
      {
        title: 'Packed Orders Today',
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
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Dashboard</p>
        <h1 className="text-2xl font-bold text-slate-900">Kivos Warehouse KPIs</h1>
        <p className="mt-2 text-sm text-slate-600">
          Live stock health, supplier orders, and rotation performance.
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
                Stock Adjustments
              </p>
              <h2 className="text-lg font-bold text-slate-900">Monthly IN/OUT</h2>
            </div>
          </div>
          {adjustmentsQuery.data && adjustmentsQuery.data.length > 0 ? (
            <MonthlyAdjustmentsChart data={adjustmentsQuery.data} />
          ) : (
            <p className="mt-4 text-sm text-slate-500">No adjustment data available.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                Stock Rotation
              </p>
              <h2 className="text-lg font-bold text-slate-900">
                Top movers · Avg {rotationQuery.data?.average ?? '—'}
              </h2>
            </div>
          </div>
          {rotationQuery.data?.items?.length ? (
            <RotationChart data={rotationQuery.data.items} />
          ) : (
            <p className="mt-4 text-sm text-slate-500">No rotation data available.</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Top 10 Fast Movers</h3>
            <p className="text-xs text-slate-500">Velocity</p>
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
            )) || <p className="mt-2 text-sm text-slate-500">No data.</p>}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Top 10 Slow Movers</h3>
            <p className="text-xs text-slate-500">Velocity</p>
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
            )) || <p className="mt-2 text-sm text-slate-500">No data.</p>}
          </ul>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-slate-500">Loading data…</p> : null}
    </div>
  );
};

export default WarehouseDashboard;
