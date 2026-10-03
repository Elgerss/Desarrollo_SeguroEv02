# ONF de seguridad de aplicaciones | Referencia ISO/IEC 27034

Este documento define un **Organizational Normative Framework (ONF) académico y reducido** para TalentCorp API. Sirve para organizar responsabilidades y evidencia durante el ciclo de vida; no declara conformidad ni sustituye la interpretación de las normas vigentes o los procesos corporativos.

## Política y contexto

- **Activo:** información de personal y de nómina.
- **Propietario funcional:** responsable de RR. HH. y Nómina, que aprueba finalidades y perfiles de acceso.
- **Responsable técnico:** equipo de desarrollo, que implementa requisitos y mantiene pruebas reproducibles.
- **Responsable de seguridad:** revisa riesgos, controles, excepciones y resultados antes de una liberación.
- **Clasificación:** restringida. Los datos reales requieren controles organizacionales y legales adicionales.

## Proceso del ciclo de vida

| Etapa | Actividad de seguridad | Evidencia del proyecto |
| --- | --- | --- |
| Requisitos | Identificar activos, actores, amenazas y obligaciones de privacidad | Este ONF y el manifiesto ético |
| Diseño | Definir límites de confianza, roles, minimización y validación | Contrato documentado en `README.md` |
| Implementación | Aplicar controles por defecto y revisión de cambios | `src/seguro/` y `gobierno-seguridad/asc-controles.md` |
| Verificación | Probar autenticación, autorización, exposición y entradas | `auditoria/test_audit.sh` y respuestas guardadas |
| Liberación | Revisar evidencia, dependencias, secretos y excepciones | Puerta de revisión propuesta abajo |
| Operación | Monitorizar, gestionar vulnerabilidades y responder a incidentes | Requisito pendiente de integración en una plataforma real |

## Puerta de liberación académica

Una versión candidata no se aprueba si falla una prueba de control, contiene secretos, usa datos reales o carece de propietario para un riesgo alto. Los riesgos aceptados deben tener justificación, responsable y fecha de expiración. Toda excepción se vuelve a evaluar cuando cambian el tratamiento, el entorno o las dependencias.

## Trazabilidad

Cada requisito de seguridad debe enlazar a: riesgo o requisito, control implementado, prueba automatizada, resultado revisado y responsable. El equipo actualiza esta documentación en el mismo cambio que modifica comportamiento o controles. La auditoría de este repositorio solo cubre rutas y casos explícitos del laboratorio.