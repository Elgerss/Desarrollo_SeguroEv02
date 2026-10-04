const demoTokens = {
  HR: 'demo-hr-token-change-me-0123456789',
  PAYROLL: 'demo-payroll-token-change-me-0123456789',
  ADMIN: 'demo-admin-token-change-me-0123456789',
  EMPLOYEE: 'demo-employee-token-change-me-0123456789'
};

const role = document.querySelector('#role');
const token = document.querySelector('#token');
const employeesBody = document.querySelector('#employees');
const responseBody = document.querySelector('#response');
const resultStatus = document.querySelector('#result-status');
const resultTitle = document.querySelector('#result-title');
const healthStatus = document.querySelector('#health-status');
const isVulnerable = window.location.port === '3000';

document.querySelector('#mode-name').textContent = isVulnerable ? 'API vulnerable' : 'API segura';
document.querySelector('#mode-address').textContent = window.location.origin;
document.querySelector('#vulnerable-link').classList.toggle('active', isVulnerable);
document.querySelector('#secure-link').classList.toggle('active', !isVulnerable);

function headers(extra = {}) {
  const requestHeaders = { Accept: 'application/json', ...extra };
  if (token.value.trim()) requestHeaders.Authorization = `Bearer ${token.value.trim()}`;
  return requestHeaders;
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: headers(options.headers)
  });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();
  return { status: response.status, body };
}

function showResult(title, status, body) {
  resultTitle.textContent = title;
  resultStatus.textContent = `HTTP ${status}`;
  resultStatus.className = `http-status ${status >= 200 && status < 300 ? 'success' : 'failure'}`;
  responseBody.textContent = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
}

function showError(title, error) {
  resultTitle.textContent = title;
  resultStatus.textContent = 'Error de conexión';
  resultStatus.className = 'http-status failure';
  responseBody.textContent = error instanceof Error ? error.message : String(error);
}

async function runRequest(title, path, options) {
  try {
    const result = await request(path, options);
    showResult(title, result.status, result.body);
    return result;
  } catch (error) {
    showError(title, error);
    return null;
  }
}

function renderEmployees(data, emptyMessage = 'No hay empleados para mostrar.') {
  employeesBody.replaceChildren();
  if (!Array.isArray(data) || data.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'empty';
    cell.textContent = emptyMessage;
    row.append(cell);
    employeesBody.append(row);
    return;
  }

  for (const employee of data) {
    const row = document.createElement('tr');
    for (const value of [
      employee.id,
      `${employee.firstName} ${employee.lastName}`,
      employee.department,
      employee.title,
      employee.status
    ]) {
      const cell = document.createElement('td');
      cell.textContent = value ?? '';
      row.append(cell);
    }
    employeesBody.append(row);
  }
}

async function loadEmployees(showResponse = true) {
  try {
    const result = await request('/api/employees');
    if (showResponse || result.status < 200 || result.status >= 300) {
      showResult('Listado de empleados', result.status, result.body);
    }
    if (result.status === 200 && Array.isArray(result.body?.data)) {
      renderEmployees(result.body.data);
    } else {
      renderEmployees([], `No se pudo cargar el directorio (HTTP ${result.status}).`);
    }
  } catch (error) {
    renderEmployees([], 'No fue posible conectar con la API.');
    showError('Listado de empleados', error);
  }
}

document.querySelector('#demo-token').addEventListener('click', () => {
  token.value = demoTokens[role.value];
  token.type = 'text';
  window.setTimeout(() => { token.type = 'password'; }, 1800);
});

role.addEventListener('change', () => {
  token.value = '';
});

document.querySelector('#load-employees').addEventListener('click', loadEmployees);

document.querySelector('#lookup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.querySelector('#lookup-id').value.trim();
  if (!id) {
    showError('Consulta de perfil', 'Escribe un ID de empleado.');
    return;
  }
  await runRequest(`Perfil del empleado ${id}`, `/api/employees/${encodeURIComponent(id)}`);
});

