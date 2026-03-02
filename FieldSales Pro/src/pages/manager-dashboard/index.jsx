import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import TeamStatusMap from './components/TeamStatusMap';
import PerformanceMetrics from './components/PerformanceMetrics';
import ActivityFeed from './components/ActivityFeed';
import QuickActions from './components/QuickActions';
import TeamOverview from './components/TeamOverview';

const ManagerDashboard = () => {
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setLastRefresh(new Date());
      setIsRefreshing(false);
    }, 1000);
  };

  const navigationCards = [
    {
      title: 'Territory Planning',
      description: 'Strategic 2-month territory planning with visual mapping',
      icon: 'Map',
      path: '/territory-planning',
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      title: 'Visit Scheduling',
      description: 'Dynamic daily visit scheduling with route optimization',
      icon: 'Calendar',
      path: '/visit-scheduling',
      color: 'text-accent',
      bgColor: 'bg-accent/10'
    },
    {
      title: 'Customer Management',
      description: 'Customer database and territory management tools',
      icon: 'Users',
      path: '/customer-management',
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    {
      title: 'Performance Analytics',
      description: 'Comprehensive performance reporting and analysis',
      icon: 'TrendingUp',
      path: '/performance-analytics',
      color: 'text-warning',
      bgColor: 'bg-warning/10'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
          {/* Header Section */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
                Manager Dashboard
              </h1>
              <p className="text-muted-foreground">
                Real-time oversight of field operations and team performance
              </p>
            </div>
            
            <div className="flex items-center space-x-3 mt-4 lg:mt-0">
              <div className="text-sm text-muted-foreground">
                Last updated: {lastRefresh?.toLocaleTimeString()}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRefresh}
                loading={isRefreshing}
                iconName="RefreshCw"
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Performance Metrics */}
          <PerformanceMetrics className="mb-6" />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
            {/* Map and Team Status - Takes 2 columns on xl screens */}
            <div className="xl:col-span-2 space-y-6">
              <TeamStatusMap />
              <TeamOverview />
            </div>

            {/* Right Sidebar - Takes 1 column on xl screens */}
            <div className="space-y-6">
              <QuickActions />
              <ActivityFeed />
            </div>
          </div>

          {/* Navigation Cards */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Quick Navigation
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {navigationCards?.map((card) => (
                <Link
                  key={card?.path}
                  to={card?.path}
                  className="block p-4 bg-card border border-border rounded-lg hover:shadow-md transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-3 mb-3">
                    <div className={`p-2 rounded-lg ${card?.bgColor} group-hover:scale-110 transition-transform`}>
                      <Icon name={card?.icon} size={20} className={card?.color} />
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {card?.title}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {card?.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {/* Mobile Quick Actions */}
          <div className="lg:hidden">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Mobile Actions
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/my-day-mobile"
                className="flex items-center justify-center space-x-2 p-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Icon name="Smartphone" size={20} />
                <span className="font-medium">My Day</span>
              </Link>
              <Button
                variant="outline"
                className="flex items-center justify-center space-x-2 p-4"
                iconName="Bell"
              >
                <span className="font-medium">Alerts</span>
              </Button>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 p-4 bg-muted/30 rounded-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                <p>Dashboard automatically refreshes every 30 seconds for real-time updates.</p>
                <p className="mt-1">
                  For urgent issues, use the quick actions panel or contact team members directly.
                </p>
              </div>
              <div className="mt-3 md:mt-0">
                <Button variant="ghost" size="sm" iconName="HelpCircle">
                  Help & Support
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagerDashboard;