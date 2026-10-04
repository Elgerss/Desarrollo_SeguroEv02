# Grupo 6 | TalentCorp API

Proyecto académico Docs-as-Code para el dominio HR & Payroll. Incluye una API intencionalmente vulnerable para pruebas controladas y una implementación de referencia con controles demostrables para los diez escenarios OWASP solicitados.

> **Alcance:** los datos son sintéticos y ambos servidores se enlazan por defecto a `127.0.0.1`. `src/vulnerable` existe únicamente para aprendizaje y no debe exponerse a redes, conectarse a datos reales ni desplegarse. `src/seguro` es una base de referencia, no una certificación de producción: una implantación real debe integrar identidad corporativa, almacenamiento persistente, gestión de secretos, observabilidad, continuidad y revisión legal.

## Requisitos

- Node.js 20 o posterior y npm.
- Bash y `curl` para ejecutar `auditoria/test_audit.sh` (Git Bash o WSL en Windows).

## Instalación y ejecución

Instala las dependencias en terminales separadas:

```sh
cd src/vulnerable && npm install
cd ../seguro && npm install
```

Inicia cada API desde la raíz del proyecto:

```sh
npm --prefix src/vulnerable start
npm --prefix src/seguro start
```

La API vulnerable escucha en `http://127.0.0.1:3000` y la segura en `http://127.0.0.1:3001`. Para uso local, la API segura acepta estos tokens sintéticos:

| Token | Identidad/rol | Uso |
| --- | --- | --- |
| `demo-hr-token-change-me-0123456789` | HR / `HR-001` | Empleados, asistencia, altas y aprobación |
| `demo-payroll-token-change-me-0123456789` | PAYROLL / `PAYROLL-001` | Nómina y cambios salariales |
| `demo-admin-token-change-me-0123456789` | ADMIN / `ADMIN-001` | Operaciones administrativas |
| `demo-employee-token-change-me-0123456789` | EMPLOYEE / `EMP-1001` | Acceso del titular a su recibo |

No reutilices estos valores fuera de pruebas.

Al iniciar cualquiera de los servidores, abre su dirección en el navegador para usar el laboratorio visual: `http://127.0.0.1:3000/` para la versión vulnerable o `http://127.0.0.1:3001/` para la segura. Además de empleados y nómina, incluye botones de prueba A01–A10. El selector de rol y «Cargar token demo» facilitan las pruebas autorizadas locales.

En `NODE_ENV=production`, el servidor seguro exige `HR_API_TOKEN`, `PAYROLL_API_TOKEN`, `ADMIN_API_TOKEN` y `EMPLOYEE_API_TOKEN` distintos, cada uno con al menos 32 caracteres. Inyéctalos desde un gestor de secretos; no los guardes en el repositorio. También admite `HOST` y `PORT`. La lista blanca SSRF se configura con `EXPORT_ALLOWED_HOSTS` como lista separada por comas; los nombres deben pertenecer a dominios aprobados por la organización.

## API

| Método y ruta | Acceso vulnerable | Acceso seguro |
| --- | --- | --- |
| `GET /health` | Público | Público |
| `GET /api/employees` | Público; expone todos los campos | `HR`; solo campos de perfil necesarios |
| `GET /api/employees/:id` | Público; acceso directo a cualquier registro | `HR`; valida el identificador y minimiza campos |
| `PATCH /api/employees/:id` | Público; asignación masiva | `HR`; permite solo `department` y `title` |
| `GET /api/payroll` | Público; expone todas las nóminas | `PAYROLL`; acceso por `employeeId` opcional |
| `GET /api/payslip/:id` | Público; entrega cualquier recibo | Titular, `HR` o `ADMIN`; el resto recibe `403` |
| `POST /api/employees` | Devuelve contraseña inicial en claro | `HR`/`ADMIN`; bcrypt y activación temporal sin exponer la contraseña |
| `GET /api/attendance?date=` | Interpola fecha en SQL | `HR`/`ADMIN`, fecha estricta y consulta SQLite preparada |
| `POST /api/vacations/approve` | Permite autoaprobación | `HR`/`ADMIN`, principal verificado y segregación de funciones |
| `GET /api/demo/error` | Filtra stack trace y ruta interna | Error genérico JSON sin stack trace |
| `GET /api/demo/components` | Informa PDFKit `0.12.3` | En modo local informa PDFKit `0.20.2`; deshabilitado en producción |
| `POST /api/login` | Sin límite de intentos | bcrypt y máximo 5 intentos por minuto; el sexto recibe `429` |
| `POST /api/cv/upload` | Acepta cualquier archivo | Solo PDF comprobado por extensión, MIME, firma y tamaño; almacenamiento privado |
| `PUT /api/salary/:id` | Cambia salario sin auditoría | Rol autorizado y evento JSON con actor, IP y valores previo/nuevo |
| `POST /api/export` | Solicita URL arbitraria HTTP/HTTPS | HTTPS, allowlist exacta, validación DNS y bloqueo de direcciones internas |

La API segura responde `401` sin credenciales, `403` si el rol no está autorizado, `400` para entradas inválidas, `413` para cargas excesivas y `404` para recursos inexistentes. Los perfiles, importes y asistencia son fixtures en memoria que se reinician al reiniciar el proceso. Los uploads aprobados quedan bajo `src/seguro/uploads/`; la demo no incluye persistencia ni entrega real del enlace de activación.

## Auditoría local

Instala primero las dependencias en la variante que vayas a probar. El script acepta `1` (vulnerable) o `2` (seguro), o presenta un menú si no se indica argumento. Ejecuta secuencialmente los diez escenarios con `curl -i -s`, guarda una respuesta cruda por control en la fase correspondiente e imprime códigos HTTP y PASS/FAIL:

```sh
bash auditoria/test_audit.sh 1
bash auditoria/test_audit.sh 2
# Menú interactivo:
bash auditoria/test_audit.sh
```

Los archivos son `a01_control_acceso.txt`, `a02_criptografia.txt`, `a03_inyeccion.txt`, `a04_diseno_inseguro.txt`, `a05_configuracion.txt`, `a06_componentes.txt`, `a07_autenticacion.txt`, `a08_integridad_archivo.txt`, `a09_logging.txt` y `a10_ssrf.txt`. Si el servidor seleccionado no está arriba, el script lo inicia y lo detiene al terminar; si ya responde en el puerto, lo reutiliza. Ejecuta este laboratorio solo en los puertos locales previstos. El script devuelve código distinto de cero si falla una comprobación.

## Docs-as-Code y seguridad

Los principios éticos, la referencia ONF/ISO/IEC 27034 y la matriz ASC están en `gobierno-seguridad/`. Los cambios a API, controles, pruebas y documentación deben revisarse juntos. La trazabilidad de este ejercicio no equivale a una evaluación formal de conformidad.

## Uso fuera de la demostración

Antes de cualquier despliegue, sustituye los fixtures por persistencia transaccional y cifrada, autentica mediante OIDC/SSO, aplica autorización por recurso y tenant, configura TLS, usa un gestor de secretos, valida malware en documentos, aplica egress de red, entrega enlaces de activación por canal confiable, define retención y respuesta a incidentes y ejecuta `npm audit`, SAST, DAST y pruebas de autorización en CI. No se incluye un despliegue productivo porque esos controles dependen del entorno organizacional.