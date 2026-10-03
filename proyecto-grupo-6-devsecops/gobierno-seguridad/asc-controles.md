# Controles ASC | TalentCorp API

ASC se usa aquí como catálogo académico de controles de seguridad de aplicación. La correspondencia con ISO/IEC 27034 es orientativa: cada organización debe adaptar controles y criterios de aceptación a su ONF, riesgo y contexto.

| ID | Riesgo / referencia | Control de diseño e implementación | Evidencia verificable |
| --- | --- | --- | --- |
| ASC-01 | Acceso no autorizado; OWASP A01 | Token Bearer requerido y autorización explícita por rol en rutas HR y PAYROLL | Sin token: `401`; rol incorrecto: `403` |
| ASC-02 | Exposición de datos; OWASP A01/A02 | Respuesta de empleados con lista positiva de campos; nómina separada por rol | La prueba confirma que HR no recibe identificador nacional, cuenta bancaria ni salario |
| ASC-03 | Fallos criptográficos; OWASP A02 | No almacenar credenciales en el código; tokens productivos desde el entorno/gestor de secretos; TLS requerido en despliegue | Arranque productivo falla sin tokens fuertes; TLS corresponde al proxy de despliegue |
| ASC-04 | Inyección y entradas inseguras; OWASP A03 | Validar IDs, consultas y cuerpo contra esquemas estrictos; no construir consultas dinámicas | Entradas no válidas y campos adicionales devuelven `400` |
| ASC-05 | Configuración insegura; OWASP A05 | Helmet, ocultación de `X-Powered-By`, límite de tamaño JSON, limitación de solicitudes y errores genéricos | Cabecera `X-Content-Type-Options: nosniff`; límites en middleware |
| ASC-06 | Componentes vulnerables; OWASP A06 | Versiones directas acotadas en manifiesto y revisión/actualización en CI | `npm audit` y escaneo de dependencias son pasos operativos pendientes |
| ASC-07 | Fallos de autenticación; OWASP A07 | Comparación de tokens con `timingSafeEqual`; no aceptar credenciales en query o body | Pruebas de ausencia y token inválido; logs no contienen tokens |
| ASC-08 | Integridad de datos; OWASP A08 | Esquema de actualización estricto y asignación explícita solo de campos autorizados | Envío de `role` como campo adicional devuelve `400` |
| ASC-09 | Registro/alerta insuficiente; OWASP A09 | La demo no registra PII ni credenciales; producción debe añadir eventos de auditoría seguros | Requisito operativo documentado; no implementado en el fixture |
| ASC-10 | SSRF y límites de confianza; OWASP A10 | No hay llamadas salientes en esta API; despliegue restringe egress según necesidad | Revisión de arquitectura y reglas de red al integrar dependencias externas |

Los controles no cubren autorización por tenant, sesiones corporativas, persistencia, copias de seguridad ni ciclo de respuesta a incidentes. Esos elementos son requisitos para una aplicación real, no capacidades implícitas de esta demo.