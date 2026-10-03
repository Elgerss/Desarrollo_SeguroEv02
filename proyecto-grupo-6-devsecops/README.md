# Grupo 6 | TalentCorp API

Proyecto académico Docs-as-Code para el dominio HR & Payroll. Incluye una API intencionalmente vulnerable para pruebas controladas y una implementación endurecida con controles de autenticación, autorización, validación y minimización de datos.

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

La API vulnerable escucha en `http://127.0.0.1:3000` y la segura en `http://127.0.0.1:3001`. Para uso local, la API segura acepta los tokens de demostración `demo-hr-token-change-me-0123456789` (rol HR) y `demo-payroll-token-change-me-0123456789` (rol PAYROLL). No reutilices estos valores fuera de pruebas.

En `NODE_ENV=production`, el servidor seguro exige `HR_API_TOKEN` y `PAYROLL_API_TOKEN` distintos, cada uno con al menos 32 caracteres. Inyéctalos desde un gestor de secretos; no los guardes en el repositorio. También admite `HOST` y `PORT` para configurar la interfaz y el puerto.

## API

| Método y ruta | Acceso vulnerable | Acceso seguro |
| --- | --- | --- |
| `GET /health` | Público | Público |
| `GET /api/employees` | Público; expone todos los campos | `HR`; solo campos de perfil necesarios |
| `GET /api/employees/:id` | Público; acceso directo a cualquier registro | `HR`; valida el identificador y minimiza campos |
| `PATCH /api/employees/:id` | Público; asignación masiva | `HR`; permite solo `department` y `title` |
| `GET /api/payroll` | Público; expone todas las nóminas | `PAYROLL`; acceso por `employeeId` opcional |

La API segura responde `401` sin credenciales, `403` si el rol no está autorizado, `400` para entradas inválidas o campos no permitidos y `404` para recursos inexistentes. Todos los importes y perfiles son fixtures en memoria que se reinician al reiniciar el proceso.

## Auditoría local

Instala primero las dependencias. El script arranca ambos procesos, verifica las rutas y controles, guarda cuerpos HTTP bajo `auditoria/fase1/` y `auditoria/fase2/`, y termina los procesos que inició:

```sh
bash auditoria/test_audit.sh
```

No ejecutes la auditoría si ya hay procesos ajenos escuchando en los puertos `3000` o `3001`. El script devuelve código distinto de cero si falla una comprobación.

## Docs-as-Code y seguridad

Las decisiones éticas, la relación orientativa con ISO/IEC 27034 y los controles ASC están en `gobierno-seguridad/`. Los cambios a API, controles, pruebas y documentación deben revisarse juntos. La trazabilidad de este ejercicio no equivale a una evaluación formal de conformidad.

## Uso fuera de la demostración

Antes de cualquier despliegue, sustituye los fixtures por persistencia con cifrado y controles transaccionales, autentica mediante OIDC/SSO, aplica autorización por recurso y tenant, configura TLS en el proxy, registra auditoría sin secretos ni PII innecesaria, define retención y respuesta a incidentes y ejecuta análisis de dependencias, SAST, DAST y pruebas de autorización en CI. No se incluye un despliegue productivo porque esos controles dependen del entorno organizacional.