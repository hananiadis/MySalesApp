import React, { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import Header from '../../components/ui/Header';
import PerformanceOverview from './components/PerformanceOverview';
import VisitCompletionChart from './components/VisitCompletionChart';
import TerritoryHeatMap from './components/TerritoryHeatMap';
import SalesmanComparison from './components/SalesmanComparison';
import ConversionAnalytics from './components/ConversionAnalytics';
import AnalyticsFilters from './components/AnalyticsFilters';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { fetchAnalyticsOverview } from '../../utils/bootApi';

function toAnalyticsQuery(filters) {
  return {
    range: filters.dateRange,
    territoryId: filters.territory !== 'all' ? filters.territory : undefined,
    salesmanId: filters.salesman !== 'all' ? filters.salesman : undefined,
    customerSegment: filters.customerSegment !== 'all' ? filters.customerSegment : undefined,
  };
}

const PerformanceAnalytics = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    dateRange: 'last7days',
    territory: 'all',
    salesman: 'all',
    customerSegment: 'all',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [analytics, setAnalytics] = useState(null);

  const tabs = [
    {
      id: 'overview',
      label: 'Επισκόπηση',
      icon: 'BarChart3',
      description: 'Βασικοί δείκτες απόδοσης και τάσεις',
    },
    {
      id: 'territory',
      label: 'Ανάλυση Περιοχών',
      icon: 'Map',
      description: 'Γεωγραφική απόδοση και κάλυψη',
    },
    {
      id: 'team',
      label: 'Απόδοση Ομάδας',
      icon: 'Users',
      description: 'Σύγκριση απόδοσης ανά πωλητή',
    },
    {
      id: 'conversion',
      label: 'Αναλύσεις Μετατροπών',
      icon: 'TrendingUp',
      description: 'Αποτελέσματα επισκέψεων και pipeline μετατροπών',
    },
  ];

  const loadAnalytics = useCallback(async (nextFilters = filters) => {
    try {
      setIsLoading(true);
      setLoadError('');
      const response = await fetchAnalyticsOverview(toAnalyticsQuery(nextFilters));
      setAnalytics(response || null);
    } catch (error) {
      setLoadError(error?.message || 'Αδυναμία φόρτωσης δεδομένων αναλύσεων.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAnalytics(filters);
  }, [filters, loadAnalytics]);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64 bg-card border border-border rounded-lg">
          <div className="text-center space-y-3">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground">Φόρτωση δεδομένων αναλύσεων...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <PerformanceOverview data={analytics?.overview} />
            <VisitCompletionChart data={analytics?.trends} />
          </div>
        );
      case 'territory':
        return <TerritoryHeatMap data={analytics?.territories} />;
      case 'team':
        return <SalesmanComparison data={analytics?.salesmen} />;
      case 'conversion':
        return <ConversionAnalytics data={analytics?.conversion} />;
      default:
        return <PerformanceOverview data={analytics?.overview} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Αναλύσεις Απόδοσης - FieldSales Pro</title>
        <meta
          name="description"
          content="Ολοκληρωμένες αναφορές και ανάλυση αποδοτικότητας ομάδας πωλήσεων, κάλυψης περιοχών και δεικτών μετατροπής επισκέψεων."
        />
      </Helmet>
      <Header />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Αναλύσεις Απόδοσης</h1>
                <p className="text-muted-foreground mt-2">
                  Πλήρης εικόνα για την αποδοτικότητα της ομάδας πωλήσεων και την απόδοση περιοχών
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  className="flex items-center space-x-2"
                  onClick={() => loadAnalytics(filters)}
                >
                  <Icon name="RefreshCw" size={16} />
                  <span>Ανανέωση Δεδομένων</span>
                </Button>

                <Button variant="default" className="flex items-center space-x-2">
                  <Icon name="Settings" size={16} />
                  <span>Ρυθμίσεις</span>
                </Button>
              </div>
            </div>
          </div>

          {loadError && (
            <div className="mb-6 rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
              {loadError}
            </div>
          )}

          <AnalyticsFilters
            onFiltersChange={handleFiltersChange}
            territoryOptions={analytics?.options?.territories || []}
            salesmanOptions={analytics?.options?.salesmen || []}
          />

          <div className="mb-6">
            <div className="border-b border-border">
              <nav className="flex space-x-8 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                    }`}
                  >
                    <Icon name={tab.icon} size={18} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {tabs.find((tab) => tab.id === activeTab)?.description}
              </p>
            </div>
          </div>

          <div className="space-y-6">{renderTabContent()}</div>

          <div className="mt-8 p-6 bg-card border border-border rounded-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">Γρήγορες Ενέργειες</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="flex items-center justify-center space-x-2 p-4 h-auto">
                <Icon name="Calendar" size={20} />
                <div className="text-left">
                  <div className="font-medium">Ανασκόπηση Προγράμματος</div>
                  <div className="text-sm text-muted-foreground">Προγραμματισμός συνάντησης ομάδας</div>
                </div>
              </Button>

              <Button variant="outline" className="flex items-center justify-center space-x-2 p-4 h-auto">
                <Icon name="AlertTriangle" size={20} />
                <div className="text-left">
                  <div className="font-medium">Ειδοποιήσεις Απόδοσης</div>
                  <div className="text-sm text-muted-foreground">Επισκόπηση τάσεων και αποκλίσεων</div>
                </div>
              </Button>

              <Button variant="outline" className="flex items-center justify-center space-x-2 p-4 h-auto">
                <Icon name="Target" size={20} />
                <div className="text-left">
                  <div className="font-medium">Ορισμός Στόχων</div>
                  <div className="text-sm text-muted-foreground">Ενημέρωση στόχων ομάδας</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PerformanceAnalytics;
