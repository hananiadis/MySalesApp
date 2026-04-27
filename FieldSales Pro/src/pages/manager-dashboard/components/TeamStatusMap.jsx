import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const COLORS = ['#2563EB', '#059669', '#DC2626', '#7C3AED', '#D97706', '#0891B2'];

const TeamStatusMap = ({ className = '', salesmen = null }) => {
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [mapView, setMapView] = useState('territories');

  // Build territoryData from real salesmen prop
  const territoryData = (salesmen || []).map((s, idx) => ({
    id: s.uid,
    name: s.territory || s.displayName,
    salesman: s.displayName,
    color: COLORS[idx % COLORS.length],
    visitProgress: { completed: s.visitsCompleted, planned: s.visitsPlanned },
    status: s.visitsInProgress > 0 || s.visitsCompleted > 0 ? 'active' : 'offline',
  }));

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active': return 'MapPin';
      case 'break': return 'Coffee';
      case 'offline': return 'WifiOff';
      default: return 'MapPin';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-success';
      case 'break': return 'text-warning';
      case 'offline': return 'text-error';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Ζωντανός Χάρτης Περιοχών</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setMapView('territories')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                mapView === 'territories' ?'bg-primary text-primary-foreground' :'text-muted-foreground hover:text-foreground'
              }`}
            >
              Περιοχές
            </button>
            <button
              onClick={() => setMapView('visits')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                mapView === 'visits' ?'bg-primary text-primary-foreground' :'text-muted-foreground hover:text-foreground'
              }`}
            >
              Επισκέψεις
            </button>
          </div>
        </div>
      </div>
      <div className="relative">
        {/* Map Container */}
        <div className="h-96 bg-muted rounded-b-lg overflow-hidden">
          <iframe
            width="100%"
            height="100%"
            loading="lazy"
            title="Territory Coverage Map"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.openstreetmap.org/export/embed.html?bbox=-74.05,40.70,-73.90,40.82&layer=mapnik"
            className="border-0"
          />
        </div>

        {/* Territory Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="relative h-full">
            {territoryData?.map((territory, index) => (
              <div
                key={territory?.id}
                className="absolute pointer-events-auto"
                style={{
                  top: `${20 + index * 20}%`,
                  left: `${15 + index * 15}%`,
                }}
              >
                <div
                  className="flex items-center space-x-2 bg-card border border-border rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedTerritory(territory)}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: territory?.color }}
                  />
                  <Icon
                    name={getStatusIcon(territory?.status)}
                    size={16}
                    className={getStatusColor(territory?.status)}
                  />
                  <span className="text-sm font-medium text-foreground">
                    {territory?.salesman}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Territory Legend */}
      <div className="p-4 border-t border-border">
        {salesmen === null && (
          <div className="flex space-x-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 h-10 bg-muted rounded" />
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {territoryData?.map((territory) => (
            <div
              key={territory?.id}
              className={`flex items-center space-x-3 p-2 rounded-md cursor-pointer transition-colors ${
                selectedTerritory?.id === territory?.id
                  ? 'bg-muted' :'hover:bg-muted/50'
              }`}
              onClick={() => setSelectedTerritory(territory)}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: territory?.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {territory?.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {territory?.visitProgress?.completed}/{territory?.visitProgress?.planned} επισκέψεις
                </div>
              </div>
              <Icon
                name={getStatusIcon(territory?.status)}
                size={14}
                className={getStatusColor(territory?.status)}
              />
            </div>
          ))}
        </div>
      </div>
      {/* Selected Territory Details */}
      {selectedTerritory && (
        <div className="p-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-foreground">{selectedTerritory?.name}</h4>
            <button
              onClick={() => setSelectedTerritory(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Icon name="X" size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Πωλητής</div>
              <div className="text-sm font-medium text-foreground">
                {selectedTerritory?.salesman}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Progress</div>
              <div className="text-sm font-medium text-foreground">
                {selectedTerritory?.visitProgress?.completed}/{selectedTerritory?.visitProgress?.planned} επισκέψεις
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamStatusMap;