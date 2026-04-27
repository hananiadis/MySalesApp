import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';

const TerritoryDetails = ({ 
  territory, 
  salesmen, 
  onUpdate, 
  onClose,
  className = '' 
}) => {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: territory?.name || '',
    assignedSalesman: territory?.assignedSalesman || '',
    visitLimit: territory?.visitLimit || 20,
    priority: territory?.priority || 'medium'
  });

  const priorityOptions = [
    { value: 'high', label: 'Υψηλή Προτεραιότητα' },
    { value: 'medium', label: 'Μεσαία Προτεραιότητα' },
    { value: 'low', label: 'Χαμηλή Προτεραιότητα' }
  ];

  const salesmanOptions = salesmen?.map(s => ({
    value: s?.id,
    label: `${s?.name} (${s?.assignedTerritories}/${s?.maxTerritories})`
  }));

  const handleSave = () => {
    onUpdate(territory?.id, formData);
    setEditMode(false);
  };

  const handleCancel = () => {
    setFormData({
      name: territory?.name || '',
      assignedSalesman: territory?.assignedSalesman || '',
      visitLimit: territory?.visitLimit || 20,
      priority: territory?.priority || 'medium'
    });
    setEditMode(false);
  };

  if (!territory) {
    return (
      <div className={`bg-card border border-border rounded-lg p-6 ${className}`}>
        <div className="text-center text-muted-foreground">
          <Icon name="Map" size={48} className="mx-auto mb-3 opacity-50" />
          <p>Επιλέξτε περιοχή για να δείτε λεπτομέρειες</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Λεπτομέρειες Περιοχής</h3>
          <div className="flex items-center space-x-2">
            {editMode ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Ακύρωση
                </Button>
                <Button variant="default" size="sm" onClick={handleSave}>
                  Αποθήκευση
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                  <Icon name="Edit" size={16} />
                  Επεξεργασία
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <Icon name="X" size={16} />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">Βασικές Πληροφορίες</h4>
          
          {editMode ? (
            <div className="space-y-3">
              <Input
                label="Όνομα Περιοχής"
                value={formData?.name}
                onChange={(e) => setFormData({ ...formData, name: e?.target?.value })}
              />
              
              <Select
                label="Ανατεθειμένος Πωλητής"
                options={[{ value: '', label: 'Χωρίς Ανάθεση' }, ...salesmanOptions]}
                value={formData?.assignedSalesman}
                onChange={(value) => setFormData({ ...formData, assignedSalesman: value })}
              />
              
              <Input
                label="Όριο Επισκέψεων ανά Εβδομάδα"
                type="number"
                value={formData?.visitLimit}
                onChange={(e) => setFormData({ ...formData, visitLimit: parseInt(e?.target?.value) })}
                min="1"
                max="50"
              />
              
              <Select
                label="Επίπεδο Προτεραιότητας"
                options={priorityOptions}
                value={formData?.priority}
                onChange={(value) => setFormData({ ...formData, priority: value })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Όνομα Περιοχής</div>
                <div className="text-sm font-medium text-foreground">{territory?.name}</div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground mb-1">Ανατεθειμένος Πωλητής</div>
                <div className="text-sm font-medium text-foreground">
                  {territory?.assignedSalesman 
                    ? salesmen?.find(s => s?.id === territory?.assignedSalesman)?.name || 'Άγνωστος' :'Χωρίς Ανάθεση'
                  }
                </div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground mb-1">Όριο Επισκέψεων</div>
                <div className="text-sm font-medium text-foreground">{territory?.visitLimit} ανά εβδομάδα</div>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground mb-1">Προτεραιότητα</div>
                <div className={`text-sm font-medium capitalize ${
                  territory?.priority === 'high' ? 'text-error' :
                  territory?.priority === 'medium' ? 'text-warning' : 'text-success'
                }`}>
                  {territory?.priority === 'high' ? 'Υψηλή' : territory?.priority === 'medium' ? 'Μεσαία' : territory?.priority === 'low' ? 'Χαμηλή' : territory?.priority}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coverage Statistics */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">Στατιστικά Κάλυψης</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Icon name="MapPin" size={16} className="text-primary" />
                <span className="text-xs text-muted-foreground">Ταχ. Κώδικες</span>
              </div>
              <div className="text-lg font-semibold text-foreground">{territory?.postcodes?.length}</div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Icon name="Users" size={16} className="text-accent" />
                <span className="text-xs text-muted-foreground">Πελάτες</span>
              </div>
              <div className="text-lg font-semibold text-foreground">{territory?.customerCount}</div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Icon name="Route" size={16} className="text-warning" />
                <span className="text-xs text-muted-foreground">Μέση Απόσταση</span>
              </div>
              <div className="text-lg font-semibold text-foreground">{territory?.avgDistance} km</div>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center space-x-2 mb-2">
                <Icon name="Clock" size={16} className="text-secondary" />
                <span className="text-xs text-muted-foreground">Εκτιμ. Χρόνος</span>
              </div>
              <div className="text-lg font-semibold text-foreground">{territory?.estimatedTime}h</div>
            </div>
          </div>
        </div>

        {/* Postcodes List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Ταχ. Κώδικες ({territory?.postcodes?.length})</h4>
            <Button variant="outline" size="sm">
              <Icon name="Plus" size={16} />
              Προσθήκη Ταχ. Κώδικα
            </Button>
          </div>
          
          <div className="max-h-32 overflow-y-auto">
            <div className="grid grid-cols-3 gap-2">
              {territory?.postcodes?.map((postcode, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-sm"
                >
                  <span className="text-foreground font-medium">{postcode}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Icon name="X" size={12} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Conflicts & Issues */}
        {territory?.conflicts && territory?.conflicts?.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground flex items-center space-x-2">
              <Icon name="AlertTriangle" size={16} className="text-error" />
              <span>Συγκρούσεις & Ζητήματα</span>
            </h4>
            
            <div className="space-y-2">
              {territory?.conflicts?.map((conflict, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-error/10 border border-error/20 rounded-md">
                  <Icon name="AlertCircle" size={16} className="text-error flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">{conflict?.type}</div>
                    <div className="text-xs text-muted-foreground mt-1">{conflict?.description}</div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Icon name="ExternalLink" size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Footer Actions */}
      <div className="p-4 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground">
            <Icon name="Clock" size={14} />
            <span>Τελευταία ενημέρωση: {new Date()?.toLocaleDateString('el-GR')}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Icon name="Copy" size={16} />
              Αντιγραφή
            </Button>
            <Button variant="destructive" size="sm">
              <Icon name="Trash2" size={16} />
              Διαγραφή
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerritoryDetails;