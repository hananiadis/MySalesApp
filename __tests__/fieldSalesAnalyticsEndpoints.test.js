const fs = require('fs');
const path = require('path');

describe('FieldSales analytics endpoint', () => {
  const functionsSourcePath = path.join(__dirname, '..', 'functions', 'index.js');
  const source = fs.readFileSync(functionsSourcePath, 'utf8');

  it('defines the analytics overview endpoint', () => {
    expect(source).toContain("app.get('/analytics/overview', authenticateRequest, async (req, res) => {");
  });

  it('includes analytics helpers and error code coverage', () => {
    expect(source).toContain('getDateRangeFromPreset');
    expect(source).toContain('normalizeOutcomeBucket');
    expect(source).toContain('analytics/load-failed');
  });
});
