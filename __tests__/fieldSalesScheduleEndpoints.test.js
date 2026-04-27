const fs = require('fs');
const path = require('path');

describe('FieldSales schedule endpoints', () => {
  const functionsSourcePath = path.join(__dirname, '..', 'functions', 'index.js');
  const source = fs.readFileSync(functionsSourcePath, 'utf8');

  it('defines schedule read and write endpoints', () => {
    expect(source).toContain("app.get('/schedules', authenticateRequest, async (req, res) => {");
    expect(source).toContain("app.post('/schedules', authenticateRequest, async (req, res) => {");
    expect(source).toContain("app.post('/schedules/:id/status', authenticateRequest, async (req, res) => {");
  });

  it('includes dedicated error codes for schedule flows', () => {
    expect(source).toContain('schedules/load-failed');
    expect(source).toContain('schedules/save-failed');
    expect(source).toContain('schedules/update-status-failed');
  });
});
