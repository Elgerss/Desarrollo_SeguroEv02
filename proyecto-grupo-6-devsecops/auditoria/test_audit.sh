#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HR_TOKEN="local-audit-hr-token-0123456789abcdef"
PAYROLL_TOKEN="local-audit-payroll-token-0123456789"
ADMIN_TOKEN="local-audit-admin-token-0123456789abcdef"
EMPLOYEE_TOKEN="local-audit-employee-token-0123456789abcdef"
SERVER_PID=""
TMP_UPLOAD=""
FAILURES=0
PASSED=0

cleanup() {
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" 2>/dev/null || true; fi
  if [[ -n "$TMP_UPLOAD" ]]; then rm -f "$TMP_UPLOAD"; fi
}
trap cleanup EXIT INT TERM

if [[ "$#" -gt 1 ]]; then
  printf 'Uso: bash auditoria/test_audit.sh [1|2]\n' >&2
  exit 2
fi
TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  printf 'Selecciona el objetivo de auditoría:\n  1) Servidor Vulnerable (:3000)\n  2) Servidor Seguro (:3001)\n'
  read -r -p 'Opción [1/2]: ' TARGET
fi
if [[ "$TARGET" != "1" && "$TARGET" != "2" ]]; then
  printf 'ERROR: selecciona 1 (vulnerable) o 2 (seguro).\n' >&2
  exit 2
fi

if [[ "$TARGET" == "1" ]]; then
  APP_DIR="vulnerable"
  PHASE_DIR="$ROOT_DIR/auditoria/fase1"
  BASE_URL="http://127.0.0.1:3000"
  TARGET_NAME="Servidor Vulnerable"
else
  APP_DIR="seguro"
  PHASE_DIR="$ROOT_DIR/auditoria/fase2"
  BASE_URL="http://127.0.0.1:3001"
  TARGET_NAME="Servidor Seguro"
fi

if ! command -v node >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  printf 'ERROR: se requieren Node.js y curl en PATH.\n' >&2
  exit 2
fi
if [[ ! -d "$ROOT_DIR/src/$APP_DIR/node_modules" ]]; then
  printf 'ERROR: instala dependencias con npm install en src/%s.\n' "$APP_DIR" >&2
  exit 2
fi

mkdir -p "$PHASE_DIR"
if ! curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
  (
    cd "$ROOT_DIR/src/$APP_DIR"
    export PORT="${BASE_URL##*:}"
    export NODE_ENV=test
    export HR_API_TOKEN="$HR_TOKEN" PAYROLL_API_TOKEN="$PAYROLL_TOKEN"
    export ADMIN_API_TOKEN="$ADMIN_TOKEN" EMPLOYEE_API_TOKEN="$EMPLOYEE_TOKEN"
    exec node server.js
  ) >"$PHASE_DIR/server.log" 2>&1 &
  SERVER_PID=$!
  ready=false
  for _attempt in {1..60}; do
    if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then ready=true; break; fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then break; fi
    sleep 0.25
  done
  if [[ "$ready" != true ]]; then
    printf 'ERROR: no arrancó %s. Revisa %s/server.log y que el puerto esté libre.\n' "$TARGET_NAME" "$PHASE_DIR" >&2
    exit 2
  fi
fi

request() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local auth_token="${4:-}"
  local body="${5:-}"
  local mode="${6:-replace}"
  local output_file="$PHASE_DIR/$name.txt"
  local args=(-i -sS -X "$method" "$BASE_URL$endpoint")
  if [[ -n "$auth_token" ]]; then args+=(-H "Authorization: Bearer $auth_token"); fi
  if [[ -n "$body" ]]; then args+=(-H 'Content-Type: application/json' --data "$body"); fi

  local raw
  raw="$(curl "${args[@]}")" || {
    printf 'ERROR: curl no pudo completar %s\n' "$endpoint" >&2
    raw="HTTP/1.1 000 Connection Error"
  }
  if [[ "$mode" == "append" ]]; then printf '%s\n\n' "$raw" >>"$output_file"; else printf '%s\n' "$raw" >"$output_file"; fi
  LAST_STATUS="$(printf '%s\n' "$raw" | sed -n '1s/^[^ ]* \([0-9][0-9][0-9]\).*/\1/p' | tr -d '\r')"
  [[ -n "$LAST_STATUS" ]] || LAST_STATUS="000"
  LAST_RAW="$raw"
}

request_upload() {
  local output_file="$PHASE_DIR/a08_integridad_archivo.txt"
  local upload_path
  if command -v cygpath >/dev/null 2>&1; then
    upload_path="$(cygpath -w "$TMP_UPLOAD")"
  else
    upload_path="$TMP_UPLOAD"
  fi
  local raw
  raw="$(curl -i -sS -X POST "$BASE_URL/api/cv/upload" \
    -H "Authorization: Bearer $HR_TOKEN" \
    -F "file=@$upload_path;filename=resume.txt;type=text/plain")" || {
      printf 'ERROR: curl no pudo completar la carga de prueba.\n' >&2
      raw="HTTP/1.1 000 Connection Error"
    }
  printf '%s\n' "$raw" >"$output_file"
  LAST_STATUS="$(printf '%s\n' "$raw" | sed -n '1s/^[^ ]* \([0-9][0-9][0-9]\).*/\1/p' | tr -d '\r')"
  [[ -n "$LAST_STATUS" ]] || LAST_STATUS="000"
  LAST_RAW="$raw"
}

