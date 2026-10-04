# ONF de seguridad de aplicaciones | Referencia ISO/IEC 27034

## Estado y propósito

Este documento define un **Organizational Normative Framework (ONF) académico y reducido** para TalentCorp API. Organiza contexto, requisitos, controles de aplicación, evidencia y responsabilidades a lo largo del ciclo de vida, tomando ISO/IEC 27034 como referencia. No afirma conformidad ni certificación: el marco normativo vigente, su terminología y su aplicación deben ser confirmados por la organización y sus especialistas.

## Contexto de la aplicación

| Elemento | Definición del laboratorio |
| --- | --- |
| Propietario funcional | Responsables de RR. HH. y Nómina; definen finalidades y aprobaciones |
| Propietario técnico | Equipo de desarrollo; implementa API, dependencias y pruebas |
| Autoridad de seguridad | Revisa amenazas, controles, excepciones y evidencia de liberación |
| Activos | Recibos, salarios, perfil de empleados, asistencia, vacaciones, archivos CV, credenciales y eventos de auditoría |
| Clasificación | Confidencial/restringida en una implantación real; sintética en este repositorio |
| Límites de confianza | Navegador/API, roles y titulares, almacenamiento, proveedor de archivos, DNS/egress y sistema de registro |
| Entorno | Dos APIs locales en `127.0.0.1:3000` (intencionalmente vulnerable) y `127.0.0.1:3001` (controles de referencia) |

## Gobierno, responsabilidades y riesgo

- El propietario funcional aprueba casos de uso, perfiles de acceso, reglas de aprobación y retención.
- Desarrollo convierte requisitos en controles preventivos y mantiene pruebas ejecutables.
- Seguridad valida el modelo de amenazas, analiza dependencias y revisa evidencia independientemente del autor del cambio.
- Operaciones gestiona secretos, red, almacenamiento, monitorización, parches, respaldo y respuesta a incidentes en una implantación real.
- Asesoría jurídica y privacidad determinan las obligaciones aplicables; este laboratorio no establece una base legal.

Los riesgos de referencia son acceso indebido a nómina (A01), exposición de credenciales (A02), inyección (A03), autoaprobación (A04), filtración por errores/configuración (A05), componentes desactualizados (A06), fuerza bruta (A07), archivos no confiables (A08), ausencia de trazabilidad salarial (A09) y SSRF/egress (A10). Los controles y criterios de aceptación se trazan en [asc-controles.md](./asc-controles.md).

## Ciclo de vida y evidencia requerida

| Etapa | Actividades normativas | Artefactos/evidencia |
| --- | --- | --- |
| Requisitos | Identificar actores, datos, propósitos, obligaciones, amenazas y criterios de aceptación | Manifiesto ético, contrato API, historias de abuso y matriz ASC |
| Diseño | Definir límites de confianza, autenticación, titularidad, segregación, tratamiento de archivos, egress y auditoría | Decisiones de arquitectura y revisión de amenazas |
| Implementación | Aplicar validación positiva, autorización del lado servidor, hashing, consultas preparadas y configuración segura | Código de `src/seguro/`, versiones fijadas y revisión por pares |
| Verificación | Ejecutar pruebas negativas y positivas A01–A10 sobre cada variante; revisar salidas y logs | `auditoria/test_audit.sh`, diez capturas HTTP por fase y resultado de pruebas |
| Liberación | Revisar hallazgos, dependencias, configuración, secretos, almacenamiento y riesgo residual | Aprobación documentada, `npm audit`, análisis SAST/DAST y excepciones |
| Operación | Revisar accesos, actualizar componentes, monitorizar eventos, gestionar retención, incidentes y cambios | Runbooks, alertas, registros protegidos y revisiones periódicas |

## Criterios de liberación y excepciones

La API vulnerable nunca es candidata a producción. Una versión segura no se libera si falla una prueba de control, expone secretos o trazas, acepta una autorización no demostrada o carece de un propietario para un riesgo alto. El equipo analiza falsos positivos y cobertura; una salida `PASS` del script demuestra únicamente el comportamiento de sus casos de prueba, no la seguridad completa.

Toda excepción debe registrar riesgo, alcance, motivo, responsable que acepta, controles compensatorios, fecha de expiración y plan de cierre. Debe revalidarse tras cambios de datos, roles, dependencias, infraestructura o amenaza. Las credenciales y datos de producción se inyectan desde gestores adecuados; no se incorporan a repositorio ni capturas.

## Trazabilidad y mantenimiento

Cada requisito se enlaza con activo/riesgo, control ASC, responsable, implementación, prueba automatizada, resultado y decisión de liberación. Cambios de código, dependencias, contratos o tratamiento actualizan esta documentación en el mismo cambio. La evidencia de este ejercicio usa exclusivamente datos sintéticos y no demuestra certificación ISO/IEC 27034 ni conformidad legal.
