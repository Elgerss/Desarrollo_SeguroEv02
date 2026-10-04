# Controles de seguridad de aplicación (ASC) | TalentCorp

Esta matriz transforma los diez escenarios solicitados en controles verificables. Las rutas vulnerables son deliberadas y se ejecutan solo en loopback con fixtures sintéticos. Los criterios son evidencia de laboratorio, no una certificación ni un sustituto de revisión de amenazas.

| ASC | OWASP | Debilidad reproducible en `src/vulnerable` | Control preventivo en `src/seguro` | Criterio/evidencia |
| --- | --- | --- | --- | --- |
| ASC-01 | A01 Broken Access Control | `GET /api/payslip/:id` entrega cualquier recibo sin autenticar ni autorizar | Token asociado a usuario/rol; titular consulta su recibo; `HR`/`ADMIN` acceden por función; resto recibe `403` | Empleado EMP-1001 para EMP-1002: vulnerable `200`, seguro `403`; usuario no autenticado `401` |
| ASC-02 | A02 Cryptographic Failures | `POST /api/employees` devuelve y conserva contraseña inicial en claro | bcrypt con factor de coste 12; no devolver hash ni contraseña; token de activación aleatorio `crypto.randomBytes`, almacenado como hash y con expiración | Creación devuelve `201`, algoritmo indicado y activación temporal; no aparece `initialPassword` |
| ASC-03 | A03 Injection | `GET /api/attendance?date=` concatena entrada en SQL ejecutable | Validación real de `YYYY-MM-DD` y sentencia SQLite preparada con placeholder y bind | `' OR 1=1 --` obtiene todas las filas en vulnerable; seguro lo rechaza con `400` |
| ASC-04 | A04 Insecure Design | Aprobación acepta solicitante igual al aprobador y no verifica rol | Regla backend impide autoaprobación; rol `HR`/`ADMIN`; aprobador debe coincidir con principal autenticado | Autoprobación `400`; rol no autorizado o identidad falsificada `403` |
| ASC-05 | A05 Security Misconfiguration | `X-Powered-By` y stack trace/rutas expuestos | `helmet()`, deshabilitar `x-powered-by`, manejador JSON central sin detalle interno | Error de prueba `500` genérico; no aparece `server.js`; cabeceras de Helmet |
| ASC-06 | A06 Vulnerable and Outdated Components | PDFKit fijado en `0.12.3` para representar la rama antigua del ejercicio | PDFKit fijado en `0.20.2`; revisar advisories y actualizar mediante proceso de dependencias | Endpoint local de diagnóstico muestra la versión fijada; confirmar vulnerabilidades por `npm audit`/advisory antes de caracterizar CVE |
| ASC-07 | A07 Identification and Authentication Failures | `POST /api/login` no limita intentos | `express-rate-limit`, máximo 5 intentos por minuto, respuesta JSON `429`; comparación bcrypt | Sexto intento consecutivo responde `429`; intentos inválidos previos `401` |
| ASC-08 | A08 Software and Data Integrity Failures | Carga multipart acepta cualquier extensión, MIME y contenido | Límite 1 MiB; `.pdf`, MIME declarado y firma `%PDF-`/marca EOF; nombre aleatorio, fuera del web root y permisos sin ejecución | TXT disfrazado de CV: vulnerable `201`, seguro `400`; exceso de tamaño `413` |
| ASC-09 | A09 Security Logging and Monitoring Failures | `PUT /api/salary/:id` modifica salario sin evento de auditoría | Winston JSON: timestamp, principal, IP, empleado y valores salariales previo/nuevo | Actualización válida produce `salary.updated` con campos obligatorios; rechazo de entradas inválidas |
| ASC-10 | A10 Server-Side Request Forgery | `/api/export` solicita URL HTTP/HTTPS indicada sin lista blanca ni filtro de red | HTTPS, host exacto en lista blanca, bloqueo de loopback/privadas/link-local/metadata, validación DNS y resolución fijada para petición | URL loopback/RFC1918/metadata no alcanza el upstream y responde `400` |

## Operación y límites

- Las capturas crudas se escriben bajo `auditoria/fase1/` o `auditoria/fase2/`; deben conservarse localmente con acceso restringido y eliminarse cuando dejen de ser necesarias.
- La ruta `GET /api/demo/components` es solo diagnóstica en el entorno de laboratorio; queda deshabilitada cuando `NODE_ENV=production`.
- Los tokens `demo-*` y credenciales de `ada` son únicamente fixtures locales. Producción exige tokens diferentes, aleatorios y gestionados fuera del repositorio.
- La prueba SSRF se dirige al health check local del propio objetivo; no apunta a sistemas externos ni a metadatos de nube.
- En despliegue real se requieren además identidad corporativa, autorización por tenant/recurso, TLS, almacenamiento privado duradero, entrega segura de activaciones, inspección antimalware, retención, alertas, egress de red y procesos legales/de privacidad.
