import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import CustomerSelectionPanel from './components/CustomerSelectionPanel';
import WeeklyCalendar from './components/WeeklyCalendar';
import RouteOptimizationPanel from './components/RouteOptimizationPanel';
import VisitDetailsModal from './components/VisitDetailsModal';
import MobileScheduleView from './components/MobileScheduleView';
import Button from '../../components/ui/Button';


const VisitScheduling = () => {
  const [currentWeek, setCurrentWeek] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday?.setDate(today?.getDate() - today?.getDay() + 1);
    return monday;
  });

  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [scheduledVisits, setScheduledVisits] = useState([]);
  const [showRouteOptimization, setShowRouteOptimization] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showVisitDetails, setShowVisitDetails] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [currentMobileDate, setCurrentMobileDate] = useState(new Date());

  // Mock data
  const territories = [
    { id: 'north', name: 'North Territory' },
    { id: 'south', name: 'South Territory' },
    { id: 'east', name: 'East Territory' },
    { id: 'west', name: 'West Territory' }
  ];

  const customers = [
    {
      id: 'cust-1',
      name: 'Sarah Johnson',
      company: 'TechCorp Solutions',
      location: 'Downtown District',
      phone: '+1 (555) 123-4567',
      territoryId: 'north',
      priority: 'high',
      isOverdue: true,
      lastVisit: '2025-10-15',
      lastOutcome: 'Product demo completed',
      nextAction: 'Follow-up on pricing proposal'
    },
    {
      id: 'cust-2',
      name: 'Michael Chen',
      company: 'Global Industries Inc',
      location: 'Business Park',
      phone: '+1 (555) 234-5678',
      territoryId: 'north',
      priority: 'medium',
      isOverdue: false,
      lastVisit: '2025-10-28',
      lastOutcome: 'Contract renewal discussion',
      nextAction: 'Schedule technical review'
    },
    {
      id: 'cust-3',
      name: 'Emily Rodriguez',
      company: 'StartUp Dynamics',
      location: 'Innovation Hub',
      phone: '+1 (555) 345-6789',
      territoryId: 'south',
      priority: 'high',
      isOverdue: false,
      lastVisit: '2025-11-01',
      lastOutcome: 'Initial consultation',
      nextAction: 'Prepare custom solution proposal'
    },
    {
      id: 'cust-4',
      name: 'David Thompson',
      company: 'Manufacturing Plus',
      location: 'Industrial Zone',
      phone: '+1 (555) 456-7890',
      territoryId: 'east',
      priority: 'medium',
      isOverdue: true,
      lastVisit: '2025-10-20',
      lastOutcome: 'Equipment assessment',
      nextAction: 'Delivery timeline confirmation'
    },
    {
      id: 'cust-5',
      name: 'Lisa Wang',
      company: 'Retail Chain Co',
      location: 'Shopping Center',
      phone: '+1 (555) 567-8901',
      territoryId: 'west',
      priority: 'low',
      isOverdue: false,
      lastVisit: '2025-11-03',
      lastOutcome: 'Quarterly review meeting',
      nextAction: 'Schedule next quarter planning'
    },
    {
      id: 'cust-6',
      name: 'Robert Kim',
      company: 'Financial Services Ltd',
      location: 'Financial District',
      phone: '+1 (555) 678-9012',
      territoryId: 'north',
      priority: 'high',
      isOverdue: false,
      lastVisit: '2025-11-05',
      lastOutcome: 'Compliance audit support',
      nextAction: 'Implementation timeline review'
    }
  ];

  const mockScheduledVisits = [
    {
      id: 'visit-1',
      customerId: 'cust-1',
      customerName: 'Sarah Johnson',
      company: 'TechCorp Solutions',
      location: 'Downtown District',
      phone: '+1 (555) 123-4567',
      date: '2025-11-10',
      timeSlot: '09:00-10:00',
      priority: 'high',
      type: 'sales',
      duration: 60,
      objective: 'Present new product features and pricing proposal',
      estimatedTravelTime: 25,
      distance: '8.5',
      notes: 'Bring updated product brochures and pricing sheets'
    },
    {
      id: 'visit-2',
      customerId: 'cust-2',
      customerName: 'Michael Chen',
      company: 'Global Industries Inc',
      location: 'Business Park',
      phone: '+1 (555) 234-5678',
      date: '2025-11-10',
      timeSlot: '11:00-12:00',
      priority: 'medium',
      type: 'follow-up',
      duration: 45,
      objective: 'Contract renewal discussion and technical requirements',
      estimatedTravelTime: 20,
      distance: '6.2',
      notes: 'Review technical specifications document'
    },
    {
      id: 'visit-3',
      customerId: 'cust-3',
      customerName: 'Emily Rodriguez',
      company: 'StartUp Dynamics',
      location: 'Innovation Hub',
      phone: '+1 (555) 345-6789',
      date: '2025-11-11',
      timeSlot: '14:00-15:00',
      priority: 'high',
      type: 'demo',
      duration: 90,
      objective: 'Product demonstration and custom solution presentation',
      estimatedTravelTime: 30,
      distance: '12.1',
      notes: 'Prepare demo environment and custom integration examples'
    },
    {
      id: 'visit-4',
      customerId: 'cust-6',
      customerName: 'Robert Kim',
      company: 'Financial Services Ltd',
      location: 'Financial District',
      phone: '+1 (555) 678-9012',
      date: '2025-11-12',
      timeSlot: '10:00-11:00',
      priority: 'high',
      type: 'meeting',
      duration: 60,
      objective: 'Implementation timeline review and compliance discussion',
      estimatedTravelTime: 15,
      distance: '4.8',
      notes: 'Bring compliance documentation and implementation roadmap'
    }
  ];

  useEffect(() => {
    setScheduledVisits(mockScheduledVisits);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleWeekChange = (direction) => {
    const newWeek = new Date(currentWeek);
    newWeek?.setDate(currentWeek?.getDate() + (direction * 7));
    setCurrentWeek(newWeek);
  };

  const handleMobileDateChange = (direction) => {
    const newDate = new Date(currentMobileDate);
    newDate?.setDate(currentMobileDate?.getDate() + direction);
    setCurrentMobileDate(newDate);
  };

  const handleCustomerSelect = (customerIds) => {
    setSelectedCustomers(customerIds);
  };

  const handleBulkSchedule = () => {
    // Open scheduling interface for selected customers
    console.log('Bulk scheduling for:', selectedCustomers);
  };

  const handleVisitDrop = (visitId, newDate) => {
    setScheduledVisits(prev => prev?.map(visit => 
      visit?.id === visitId ? { ...visit, date: newDate } : visit
    ));
  };

  const handleVisitClick = (visit) => {
    setSelectedVisit(visit);
    setShowVisitDetails(true);
  };

  const handleOptimizeRoute = (selectedDay = null) => {
    setShowRouteOptimization(true);
  };

  const handleRouteOptimized = (optimizedData) => {
    console.log('Route optimized:', optimizedData);
  };

  const handleExportToMaps = (mapType) => {
    console.log(`Exporting to ${mapType} Maps`);
    // Implementation for map export
  };

  const handleVisitSave = (updatedVisit) => {
    setScheduledVisits(prev => prev?.map(visit => 
      visit?.id === updatedVisit?.id ? { ...updatedVisit, ...visit } : visit
    ));
  };

  const handleVisitDelete = (visitId) => {
    setScheduledVisits(prev => prev?.filter(visit => visit?.id !== visitId));
  };

  const handleAddVisit = (date) => {
    // Navigate to customer selection or open modal
    console.log('Adding visit for date:', date);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto p-4 lg:p-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Visit Scheduling</h1>
                <p className="text-muted-foreground mt-1">
                  Plan and optimize customer visits with route optimization
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsMobileView(!isMobileView)}
                  iconName={isMobileView ? "Monitor" : "Smartphone"}
                  iconPosition="left"
                  className="hidden lg:flex"
                >
                  {isMobileView ? 'Desktop View' : 'Mobile View'}
                </Button>
                
                <Button
                  variant="default"
                  onClick={handleOptimizeRoute}
                  iconName="Route"
                  iconPosition="left"
                >
                  Optimize All Routes
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          {isMobileView ? (
            /* Mobile View */
            (<div className="space-y-4">
              <MobileScheduleView
                currentDate={currentMobileDate}
                onDateChange={handleMobileDateChange}
                scheduledVisits={scheduledVisits}
                onVisitClick={handleVisitClick}
                onAddVisit={handleAddVisit}
              />
            </div>)
          ) : (
            /* Desktop View */
            (<div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              {/* Customer Selection Panel */}
              <div className="xl:col-span-1">
                <CustomerSelectionPanel
                  customers={customers}
                  selectedCustomers={selectedCustomers}
                  onCustomerSelect={handleCustomerSelect}
                  onBulkSchedule={handleBulkSchedule}
                  territories={territories}
                />
              </div>
              {/* Weekly Calendar */}
              <div className="xl:col-span-3">
                <WeeklyCalendar
                  currentWeek={currentWeek}
                  onWeekChange={handleWeekChange}
                  scheduledVisits={scheduledVisits}
                  onVisitDrop={handleVisitDrop}
                  onVisitClick={handleVisitClick}
                  onOptimizeRoute={handleOptimizeRoute}
                />
              </div>
            </div>)
          )}

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-card border border-border rounded-lg text-center">
              <div className="text-2xl font-bold text-foreground">{scheduledVisits?.length}</div>
              <div className="text-sm text-muted-foreground">Scheduled Visits</div>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg text-center">
              <div className="text-2xl font-bold text-foreground">
                {customers?.filter(c => c?.isOverdue)?.length}
              </div>
              <div className="text-sm text-muted-foreground">Overdue Customers</div>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg text-center">
              <div className="text-2xl font-bold text-foreground">
                {customers?.filter(c => c?.priority === 'high')?.length}
              </div>
              <div className="text-sm text-muted-foreground">High Priority</div>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg text-center">
              <div className="text-2xl font-bold text-foreground">4</div>
              <div className="text-sm text-muted-foreground">Active Territories</div>
            </div>
          </div>
        </div>
      </main>
      {/* Modals */}
      <RouteOptimizationPanel
        isVisible={showRouteOptimization}
        onClose={() => setShowRouteOptimization(false)}
        selectedDay={currentWeek}
        visits={scheduledVisits}
        onOptimize={handleRouteOptimized}
        onExportToMaps={handleExportToMaps}
      />
      <VisitDetailsModal
        isVisible={showVisitDetails}
        onClose={() => setShowVisitDetails(false)}
        visit={selectedVisit}
        onSave={handleVisitSave}
        onDelete={handleVisitDelete}
      />
    </div>
  );
};

export default VisitScheduling;