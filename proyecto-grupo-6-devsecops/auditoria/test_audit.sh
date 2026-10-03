#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHASE1_DIR="$ROOT_DIR/auditoria/fase1"
PHASE2_DIR="$ROOT_DIR/auditoria/fase2"
HR_TOKEN="local-audit-hr-token-0123456789abcdef"
PAYROLL_TOKEN="local-audit-payroll-token-0123456789"
VULNERABLE_PID=""
SECURE_PID=""
FAILURES=0

cleanup() {
  if [[ -n "$VULNERABLE_PID" ]]; then kill "$VULNERABLE_PID" 2>/dev/null || true; fi
  if [[ -n "$SECURE_PID" ]]; then kill "$SECURE_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

fail() {
  printf 'FAIL: %s\n' "$1"
  FAILURES=$((FAILURES + 1))
}

check() {
  local description="$1"
  local condition="$2"
  if [[ "$condition" == "true" ]]; then
    printf 'PASS: %s\n' "$description"
  else
    fail "$description"
  fi
}

request() {
  local base_url="$1"
  local phase_dir="$2"
  local name="$3"
  local method="$4"
  local path="$5"
  local token="${6:-}"
  local body="${7:-}"
  local args=(-sS -o "$phase_dir/$name.json" -w '%{http_code}' -X "$method" "$base_url$path")
  if [[ -n "$token" ]]; then args+=(-H "Authorization: Bearer $token"); fi
  if [[ -n "$body" ]]; then args+=(-H 'Content-Type: application/json' --data "$body"); fi
  curl "${args[@]}"
}

wait_for_health() {
  local url="$1"
  local attempt
  for attempt in {1..40}; do
    if curl -fsS "$url/health" >/dev/null 2>&1; then return 0; fi
    sleep 0.25
  done
  return 1
}

if ! command -v node >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  printf 'ERROR: se requieren Node.js y curl en PATH.\n' >&2
  exit 2
fi
if [[ ! -d "$ROOT_DIR/src/vulnerable/node_modules" || ! -d "$ROOT_DIR/src/seguro/node_modules" ]]; then
  printf 'ERROR: instala dependencias con npm install en src/vulnerable y src/seguro.\n' >&2
  exit 2
fi

mkdir -p "$PHASE1_DIR" "$PHASE2_DIR"

(
  cd "$ROOT_DIR/src/vulnerable"
  export PORT=3000
  exec node server.js
) >"$PHASE1_DIR/server.log" 2>&1 &
VULNERABLE_PID=$!
(
  cd "$ROOT_DIR/src/seguro"
  export NODE_ENV=test PORT=3001 HR_API_TOKEN="$HR_TOKEN" PAYROLL_API_TOKEN="$PAYROLL_TOKEN"
  exec node server.js
) >"$PHASE2_DIR/server.log" 2>&1 &
SECURE_PID=$!

if ! wait_for_health 'http://127.0.0.1:3000' || ! wait_for_health 'http://127.0.0.1:3001'; then
  printf 'ERROR: no arrancaron las APIs. Revisa server.log en fase1/fase2 y los puertos 3000/3001.\n' >&2
  exit 2
fi
if ! kill -0 "$VULNERABLE_PID" 2>/dev/null || ! kill -0 "$SECURE_PID" 2>/dev/null; then
  printf 'ERROR: uno de los procesos de auditoría terminó al iniciar; comprueba si los puertos 3000/3001 están ocupados.\n' >&2
  exit 2
fi

status="$(request 'http://127.0.0.1:3000' "$PHASE1_DIR" employees-public GET '/api/employees')"
check 'Fase 1: empleados accesibles sin autenticación (200)' "$([[ "$status" == 200 ]] && echo true || echo false)"
grep -q '"nationalId"' "$PHASE1_DIR/employees-public.json" && check 'Fase 1: respuesta expone identificadores sensibles' true || check 'Fase 1: respuesta expone identificadores sensibles' false
grep -q '"salary"' "$PHASE1_DIR/employees-public.json" && check 'Fase 1: respuesta expone salario en perfil' true || check 'Fase 1: respuesta expone salario en perfil' false
status="$(request 'http://127.0.0.1:3000' "$PHASE1_DIR" mass-assignment PATCH '/api/employees/EMP-1001' '' '{"salary":1,"accessLevel":"admin"}')"
check 'Fase 1: asignación masiva aceptada (200)' "$([[ "$status" == 200 ]] && echo true || echo false)"
grep -q '"salary":1' "$PHASE1_DIR/mass-assignment.json" && check 'Fase 1: salario alterado mediante asignación masiva' true || check 'Fase 1: salario alterado mediante asignación masiva' false
status="$(request 'http://127.0.0.1:3000' "$PHASE1_DIR" payroll-public GET '/api/payroll')"
check 'Fase 1: nómina accesible sin autenticación (200)' "$([[ "$status" == 200 ]] && echo true || echo false)"

status="$(request 'http://127.0.0.1:3001' "$PHASE2_DIR" employees-no-auth GET '/api/employees')"
check 'Fase 2: endpoint HR exige autenticación (401)' "$([[ "$status" == 401 ]] && echo true || echo false)"
status="$(request 'http://127.0.0.1:3001' "$PHASE2_DIR" employees-hr GET '/api/employees' "$HR_TOKEN")"
check 'Fase 2: rol HR autorizado (200)' "$([[ "$status" == 200 ]] && echo true || echo false)"
if grep -Eq '"(nationalId|bankAccount|salary)"' "$PHASE2_DIR/employees-hr.json"; then
  check 'Fase 2: perfil HR minimiza campos sensibles' false
else
  check 'Fase 2: perfil HR minimiza campos sensibles' true
fi
status="$(request 'http://127.0.0.1:3001' "$PHASE2_DIR" payroll-wrong-role GET '/api/payroll' "$HR_TOKEN")"
check 'Fase 2: HR no puede consultar nómina (403)' "$([[ "$status" == 403 ]] && echo true || echo false)"
status="$(request 'http://127.0.0.1:3001' "$PHASE2_DIR" payroll-authorized GET '/api/payroll' "$PAYROLL_TOKEN")"
check 'Fase 2: rol PAYROLL autorizado (200)' "$([[ "$status" == 200 ]] && echo true || echo false)"
status="$(request 'http://127.0.0.1:3001' "$PHASE2_DIR" invalid-id GET '/api/employees/not-an-id' "$HR_TOKEN")"
check 'Fase 2: identificador inválido rechazado (400)' "$([[ "$status" == 400 ]] && echo true || echo false)"
status="$(request 'http://127.0.0.1:3001' "$PHASE2_DIR" mass-assignment-rejected PATCH '/api/employees/EMP-1001' "$HR_TOKEN" '{"salary":1,"accessLevel":"admin"}')"
check 'Fase 2: campos no permitidos rechazados (400)' "$([[ "$status" == 400 ]] && echo true || echo false)"
status="$(curl -sS -D "$PHASE2_DIR/security-headers.txt" -o "$PHASE2_DIR/health.json" -w '%{http_code}' 'http://127.0.0.1:3001/health')"
check 'Fase 2: health disponible (200)' "$([[ "$status" == 200 ]] && echo true || echo false)"
grep -qi '^x-content-type-options: nosniff' "$PHASE2_DIR/security-headers.txt" && check 'Fase 2: cabecera nosniff presente' true || check 'Fase 2: cabecera nosniff presente' false

if [[ "$FAILURES" -gt 0 ]]; then
  printf '\nAuditoría finalizada con %s comprobación(es) fallida(s).\n' "$FAILURES"
  exit 1
fi
printf '\nAuditoría completada: todas las comprobaciones pasaron. Respuestas en auditoria/fase1 y auditoria/fase2.\n'