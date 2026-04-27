const fs = require('fs');
const path = require('path');

describe('FieldSales visit execution endpoints', () => {
  const functionsSourcePath = path.join(__dirname, '..', 'functions', 'index.js');
  const source = fs.readFileSync(functionsSourcePath, 'utf8');

  it('defines visit execution read/write endpoints', () => {
    expect(source).toContain("app.get('/visit-executions', authenticateRequest, async (req, res) => {");
    expect(source).toContain("app.post('/visit-executions', authenticateRequest, async (req, res) => {");
    expect(source).toContain("app.patch('/visit-executions/:id', authenticateRequest, async (req, res) => {");
  });

  it('includes dedicated error codes for visit execution flows', () => {
    expect(source).toContain('visit-executions/load-failed');
    expect(source).toContain('visit-executions/create-failed');
    expect(source).toContain('visit-executions/update-failed');
  });
});