document.querySelector('#update-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = document.querySelector('#update-id').value.trim();
  const department = document.querySelector('#department').value.trim();
  const title = document.querySelector('#title').value.trim();
  if (!id || (!department && !title)) {
    showError('Actualización de perfil', 'Indica un ID y al menos un campo permitido.');
    return;
  }
  const changes = {};
  if (department) changes.department = department;
  if (title) changes.title = title;
  const result = await runRequest(`Actualización del empleado ${id}`, `/api/employees/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes)
  });
  if (result?.status === 200) await loadEmployees(false);
});

document.querySelector('#mass-assignment').addEventListener('click', async () => {
  const result = await runRequest('Prueba de asignación masiva (solo datos sintéticos)', '/api/employees/EMP-1001', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ salary: 1, accessLevel: 'admin' })
  });
  if (result?.status === 200) await loadEmployees(false);
});

document.querySelector('#payroll-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const employeeId = document.querySelector('#payroll-id').value.trim();
  const query = employeeId ? `?employeeId=${encodeURIComponent(employeeId)}` : '';
  await runRequest('Consulta de nómina', `/api/payroll${query}`);
});

document.querySelector('#export-url').value = `http://127.0.0.1:${window.location.port}/health`;

document.querySelector('#test-a01').addEventListener('click', async () => {
  const id = document.querySelector('#payslip-id').value.trim();
  await runRequest(`A01 · Recibo de ${id}`, `/api/payslip/${encodeURIComponent(id)}`);
});

document.querySelector('#test-a02').addEventListener('click', async () => {
  const id = document.querySelector('#new-employee-id').value.trim();
  await runRequest('A02 · Alta con credencial protegida', '/api/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, firstName: 'Demo', lastName: 'Employee' })
  });
});

document.querySelector('#test-a03').addEventListener('click', async () => {
  const date = document.querySelector('#attendance-date').value;
  await runRequest('A03 · Consulta parametrizada de asistencia', `/api/attendance?date=${encodeURIComponent(date)}`);
});

document.querySelector('#test-a04').addEventListener('click', async () => {
  await runRequest('A04 · Segregación de aprobación', '/api/vacations/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ solicitante_id: 'HR-001', aprobador_id: 'HR-001' })
  });
});

document.querySelector('#test-a05').addEventListener('click', async () => {
  await runRequest('A05 · Manejo de error interno', '/api/demo/error');
});

document.querySelector('#test-a06').addEventListener('click', async () => {
  await runRequest('A06 · Componente PDFKit', '/api/demo/components');
});

document.querySelector('#test-a07').addEventListener('click', async () => {
  let result;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    result = await request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unknown-demo-user', password: `invalid-${attempt}` })
    });
  }
  showResult('A07 · Sexto intento de inicio de sesión', result.status, result.body);
});

document.querySelector('#test-a08').addEventListener('click', async () => {
  const fileInput = document.querySelector('#cv-file');
  const file = fileInput.files[0] || new File(['synthetic resume, not a PDF'], 'resume.txt', { type: 'text/plain' });
  const formData = new FormData();
  formData.append('file', file);
  await runRequest('A08 · Validación de tipo y contenido del archivo', '/api/cv/upload', {
    method: 'POST',
    body: formData
  });
});

document.querySelector('#test-a09').addEventListener('click', async () => {
  const salary = Number(document.querySelector('#salary-value').value);
  await runRequest('A09 · Actualización auditada de salario', '/api/salary/EMP-1001', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ salary })
  });
});

document.querySelector('#test-a10').addEventListener('click', async () => {
  const url = document.querySelector('#export-url').value.trim();
  await runRequest('A10 · Validación SSRF de URL de exportación', '/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  });
});

request('/health')
  .then(({ status, body }) => {
    if (status !== 200) throw new Error(`Health check respondió HTTP ${status}.`);
    healthStatus.classList.add('ok');
    healthStatus.lastChild.textContent = ` Conectada · ${body.service}`;
  })
  .catch((error) => {
    healthStatus.classList.add('error');
    healthStatus.lastChild.textContent = ' Sin conexión con la API';
    showError('Comprobación de conexión', error);
  });
