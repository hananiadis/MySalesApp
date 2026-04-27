const fs = require('fs');
const path = require('path');

describe('customer Firestore write rules', () => {
  const readRules = (relativePath) =>
    fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

  const expectSignedInCustomerWrites = (rulesText, collectionName, expectedDeleteGuard) => {
    const startMarker = `match /${collectionName}/{docId} {`;
    const startIndex = rulesText.indexOf(startMarker);

    expect(startIndex).toBeGreaterThanOrEqual(0);

    const block = rulesText.slice(startIndex, startIndex + 400);

    expect(block).toContain('allow read: if isSignedIn()');
    expect(block).toContain('allow create, update: if isSignedIn();');
    expect(block).toContain(expectedDeleteGuard);
  };

  it('allows signed-in users to create and update customers in every brand collection', () => {
    const appRules = readRules('firebase/firestore.rules');
    const webRules = readRules('warehouse-web/firestore.rules');

    [appRules, webRules].forEach((rulesText) => {
      expectSignedInCustomerWrites(rulesText, 'customers', "allow delete: if isAdmin();");
      expectSignedInCustomerWrites(rulesText, 'customers_john', "allow delete: if isAdminForBrand('john');");
      expectSignedInCustomerWrites(rulesText, 'customers_kivos', "allow delete: if isAdminForBrand('kivos') || isWarehouseManagerForBrand('kivos');");
    });
  });
});
