// src/utils/customerFiltering.js
import { normalizeSalesmanKey, extractSalesmanCandidates } from './salesmen';

/**
 * Filters customers based on user's linked salesmen (merchIds)
 * @param {Array} customers - Array of customer objects
 * @param {Array} userMerchIds - Array of salesman IDs linked to the user
 * @param {string} brand - Brand to filter by (optional)
 * @returns {Array} Filtered customers
 */
export function filterCustomersBySalesman(customers, userMerchIds, brand = null) {
  if (!userMerchIds || userMerchIds.length === 0) {
    console.log('🔍 filterCustomersBySalesman: No userMerchIds provided');
    return [];
  }

  // Extract salesman names from merchIds (document IDs like "playmobil_ΑΝΑΝΙΑΔΗΣ ΒΑΣΙΛΗΣ")
  const salesmanNames = userMerchIds.map(merchId => {
    if (typeof merchId === 'string' && merchId.includes('_')) {
      // Extract name from document ID format: "brand_NAME"
      return merchId.split('_').slice(1).join('_');
    }
    return merchId; // Fallback for direct names
  }).filter(Boolean);

  console.log('🔍 filterCustomersBySalesman:', {
    userMerchIds,
    salesmanNames,
    brand,
    totalCustomers: customers.length
  });

  const filtered = customers.filter(customer => {
    // If brand is specified, check if customer belongs to that brand
    if (brand && customer.brand !== brand) {
      return false;
    }

    const customerMerch = customer.merch;
    if (!customerMerch) {
      return false;
    }

    // Handle both string and array merch values
    const merchValues = Array.isArray(customerMerch) ? customerMerch : [customerMerch];
    
    // Check if any of the customer's merch values match the user's linked salesmen
    const matches = merchValues.some(merchValue => {
      if (typeof merchValue === 'string') {
        const normalizedMerchValue = merchValue.toLowerCase().trim();
        return salesmanNames.some(salesmanName => 
          salesmanName.toLowerCase().trim() === normalizedMerchValue
        );
      }
      return false;
    });

    if (matches) {
      console.log(`✅ Customer match: ${customer.name} (merch: ${customerMerch})`);
    }

    return matches;
  });

  console.log(`🔍 filterCustomersBySalesman result: ${filtered.length}/${customers.length} customers match`);
  return filtered;
}

/**
 * Gets customers that belong to a specific salesman
 * @param {Array} customers - Array of customer objects
 * @param {string} salesmanName - Name of the salesman
 * @param {string} brand - Brand to filter by (optional)
 * @returns {Array} Customers belonging to the salesman
 */
export function getCustomersBySalesmanName(customers, salesmanName, brand = null) {
  if (!salesmanName) {
    return [];
  }

  return customers.filter(customer => {
    // If brand is specified, check if customer belongs to that brand
    if (brand && customer.brand !== brand) {
      return false;
    }

    const customerMerch = customer.merch;
    if (!customerMerch) {
      return false;
    }

    // Handle both string and array merch values
    const merchValues = Array.isArray(customerMerch) ? customerMerch : [customerMerch];
    
    // Check if any of the customer's merch values match the salesman name
    return merchValues.some(merchValue => {
      if (typeof merchValue === 'string') {
        return merchValue.toLowerCase().trim() === salesmanName.toLowerCase().trim();
      }
      return false;
    });
  });
}

/**
 * Gets unique salesman names from customers
 * @param {Array} customers - Array of customer objects
 * @param {string} brand - Brand to filter by (optional)
 * @returns {Array} Array of unique salesman names
 */
export function getUniqueSalesmenFromCustomers(customers, brand = null) {
  const salesmen = new Set();
  
  customers.forEach(customer => {
    // If brand is specified, check if customer belongs to that brand
    if (brand && customer.brand !== brand) {
      return;
    }

    const customerMerch = customer.merch;
    if (!customerMerch) {
      return;
    }

    // Handle both string and array merch values
    const merchValues = Array.isArray(customerMerch) ? customerMerch : [customerMerch];
    
    merchValues.forEach(merchValue => {
      if (typeof merchValue === 'string' && merchValue.trim()) {
        salesmen.add(merchValue.trim());
      }
    });
  });

  return Array.from(salesmen).sort();
}

/**
 * Checks if a user has access to view a specific customer
 * @param {Object} customer - Customer object
 * @param {Array} userMerchIds - Array of salesman IDs linked to the user
 * @param {Array} userBrands - Array of brands the user has access to
 * @returns {boolean} True if user can view the customer
 */
export function canUserViewCustomer(customer, userMerchIds, userBrands) {
  // Check brand access first
  if (userBrands && userBrands.length > 0 && !userBrands.includes(customer.brand)) {
    return false;
  }

  // If no merchIds linked, user can't view any customers
  if (!userMerchIds || userMerchIds.length === 0) {
    return false;
  }

  // Extract salesman names from merchIds (document IDs like "playmobil_ΑΝΑΝΙΑΔΗΣ ΒΑΣΙΛΗΣ")
  const salesmanNames = userMerchIds.map(merchId => {
    if (typeof merchId === 'string' && merchId.includes('_')) {
      // Extract name from document ID format: "brand_NAME"
      return merchId.split('_').slice(1).join('_');
    }
    return merchId; // Fallback for direct names
  }).filter(Boolean);

  const customerMerch = customer.merch;
  if (!customerMerch) {
    return false;
  }

  // Handle both string and array merch values
  const merchValues = Array.isArray(customerMerch) ? customerMerch : [customerMerch];
  
  // Check if any of the customer's merch values match the user's linked salesmen
  return merchValues.some(merchValue => {
    if (typeof merchValue === 'string') {
      const normalizedMerchValue = merchValue.toLowerCase().trim();
      return salesmanNames.some(salesmanName => 
        salesmanName.toLowerCase().trim() === normalizedMerchValue
      );
    }
    return false;
  });
}
