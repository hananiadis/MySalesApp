# User-Customer Linking System

This document explains how to use the new user-customer linking system that allows users to be connected to customers through the "merch" field in the Firestore database.

## Overview

The system allows administrators to link users with salesmen (merch) so that users can view only the customers assigned to their linked salesmen. This provides a way to control customer access based on sales territories or assignments.

## How It Works

1. **Salesmen Collection**: The `salesmen` collection contains salesman records with their names and associated brands
2. **User Linking**: Users can be linked to multiple salesmen through the `merchIds` field in their user profile
3. **Customer Filtering**: Customers are filtered based on their `merch` field matching the user's linked salesmen
4. **Access Control**: Users can only view customers that belong to their linked salesmen

## Database Structure

### Users Collection
```javascript
{
  uid: "user123",
  firstName: "John",
  lastName: "Doe",
  email: "john@example.com",
  role: "salesman",
  brands: ["playmobil", "kivos"],
  merchIds: ["playmobil_JOHN_SMITH", "kivos_JANE_DOE"], // Linked salesman IDs
  // ... other fields
}
```

### Salesmen Collection
```javascript
{
  id: "playmobil_JOHN_SMITH",
  name: "John Smith",
  brand: "playmobil",
  normalized: "JOHN SMITH",
  updatedAt: timestamp
}
```

### Customers Collection
```javascript
{
  id: "customer123",
  name: "ABC Company",
  email: "contact@abc.com",
  brand: "playmobil",
  merch: "John Smith", // This links to the salesman
  // ... other fields
}
```

## Implementation

### 1. UserManagementScreen Updates

The `UserManagementScreen` has been updated to include:
- A new "Σύνδεση με Πελάτες (Merch)" section
- Search functionality for salesmen
- Multi-select capability for linking users to salesmen
- Visual display of linked salesmen in the user list

### 2. Customer Filtering Utilities

New utility functions in `src/utils/customerFiltering.js`:

```javascript
import { filterCustomersBySalesman } from '../utils/customerFiltering';

// Filter customers based on user's linked salesmen
const filteredCustomers = filterCustomersBySalesman(
  allCustomers, 
  userMerchIds, 
  selectedBrand
);
```

### 3. Example Implementation

See `src/screens/MyCustomersScreen.js` for a complete example of how to:
- Load customers
- Filter based on user's linked salesmen
- Display filtered results
- Handle search and brand filtering

## Usage Examples

### Basic Customer Filtering

```javascript
import { filterCustomersBySalesman } from '../utils/customerFiltering';
import { useAuth } from '../context/AuthProvider';

function CustomerList() {
  const { profile } = useAuth();
  const userMerchIds = profile?.merchIds || [];
  
  // Filter customers based on user's linked salesmen
  const filteredCustomers = filterCustomersBySalesman(
    allCustomers, 
    userMerchIds
  );
  
  return (
    <FlatList
      data={filteredCustomers}
      renderItem={({ item }) => <CustomerCard customer={item} />}
    />
  );
}
```

### Brand-Specific Filtering

```javascript
// Filter customers for a specific brand
const playmobilCustomers = filterCustomersBySalesman(
  allCustomers, 
  userMerchIds, 
  'playmobil'
);
```

### Access Control Check

```javascript
import { canUserViewCustomer } from '../utils/customerFiltering';

function CustomerDetail({ customer }) {
  const { profile } = useAuth();
  const userMerchIds = profile?.merchIds || [];
  const userBrands = profile?.brands || [];
  
  const canView = canUserViewCustomer(customer, userMerchIds, userBrands);
  
  if (!canView) {
    return <AccessDenied />;
  }
  
  return <CustomerDetails customer={customer} />;
}
```

## Setup Instructions

### 1. Update Existing Screens

To add customer filtering to existing screens:

```javascript
import { filterCustomersBySalesman } from '../utils/customerFiltering';
import { useAuth } from '../context/AuthProvider';

function ExistingCustomerScreen() {
  const { profile } = useAuth();
  const userMerchIds = profile?.merchIds || [];
  
  // Replace existing customer filtering with:
  const filteredCustomers = filterCustomersBySalesman(
    allCustomers, 
    userMerchIds, 
    selectedBrand
  );
  
  // Rest of your component...
}
```

### 2. Add to Navigation

Add the new `MyCustomersScreen` to your navigation:

```javascript
// In your navigation stack
<Stack.Screen 
  name="MyCustomers" 
  component={MyCustomersScreen} 
  options={{ title: 'Οι Πελάτες Μου' }}
/>
```

### 3. Update User Roles

Ensure users have appropriate roles to view customers:

```javascript
// In AuthProvider.js
const PERMISSIONS_BY_ROLE = {
  [ROLES.SALESMAN]: ['products.view', 'customers.view.mine', 'orders.view.mine'],
  // ... other roles
};
```

## Security Considerations

1. **Server-Side Validation**: Always validate user permissions on the server side
2. **Firestore Rules**: Update Firestore security rules to enforce customer access control
3. **Role-Based Access**: Ensure only appropriate roles can view customer data
4. **Data Privacy**: Consider data privacy implications when linking users to customers

## Troubleshooting

### Common Issues

1. **No Customers Showing**: Check if user has `merchIds` linked
2. **Wrong Customers**: Verify salesman names match between collections
3. **Performance Issues**: Consider pagination for large customer lists

### Debug Tips

```javascript
// Debug customer filtering
console.log('User merchIds:', userMerchIds);
console.log('All customers:', allCustomers.length);
console.log('Filtered customers:', filteredCustomers.length);

// Check salesman matching
const customer = allCustomers[0];
const candidates = extractSalesmanCandidates(customer);
console.log('Customer salesman candidates:', candidates);
```

## Future Enhancements

1. **Bulk Assignment**: Allow bulk assignment of customers to salesmen
2. **Territory Management**: Add territory-based customer assignment
3. **Performance Optimization**: Add caching for customer filtering
4. **Analytics**: Track customer access patterns
5. **Mobile Sync**: Ensure offline customer access works correctly

## Related Files

- `src/screens/UserManagementScreen.js` - User management with salesman linking
- `src/screens/MyCustomersScreen.js` - Example customer filtering implementation
- `src/utils/customerFiltering.js` - Customer filtering utilities
- `src/utils/salesmen.js` - Existing salesman utilities
- `src/context/AuthProvider.js` - Authentication context with merchIds support
