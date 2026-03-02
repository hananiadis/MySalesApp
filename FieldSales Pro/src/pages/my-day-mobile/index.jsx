import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import DayHeader from './components/DayHeader';
import VisitCard from './components/VisitCard';
import RouteOptimizer from './components/RouteOptimizer';
import QuickActions from './components/QuickActions';
import VisitExecutionModal from './components/VisitExecutionModal';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

const MyDayMobile = () => {
  const [currentDate] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(new Date());
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [visits, setVisits] = useState([
  {
    id: 1,
    customerName: "TechCorp Solutions",
    address: "1234 Business Ave, Suite 100, Downtown",
    scheduledTime: "09:00",
    status: "completed",
    priority: "High",
    objectives: "Product demo for new CRM system, discuss pricing options, and gather technical requirements",
    contactPerson: "Sarah Johnson",
    phone: "(555) 123-4567",
    lastVisit: "Oct 15, 2025",
    lastOutcome: "Quote requested",
    customerPhoto: "/assets/images/avatar-placeholder.png",
    customerPhotoAlt: "Modern glass office building with TechCorp Solutions signage in downtown business district",
    notes: "Customer interested in enterprise package. Follow up with technical specifications."
  },
  {
    id: 2,
    customerName: "Green Valley Manufacturing",
    address: "5678 Industrial Blvd, Manufacturing District",
    scheduledTime: "11:30",
    status: "in-progress",
    priority: "Medium",
    objectives: "Quarterly review meeting, discuss contract renewal, and present new service offerings",
    contactPerson: "Mike Rodriguez",
    phone: "(555) 234-5678",
    lastVisit: "Sep 20, 2025",
    lastOutcome: "Successful meeting",
    customerPhoto: "/assets/images/avatar-placeholder.png",
    customerPhotoAlt: "Large industrial manufacturing facility with Green Valley Manufacturing logo on modern warehouse building",
    notes: ""
  },
  {
    id: 3,
    customerName: "Sunrise Retail Group",
    address: "9012 Commerce St, Retail Plaza",
    scheduledTime: "14:00",
    status: "upcoming",
    priority: "High",
    objectives: "Present seasonal marketing campaign, discuss inventory management solutions, and review performance metrics",
    contactPerson: "Lisa Chen",
    phone: "(555) 345-6789",
    lastVisit: "Oct 28, 2025",
    lastOutcome: "Information gathering",
    customerPhoto: "/assets/images/avatar-placeholder.png",
    customerPhotoAlt: "Bright modern retail store interior with Sunrise Retail Group branding and organized product displays",
    notes: ""
  },
  {
    id: 4,
    customerName: "Metro Healthcare Partners",
    address: "3456 Medical Center Dr, Healthcare Complex",
    scheduledTime: "16:30",
    status: "upcoming",
    priority: "Medium",
    objectives: "Software training session, address user feedback, and discuss system integration requirements",
    contactPerson: "Dr. James Wilson",
    phone: "(555) 456-7890",
    lastVisit: "Nov 1, 2025",
    lastOutcome: "Training completed",
    customerPhoto: "/assets/images/avatar-placeholder.png",
    customerPhotoAlt: "Modern healthcare facility entrance with Metro Healthcare Partners signage and glass facade",
    notes: ""
  },
  {
    id: 5,
    customerName: "Coastal Construction LLC",
    address: "7890 Builder's Way, Construction Zone",
    scheduledTime: "18:00",
    status: "overdue",
    priority: "High",
    objectives: "Project status update, discuss timeline adjustments, and review budget considerations",
    contactPerson: "Tom Anderson",
    phone: "(555) 567-8901",
    lastVisit: "Oct 25, 2025",
    lastOutcome: "Rescheduled",
    customerPhoto: "/assets/images/avatar-placeholder.png",
    customerPhotoAlt: "Active construction site with Coastal Construction LLC equipment and workers in hard hats",
    notes: "Customer requested evening meeting due to site schedule."
  }]
  );

  // Calculate stats
  const stats = {
    total: visits?.length,
    completed: visits?.filter((v) => v?.status === 'completed')?.length,
    inProgress: visits?.filter((v) => v?.status === 'in-progress')?.length,
    pending: visits?.filter((v) => v?.status === 'upcoming' || v?.status === 'overdue')?.length
  };

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when online
  useEffect(() => {
    if (isOnline) {
      const syncInterval = setInterval(() => {
        setLastSync(new Date());
      }, 30000); // Sync every 30 seconds

      return () => clearInterval(syncInterval);
    }
  }, [isOnline]);

  const handleSyncData = () => {
    if (isOnline) {
      setLastSync(new Date());
      // In real app, trigger actual sync
    }
  };

  const handleOptimizeRoute = () => {
    setIsOptimizing(true);
    // Simulate route optimization
    setTimeout(() => {
      setIsOptimizing(false);
      // In real app, reorder visits based on optimization
    }, 2000);
  };

  const handleCheckIn = (visitId) => {
    setVisits((prev) => prev?.map((visit) =>
    visit?.id === visitId ?
    { ...visit, status: 'in-progress', checkInTime: new Date() } :
    visit
    ));
  };

  const handleCheckOut = (visitId) => {
    const visit = visits?.find((v) => v?.id === visitId);
    setSelectedVisit(visit);
    setShowExecutionModal(true);
  };

  const handleCompleteVisit = (visitData) => {
    setVisits((prev) => prev?.map((visit) =>
    visit?.id === visitData?.id ?
    {
      ...visit,
      status: 'completed',
      completedAt: visitData?.completedAt,
      outcome: visitData?.outcome,
      notes: visitData?.notes
    } :
    visit
    ));
  };

  const handleReschedule = (visitId) => {
    // In real app, open reschedule modal
    console.log('Reschedule visit:', visitId);
  };

  const handleAddNotes = (visitId, notes) => {
    setVisits((prev) => prev?.map((visit) =>
    visit?.id === visitId ? { ...visit, notes } : visit
    ));
  };

  const handleAddSpontaneousVisit = () => {
    console.log('Add spontaneous visit');
  };

  const handleEmergencyContact = () => {
    console.log('Emergency contact');
  };

  const handleViewMap = () => {
    console.log('View map');
  };

  // Sort visits by time
  const sortedVisits = [...visits]?.sort((a, b) => {
    const timeA = new Date(`2025-11-07 ${a.scheduledTime}`);
    const timeB = new Date(`2025-11-07 ${b.scheduledTime}`);
    return timeA - timeB;
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <DayHeader
          currentDate={currentDate}
          stats={stats}
          onSyncData={handleSyncData}
          isOnline={isOnline}
          lastSync={lastSync} />


        <div className="p-4 pb-20">
          {/* Route Optimizer */}
          <RouteOptimizer
            visits={visits}
            onOptimizeRoute={handleOptimizeRoute}
            isOptimizing={isOptimizing} />


          {/* Offline Notice */}
          {!isOnline &&
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2">
                <Icon name="WifiOff" size={16} className="text-warning" />
                <span className="text-sm text-warning font-medium">
                  Working offline. Changes will sync when connection is restored.
                </span>
              </div>
            </div>
          }

          {/* Visit List */}
          <div className="space-y-4">
            {sortedVisits?.length > 0 ?
            sortedVisits?.map((visit) =>
            <VisitCard
              key={visit?.id}
              visit={visit}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              onReschedule={handleReschedule}
              onAddNotes={handleAddNotes} />

            ) :

            <div className="text-center py-12">
                <Icon name="Calendar" size={48} className="text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No visits scheduled</h3>
                <p className="text-muted-foreground mb-4">
                  You have no visits scheduled for today.
                </p>
                <Button variant="outline" iconName="Plus">
                  Add Visit
                </Button>
              </div>
            }
          </div>

          {/* End of Day Summary */}
          {stats?.completed === stats?.total && stats?.total > 0 &&
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 mt-6">
              <div className="text-center">
                <Icon name="CheckCircle" size={32} className="text-success mx-auto mb-2" />
                <h3 className="font-semibold text-success mb-1">Great job!</h3>
                <p className="text-sm text-success/80">
                  You've completed all visits for today. Time to head home!
                </p>
              </div>
            </div>
          }
        </div>

        {/* Quick Actions FAB */}
        <QuickActions
          onAddSpontaneousVisit={handleAddSpontaneousVisit}
          onEmergencyContact={handleEmergencyContact}
          onViewMap={handleViewMap} />


        {/* Visit Execution Modal */}
        <VisitExecutionModal
          visit={selectedVisit}
          isOpen={showExecutionModal}
          onClose={() => {
            setShowExecutionModal(false);
            setSelectedVisit(null);
          }}
          onComplete={handleCompleteVisit} />

      </main>
    </div>);

};

export default MyDayMobile;