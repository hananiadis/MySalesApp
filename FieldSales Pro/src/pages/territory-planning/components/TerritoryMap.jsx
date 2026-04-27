import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const TerritoryMap = ({ 
  territories, 
  salesmen, 
  selectedTerritory, 
  onTerritorySelect, 
  onSalesmanAssign,
  className = '' 
}) => {
  const [mapView, setMapView] = useState('territories');
  const [draggedSalesman, setDraggedSalesman] = useState(null);
  const [hoveredTerritory, setHoveredTerritory] = useState(null);

  const mapViewOptions = [
    { id: 'territories', label: 'Περιοχές', icon: 'Map' },
    { id: 'coverage', label: 'Κάλυψη', icon: 'Target' },
    { id: 'conflicts', label: 'Συγκρούσεις', icon: 'AlertTriangle' }
  ];

  const handleDragStart = (salesman) => {
    setDraggedSalesman(salesman);
  };

  const handleDragOver = (e) => {
    e?.preventDefault();
  };

  const handleDrop = (e, territoryId) => {
    e?.preventDefault();
    if (draggedSalesman) {
      onSalesmanAssign(territoryId, draggedSalesman?.id);
      setDraggedSalesman(null);
    }
  };

  const getTerritoryColor = (territory) => {
    if (territory?.conflicts?.length > 0) return 'border-error bg-error/10';
    if (territory?.assignedSalesman) return 'border-success bg-success/10';
    return 'border-warning bg-warning/10';
  };

  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Map Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-foreground">Χάρτης Περιοχών</h3>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Icon name="Download" size={16} />
              Εξαγωγή
            </Button>
            <Button variant="outline" size="sm">
              <Icon name="Maximize2" size={16} />
            </Button>
          </div>
        </div>

        {/* Map View Tabs */}
        <div className="flex space-x-1 bg-muted p-1 rounded-md">
          {mapViewOptions?.map((option) => (
            <button
              key={option?.id}
              onClick={() => setMapView(option?.id)}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                mapView === option?.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={option?.icon} size={16} />
              <span>{option?.label}</span>
            </button>
          ))}
        </div>
      </div>
      {/* Map Content */}
      <div className="relative h-96 bg-muted/30">
        {/* OpenStreetMap Iframe */}
        <iframe
          width="100%"
          height="100%"
          loading="lazy"
          title="Territory Planning Map"
          referrerPolicy="no-referrer-when-downgrade"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-74.30,40.50,-73.70,40.95&layer=mapnik"
          className="absolute inset-0"
        />

        {/* Territory Overlays */}
        <div className="absolute inset-0 pointer-events-none">
          {territories?.map((territory) => (
            <div
              key={territory?.id}
              className={`absolute pointer-events-auto cursor-pointer border-2 rounded-lg transition-all duration-200 ${getTerritoryColor(territory)} ${
                selectedTerritory?.id === territory?.id ? 'ring-2 ring-primary' : ''
              } ${hoveredTerritory === territory?.id ? 'scale-105' : ''}`}
              style={{
                left: `${territory?.bounds?.x}%`,
                top: `${territory?.bounds?.y}%`,
                width: `${territory?.bounds?.width}%`,
                height: `${territory?.bounds?.height}%`
              }}
              onClick={() => onTerritorySelect(territory)}
              onMouseEnter={() => setHoveredTerritory(territory?.id)}
              onMouseLeave={() => setHoveredTerritory(null)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, territory?.id)}
            >
              <div className="p-2 bg-background/90 backdrop-blur-sm rounded-md m-1">
                <div className="text-xs font-medium text-foreground">{territory?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {territory?.postcodes?.length} postcodes
                </div>
                {territory?.assignedSalesman && (
                  <div className="flex items-center space-x-1 mt-1">
                    <Icon name="User" size={12} className="text-primary" />
                    <span className="text-xs text-primary font-medium">
                      {salesmen?.find(s => s?.id === territory?.assignedSalesman)?.name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Map Controls */}
        <div className="absolute top-4 right-4 flex flex-col space-y-2">
          <Button variant="outline" size="sm" className="bg-background/90 backdrop-blur-sm">
            <Icon name="Plus" size={16} />
          </Button>
          <Button variant="outline" size="sm" className="bg-background/90 backdrop-blur-sm">
            <Icon name="Minus" size={16} />
          </Button>
          <Button variant="outline" size="sm" className="bg-background/90 backdrop-blur-sm">
            <Icon name="RotateCcw" size={16} />
          </Button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm border border-border rounded-lg p-3">
          <div className="text-xs font-medium text-foreground mb-2">Υπόμνημα</div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border-2 border-success bg-success/10 rounded"></div>
              <span className="text-xs text-muted-foreground">Ανατεθειμένες</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border-2 border-warning bg-warning/10 rounded"></div>
              <span className="text-xs text-muted-foreground">Χωρίς ανάθεση</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 border-2 border-error bg-error/10 rounded"></div>
              <span className="text-xs text-muted-foreground">Συγκρούσεις</span>
            </div>
          </div>
        </div>
      </div>
      {/* Salesman Panel */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-foreground">Διαθέσιμοι Πωλητές</h4>
          <span className="text-xs text-muted-foreground">Σύρετε για ανάθεση περιοχών</span>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {salesmen?.map((salesman) => (
            <div
              key={salesman?.id}
              draggable
              onDragStart={() => handleDragStart(salesman)}
              className="flex items-center space-x-2 p-2 bg-muted rounded-md cursor-move hover:bg-muted/80 transition-colors duration-200"
            >
              <div className={`w-3 h-3 rounded-full ${salesman?.available ? 'bg-success' : 'bg-error'}`}></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{salesman?.name}</div>
                <div className="text-xs text-muted-foreground">
                  {salesman?.assignedTerritories}/{salesman?.maxTerritories}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TerritoryMap;