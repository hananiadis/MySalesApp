import React, { useState, useEffect } from 'react';
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

const PerformanceAnalytics = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    dateRange: 'last7days',
    territory: 'all',
    salesman: 'all',
    customerSegment: 'all'
  });
  const [isLoading, setIsLoading] = useState(false);

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: 'BarChart3',
      description: 'Key performance metrics and trends'
    },
    {
      id: 'territory',
      label: 'Territory Analysis',
      icon: 'Map',
      description: 'Geographic performance and coverage'
    },
    {
      id: 'team',
      label: 'Team Performance',
      icon: 'Users',
      description: 'Individual salesman comparison'
    },
    {
      id: 'conversion',
      label: 'Conversion Analytics',
      icon: 'TrendingUp',
      description: 'Visit outcomes and revenue attribution'
    }
  ];

  useEffect(() => {
    // Simulate data loading when filters change
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [filters]);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64 bg-card border border-border rounded-lg">
          <div className="text-center space-y-3">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground">Loading analytics data...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <PerformanceOverview />
            <VisitCompletionChart />
          </div>
        );
      case 'territory':
        return <TerritoryHeatMap />;
      case 'team':
        return <SalesmanComparison />;
      case 'conversion':
        return <ConversionAnalytics />;
      default:
        return <PerformanceOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Performance Analytics - FieldSales Pro</title>
        <meta name="description" content="Comprehensive reporting and analysis of sales team efficiency, territory coverage, and visit-to-order conversion metrics" />
      </Helmet>
      <Header />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Performance Analytics</h1>
                <p className="text-muted-foreground mt-2">
                  Comprehensive insights into sales team efficiency and territory performance
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  className="flex items-center space-x-2"
                  onClick={() => window.location?.reload()}
                >
                  <Icon name="RefreshCw" size={16} />
                  <span>Refresh Data</span>
                </Button>

                <Button
                  variant="default"
                  className="flex items-center space-x-2"
                >
                  <Icon name="Settings" size={16} />
                  <span>Configure</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <AnalyticsFilters onFiltersChange={handleFiltersChange} />

          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="border-b border-border">
              <nav className="flex space-x-8 overflow-x-auto">
                {tabs?.map((tab) => (
                  <button
                    key={tab?.id}
                    onClick={() => setActiveTab(tab?.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200 ${
                      activeTab === tab?.id
                        ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                    }`}
                  >
                    <Icon name={tab?.icon} size={18} />
                    <span>{tab?.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Description */}
            <div className="mt-4 p-4 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {tabs?.find(tab => tab?.id === activeTab)?.description}
              </p>
            </div>
          </div>

          {/* Tab Content */}
          <div className="space-y-6">
            {renderTabContent()}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 p-6 bg-card border border-border rounded-lg">
            <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="flex items-center justify-center space-x-2 p-4 h-auto"
              >
                <Icon name="Calendar" size={20} />
                <div className="text-left">
                  <div className="font-medium">Schedule Review</div>
                  <div className="text-sm text-muted-foreground">Plan team meeting</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="flex items-center justify-center space-x-2 p-4 h-auto"
              >
                <Icon name="AlertTriangle" size={20} />
                <div className="text-left">
                  <div className="font-medium">Performance Alerts</div>
                  <div className="text-sm text-muted-foreground">View 3 active alerts</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="flex items-center justify-center space-x-2 p-4 h-auto"
              >
                <Icon name="Target" size={20} />
                <div className="text-left">
                  <div className="font-medium">Set Targets</div>
                  <div className="text-sm text-muted-foreground">Update goals</div>
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