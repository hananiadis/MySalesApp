import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';

const SalesmanComparison = () => {
  const [selectedMetric, setSelectedMetric] = useState('visits');

  const salesmenData = [
  {
    id: 1,
    name: "Michael Rodriguez",
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: "Professional headshot of Hispanic man with short black hair in navy suit",
    visits: 142,
    orders: 48,
    revenue: 89500,
    efficiency: 87,
    travelTime: 6.2,
    conversionRate: 33.8
  },
  {
    id: 2,
    name: "Sarah Chen",
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: "Professional headshot of Asian woman with long black hair in white blazer",
    visits: 128,
    orders: 52,
    revenue: 95200,
    efficiency: 91,
    travelTime: 5.8,
    conversionRate: 40.6
  },
  {
    id: 3,
    name: "David Thompson",
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: "Professional headshot of Caucasian man with brown hair in dark suit",
    visits: 135,
    orders: 41,
    revenue: 78900,
    efficiency: 82,
    travelTime: 7.1,
    conversionRate: 30.4
  },
  {
    id: 4,
    name: "Lisa Johnson",
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: "Professional headshot of African American woman with curly hair in blue blazer",
    visits: 119,
    orders: 45,
    revenue: 82300,
    efficiency: 85,
    travelTime: 6.5,
    conversionRate: 37.8
  },
  {
    id: 5,
    name: "Robert Kim",
    avatar: "/assets/images/avatar-placeholder.png",
    avatarAlt: "Professional headshot of Asian man with glasses in gray suit",
    visits: 98,
    orders: 32,
    revenue: 65400,
    efficiency: 78,
    travelTime: 8.2,
    conversionRate: 32.7
  }];


  const metrics = [
  { key: 'visits', label: 'Total Visits', icon: 'MapPin', color: '#2563EB' },
  { key: 'orders', label: 'Orders Closed', icon: 'ShoppingCart', color: '#059669' },
  { key: 'revenue', label: 'Revenue ($)', icon: 'DollarSign', color: '#DC2626' },
  { key: 'efficiency', label: 'Efficiency (%)', icon: 'Target', color: '#7C3AED' },
  { key: 'conversionRate', label: 'Conversion (%)', icon: 'TrendingUp', color: '#EA580C' }];


  const chartData = salesmenData?.map((person) => ({
    name: person?.name?.split(' ')?.[0],
    fullName: person?.name,
    [selectedMetric]: selectedMetric === 'revenue' ? person?.[selectedMetric] / 1000 : person?.[selectedMetric]
  }));

  const selectedMetricData = metrics?.find((m) => m?.key === selectedMetric);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0];
      const fullData = salesmenData?.find((p) => p?.name?.split(' ')?.[0] === label);

      return (
        <div className="bg-popover border border-border rounded-lg p-4 shadow-lg">
          <p className="font-medium text-foreground mb-2">{fullData?.name}</p>
          <p className="text-sm text-muted-foreground">
            {selectedMetricData?.label}: {
            selectedMetric === 'revenue' ?
            `$${data?.value}k` :
            selectedMetric === 'efficiency' || selectedMetric === 'conversionRate' ?
            `${data?.value}%` :
            data?.value
            }
          </p>
        </div>);

    }
    return null;
  };

  const getRankIcon = (index) => {
    switch (index) {
      case 0:return { icon: 'Trophy', color: 'text-yellow-500' };
      case 1:return { icon: 'Medal', color: 'text-gray-400' };
      case 2:return { icon: 'Award', color: 'text-amber-600' };
      default:return { icon: 'User', color: 'text-muted-foreground' };
    }
  };

  const sortedSalesmen = [...salesmenData]?.sort((a, b) => {
    if (selectedMetric === 'travelTime') {
      return a?.[selectedMetric] - b?.[selectedMetric]; // Lower is better for travel time
    }
    return b?.[selectedMetric] - a?.[selectedMetric]; // Higher is better for others
  });

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        <h3 className="text-lg font-semibold text-foreground">Salesman Performance Comparison</h3>
        
        <div className="flex flex-wrap gap-2">
          {metrics?.map((metric) =>
          <button
            key={metric?.key}
            onClick={() => setSelectedMetric(metric?.key)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
            selectedMetric === metric?.key ?
            'bg-primary text-primary-foreground' :
            'bg-muted text-muted-foreground hover:bg-muted/80'}`
            }>

              <Icon name={metric?.icon} size={16} />
              <span>{metric?.label}</span>
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12} />

              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12} />

              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey={selectedMetric}
                fill={selectedMetricData?.color || '#2563EB'}
                radius={[4, 4, 0, 0]} />

            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Leaderboard */}
        <div className="space-y-3">
          <h4 className="font-medium text-foreground mb-4">Performance Ranking</h4>
          {sortedSalesmen?.slice(0, 5)?.map((person, index) => {
            const rankData = getRankIcon(index);
            return (
              <div key={person?.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Icon name={rankData?.icon} size={20} className={rankData?.color} />
                  <Image
                    src={person?.avatar}
                    alt={person?.avatarAlt}
                    className="w-10 h-10 rounded-full object-cover" />

                  <div>
                    <p className="font-medium text-foreground">{person?.name}</p>
                    <p className="text-sm text-muted-foreground">Rank #{index + 1}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">
                    {selectedMetric === 'revenue' ?
                    `$${(person?.[selectedMetric] / 1000)?.toFixed(1)}k` :
                    selectedMetric === 'efficiency' || selectedMetric === 'conversionRate' ?
                    `${person?.[selectedMetric]}%` :
                    selectedMetric === 'travelTime' ?
                    `${person?.[selectedMetric]}h` :
                    person?.[selectedMetric]
                    }
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedMetricData?.label}
                  </p>
                </div>
              </div>);

          })}
        </div>
      </div>
    </div>);

};

export default SalesmanComparison;