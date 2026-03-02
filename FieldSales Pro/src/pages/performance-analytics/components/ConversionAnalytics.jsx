import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';

const ConversionAnalytics = () => {
  const conversionData = [
    { name: 'Successful Orders', value: 178, color: '#059669', percentage: 34.2 },
    { name: 'Follow-up Required', value: 156, color: '#F59E0B', percentage: 30.0 },
    { name: 'Quotes Pending', value: 98, color: '#2563EB', percentage: 18.8 },
    { name: 'No Interest', value: 88, color: '#EF4444', percentage: 16.9 }
  ];

  const revenueByOutcome = [
    {
      outcome: "Immediate Orders",
      visits: 178,
      revenue: 425600,
      avgRevenue: 2391,
      icon: "ShoppingCart",
      color: "text-success",
      bgColor: "bg-success/10"
    },
    {
      outcome: "Follow-up Pipeline",
      visits: 156,
      revenue: 312800,
      avgRevenue: 2005,
      icon: "Clock",
      color: "text-warning",
      bgColor: "bg-warning/10"
    },
    {
      outcome: "Quote Requests",
      visits: 98,
      revenue: 189400,
      avgRevenue: 1933,
      icon: "FileText",
      color: "text-primary",
      bgColor: "bg-primary/10"
    }
  ];

  const engagementMetrics = [
    { label: "Decision Maker Met", value: 67, total: 100, icon: "Users" },
    { label: "Product Demo Given", value: 45, total: 100, icon: "Monitor" },
    { label: "Pricing Discussed", value: 78, total: 100, icon: "DollarSign" },
    { label: "Next Meeting Scheduled", value: 56, total: 100, icon: "Calendar" }
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0];
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data?.name}</p>
          <p className="text-sm text-muted-foreground">
            {data?.value} visits ({data?.payload?.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Visit Outcomes Pie Chart */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Visit Outcome Distribution</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conversionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {conversionData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry?.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Outcome Breakdown</h4>
            {conversionData?.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item?.color }}
                  />
                  <span className="text-sm font-medium text-foreground">{item?.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{item?.value}</p>
                  <p className="text-xs text-muted-foreground">{item?.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Revenue by Outcome */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Revenue Attribution by Outcome</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {revenueByOutcome?.map((item, index) => (
            <div key={index} className="p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 rounded-lg ${item?.bgColor} flex items-center justify-center`}>
                  <Icon name={item?.icon} size={20} className={item?.color} />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{item?.visits} visits</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-foreground">{item?.outcome}</h4>
                <p className="text-2xl font-bold text-foreground">
                  ${(item?.revenue / 1000)?.toFixed(0)}k
                </p>
                <p className="text-sm text-muted-foreground">
                  Avg: ${item?.avgRevenue}/visit
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Customer Engagement Scoring */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Customer Engagement Metrics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {engagementMetrics?.map((metric, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Icon name={metric?.icon} size={18} className="text-primary" />
                  <span className="font-medium text-foreground">{metric?.label}</span>
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {metric?.value}%
                </span>
              </div>
              
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${metric?.value}%` }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConversionAnalytics;