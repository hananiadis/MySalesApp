import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import TerritoryMap from './components/TerritoryMap';
import PlanningCalendar from './components/PlanningCalendar';
import TerritoryDetails from './components/TerritoryDetails';
import PlanningControls from './components/PlanningControls';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

const TerritoryPlanning = () => {
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [planningStatus, setPlanningStatus] = useState('draft');
  const [showMobilePanel, setShowMobilePanel] = useState('map');

  // Mock data for territories
  const [territories, setTerritories] = useState([
    {
      id: 'T001',
      name: 'Downtown Manhattan',
      assignedSalesman: 'sm001',
      visitLimit: 25,
      priority: 'high',
      postcodes: ['10001', '10002', '10003', '10004'],
      customerCount: 145,
      avgDistance: 2.3,
      estimatedTime: 6.5,
      bounds: { x: 15, y: 20, width: 20, height: 15 },
      conflicts: [
        {
          type: 'Capacity Overload',
          description: 'Assigned visits exceed salesman weekly capacity by 15%'
        }
      ]
    },
    {
      id: 'T002',
      name: 'Brooklyn Heights',
      assignedSalesman: 'sm002',
      visitLimit: 20,
      priority: 'medium',
      postcodes: ['11201', '11202', '11203'],
      customerCount: 98,
      avgDistance: 3.1,
      estimatedTime: 5.2,
      bounds: { x: 40, y: 35, width: 18, height: 12 },
      conflicts: []
    },
    {
      id: 'T003',
      name: 'Queens Central',
      assignedSalesman: null,
      visitLimit: 18,
      priority: 'medium',
      postcodes: ['11101', '11102', '11103', '11104'],
      customerCount: 112,
      avgDistance: 4.2,
      estimatedTime: 7.1,
      bounds: { x: 65, y: 25, width: 22, height: 18 },
      conflicts: []
    },
    {
      id: 'T004',
      name: 'Bronx North',
      assignedSalesman: 'sm003',
      visitLimit: 22,
      priority: 'low',
      postcodes: ['10451', '10452', '10453'],
      customerCount: 87,
      avgDistance: 5.8,
      estimatedTime: 8.3,
      bounds: { x: 20, y: 60, width: 25, height: 20 },
      conflicts: []
    }
  ]);

  // Mock data for salesmen
  const salesmen = [
    {
      id: 'sm001',
      name: 'John Smith',
      available: true,
      assignedTerritories: 2,
      maxTerritories: 5,
      weeklyCapacity: 30
    },
    {
      id: 'sm002',
      name: 'Sarah Johnson',
      available: true,
      assignedTerritories: 3,
      maxTerritories: 4,
      weeklyCapacity: 25
    },
    {
      id: 'sm003',
      name: 'Mike Chen',
      available: true,
      assignedTerritories: 1,
      maxTerritories: 6,
      weeklyCapacity: 35
    },
    {
      id: 'sm004',
      name: 'Lisa Rodriguez',
      available: false,
      assignedTerritories: 4,
      maxTerritories: 5,
      weeklyCapacity: 28
    },
    {
      id: 'sm005',
      name: 'David Wilson',
      available: true,
      assignedTerritories: 0,
      maxTerritories: 4,
      weeklyCapacity: 32
    }
  ];

  // Mock planning data for calendar
  const planningData = [
    {
      salesmanId: 'sm001',
      weekId: 'w1',
      territories: [
        { id: 'T001', name: 'Downtown Manhattan', plannedVisits: 15, conflicts: 1 }
      ],
      totalVisits: 15
    },
    {
      salesmanId: 'sm001',
      weekId: 'w2',
      territories: [
        { id: 'T001', name: 'Downtown Manhattan', plannedVisits: 18, conflicts: 0 }
      ],
      totalVisits: 18
    },
    {
      salesmanId: 'sm002',
      weekId: 'w1',
      territories: [
        { id: 'T002', name: 'Brooklyn Heights', plannedVisits: 12, conflicts: 0 }
      ],
      totalVisits: 12
    },
    {
      salesmanId: 'sm003',
      weekId: 'w3',
      territories: [
        { id: 'T004', name: 'Bronx North', plannedVisits: 14, conflicts: 0 }
      ],
      totalVisits: 14
    }
  ];

  const handleTerritorySelect = (territory) => {
    setSelectedTerritory(territory);
    if (window.innerWidth < 1024) {
      setShowMobilePanel('details');
    }
  };

  const handleSalesmanAssign = (territoryId, salesmanId) => {
    setTerritories(prev => prev?.map(territory => 
      territory?.id === territoryId 
        ? { ...territory, assignedSalesman: salesmanId }
        : territory
    ));
  };

  const handleTerritoryUpdate = (territoryId, updates) => {
    setTerritories(prev => prev?.map(territory => 
      territory?.id === territoryId 
        ? { ...territory, ...updates }
        : territory
    ));
  };

  const handleBulkAssign = (salesmanId, territoryIds) => {
    setTerritories(prev => prev?.map(territory => 
      territoryIds?.includes(territory?.id)
        ? { ...territory, assignedSalesman: salesmanId }
        : territory
    ));
  };

  const handleOptimize = (settings) => {
    console.log('Optimizing with settings:', settings);
    // Implement optimization logic here
  };

  const handleExport = (format) => {
    console.log('Exporting in format:', format);
    // Implement export logic here
  };

  const handleSave = () => {
    console.log('Saving planning data...');
    // Implement save logic here
  };

  const handleSubmitApproval = () => {
    setPlanningStatus('pending');
    console.log('Submitting for approval...');
    // Implement approval submission logic here
  };

  const mobileNavItems = [
    { id: 'map', label: 'Map', icon: 'Map' },
    { id: 'calendar', label: 'Calendar', icon: 'Calendar' },
    { id: 'details', label: 'Details', icon: 'Info' },
    { id: 'controls', label: 'Controls', icon: 'Settings' }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="pt-16">
        {/* Desktop Layout */}
        <div className="hidden lg:block">
          <div className="h-screen flex">
            {/* Left Panel - Map and Calendar */}
            <div className="flex-1 flex flex-col p-6 space-y-6">
              {/* Territory Map */}
              <TerritoryMap
                territories={territories}
                salesmen={salesmen}
                selectedTerritory={selectedTerritory}
                onTerritorySelect={handleTerritorySelect}
                onSalesmanAssign={handleSalesmanAssign}
                className="flex-1"
              />
              
              {/* Planning Calendar */}
              <PlanningCalendar
                planningData={planningData}
                salesmen={salesmen}
                onAssignmentChange={() => {}}
                onCapacityChange={() => {}}
                className="h-80"
              />
            </div>

            {/* Right Panel - Details and Controls */}
            <div className="w-96 flex flex-col p-6 space-y-6 border-l border-border">
              {/* Territory Details */}
              <TerritoryDetails
                territory={selectedTerritory}
                salesmen={salesmen}
                onUpdate={handleTerritoryUpdate}
                onClose={() => setSelectedTerritory(null)}
                className="flex-1"
              />
              
              {/* Planning Controls */}
              <PlanningControls
                onBulkAssign={handleBulkAssign}
                onOptimize={handleOptimize}
                onExport={handleExport}
                onSave={handleSave}
                onSubmitApproval={handleSubmitApproval}
                planningStatus={planningStatus}
                className="h-auto"
              />
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Mobile Navigation */}
          <div className="sticky top-16 z-40 bg-card border-b border-border">
            <div className="flex">
              {mobileNavItems?.map((item) => (
                <button
                  key={item?.id}
                  onClick={() => setShowMobilePanel(item?.id)}
                  className={`flex-1 flex flex-col items-center py-3 px-2 transition-colors duration-200 ${
                    showMobilePanel === item?.id
                      ? 'text-primary bg-primary/10' :'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon name={item?.icon} size={20} />
                  <span className="text-xs mt-1">{item?.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Content */}
          <div className="p-4">
            {showMobilePanel === 'map' && (
              <TerritoryMap
                territories={territories}
                salesmen={salesmen}
                selectedTerritory={selectedTerritory}
                onTerritorySelect={handleTerritorySelect}
                onSalesmanAssign={handleSalesmanAssign}
                className="h-96"
              />
            )}

            {showMobilePanel === 'calendar' && (
              <PlanningCalendar
                planningData={planningData}
                salesmen={salesmen}
                onAssignmentChange={() => {}}
                onCapacityChange={() => {}}
                className="h-auto"
              />
            )}

            {showMobilePanel === 'details' && (
              <TerritoryDetails
                territory={selectedTerritory}
                salesmen={salesmen}
                onUpdate={handleTerritoryUpdate}
                onClose={() => setSelectedTerritory(null)}
                className="h-auto"
              />
            )}

            {showMobilePanel === 'controls' && (
              <PlanningControls
                onBulkAssign={handleBulkAssign}
                onOptimize={handleOptimize}
                onExport={handleExport}
                onSave={handleSave}
                onSubmitApproval={handleSubmitApproval}
                planningStatus={planningStatus}
                className="h-auto"
              />
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 lg:hidden">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span className="text-muted-foreground">8 Assigned</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-warning rounded-full"></div>
                <span className="text-muted-foreground">4 Unassigned</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-error rounded-full"></div>
                <span className="text-muted-foreground">2 Conflicts</span>
              </div>
            </div>
            
            <Button variant="default" size="sm" onClick={handleSave}>
              <Icon name="Save" size={16} />
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerritoryPlanning;