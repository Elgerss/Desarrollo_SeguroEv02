const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const fs = require('node:fs/promises');
const https = require('node:https');
const net = require('node:net');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit').rateLimit;
const helmet = require('helmet');
const winston = require('winston');
const initSqlJs = require('sql.js');

const app = express();
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';
const uploadDirectory = path.join(__dirname, 'uploads');
const activationTokens = new Map();
const sessionTokens = new Map();
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

const payslips = [
  { id: 'EMP-1001', period: '2026-09', gross: 7666.67, tax: 1533.33, net: 6133.34, bankAccount: 'SYNTHETIC-ACCOUNT-0001' },
  { id: 'EMP-1002', period: '2026-09', gross: 7333.33, tax: 1466.67, net: 5866.66, bankAccount: 'SYNTHETIC-ACCOUNT-0002' }
];

const demoTokens = {
  HR: { token: 'demo-hr-token-change-me-0123456789', userId: 'HR-001' },
  PAYROLL: { token: 'demo-payroll-token-change-me-0123456789', userId: 'PAYROLL-001' },
  ADMIN: { token: 'demo-admin-token-change-me-0123456789', userId: 'ADMIN-001' },
  EMPLOYEE: { token: 'demo-employee-token-change-me-0123456789', userId: 'EMP-1001' }
};

const configuredTokens = Object.fromEntries(
  Object.entries(demoTokens).map(([role, demo]) => [
    role,
    process.env[`${role}_API_TOKEN`] || (isProduction ? '' : demo.token)
  ])
);

if (Object.values(configuredTokens).some((token) => token.length < 32)) {
  throw new Error('Configure distinct API tokens of at least 32 characters before production startup.');
}
if (new Set(Object.values(configuredTokens)).size !== Object.values(configuredTokens).length) {
  throw new Error('All API role tokens must be different.');
}

const tokenPrincipals = new Map(
  Object.entries(configuredTokens).map(([role, token]) => [
    token,
    { role, userId: demoTokens[role].userId }
  ])
);
const usersByName = new Map();
const activationLifetimeMs = 15 * 60 * 1000;
const allowedExportHosts = new Set(
  (process.env.EXPORT_ALLOWED_HOSTS || 'api.github.com')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1 }
});

app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '10kb', strict: true }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));
app.use(express.static(path.join(__dirname, '..', 'demo-ui')));

function authenticate(request, response, next) {
  const match = /^Bearer ([^\s]+)$/.exec(request.get('authorization') || '');
  if (!match) return response.status(401).json({ error: 'Authentication required' });

  const supplied = Buffer.from(match[1]);
  const principal = [...tokenPrincipals.entries()].find(([knownToken]) => {
    const expected = Buffer.from(knownToken);
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  })?.[1];

  const session = sessionTokens.get(match[1]);
  const authenticated = principal || (session && session.expiresAt > Date.now() ? session : null);
  if (!authenticated) {
    sessionTokens.delete(match[1]);
    return response.status(401).json({ error: 'Authentication required' });
  }
  request.auth = authenticated;
  return next();
}

function requireRole(...roles) {
  return (request, response, next) => {
    if (!roles.includes(request.auth?.role)) {
      return response.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}

function validEmployeeId(value) {
  return typeof value === 'string' && /^EMP-\d{4}$/.test(value);
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

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function rowsFromStatement(statement) {
  const rows = [];
  while (statement.step()) rows.push(statement.getAsObject());
  statement.free();
  return rows;
}

function isPrivateAddress(address) {
  const family = net.isIP(address);
  if (family === 4) {
    const octets = address.split('.').map(Number);
    const [first, second] = octets;
    return first === 0 || first === 10 || first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 0) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224;
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice(7);
      return net.isIP(mapped) === 4 && isPrivateAddress(mapped);
    }
    return normalized.startsWith('fc') || normalized.startsWith('fd') ||
      /^fe[89ab]/.test(normalized);
  }
  return true;
}

async function safeExport(target) {
  if (target.protocol !== 'https:' || target.username || target.password || target.port && target.port !== '443') {
    throw Object.assign(new Error('Only HTTPS on the default port is allowed'), { statusCode: 400 });
  }
  if (!allowedExportHosts.has(target.hostname.toLowerCase()) ||
      /^(localhost|metadata|metadata\.google\.internal|instance-data)$/i.test(target.hostname)) {
    throw Object.assign(new Error('Export host is not allowed'), { statusCode: 400 });
  }

  const addresses = await dns.lookup(target.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw Object.assign(new Error('Private and loopback addresses are not allowed'), { statusCode: 400 });
  }

  return new Promise((resolve, reject) => {
    const request = https.request({
      hostname: target.hostname,
      method: 'GET',
      path: `${target.pathname}${target.search}`,
      servername: target.hostname,
      timeout: 3000,
      headers: { Accept: 'application/json' },
      lookup: (_hostname, options, callback) => {
        if (options?.all) return callback(null, addresses);
        return callback(null, addresses[0].address, addresses[0].family);
      }
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 32768) {
          request.destroy(Object.assign(new Error('Remote response exceeded the demo limit'), { statusCode: 502 }));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({
        status: response.statusCode || 502,
        body: Buffer.concat(chunks).toString('utf8')
      }));
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('Export request timed out')));
    request.on('error', reject);
    request.end();
  });
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'TalentCorp API' });
});

if (!isProduction) {
  app.get('/api/demo/components', (_request, response) => {
    response.json({ pdfkit: require('./package.json').dependencies.pdfkit });
  });
}

app.get('/api/employees', authenticate, requireRole('HR', 'ADMIN'), (_request, response) => {
  response.json({ data: employees.map(publicEmployee) });
});

app.get('/api/employees/:id', authenticate, requireRole('HR', 'ADMIN'), (request, response) => {
  const result = getEmployee(request.params.id);
  if (result.invalid) return response.status(400).json({ error: 'Invalid employee ID' });
  if (!result.employee) return response.status(404).json({ error: 'Employee not found' });
  return response.json({ data: publicEmployee(result.employee) });
});

app.patch('/api/employees/:id', authenticate, requireRole('HR', 'ADMIN'), (request, response) => {
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
  if (employeeId !== undefined && !validEmployeeId(employeeId)) {
    return response.status(400).json({ error: 'Invalid employee ID' });
  }
  const records = employeeId
    ? payroll.filter((record) => record.employeeId === employeeId)
    : payroll;
  return response.json({ data: records });
});

app.get('/api/payslip/:id', authenticate, (request, response) => {
  const id = request.params.id;
  if (!validEmployeeId(id)) return response.status(400).json({ error: 'Invalid employee ID' });
  if (!['ADMIN', 'HR'].includes(request.auth.role) &&
      !(request.auth.role === 'EMPLOYEE' && request.auth.userId === id)) {
    return response.status(403).json({ error: 'Insufficient permissions' });
  }
  const payslip = payslips.find((item) => item.id === id);
  if (!payslip) return response.status(404).json({ error: 'Payslip not found' });
  return response.json({ data: payslip });
});

app.post('/api/employees', authenticate, requireRole('HR', 'ADMIN'), async (request, response, next) => {
  try {
    const { id, firstName, lastName } = request.body || {};
    if (!validEmployeeId(id) || employees.some((employee) => employee.id === id) ||
        ![firstName, lastName].every((value) => typeof value === 'string' && value.trim().length > 0 && value.length <= 80)) {
      return response.status(400).json({ error: 'Invalid employee details' });
    }

    const initialPassword = crypto.randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(initialPassword, 12);
    const activationToken = crypto.randomBytes(24).toString('base64url');
    const activationTokenHash = crypto.createHash('sha256').update(activationToken).digest('hex');
    activationTokens.set(id, { hash: activationTokenHash, expiresAt: Date.now() + activationLifetimeMs });
    employees.push({
      id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      department: 'Unassigned',
      title: 'New employee',
      status: 'pending',
      passwordHash,
      activationTokenHash
    });
    return response.status(201).json({
      data: { id, firstName: firstName.trim(), lastName: lastName.trim(), credential: 'bcrypt' },
      activationTokenIssued: true,
      activationExpiresInSeconds: activationLifetimeMs / 1000
    });
  } catch (error) {
    return next(error);
  }
});

app.get('/api/attendance', authenticate, requireRole('HR', 'ADMIN'), (request, response) => {
  const date = request.query.date;
  if (!validDate(date)) return response.status(400).json({ error: 'Date must use YYYY-MM-DD and be valid' });
  const statement = request.app.locals.attendanceDb.prepare(
    'SELECT employee_id, work_date, status FROM attendance WHERE work_date = ?'
  );
  statement.bind([date]);
  return response.json({ data: rowsFromStatement(statement) });
});

app.post('/api/vacations/approve', authenticate, requireRole('HR', 'ADMIN'), (request, response) => {
  const { solicitante_id: requesterId, aprobador_id: approverId } = request.body || {};
  if (typeof requesterId !== 'string' || typeof approverId !== 'string' ||
      requesterId.length === 0 || approverId.length === 0) {
    return response.status(400).json({ error: 'Requester and approver IDs are required' });
  }
  if (approverId !== request.auth.userId) {
    return response.status(403).json({ error: 'Approver ID must match the authenticated user' });
  }
  if (requesterId === approverId) {
    return response.status(400).json({ error: 'A requester cannot approve their own vacation' });
  }
  return response.json({ status: 'approved', solicitante_id: requesterId, aprobador_id: approverId });
});

app.get('/api/demo/error', (_request, _response, next) => {
  next(new Error('Demonstration internal failure'));
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ error: 'Too many login attempts; try again later' })
});

app.post('/api/login', loginLimiter, async (request, response, next) => {
  try {
    const { username, password } = request.body || {};
    const user = typeof username === 'string' ? usersByName.get(username.toLowerCase()) : null;
    const passwordMatches = typeof password === 'string' && user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;
    if (!passwordMatches || !user) return response.status(401).json({ error: 'Invalid credentials' });

    const token = crypto.randomBytes(32).toString('base64url');
    sessionTokens.set(token, {
      role: user.role,
      userId: user.userId,
      expiresAt: Date.now() + 15 * 60 * 1000
    });
    return response.json({ token, tokenType: 'Bearer', expiresInSeconds: 900 });
  } catch (error) {
    return next(error);
  }
});

app.post('/api/cv/upload', authenticate, requireRole('HR', 'ADMIN'), upload.single('file'), async (request, response, next) => {
  try {
    const file = request.file;
    const hasPdfSignature = file?.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    const hasPdfEndMarker = file?.buffer.includes(Buffer.from('%%EOF'));
    if (!file || path.extname(file.originalname).toLowerCase() !== '.pdf' ||
        file.mimetype !== 'application/pdf' || !hasPdfSignature || !hasPdfEndMarker) {
      return response.status(400).json({ error: 'Only valid PDF documents are accepted' });
    }

    await fs.mkdir(uploadDirectory, { recursive: true, mode: 0o700 });
    const storedName = `${crypto.randomBytes(16).toString('hex')}.pdf`;
    await fs.writeFile(path.join(uploadDirectory, storedName), file.buffer, { flag: 'wx', mode: 0o600 });
    return response.status(201).json({ accepted: true, storedName, size: file.size });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/salary/:id', authenticate, requireRole('HR', 'ADMIN', 'PAYROLL'), (request, response) => {
  const result = getEmployee(request.params.id);
  if (result.invalid) return response.status(400).json({ error: 'Invalid employee ID' });
  if (!result.employee) return response.status(404).json({ error: 'Employee not found' });
  const newSalary = request.body?.salary;
  if (typeof newSalary !== 'number' || !Number.isFinite(newSalary) || newSalary <= 0 || newSalary > 10000000) {
    return response.status(400).json({ error: 'Salary must be a positive number within the allowed range' });
  }

  const previousSalary = result.employee.salary;
  result.employee.salary = newSalary;
  auditLogger.info({
    event: 'salary.updated',
    timestamp: new Date().toISOString(),
    user: request.auth.userId,
    role: request.auth.role,
    ip: request.ip,
    employeeId: result.employee.id,
    previousSalary,
    newSalary
  });
  return response.json({
    data: { id: result.employee.id, salary: newSalary },
    audit: { event: 'salary.updated', recorded: true }
  });
});

app.post('/api/export', async (request, response, next) => {
  try {
    if (typeof request.body?.url !== 'string') {
      return response.status(400).json({ error: 'A URL is required' });
    }
    let target;
    try {
      target = new URL(request.body.url);
    } catch {
      return response.status(400).json({ error: 'Invalid URL' });
    }
    const result = await safeExport(target);
    return response.json({ requestedUrl: target.href, upstreamStatus: result.status, body: result.body });
  } catch (error) {
    if (error.statusCode === 400) return response.status(400).json({ error: error.message });
    if (error.statusCode === 502) return response.status(502).json({ error: 'Export response exceeded the demo limit' });
    return next(error);
  }
});

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.use((error, _request, response, _next) => {
  if (response.headersSent) return;
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return response.status(400).json({ error: 'Invalid JSON body' });
  }
  if (error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ error: 'Uploaded file exceeds the 1 MB limit' });
  }
  if (error instanceof multer.MulterError) {
    return response.status(400).json({ error: 'Invalid file upload' });
  }
  if (error.status === 413) return response.status(413).json({ error: 'Request body too large' });
  return response.status(500).json({ error: 'Internal server error' });
});

async function start() {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  database.run('CREATE TABLE attendance (employee_id TEXT, work_date TEXT, status TEXT)');
  database.run("INSERT INTO attendance VALUES ('EMP-1001', '2026-09-30', 'present'), ('EMP-1002', '2026-09-30', 'remote')");
  app.locals.attendanceDb = database;

  const initialPasswordHash = await bcrypt.hash('demo-initial-password-1001', 12);
  usersByName.set('ada', { role: 'EMPLOYEE', userId: 'EMP-1001', passwordHash: initialPasswordHash });

  app.listen(port, host, () => {
    console.log(`TalentCorp API listening on http://${host}:${port}`);
  });
}

start().catch((error) => {
  console.error('Unable to start secure TalentCorp API:', error);
  process.exitCode = 1;
});
