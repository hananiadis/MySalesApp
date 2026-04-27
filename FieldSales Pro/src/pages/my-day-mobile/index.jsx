import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import DayHeader from './components/DayHeader';
import VisitCard from './components/VisitCard';
import RouteOptimizer from './components/RouteOptimizer';
import QuickActions from './components/QuickActions';
import VisitExecutionModal from './components/VisitExecutionModal';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import {
  createVisitExecution,
  fetchVisitPlans,
  saveVisitPlan,
  updateVisitExecution,
} from '../../utils/bootApi';

const MyDayMobile = () => {
  const [currentDate] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState(new Date());
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [visits, setVisits] = useState([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [visitsError, setVisitsError] = useState('');
  const [isSavingExecution, setIsSavingExecution] = useState(false);

  const toScheduledTime = (visit) => {
    const startTime = String(visit?.startTime || '').trim();
    if (startTime) {
      return startTime;
    }

    const slot = String(visit?.timeSlot || '').trim();
    if (slot.includes('-')) {
      return slot?.split('-')?.[0]?.trim();
    }

    return slot || '09:00';
  };

  const mapVisitPlanToCard = (visit) => ({
    id: visit?.id,
    visitPlanId: visit?.id,
    customerId: visit?.customerId || null,
    customerCode: visit?.customerCode || null,
    customerName: visit?.customerName || visit?.company || 'Πελάτης',
    company: visit?.company || null,
    location: visit?.location || null,
    address: visit?.address || visit?.location || '—',
    scheduledTime: toScheduledTime(visit),
    status: visit?.status || 'upcoming',
    priority: String(visit?.priority || 'medium')?.toLowerCase(),
    objectives: visit?.objective || 'Προγραμματισμένη επίσκεψη πελάτη.',
    contactPerson: visit?.customerName || '—',
    phone: visit?.phone || '—',
    lastVisit: visit?.date || '—',
    lastOutcome: visit?.type || '—',
    customerPhoto: '/assets/images/avatar-placeholder.png',
    customerPhotoAlt: 'Customer location placeholder image',
    notes: visit?.notes || '',
    executionId: visit?.executionId || null,
  });

  const toExecutionPayload = (visit, overrides = {}) => {
    const date = new Date().toISOString().slice(0, 10);
    return {
      visitPlanId: visit?.visitPlanId || visit?.id,
      customerId: visit?.customerId || null,
      customerCode: visit?.customerCode || null,
      customerName: visit?.customerName || null,
      company: visit?.company || null,
      location: visit?.location || null,
      address: visit?.address || null,
      phone: visit?.phone || null,
      date,
      ...overrides,
    };
  };

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

  useEffect(() => {
    let isActive = true;

    const loadTodayPlans = async () => {
      setIsLoadingVisits(true);
      setVisitsError('');

      try {
        const today = new Date().toISOString().slice(0, 10);
        const response = await fetchVisitPlans({ date: today });

        if (!isActive) {
          return;
        }

        const items = Array.isArray(response?.items) ? response.items : [];
        setVisits(items.map(mapVisitPlanToCard));
      } catch (error) {
        if (isActive) {
          setVisitsError(error?.message || 'Αδυναμία φόρτωσης σημερινών επισκέψεων.');
          setVisits([]);
        }
      } finally {
        if (isActive) {
          setIsLoadingVisits(false);
        }
      }
    };

    loadTodayPlans();

    return () => {
      isActive = false;
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
    const targetVisit = visits?.find((visit) => visit?.id === visitId);
    if (!targetVisit) {
      return;
    }

    const checkInAt = new Date().toISOString();
    setVisits((prev) =>
      prev?.map((visit) =>
        visit?.id === visitId ? { ...visit, status: 'in-progress', checkInTime: checkInAt } : visit
      )
    );

    setIsSavingExecution(true);
    setVisitsError('');

    createVisitExecution(
      toExecutionPayload(targetVisit, {
        status: 'in-progress',
        checkInAt,
      })
    )
      .then((response) => {
        const executionId = response?.item?.id || null;
        setVisits((prev) =>
          prev?.map((visit) =>
            visit?.id === visitId ? { ...visit, executionId: executionId || visit?.executionId } : visit
          )
        );
        return saveVisitPlan({ id: targetVisit?.visitPlanId || visitId, status: 'in-progress' });
      })
      .catch((error) => {
        setVisitsError(error?.message || 'Αποτυχία καταγραφής check-in επίσκεψης.');
        setVisits((prev) =>
          prev?.map((visit) =>
            visit?.id === visitId ? { ...visit, status: targetVisit?.status || 'upcoming' } : visit
          )
        );
      })
      .finally(() => {
        setIsSavingExecution(false);
      });
  };

  const handleCheckOut = (visitId) => {
    const visit = visits?.find((v) => v?.id === visitId);
    setSelectedVisit(visit);
    setShowExecutionModal(true);
  };

  const handleCompleteVisit = async (visitData) => {
    const targetVisit = visits?.find((visit) => visit?.id === visitData?.id);
    if (!targetVisit) {
      return;
    }

    const completedAtIso = new Date(visitData?.completedAt || new Date()).toISOString();

    setVisits((prev) =>
      prev?.map((visit) =>
        visit?.id === visitData?.id
          ? {
              ...visit,
              status: 'completed',
              completedAt: completedAtIso,
              outcome: visitData?.outcome,
              notes: visitData?.notes,
            }
          : visit
      )
    );

    setIsSavingExecution(true);
    setVisitsError('');

    try {
      if (targetVisit?.executionId) {
        await updateVisitExecution(targetVisit.executionId, {
          status: 'completed',
          checkOutAt: completedAtIso,
          completedAt: completedAtIso,
          outcome: visitData?.outcome,
          notes: visitData?.notes,
          nextAction: visitData?.nextAction,
          checklist: visitData?.checklist,
          attachments: visitData?.attachments,
        });
      } else {
        const createResponse = await createVisitExecution(
          toExecutionPayload(targetVisit, {
            status: 'completed',
            checkInAt: completedAtIso,
            checkOutAt: completedAtIso,
            completedAt: completedAtIso,
            outcome: visitData?.outcome,
            notes: visitData?.notes,
            nextAction: visitData?.nextAction,
            checklist: visitData?.checklist,
            attachments: visitData?.attachments,
          })
        );

        const executionId = createResponse?.item?.id || null;
        if (executionId) {
          setVisits((prev) =>
            prev?.map((visit) =>
              visit?.id === visitData?.id ? { ...visit, executionId } : visit
            )
          );
        }
      }

      await saveVisitPlan({
        id: targetVisit?.visitPlanId || visitData?.id,
        status: 'completed',
        notes: visitData?.notes,
      });
    } catch (error) {
      setVisitsError(error?.message || 'Αποτυχία ολοκλήρωσης επίσκεψης.');
      setVisits((prev) =>
        prev?.map((visit) =>
          visit?.id === visitData?.id ? { ...visit, status: targetVisit?.status || 'in-progress' } : visit
        )
      );
    } finally {
      setIsSavingExecution(false);
    }
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
          {isLoadingVisits && (
            <div className="bg-card border border-border rounded-lg p-3 mb-4 text-sm text-muted-foreground">
              Φόρτωση σημερινών επισκέψεων...
            </div>
          )}

          {visitsError && (
            <div className="bg-error/10 border border-error/30 rounded-lg p-3 mb-4 text-sm text-error">
              {visitsError}
            </div>
          )}

          {isSavingExecution && (
            <div className="bg-card border border-border rounded-lg p-3 mb-4 text-sm text-muted-foreground">
              Αποθήκευση ενημέρωσης επίσκεψης...
            </div>
          )}

          {!isOnline &&
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-4">
              <div className="flex items-center space-x-2">
                <Icon name="WifiOff" size={16} className="text-warning" />
                <span className="text-sm text-warning font-medium">
                  Εργασία εκτός σύνδεσης. Οι αλλαγές θα συγχρονιστούν όταν αποκατασταθεί η σύνδεση.
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
                <h3 className="text-lg font-medium text-foreground mb-2">Δεν υπάρχουν προγραμματισμένες επισκέψεις</h3>
                <p className="text-muted-foreground mb-4">
                  Δεν έχετε προγραμματισμένες επισκέψεις για σήμερα.
                </p>
                <Button variant="outline" iconName="Plus">
                  Προσθήκη Επίσκεψης
                </Button>
              </div>
            }
          </div>

          {/* End of Day Summary */}
          {stats?.completed === stats?.total && stats?.total > 0 &&
          <div className="bg-success/10 border border-success/20 rounded-lg p-4 mt-6">
              <div className="text-center">
                <Icon name="CheckCircle" size={32} className="text-success mx-auto mb-2" />
                <h3 className="font-semibold text-success mb-1">Εξαιρετική δουλειά!</h3>
                <p className="text-sm text-success/80">
                  Ολοκληρώσατε όλες τις επισκέψεις για σήμερα. Ώρα για επιστροφή!
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