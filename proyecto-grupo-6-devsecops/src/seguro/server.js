const crypto = require('node:crypto');
const express = require('express');
const rateLimit = require('express-rate-limit').rateLimit;
const helmet = require('helmet');

const app = express();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';

const demoTokens = {
  HR: 'demo-hr-token-change-me-0123456789',
  PAYROLL: 'demo-payroll-token-change-me-0123456789'
};

const configuredTokens = {
  HR: process.env.HR_API_TOKEN || (isProduction ? '' : demoTokens.HR),
  PAYROLL: process.env.PAYROLL_API_TOKEN || (isProduction ? '' : demoTokens.PAYROLL)
};

if (Object.values(configuredTokens).some((token) => token.length < 32)) {
  throw new Error('Configure distinct API tokens of at least 32 characters before production startup.');
}

if (configuredTokens.HR === configuredTokens.PAYROLL) {
  throw new Error('HR_API_TOKEN and PAYROLL_API_TOKEN must be different.');
}

const tokenRoles = new Map([
  [configuredTokens.HR, 'HR'],
  [configuredTokens.PAYROLL, 'PAYROLL']
]);

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb', strict: true }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));

const employees = [
  {
    id: 'EMP-1001',
    firstName: 'Ada',
    lastName: 'Lovelace',
    department: 'Engineering',
    title: 'Platform Engineer',
    status: 'active',
    nationalId: 'SYNTHETIC-0001',
    bankAccount: 'SYNTHETIC-ACCOUNT-0001',
    salary: 92000
  },
  {
    id: 'EMP-1002',
    firstName: 'Grace',
    lastName: 'Hopper',
    department: 'Finance',
    title: 'Payroll Analyst',
    status: 'active',
    nationalId: 'SYNTHETIC-0002',
    bankAccount: 'SYNTHETIC-ACCOUNT-0002',
    salary: 88000
  }
];

const payroll = [
  { employeeId: 'EMP-1001', period: '2026-09', gross: 7666.67, tax: 1533.33, net: 6133.34 },
  { employeeId: 'EMP-1002', period: '2026-09', gross: 7333.33, tax: 1466.67, net: 5866.66 }
];

function authenticate(request, response, next) {
  const match = /^Bearer ([^\s]+)$/.exec(request.get('authorization') || '');
  if (!match) return response.status(401).json({ error: 'Authentication required' });

  const supplied = Buffer.from(match[1]);
  const role = [...tokenRoles.entries()].find(([knownToken]) => {
    const expected = Buffer.from(knownToken);
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  })?.[1];

  if (!role) return response.status(401).json({ error: 'Authentication required' });
  request.auth = { role };
  return next();
}

function requireRole(role) {
  return (request, response, next) => {
    if (request.auth?.role !== role) {
      return response.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

function validEmployeeId(value) {
  return /^EMP-\d{4}$/.test(value);
}

function publicEmployee(employee) {
  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    department: employee.department,
    title: employee.title,
    status: employee.status
  };
}

function getEmployee(id) {
  if (!validEmployeeId(id)) return { invalid: true };
  return { employee: employees.find((item) => item.id === id) };
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'TalentCorp API' });
});

app.get('/api/employees', authenticate, requireRole('HR'), (_request, response) => {
  response.json({ data: employees.map(publicEmployee) });
});

app.get('/api/employees/:id', authenticate, requireRole('HR'), (request, response) => {
  const result = getEmployee(request.params.id);
  if (result.invalid) return response.status(400).json({ error: 'Invalid employee ID' });
  if (!result.employee) return response.status(404).json({ error: 'Employee not found' });
  return response.json({ data: publicEmployee(result.employee) });
});

app.patch('/api/employees/:id', authenticate, requireRole('HR'), (request, response) => {
  const result = getEmployee(request.params.id);
  if (result.invalid) return response.status(400).json({ error: 'Invalid employee ID' });
  if (!result.employee) return response.status(404).json({ error: 'Employee not found' });

  const fields = Object.keys(request.body || {});
  const allowedFields = new Set(['department', 'title']);
  const validText = (value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 80;
  if (fields.length === 0 || fields.some((field) => !allowedFields.has(field)) ||
      fields.some((field) => !validText(request.body[field]))) {
    return response.status(400).json({ error: 'Invalid update fields' });
  }

  for (const field of fields) result.employee[field] = request.body[field].trim();
  return response.json({ data: publicEmployee(result.employee) });
});

app.get('/api/payroll', authenticate, requireRole('PAYROLL'), (request, response) => {
  const employeeId = request.query.employeeId;
  if (employeeId !== undefined && (typeof employeeId !== 'string' || !validEmployeeId(employeeId))) {
    return response.status(400).json({ error: 'Invalid employee ID' });
  }

  const records = employeeId
    ? payroll.filter((record) => record.employeeId === employeeId)
    : payroll;
  return response.json({ data: records });
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return response.status(400).json({ error: 'Invalid JSON body' });
  }
  if (error.status === 413) return response.status(413).json({ error: 'Request body too large' });
  return response.status(500).json({ error: 'Internal server error' });
});

app.listen(port, host, () => {
  console.log(`TalentCorp API listening on http://${host}:${port}`);
});