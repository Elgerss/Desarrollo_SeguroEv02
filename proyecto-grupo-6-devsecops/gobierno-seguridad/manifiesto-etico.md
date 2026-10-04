# Manifiesto ético | TalentCorp API

## Propósito y alcance

TalentCorp representa operaciones de Recursos Humanos y Nómina para enseñar seguridad de aplicaciones. Sus registros son sintéticos. La versión vulnerable existe solo para pruebas locales autorizadas; no es un modelo aceptable de producción ni debe conectarse a personas, servicios o redes ajenas al laboratorio.

Este manifiesto establece compromisos del equipo del ejercicio. No es asesoría legal ni reemplaza el análisis de las leyes aplicables al lugar donde se traten datos.

## Principios deontológicos

- **Dignidad, privacidad y minimización:** tratar información salarial, bancaria, identificadores y antecedentes laborales como confidencial; usarla únicamente para una finalidad legítima, explícita y comunicada. Recopilar y conservar lo estrictamente necesario.
- **Confidencialidad y acceso mínimo:** conceder acceso por función y titularidad; no inferir que la pertenencia a Recursos Humanos autoriza todo tratamiento. Proteger las credenciales, los recibos salariales y las exportaciones frente a divulgación accidental.
- **Integridad y exactitud:** evitar alteraciones no autorizadas de salario, asistencia y vacaciones. Registrar los cambios relevantes de forma atribuible y permitir su revisión y corrección por canales autorizados.
- **Segregación de funciones:** quien solicita un beneficio no lo aprueba a sí mismo. Las decisiones que afecten remuneración o derechos laborales requieren un aprobador autorizado e independiente.
- **Transparencia y rendición de cuentas:** informar a las personas sobre finalidades, responsables, conservación y vías de ejercicio de derechos; documentar controles, excepciones, incidentes y responsables.
- **Proporcionalidad y no discriminación:** no utilizar datos o métricas de RR. HH. para decisiones incompatibles con la finalidad informada, ni para discriminación, represalia o vigilancia desproporcionada.
- **Práctica responsable:** ejecutar pruebas únicamente en instancias propias, aisladas y con datos sintéticos. No explotar sistemas de terceros ni publicar secretos, datos personales o instrucciones que permitan abusar de una instancia real.

## Responsabilidad civil, penal y organizacional

El acceso, modificación, divulgación, conservación o transferencia ilícita de información de empleados puede generar responsabilidades para la organización y para las personas intervinientes, incluidas consecuencias civiles, administrativas, laborales o penales, según la jurisdicción y los hechos. La autorización del docente o del equipo para este laboratorio solo cubre los activos y pruebas expresamente acordados; no autoriza acciones contra sistemas externos.

La organización debe determinar, con asesoría jurídica competente, qué normas de privacidad, protección de datos, trabajo, seguridad informática, conservación documental y notificación de incidentes son aplicables. Debe definir quién es responsable del tratamiento, quién opera el sistema, qué base y propósito habilitan el tratamiento, cuánto tiempo se conservan los datos y cómo se atienden solicitudes, brechas y órdenes legales. No se presume cumplimiento legal por aprobar las pruebas de este repositorio.

## Datos, pruebas e incidentes

1. No cargar salarios, cuentas, identificadores, credenciales ni currículums reales en ninguna fase del laboratorio.
2. Limitar la API vulnerable a `127.0.0.1`, no publicarla en Internet ni enrutarla a redes corporativas o cloud metadata.
3. Mantener los tokens de demostración fuera de producción y no guardar secretos en capturas, tickets o control de versiones.
4. Usar documentos sintéticos no ejecutables en las pruebas de carga. Revisar y eliminar los artefactos del laboratorio conforme a la política del curso.
5. Ante una exposición accidental, detener el proceso afectado, preservar únicamente la evidencia necesaria con acceso restringido, notificar al responsable docente/seguridad y seguir el procedimiento institucional. No investigar sistemas de terceros ni difundir datos.

## Revisión

Cada integrante debe revisar este manifiesto antes de ejecutar la auditoría. El equipo lo actualiza si cambia el tipo de datos, el alcance, los roles o la infraestructura. Un hallazgo debe describirse con evidencia mínima, impacto, alcance autorizado y recomendación de mitigación; la comunicación no debe incluir más información sensible de la imprescindible.
