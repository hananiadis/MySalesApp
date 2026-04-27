import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const TerritoryHeatMap = ({ data = [] }) => {
  const [selectedMetric, setSelectedMetric] = useState('visits');

  const metrics = [
    { key: 'visits', label: 'Αριθμός Επισκέψεων', icon: 'MapPin' },
    { key: 'completed', label: 'Ολοκληρωμένες', icon: 'CheckCircle' },
    { key: 'orders', label: 'Παραγγελίες', icon: 'ShoppingCart' },
    { key: 'efficiency', label: 'Αποδοτικότητα (%)', icon: 'Target' },
    { key: 'coverage', label: 'Κάλυψη (%)', icon: 'Globe' },
  ];

  const getIntensityColor = (value, metric) => {
    let intensity = 0.4;
    switch (metric) {
      case 'visits':
        intensity = Math.min(value / 50, 1);
        break;
      case 'completed':
      case 'orders':
        intensity = Math.min(value / 25, 1);
        break;
      case 'efficiency':
      case 'coverage':
        intensity = value / 100;
        break;
      default:
        break;
    }
    return `rgba(37, 99, 235, ${Math.max(0.25, intensity)})`;
  };

  const formatValue = (value, metric) => {
    if (metric === 'efficiency' || metric === 'coverage') {
      return `${value}%`;
    }
    return String(value ?? 0);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        <h3 className="text-lg font-semibold text-foreground">Θερμικός Χάρτης Απόδοσης Περιοχών</h3>

        <div className="flex flex-wrap gap-2">
          {metrics.map((metric) => (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                selectedMetric === metric.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Icon name={metric.icon} size={16} />
              <span>{metric.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative bg-muted rounded-lg overflow-hidden" style={{ height: '400px' }}>
          <iframe
            width="100%"
            height="100%"
            loading="lazy"
            title="Θερμικός Χάρτης Περιοχών"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-74.05,40.70,-73.90,40.82&layer=mapnik"
            className="border-0"
          />
          <div className="absolute inset-0 pointer-events-none">
            {data.map((territory, index) => (
              <div
                key={territory.id}
                className="absolute w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold"
                style={{
                  backgroundColor: getIntensityColor(territory[selectedMetric], selectedMetric),
                  left: `${20 + index * 15}%`,
                  top: `${30 + index * 10}%`,
                }}
              >
                {index + 1}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-foreground mb-4">Απόδοση Περιοχών</h4>
          {data.map((territory, index) => (
            <div key={territory.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div
                  className="w-4 h-4 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: getIntensityColor(territory[selectedMetric], selectedMetric) }}
                />
                <div>
                  <p className="font-medium text-foreground">{territory.name}</p>
                  <p className="text-sm text-muted-foreground">Ζώνη {index + 1}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="font-semibold text-foreground">
                  {formatValue(territory[selectedMetric], selectedMetric)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics.find((metric) => metric.key === selectedMetric)?.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Ένταση Απόδοσης</span>
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground">Χαμηλή</span>
            <div className="w-20 h-3 bg-gradient-to-r from-blue-200 to-blue-600 rounded-full" />
            <span className="text-muted-foreground">Υψηλή</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerritoryHeatMap;
