import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const RouteOptimizationPanel = ({ 
  isVisible, 
  onClose, 
  selectedDay, 
  visits, 
  onOptimize,
  onExportToMaps,
  className = '' 
}) => {
  const [optimizationSettings, setOptimizationSettings] = useState({
    considerTraffic: true,
    respectTimeWindows: true,
    includeLunchBreak: true,
    minimizeTravelTime: true,
    prioritizeHighValue: false
  });

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState(null);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    
    // Simulate optimization process
    setTimeout(() => {
      const optimized = {
        originalTravelTime: 180,
        optimizedTravelTime: 135,
        timeSaved: 45,
        fuelSaved: 12,
        route: visits?.map((visit, index) => ({
          ...visit,
          order: index + 1,
          estimatedArrival: `${9 + Math.floor(index * 1.5)}:${(index * 30) % 60 < 10 ? '0' : ''}${(index * 30) % 60}`,
          travelTimeToNext: index < visits?.length - 1 ? Math.floor(Math.random() * 30) + 15 : 0
        }))
      };
      setOptimizedRoute(optimized);
      setIsOptimizing(false);
      onOptimize(optimized);
    }, 2000);
  };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-card border border-border rounded-lg shadow-elevation max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Route Optimization</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Optimize visits for {selectedDay?.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <Icon name="X" size={20} />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Optimization Settings */}
          <div className="p-6 border-b border-border">
            <h4 className="font-medium text-foreground mb-4">Optimization Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Checkbox
                label="Consider real-time traffic"
                description="Use current traffic conditions"
                checked={optimizationSettings?.considerTraffic}
                onChange={(e) => setOptimizationSettings(prev => ({
                  ...prev,
                  considerTraffic: e?.target?.checked
                }))}
              />
              <Checkbox
                label="Respect customer time windows"
                description="Honor preferred visit times"
                checked={optimizationSettings?.respectTimeWindows}
                onChange={(e) => setOptimizationSettings(prev => ({
                  ...prev,
                  respectTimeWindows: e?.target?.checked
                }))}
              />
              <Checkbox
                label="Include lunch break"
                description="Schedule 1-hour lunch break"
                checked={optimizationSettings?.includeLunchBreak}
                onChange={(e) => setOptimizationSettings(prev => ({
                  ...prev,
                  includeLunchBreak: e?.target?.checked
                }))}
              />
              <Checkbox
                label="Minimize travel time"
                description="Prioritize shortest routes"
                checked={optimizationSettings?.minimizeTravelTime}
                onChange={(e) => setOptimizationSettings(prev => ({
                  ...prev,
                  minimizeTravelTime: e?.target?.checked
                }))}
              />
            </div>
          </div>

          {/* Current Route */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-foreground">
                {optimizedRoute ? 'Optimized Route' : 'Current Route'}
              </h4>
              {!optimizedRoute && (
                <Button
                  variant="default"
                  onClick={handleOptimize}
                  loading={isOptimizing}
                  iconName="Route"
                  iconPosition="left"
                >
                  {isOptimizing ? 'Optimizing...' : 'Optimize Route'}
                </Button>
              )}
            </div>

            {/* Route Statistics */}
            {optimizedRoute && (
              <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-success/10 border border-success/20 rounded-lg">
                <div className="text-center">
                  <div className="text-lg font-semibold text-success">
                    {formatTime(optimizedRoute?.timeSaved)}
                  </div>
                  <div className="text-xs text-muted-foreground">Time Saved</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-success">
                    {optimizedRoute?.fuelSaved}%
                  </div>
                  <div className="text-xs text-muted-foreground">Fuel Saved</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-success">
                    {formatTime(optimizedRoute?.optimizedTravelTime)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total Travel</div>
                </div>
              </div>
            )}

            {/* Visit List */}
            <div className="space-y-3">
              {(optimizedRoute?.route || visits)?.map((visit, index) => (
                <div key={visit?.id} className="flex items-center space-x-4 p-3 border border-border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{visit?.customerName}</div>
                    <div className="text-sm text-muted-foreground">{visit?.company}</div>
                    {optimizedRoute && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Estimated arrival: {visit?.estimatedArrival}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 text-right">
                    {visit?.travelTimeToNext > 0 && (
                      <div className="text-sm text-muted-foreground">
                        {formatTime(visit?.travelTimeToNext)} to next
                      </div>
                    )}
                    <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                      <Icon name="MapPin" size={12} />
                      <span>{visit?.location}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {optimizedRoute && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => onExportToMaps('google')}
                    iconName="Navigation"
                    iconPosition="left"
                  >
                    Google Maps
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onExportToMaps('apple')}
                    iconName="Navigation"
                    iconPosition="left"
                  >
                    Apple Maps
                  </Button>
                </>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              {optimizedRoute && (
                <Button variant="default" onClick={onClose}>
                  Apply Route
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteOptimizationPanel;