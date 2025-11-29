const variants = {
  good: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-100 bg-amber-50 text-amber-800',
  danger: 'border-rose-100 bg-rose-50 text-rose-800',
  default: 'border-slate-200 bg-white text-slate-900',
};

const KpiCard = ({ title, value, icon = null, variant = 'default', hint }) => {
  const tone = variants[variant] || variants.default;

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tone}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
        </div>
        {icon ? <div className="text-2xl">{icon}</div> : null}
      </div>
    </div>
  );
};

export default KpiCard;
