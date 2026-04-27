import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/ui/Header';
import CustomerTable from './components/CustomerTable';
import CustomerFilters from './components/CustomerFilters';
import Customer360Modal from './components/Customer360Modal';
import BulkActionsPanel from './components/BulkActionsPanel';
import TerritoryMap from './components/TerritoryMap';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { fetchCustomers, fetchTerritories } from '../../utils/bootApi';

function toIsoDate(input) {
  if (!input) {
    return null;
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function computeCompliance(rawCustomer) {
  const dueDate = toIsoDate(rawCustomer?.nextVisitDue);
  if (dueDate) {
    return new Date(dueDate) >= new Date() ? 95 : 60;
  }

  const lastVisit = toIsoDate(rawCustomer?.lastVisitAt);
  if (!lastVisit) {
    return 75;
  }

  const visitCadenceDays = Number(rawCustomer?.visitCadenceDays || 60);
  const elapsedDays = Math.floor(
    (Date.now() - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (elapsedDays <= visitCadenceDays) {
    return 95;
  }

  if (elapsedDays <= visitCadenceDays + 14) {
    return 78;
  }

  return 62;
}

function mapCustomerToUi(rawCustomer, territoryMap) {
  const lastVisit =
    toIsoDate(rawCustomer?.lastVisitAt) ||
    toIsoDate(rawCustomer?.updatedAt) ||
    toIsoDate(new Date().toISOString());
  const compliance = computeCompliance(rawCustomer);
  const territoryId = String(rawCustomer?.territoryId || '').trim() || null;

  return {
    id: String(rawCustomer?.id || rawCustomer?.customerCode || ''),
    customerCode: rawCustomer?.customerCode || '',
    name: String(rawCustomer?.name || rawCustomer?.customerCode || 'Unknown').trim(),
    company: String(rawCustomer?.name || rawCustomer?.customerCode || 'Unknown').trim(),
    avatar: '/assets/images/avatar-placeholder.png',
    avatarAlt: 'Customer avatar placeholder',
    territoryId,
    territory: territoryMap.get(territoryId)?.name || 'Χωρίς περιοχή',
    lastVisit,
    compliance,
    priority:
      String(rawCustomer?.priority || '').trim().toLowerCase() ||
      (compliance >= 90 ? 'medium' : 'high'),
    email: rawCustomer?.email || '',
    phone: rawCustomer?.phone || '',
    address: rawCustomer?.address || '',
  };
}

const CustomerManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [territoryFilter, setTerritoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [complianceFilter, setComplianceFilter] = useState('all');
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [territories, setTerritories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        const [territoriesResult, customersResult] = await Promise.all([
          fetchTerritories({ active: true }),
          fetchCustomers({ limit: 500 }),
        ]);

        if (!isMounted) {
          return;
        }

        const territoryItems = Array.isArray(territoriesResult?.items)
          ? territoriesResult.items
          : [];
        const territoryMap = new Map(
          territoryItems.map((territory) => [String(territory.id), territory])
        );

        const customerItems = Array.isArray(customersResult?.items)
          ? customersResult.items
          : [];

        setTerritories(territoryItems);
        setCustomers(customerItems.map((item) => mapCustomerToUi(item, territoryMap)));
      } catch (loadError) {
        if (!isMounted) {
          return;
        }
        setError(loadError?.message || 'Αδυναμία φόρτωσης πελατών.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Filter and sort customers
  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = customers?.filter((customer) => {
      const matchesSearch = customer?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      customer?.company?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      customer?.territory?.toLowerCase()?.includes(searchTerm?.toLowerCase());

      const matchesTerritory = territoryFilter === 'all' ||
      customer?.territoryId === territoryFilter;

      const matchesPriority = priorityFilter === 'all' || customer?.priority === priorityFilter;

      const matchesCompliance = complianceFilter === 'all' ||
      complianceFilter === 'compliant' && customer?.compliance >= 90 ||
      complianceFilter === 'at-risk' && customer?.compliance >= 70 && customer?.compliance < 90 ||
      complianceFilter === 'non-compliant' && customer?.compliance < 70;

      return matchesSearch && matchesTerritory && matchesPriority && matchesCompliance;
    });

    // Sort customers
    filtered?.sort((a, b) => {
      let aValue = a?.[sortConfig?.key];
      let bValue = b?.[sortConfig?.key];

      if (sortConfig?.key === 'lastVisit') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) return sortConfig?.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig?.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [customers, searchTerm, territoryFilter, priorityFilter, complianceFilter, sortConfig]);

  const territoryOptions = useMemo(() => {
    const dynamicOptions = territories
      .map((territory) => ({
        value: String(territory.id),
        label: territory.name || String(territory.id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'el'));

    return [{ value: 'all', label: 'Όλες οι Περιοχές' }, ...dynamicOptions];
  }, [territories]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev?.key === key && prev?.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleCustomerSelect = (customerId) => {
    setSelectedCustomers((prev) =>
    prev?.includes(customerId) ?
    prev?.filter((id) => id !== customerId) :
    [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    setSelectedCustomers((prev) =>
    prev?.length === filteredAndSortedCustomers?.length ?
    [] :
    filteredAndSortedCustomers?.map((customer) => customer?.id)
    );
  };

  const handleCustomerClick = (customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setTerritoryFilter('all');
    setPriorityFilter('all');
    setComplianceFilter('all');
  };

  const handleBulkTerritoryChange = (territory) => {
    console.log(`Changing territory to ${territory} for ${selectedCustomers?.length} customers`);
    setSelectedCustomers([]);
  };

  const handleBulkPriorityChange = (priority) => {
    console.log(`Changing priority to ${priority} for ${selectedCustomers?.length} customers`);
    setSelectedCustomers([]);
  };

  const handleBulkScheduleVisit = () => {
    console.log(`Scheduling visits for ${selectedCustomers?.length} customers`);
  };

  const handleBulkExport = () => {
    console.log(`Exporting ${selectedCustomers?.length} customers`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Διαχείριση Πελατών</h1>
              <p className="text-muted-foreground">
                Ολοκληρωμένη βάση πελατών με ανάθεση περιοχών και παρακολούθηση επισκέψεων
              </p>
            </div>
            
            <div className="flex items-center space-x-3 mt-4 lg:mt-0">
              <Button
                variant={showMap ? 'default' : 'outline'}
                onClick={() => setShowMap(!showMap)}
                iconName="Map"
                iconPosition="left">

                {showMap ? 'Απόκρυψη Χάρτη' : 'Εμφάνιση Χάρτη'}
              </Button>
              <Button variant="outline" iconName="Filter" iconPosition="left">
                Προχωρημένα Φίλτρα
              </Button>
            </div>
          </div>

          {/* Territory Map */}
          {showMap &&
          <div className="mb-6">
              <TerritoryMap
              onTerritorySelect={setSelectedTerritory}
              selectedTerritory={selectedTerritory} />

            </div>
          }

          {/* Filters */}
          <CustomerFilters
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            territoryFilter={territoryFilter}
            territoryOptions={territoryOptions}
            onTerritoryChange={setTerritoryFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            complianceFilter={complianceFilter}
            onComplianceChange={setComplianceFilter}
            onClearFilters={handleClearFilters}
            resultCount={filteredAndSortedCustomers?.length} />

          {loading && (
            <div className="mb-4 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
              Φόρτωση πελατών από FieldSales Pro API...
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
              {error}
            </div>
          )}


          {/* Customer Table */}
          <CustomerTable
            customers={filteredAndSortedCustomers}
            selectedCustomers={selectedCustomers}
            onCustomerSelect={handleCustomerSelect}
            onSelectAll={handleSelectAll}
            onCustomerClick={handleCustomerClick}
            sortConfig={sortConfig}
            onSort={handleSort} />


          {/* Empty State */}
          {filteredAndSortedCustomers?.length === 0 &&
          <div className="text-center py-12">
              <Icon name="Users" size={48} className="text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Δεν βρέθηκαν πελάτες</h3>
              <p className="text-muted-foreground mb-4">
                Δοκιμάστε να προσαρμόσετε τα κριτήρια αναζήτησης ή τα φίλτρα
              </p>
              <Button variant="outline" onClick={handleClearFilters}>
                Καθαρισμός Φίλτρων
              </Button>
            </div>
          }
        </div>
      </main>
      {/* Bulk Actions Panel */}
      <BulkActionsPanel
        selectedCount={selectedCustomers?.length}
        onClearSelection={() => setSelectedCustomers([])}
        onBulkTerritoryChange={handleBulkTerritoryChange}
        onBulkPriorityChange={handleBulkPriorityChange}
        onBulkScheduleVisit={handleBulkScheduleVisit}
        onBulkExport={handleBulkExport} />

      {/* Customer 360 Modal */}
      <Customer360Modal
        customer={selectedCustomer}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)} />

    </div>);

};

export default CustomerManagement;