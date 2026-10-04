const express = require('express');
const multer = require('multer');
const path = require('node:path');
const initSqlJs = require('sql.js');

const app = express();
const host = '127.0.0.1';
const port = Number(process.env.PORT || 3000);
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'demo-ui')));

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
    accessLevel: 'employee',
    password: 'demo-initial-password-1001'
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
    accessLevel: 'employee',
    password: 'demo-initial-password-1002'
  }
];

const payroll = [
  { employeeId: 'EMP-1001', period: '2026-09', gross: 7666.67, tax: 1533.33, net: 6133.34 },
  { employeeId: 'EMP-1002', period: '2026-09', gross: 7333.33, tax: 1466.67, net: 5866.66 }
];

const payslips = [
  { id: 'EMP-1001', period: '2026-09', gross: 7666.67, tax: 1533.33, net: 6133.34, bankAccount: 'SYNTHETIC-ACCOUNT-0001' },
  { id: 'EMP-1002', period: '2026-09', gross: 7333.33, tax: 1466.67, net: 5866.66, bankAccount: 'SYNTHETIC-ACCOUNT-0002' }
];

let attendanceDb;

function rowsFromStatement(statement) {
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

async function initializeDatabase() {
  const SQL = await initSqlJs();
  attendanceDb = new SQL.Database();
  attendanceDb.run('CREATE TABLE attendance (employee_id TEXT, work_date TEXT, status TEXT)');
  attendanceDb.run("INSERT INTO attendance VALUES ('EMP-1001', '2026-09-30', 'present'), ('EMP-1002', '2026-09-30', 'remote')");
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'TalentCorp API - vulnerable demo' });
});

app.get('/api/demo/components', (_request, response) => {
  response.json({ pdfkit: require('./package.json').dependencies.pdfkit });
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

app.get('/api/payslip/:id', (request, response) => {
  const payslip = payslips.find((item) => item.id === request.params.id);
  if (!payslip) return response.status(404).json({ error: 'Payslip not found' });
  return response.json({ data: payslip });
});

app.post('/api/employees', (request, response) => {
  const { id, firstName, lastName } = request.body;
  const employee = {
    id: id || `EMP-${String(1000 + employees.length + 1).padStart(4, '0')}`,
    firstName: firstName || 'Demo',
    lastName: lastName || 'Employee',
    department: 'Unassigned',
    title: 'New employee',
    status: 'pending',
    password: 'Welcome123!'
  };
  employees.push(employee);
  response.status(201).json({
    data: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName },
    initialPassword: employee.password
  });
});

app.get('/api/attendance', (request, response) => {
  const date = String(request.query.date || '');
  const statement = attendanceDb.prepare(`SELECT employee_id, work_date, status FROM attendance WHERE work_date = '${date}'`);
  return response.json({ data: rowsFromStatement(statement) });
});

app.post('/api/vacations/approve', (request, response) => {
  const { solicitante_id: requesterId, aprobador_id: approverId } = request.body || {};
  return response.json({ status: 'approved', solicitante_id: requesterId, aprobador_id: approverId });
});

app.get('/api/demo/error', (_request, _response, next) => {
  next(new Error(`Demonstration failure at ${__filename}`));
});

app.post('/api/login', (request, response) => {
  if (request.body?.username === 'ada' && request.body?.password === 'demo-initial-password-1001') {
    return response.json({ status: 'authenticated', token: 'vulnerable-demo-session' });
  }
  return response.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/cv/upload', upload.single('file'), (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'File is required' });
  return response.status(201).json({
    filename: request.file.originalname,
    mimetype: request.file.mimetype,
    size: request.file.size,
    accepted: true
  });
});

app.put('/api/salary/:id', (request, response) => {
  const employee = employees.find((item) => item.id === request.params.id);
  if (!employee) return response.status(404).json({ error: 'Employee not found' });
  employee.salary = request.body?.salary;
  return response.json({ data: { id: employee.id, salary: employee.salary } });
});

app.post('/api/export', async (request, response, next) => {
  try {
    const target = new URL(request.body?.url);
    if (!['http:', 'https:'].includes(target.protocol)) {
      return response.status(400).json({ error: 'Only HTTP and HTTPS URLs are supported' });
    }
    const remote = await fetch(target, { signal: AbortSignal.timeout(3000), redirect: 'manual' });
    const reader = remote.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 32768) {
          await reader.cancel();
          return response.status(502).json({ error: 'Remote response exceeded the demo limit' });
        }
        chunks.push(value);
      }
    }
    const body = Buffer.concat(chunks).toString('utf8');
    return response.json({ requestedUrl: target.href, upstreamStatus: remote.status, body });
  } catch (error) {
    return next(error);
  }
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return response.status(400).type('text').send(error.stack);
  }
  if (error.status === 413) return response.status(413).type('text').send(error.stack);
  if (response.headersSent) return;
  return response.status(500).type('text').send(error.stack || String(error));
});

initializeDatabase().then(() => {
  app.listen(port, host, () => {
    console.log(`Vulnerable demo listening on http://${host}:${port}`);
  });
}).catch((error) => {
  console.error('Unable to initialize vulnerable demo database:', error);
  process.exitCode = 1;
});
