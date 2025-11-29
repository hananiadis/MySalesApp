const events = [
  { id: 1, action: 'Received shipment SO-1041', actor: 'Priya', time: '2h ago' },
  { id: 2, action: 'Adjusted inventory for SKU KVS-202', actor: 'Luis', time: '4h ago' },
  { id: 3, action: 'Created supplier order SO-1043', actor: 'Amir', time: '1d ago' },
  { id: 4, action: 'Updated reorder points for 6 SKUs', actor: 'Sam', time: '2d ago' },
];

const ActivityLogScreen = () => {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Activity</p>
        <h1 className="text-2xl font-bold text-slate-900">Recent changes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Trace operational updates across the warehouse team.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Timeline
        </div>
        <ul className="divide-y divide-slate-100">
          {events.map((event) => (
            <li key={event.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{event.action}</p>
                <p className="text-slate-500">By {event.actor}</p>
              </div>
              <p className="text-slate-500">{event.time}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ActivityLogScreen;
