const express = require('express');

const app = express();
const host = '127.0.0.1';
const port = Number(process.env.PORT || 3000);

app.use(express.json());

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
    salary: 92000,
    accessLevel: 'employee'
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
    salary: 88000,
    accessLevel: 'employee'
  }
];

const payroll = [
  { employeeId: 'EMP-1001', period: '2026-09', gross: 7666.67, tax: 1533.33, net: 6133.34 },
  { employeeId: 'EMP-1002', period: '2026-09', gross: 7333.33, tax: 1466.67, net: 5866.66 }
];

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'TalentCorp API - vulnerable demo' });
});

app.get('/api/employees', (_request, response) => {
  response.json({ data: employees });
});

app.get('/api/employees/:id', (request, response) => {
  const employee = employees.find((item) => item.id === request.params.id);
  if (!employee) return response.status(404).json({ error: 'Employee not found' });
  return response.json({ data: employee });
});

app.patch('/api/employees/:id', (request, response) => {
  const employee = employees.find((item) => item.id === request.params.id);
  if (!employee) return response.status(404).json({ error: 'Employee not found' });
  Object.assign(employee, request.body);
  return response.json({ data: employee });
});

app.get('/api/payroll', (request, response) => {
  const records = request.query.employeeId
    ? payroll.filter((record) => record.employeeId === request.query.employeeId)
    : payroll;
  response.json({ data: records });
});

app.listen(port, host, () => {
  console.log(`Vulnerable demo listening on http://${host}:${port}`);
});