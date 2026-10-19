USE `u327351184_personal_hub`;

-- Todos los invitados y su última respuesta.
SELECT id, nombre, telefono, asistencia, personas, mensaje,
       fecha_confirmacion, fecha_actualizacion
FROM boda_confirmaciones
ORDER BY fecha_actualizacion DESC;

-- Personas confirmadas, personas que no asistirán y aforo esperado.
SELECT
  COUNT(*) AS respuestas_totales,
  SUM(asistencia = 'si') AS registros_confirmados,
  SUM(asistencia = 'no') AS registros_no_asistiran,
  COALESCE(SUM(CASE WHEN asistencia = 'si' THEN personas ELSE 0 END), 0) AS personas_confirmadas
FROM boda_confirmaciones;

-- Solo asistentes confirmados.
SELECT nombre, telefono, personas, mensaje, fecha_actualizacion
FROM boda_confirmaciones
WHERE asistencia = 'si'
ORDER BY nombre;
