import { Link } from 'react-router-dom';

const supplierOrders = [
  { id: 'SO-1042', supplier: 'Nova Supply', status: 'In Transit', eta: 'Dec 02' },
  { id: 'SO-1041', supplier: 'Kivos Central', status: 'Received', eta: 'Nov 29' },
  { id: 'SO-1040', supplier: 'Axis Parts', status: 'Pending', eta: 'Dec 05' },
  { id: 'SO-1039', supplier: 'Delta Materials', status: 'Pending', eta: 'Dec 06' },
];

const statusBadge = {
  Received: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Pending: 'bg-amber-50 text-amber-700 border-amber-100',
  'In Transit': 'bg-sky-50 text-sky-700 border-sky-100',
};

const SupplierOrdersList = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
            Supplier Orders
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Inbound orders</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track pending, in-transit, and received supplier shipments.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          New order
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-4 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>ID</span>
          <span>Supplier</span>
          <span>Status</span>
          <span className="text-right">ETA</span>
        </div>
        <div className="divide-y divide-slate-100">
          {supplierOrders.map((order) => (
            <Link
              key={order.id}
              to={`/supplier-orders/${order.id}`}
              className="grid grid-cols-4 items-center px-4 py-3 text-sm hover:bg-slate-50"
            >
              <span className="font-semibold text-slate-900">{order.id}</span>
              <span className="text-slate-700">{order.supplier}</span>
              <span
                className={[
                  'inline-flex w-fit items-center rounded-full border px-2 py-1 text-xs font-semibold',
                  statusBadge[order.status] || 'bg-slate-100 text-slate-700 border-slate-200',
                ].join(' ')}
              >
                {order.status}
              </span>
              <span className="text-right text-slate-600">{order.eta}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SupplierOrdersList;
