import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const TerritoryMap = ({ onTerritorySelect, selectedTerritory }) => {
  const [mapView, setMapView] = useState('territories');

  const territories = [
    {
      id: 'north',
      name: 'North Region',
      color: '#3B82F6',
      customerCount: 45,
      salesman: 'John Smith',
      coverage: 92
    },
    {
      id: 'south',
      name: 'South Region',
      color: '#10B981',
      customerCount: 38,
      salesman: 'Sarah Johnson',
      coverage: 88
    },
    {
      id: 'east',
      name: 'East Region',
      color: '#F59E0B',
      customerCount: 52,
      salesman: 'Mike Wilson',
      coverage: 95
    },
    {
      id: 'west',
      name: 'West Region',
      color: '#EF4444',
      customerCount: 41,
      salesman: 'Lisa Chen',
      coverage: 85
    },
    {
      id: 'central',
      name: 'Central Region',
      color: '#8B5CF6',
      customerCount: 47,
      salesman: 'David Brown',
      coverage: 90
    }
  ];

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Map Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Territory Overview</h3>
          <div className="flex items-center space-x-2">
            <Button
              variant={mapView === 'territories' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMapView('territories')}
            >
              Territories
            </Button>
            <Button
              variant={mapView === 'coverage' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMapView('coverage')}
            >
              Coverage
            </Button>
          </div>
        </div>
      </div>
      {/* Map Container */}
      <div className="relative h-80 bg-muted/30">
        {/* Mock Map with Territory Boundaries */}
        <div className="absolute inset-0 p-4">
          <div className="grid grid-cols-3 grid-rows-2 h-full gap-2">
            {/* North Region */}
            <div
              className={`col-span-3 rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center justify-center ${
                selectedTerritory === 'north' ?'border-primary bg-primary/10' :'border-blue-300 bg-blue-50 hover:bg-blue-100'
              }`}
              onClick={() => onTerritorySelect('north')}
              style={{ backgroundColor: territories?.[0]?.color + '20' }}
            >
              <div className="text-center">
                <div className="font-medium text-foreground">North Region</div>
                <div className="text-sm text-muted-foreground">45 customers</div>
              </div>
            </div>

            {/* West Region */}
            <div
              className={`rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center justify-center ${
                selectedTerritory === 'west' ?'border-primary bg-primary/10' :'border-red-300 bg-red-50 hover:bg-red-100'
              }`}
              onClick={() => onTerritorySelect('west')}
              style={{ backgroundColor: territories?.[3]?.color + '20' }}
            >
              <div className="text-center">
                <div className="font-medium text-foreground">West</div>
                <div className="text-sm text-muted-foreground">41</div>
              </div>
            </div>

            {/* Central Region */}
            <div
              className={`rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center justify-center ${
                selectedTerritory === 'central' ?'border-primary bg-primary/10' :'border-purple-300 bg-purple-50 hover:bg-purple-100'
              }`}
              onClick={() => onTerritorySelect('central')}
              style={{ backgroundColor: territories?.[4]?.color + '20' }}
            >
              <div className="text-center">
                <div className="font-medium text-foreground">Central</div>
                <div className="text-sm text-muted-foreground">47</div>
              </div>
            </div>

            {/* East Region */}
            <div
              className={`rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center justify-center ${
                selectedTerritory === 'east' ?'border-primary bg-primary/10' :'border-amber-300 bg-amber-50 hover:bg-amber-100'
              }`}
              onClick={() => onTerritorySelect('east')}
              style={{ backgroundColor: territories?.[2]?.color + '20' }}
            >
              <div className="text-center">
                <div className="font-medium text-foreground">East</div>
                <div className="text-sm text-muted-foreground">52</div>
              </div>
            </div>
          </div>

          {/* South Region - spans remaining space */}
          <div
            className={`absolute bottom-4 left-4 right-4 h-16 rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center justify-center ${
              selectedTerritory === 'south' ?'border-primary bg-primary/10' :'border-emerald-300 bg-emerald-50 hover:bg-emerald-100'
            }`}
            onClick={() => onTerritorySelect('south')}
            style={{ backgroundColor: territories?.[1]?.color + '20' }}
          >
            <div className="text-center">
              <div className="font-medium text-foreground">South Region</div>
              <div className="text-sm text-muted-foreground">38 customers</div>
            </div>
          </div>
        </div>

        {/* Drop Zone Indicator */}
        <div className="absolute top-2 right-2 bg-card border border-border rounded-lg p-2 text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Icon name="Move" size={12} />
            <span>Drop zone for reassignment</span>
          </div>
        </div>
      </div>
      {/* Territory Stats */}
      <div className="p-4 border-t border-border">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {territories?.map((territory) => (
            <div
              key={territory?.id}
              className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                selectedTerritory === territory?.id
                  ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
              }`}
              onClick={() => onTerritorySelect(territory?.id)}
            >
              <div className="flex items-center space-x-2 mb-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: territory?.color }}
                ></div>
                <span className="text-sm font-medium text-foreground">{territory?.name}</span>
              </div>
              
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Customers:</span>
                  <span className="font-medium">{territory?.customerCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Coverage:</span>
                  <span className={`font-medium ${territory?.coverage >= 90 ? 'text-success' : territory?.coverage >= 80 ? 'text-warning' : 'text-error'}`}>
                    {territory?.coverage}%
                  </span>
                </div>
                <div className="text-xs truncate">
                  {territory?.salesman}
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