import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mysql from 'mysql2/promise';

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = requiredEnv.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Faltan variables de entorno obligatorias: ${missing.join(', ')}`);
  process.exit(1);
}

const port = Number(process.env.PORT || 3000);
const allowedOrigins = String(process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);
if (!allowedOrigins.length) {
  console.error('Configura FRONTEND_ORIGINS antes de iniciar el servidor.');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 20,
  timezone: 'Z'
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // Hostinger/reverse proxy: configurar al número real de proxies si difiere.
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no autorizado'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '8kb' }));
app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiados intentos. Espera 15 minutos y vuelve a intentar.' }
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    console.error('Error de salud de MySQL:', error.code || error.message);
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.post('/api/rsvp', submissionLimiter, async (req, res) => {
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ ok: false, message: 'Envía los datos de confirmación.' });
  }
  // Honeypot: bots rellenan un campo que las personas nunca ven.
  if (req.body.website) return res.status(400).json({ ok: false, message: 'Solicitud inválida.' });

  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim().replace(/\s+/g, ' ') : '';
  const telefono = typeof req.body.telefono === 'string' ? req.body.telefono.replace(/\D/g, '') : '';
  const asistencia = req.body.asistencia;
  const personas = Number(req.body.personas);
  const mensaje = typeof req.body.mensaje === 'string' ? req.body.mensaje.trim() : '';

  if (nombre.length < 3 || nombre.length > 120 || /[\x00-\x1f\x7f]/.test(nombre)) {
    return res.status(422).json({ ok: false, message: 'Escribe un nombre válido (3 a 120 caracteres).' });
  }
  if (!/^\d{10}$/.test(telefono)) {
    return res.status(422).json({ ok: false, message: 'El teléfono debe tener 10 dígitos.' });
  }
  if (!['si', 'no'].includes(asistencia)) {
    return res.status(422).json({ ok: false, message: 'Selecciona una respuesta de asistencia.' });
  }
  if (!Number.isInteger(personas) || (asistencia === 'si' && (personas < 1 || personas > 10)) || (asistencia === 'no' && personas !== 0)) {
    return res.status(422).json({ ok: false, message: 'La cantidad de personas no es válida.' });
  }
  if (mensaje.length > 500 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(mensaje)) {
    return res.status(422).json({ ok: false, message: 'El mensaje no puede exceder 500 caracteres.' });
  }
  if (req.body.consentimiento !== true) {
    return res.status(422).json({ ok: false, message: 'Se necesita consentimiento para registrar tus datos.' });
  }

  try {
    // El teléfono identifica una sola confirmación; un segundo envío la actualiza.
    // Consultas parametrizadas: no interpolamos los valores de invitados en SQL.
    await pool.execute(`
      INSERT INTO boda_confirmaciones
      (nombre, telefono, asistencia, personas, mensaje, consentimiento_privacidad)
      VALUES (?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre),
        asistencia = VALUES(asistencia),
        personas = VALUES(personas),
        mensaje = VALUES(mensaje),
        consentimiento_privacidad = 1,
        fecha_actualizacion = CURRENT_TIMESTAMP
    `, [nombre, telefono, asistencia, personas, mensaje || null]);

    return res.status(200).json({ ok: true, message: 'Confirmación guardada correctamente.' });
  } catch (error) {
    console.error('Error al guardar confirmación:', error.code || error.message);
    return res.status(500).json({ ok: false, message: 'No fue posible guardar la confirmación. Inténtalo en unos minutos.' });
  }
});

app.use((error, _req, res, _next) => {
  console.error('Error API:', error.message);
  res.status(error.type === 'entity.too.large' ? 413 : 400)
    .json({ ok: false, message: 'Solicitud inválida o sitio de origen no autorizado.' });
});

const server = app.listen(port, () => {
  console.log(`API de boda escuchando en puerto ${port}`);
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(async () => { await pool.end(); process.exit(0); });
  });
}
