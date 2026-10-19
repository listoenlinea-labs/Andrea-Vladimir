-- Base de datos que aparece en tu captura de MySQL Workbench / Hostinger.
-- Este script NO modifica las tablas existentes (Director y Movies).
USE `u327351184_personal_hub`;

CREATE TABLE IF NOT EXISTS `boda_confirmaciones` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(120) NOT NULL,
  `telefono` CHAR(10) NOT NULL,
  `asistencia` ENUM('si', 'no') NOT NULL,
  `personas` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `mensaje` VARCHAR(500) NULL,
  `consentimiento_privacidad` TINYINT(1) NOT NULL DEFAULT 1,
  `fecha_confirmacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_actualizacion` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_boda_confirmaciones_telefono` (`telefono`),
  KEY `idx_boda_confirmaciones_asistencia` (`asistencia`),
  CONSTRAINT `chk_boda_personas` CHECK (
    (`asistencia` = 'si' AND `personas` BETWEEN 1 AND 10)
    OR (`asistencia` = 'no' AND `personas` = 0)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comprobar que se creó correctamente:
SHOW CREATE TABLE `boda_confirmaciones`;
