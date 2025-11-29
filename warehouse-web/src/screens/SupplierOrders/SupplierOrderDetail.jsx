import { Link, useParams } from 'react-router-dom';

const SupplierOrderDetail = () => {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Supplier Order</p>
          <h1 className="text-2xl font-bold text-slate-900">{id}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Summary of line items, status, and delivery timeline.
          </p>
        </div>
        <Link
          to="/supplier-orders"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Back to orders
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Status</h2>
          <dl className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="flex justify-between">
              <dt className="text-slate-600">Current</dt>
              <dd className="font-semibold">In Transit</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">ETA</dt>
              <dd className="font-semibold">Dec 02, 10:00</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-600">Supplier</dt>
              <dd className="font-semibold">Kivos Central</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
          <p className="mt-3 text-sm text-slate-700">
            Use this space to capture receiving instructions, carrier updates, and QC requirements.
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Carrier confirmed arrival window.</li>
            <li>QC team on standby for inspection.</li>
            <li>Allocate dock 3 for unloading.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Line items</h2>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Export CSV
          </button>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>SKU</span>
          <span>Description</span>
          <span className="text-right">Qty</span>
          <span className="text-right">Cost</span>
        </div>
        <div className="mt-2 divide-y divide-slate-100 text-sm">
          {['KVS-104', 'KVS-202', 'KVS-418'].map((sku) => (
            <div key={sku} className="grid grid-cols-4 items-center gap-3 py-3">
              <span className="font-semibold text-slate-900">{sku}</span>
              <span className="text-slate-700">Component replenishment</span>
              <span className="text-right font-semibold text-slate-800">240</span>
              <span className="text-right text-slate-600">$12,480</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SupplierOrderDetail;