check() {
  local label="$1"
  local passed="$2"
  if [[ "$passed" == true ]]; then
    printf 'PASS  %-30s HTTP %s\n' "$label" "$LAST_STATUS"
    PASSED=$((PASSED + 1))
  else
    printf 'FAIL  %-30s HTTP %s\n' "$label" "$LAST_STATUS"
    FAILURES=$((FAILURES + 1))
  fi
}

expected_status() {
  local vulnerable_status="$1"
  local secure_status="$2"
  if [[ "$TARGET" == "1" ]]; then [[ "$LAST_STATUS" == "$vulnerable_status" ]]; else [[ "$LAST_STATUS" == "$secure_status" ]]; fi
}

printf '\nObjetivo: %s (%s)\nRespuestas sin procesar: %s\n\n' "$TARGET_NAME" "$BASE_URL" "$PHASE_DIR"

request a01_control_acceso GET '/api/payslip/EMP-1002' "$EMPLOYEE_TOKEN"
check 'A01 Broken Access Control' "$(expected_status 200 403 && echo true || echo false)"

NEW_ID="EMP-$(printf '%04d' "$((RANDOM % 10000))")"
request a02_criptografia POST '/api/employees' "$HR_TOKEN" "{\"id\":\"$NEW_ID\",\"firstName\":\"Audit\",\"lastName\":\"Synthetic\"}"
if [[ "$TARGET" == "1" ]]; then
  check 'A02 Cryptographic Failures' "$([[ "$LAST_STATUS" == 201 && "$LAST_RAW" == *initialPassword* ]] && echo true || echo false)"
else
  check 'A02 Cryptographic Failures' "$([[ "$LAST_STATUS" == 201 && "$LAST_RAW" == *activationTokenIssued* && "$LAST_RAW" == *bcrypt* && "$LAST_RAW" != *initialPassword* ]] && echo true || echo false)"
fi

request a03_inyeccion GET '/api/attendance?date=%27%20OR%201%3D1%20--' "$HR_TOKEN"
check 'A03 Injection' "$(expected_status 200 400 && echo true || echo false)"

request a04_diseno_inseguro POST '/api/vacations/approve' "$HR_TOKEN" '{"solicitante_id":"HR-001","aprobador_id":"HR-001"}'
check 'A04 Insecure Design' "$(expected_status 200 400 && echo true || echo false)"

request a05_configuracion GET '/api/demo/error'
if [[ "$TARGET" == "1" ]]; then
  check 'A05 Security Misconfiguration' "$([[ "$LAST_STATUS" == 500 && "$LAST_RAW" == *server.js* && "$LAST_RAW" == *X-Powered-By* ]] && echo true || echo false)"
else
  check 'A05 Security Misconfiguration' "$([[ "$LAST_STATUS" == 500 && "$LAST_RAW" == *'Internal server error'* && "$LAST_RAW" != *server.js* && "$LAST_RAW" != *X-Powered-By* ]] && echo true || echo false)"
fi

request a06_componentes GET '/api/demo/components'
if [[ "$TARGET" == "1" ]]; then
  check 'A06 Vulnerable Components' "$([[ "$LAST_STATUS" == 200 && "$LAST_RAW" == *0.12.3* ]] && echo true || echo false)"
else
  check 'A06 Vulnerable Components' "$([[ "$LAST_STATUS" == 200 && "$LAST_RAW" == *0.20.2* ]] && echo true || echo false)"
fi

: >"$PHASE_DIR/a07_autenticacion.txt"
for _attempt in {1..6}; do
  request a07_autenticacion POST '/api/login' '' '{"username":"unknown-demo-user","password":"invalid-audit-password"}' append
done
check 'A07 Authentication Failures' "$(expected_status 401 429 && echo true || echo false)"

TMP_UPLOAD="$PHASE_DIR/.audit-upload-$$.txt"
printf 'Synthetic résumé fixture; deliberately not a PDF.\n' >"$TMP_UPLOAD"
request_upload
check 'A08 Software/Data Integrity' "$(expected_status 201 400 && echo true || echo false)"

request a09_logging PUT '/api/salary/EMP-1001' "$PAYROLL_TOKEN" '{"salary":90001}'
if [[ "$TARGET" == "1" ]]; then
  check 'A09 Logging and Monitoring' "$([[ "$LAST_STATUS" == 200 && "$LAST_RAW" != *auditEvent* ]] && echo true || echo false)"
else
  check 'A09 Logging and Monitoring' "$([[ "$LAST_STATUS" == 200 && "$LAST_RAW" == *'"recorded":true'* ]] && echo true || echo false)"
fi

request a10_ssrf POST '/api/export' "$HR_TOKEN" "{\"url\":\"$BASE_URL/health\"}"
check 'A10 Server-Side Request Forgery' "$(expected_status 200 400 && echo true || echo false)"

printf '\nResultado: %s PASS, %s FAIL\n' "$PASSED" "$FAILURES"
if [[ "$FAILURES" -gt 0 ]]; then
  printf 'Auditoría completada con fallos. Revisa los diez archivos a01_*.txt ... a10_*.txt.\n'
  exit 1
fi
if [[ "$TARGET" == "1" ]]; then
  printf 'Todas las comprobaciones confirmaron los comportamientos vulnerables esperados (solo laboratorio local).\n'
else
  printf 'Todas las comprobaciones confirmaron los controles mitigados.\n'
fi
