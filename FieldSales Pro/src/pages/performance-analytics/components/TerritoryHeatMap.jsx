import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const TerritoryHeatMap = () => {
  const [selectedMetric, setSelectedMetric] = useState('visits');

  const territories = [
    {
      id: 1,
      name: "Downtown District",
      visits: 145,
      revenue: 89500,
      efficiency: 87,
      coverage: 92,
      lat: 40.7589,
      lng: -73.9851,
      color: "bg-success"
    },
    {
      id: 2,
      name: "North Suburbs",
      visits: 98,
      revenue: 67200,
      efficiency: 78,
      coverage: 85,
      lat: 40.7831,
      lng: -73.9712,
      color: "bg-primary"
    },
    {
      id: 3,
      name: "East Commercial",
      visits: 112,
      revenue: 78900,
      efficiency: 82,
      coverage: 88,
      lat: 40.7505,
      lng: -73.9934,
      color: "bg-accent"
    },
    {
      id: 4,
      name: "West Industrial",
      visits: 76,
      revenue: 45300,
      efficiency: 65,
      coverage: 72,
      lat: 40.7614,
      lng: -73.9776,
      color: "bg-warning"
    },
    {
      id: 5,
      name: "South Residential",
      visits: 89,
      revenue: 52100,
      efficiency: 71,
      coverage: 79,
      lat: 40.7282,
      lng: -73.9942,
      color: "bg-error"
    }
  ];

  const metrics = [
    { key: 'visits', label: 'Visit Count', icon: 'MapPin' },
    { key: 'revenue', label: 'Revenue ($)', icon: 'DollarSign' },
    { key: 'efficiency', label: 'Efficiency (%)', icon: 'Target' },
    { key: 'coverage', label: 'Coverage (%)', icon: 'Globe' }
  ];

  const getIntensityColor = (value, metric) => {
    let intensity;
    switch (metric) {
      case 'visits':
        intensity = Math.min(value / 150, 1);
        break;
      case 'revenue':
        intensity = Math.min(value / 100000, 1);
        break;
      case 'efficiency': case'coverage':
        intensity = value / 100;
        break;
      default:
        intensity = 0.5;
    }
    
    const opacity = Math.max(0.3, intensity);
    return `rgba(37, 99, 235, ${opacity})`;
  };

  const formatValue = (value, metric) => {
    switch (metric) {
      case 'revenue':
        return `$${(value / 1000)?.toFixed(1)}k`;
      case 'efficiency': case'coverage':
        return `${value}%`;
      default:
        return value?.toString();
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        <h3 className="text-lg font-semibold text-foreground">Territory Performance Heat Map</h3>
        
        <div className="flex flex-wrap gap-2">
          {metrics?.map((metric) => (
            <button
              key={metric?.key}
              onClick={() => setSelectedMetric(metric?.key)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                selectedMetric === metric?.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Icon name={metric?.icon} size={16} />
              <span>{metric?.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Visualization */}
        <div className="relative bg-muted rounded-lg overflow-hidden" style={{ height: '400px' }}>
          <iframe
            width="100%"
            height="100%"
            loading="lazy"
            title="Territory Heat Map"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-74.05,40.70,-73.90,40.82&layer=mapnik"
            className="border-0"
          />
          
          {/* Overlay with territory markers */}
          <div className="absolute inset-0 pointer-events-none">
            {territories?.map((territory, index) => (
              <div
                key={territory?.id}
                className="absolute w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-bold"
                style={{
                  backgroundColor: getIntensityColor(territory?.[selectedMetric], selectedMetric),
                  left: `${20 + (index * 15)}%`,
                  top: `${30 + (index * 10)}%`
                }}
              >
                {index + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Territory List */}
        <div className="space-y-3">
          <h4 className="font-medium text-foreground mb-4">Territory Performance</h4>
          {territories?.map((territory, index) => (
            <div key={territory?.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div
                  className="w-4 h-4 rounded-full border border-white shadow-sm"
                  style={{
                    backgroundColor: getIntensityColor(territory?.[selectedMetric], selectedMetric)
                  }}
                />
                <div>
                  <p className="font-medium text-foreground">{territory?.name}</p>
                  <p className="text-sm text-muted-foreground">Zone {index + 1}</p>
                </div>
              </div>
              
              <div className="text-right">
                <p className="font-semibold text-foreground">
                  {formatValue(territory?.[selectedMetric], selectedMetric)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metrics?.find(m => m?.key === selectedMetric)?.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="mt-6 p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Performance Intensity</span>
          <div className="flex items-center space-x-2">
            <span className="text-muted-foreground">Low</span>
            <div className="w-20 h-3 bg-gradient-to-r from-blue-200 to-blue-600 rounded-full"></div>
            <span className="text-muted-foreground">High</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerritoryHeatMap;