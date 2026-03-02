import React, { useState, useMemo } from 'react';
import Header from '../../components/ui/Header';
import CustomerTable from './components/CustomerTable';
import CustomerFilters from './components/CustomerFilters';
import Customer360Modal from './components/Customer360Modal';
import BulkActionsPanel from './components/BulkActionsPanel';
import TerritoryMap from './components/TerritoryMap';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

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

  // Mock customer data
  const mockCustomers = [
  {
    id: 1,
    name: 'Sarah Johnson',
    company: 'TechCorp Solutions',
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: 'Professional headshot of woman with shoulder-length brown hair in business attire',
    territory: 'North Region',
    lastVisit: '2024-11-05',
    compliance: 95,
    priority: 'high',
    email: 'sarah.johnson@techcorp.com',
    phone: '+1 (555) 123-4567',
    address: '123 Business Ave, Tech City, TC 12345'
  },
  {
    id: 2,
    name: 'Michael Chen',
    company: 'Global Industries',
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: 'Professional headshot of Asian man with black hair in navy suit',
    territory: 'East Region',
    lastVisit: '2024-11-03',
    compliance: 88,
    priority: 'medium',
    email: 'michael.chen@globalind.com',
    phone: '+1 (555) 234-5678',
    address: '456 Commerce St, Business Park, BP 23456'
  },
  {
    id: 3,
    name: 'Emily Rodriguez',
    company: 'Innovation Labs',
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: 'Professional headshot of Hispanic woman with long dark hair in white blouse',
    territory: 'West Region',
    lastVisit: '2024-10-28',
    compliance: 72,
    priority: 'high',
    email: 'emily.rodriguez@innovlabs.com',
    phone: '+1 (555) 345-6789',
    address: '789 Innovation Dr, Tech Valley, TV 34567'
  },
  {
    id: 4,
    name: 'David Thompson',
    company: 'Manufacturing Plus',
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: 'Professional headshot of Caucasian man with brown hair in gray suit',
    territory: 'South Region',
    lastVisit: '2024-11-01',
    compliance: 91,
    priority: 'medium',
    email: 'david.thompson@mfgplus.com',
    phone: '+1 (555) 456-7890',
    address: '321 Industrial Blvd, Factory Town, FT 45678'
  },
  {
    id: 5,
    name: 'Lisa Wang',
    company: 'Digital Dynamics',
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: 'Professional headshot of Asian woman with short black hair in blue blazer',
    territory: 'Central Region',
    lastVisit: '2024-10-25',
    compliance: 65,
    priority: 'low',
    email: 'lisa.wang@digitaldyn.com',
    phone: '+1 (555) 567-8901',
    address: '654 Digital Way, Cyber City, CC 56789'
  },
  {
    id: 6,
    name: 'Robert Martinez',
    company: 'Enterprise Solutions',
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: 'Professional headshot of Hispanic man with beard in dark suit',
    territory: 'North Region',
    lastVisit: '2024-11-04',
    compliance: 93,
    priority: 'high',
    email: 'robert.martinez@entsol.com',
    phone: '+1 (555) 678-9012',
    address: '987 Enterprise Pkwy, Business Hub, BH 67890'
  }];


  // Filter and sort customers
  const filteredAndSortedCustomers = useMemo(() => {
    let filtered = mockCustomers?.filter((customer) => {
      const matchesSearch = customer?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      customer?.company?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      customer?.territory?.toLowerCase()?.includes(searchTerm?.toLowerCase());

      const matchesTerritory = territoryFilter === 'all' ||
      customer?.territory?.toLowerCase()?.includes(territoryFilter);

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
  }, [mockCustomers, searchTerm, territoryFilter, priorityFilter, complianceFilter, sortConfig]);

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
              <h1 className="text-2xl font-bold text-foreground mb-2">Customer Management</h1>
              <p className="text-muted-foreground">
                Comprehensive customer database with territory assignment and visit tracking
              </p>
            </div>
            
            <div className="flex items-center space-x-3 mt-4 lg:mt-0">
              <Button
                variant={showMap ? 'default' : 'outline'}
                onClick={() => setShowMap(!showMap)}
                iconName="Map"
                iconPosition="left">

                {showMap ? 'Hide Map' : 'Show Map'}
              </Button>
              <Button variant="outline" iconName="Filter" iconPosition="left">
                Advanced Filters
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
            onTerritoryChange={setTerritoryFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            complianceFilter={complianceFilter}
            onComplianceChange={setComplianceFilter}
            onClearFilters={handleClearFilters}
            resultCount={filteredAndSortedCustomers?.length} />


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
              <h3 className="text-lg font-medium text-foreground mb-2">No customers found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search criteria or filters
              </p>
              <Button variant="outline" onClick={handleClearFilters}>
                Clear Filters
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