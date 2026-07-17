import express from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import morgan  from 'morgan';
import dotenv  from 'dotenv';
import path    from 'path';
import fs      from 'fs';

import { testConnection, ensureSchemaPatches } from './config/database';
import { invalidateProfilsCardiologuesColumnCache } from './utils/schemaCompat.utils';
import { verifyMailer }   from './config/mailer';
import { initFirebase }   from './config/firebase';
import { verifyAgora }    from './config/agora';
import { demarrerScheduler } from './services/scheduler.service';

import authRoutes         from './routes/auth.routes';
import mesureRoutes       from './routes/mesure.routes';
import medicamentRoutes   from './routes/medicament.routes';
import ordonnanceRoutes   from './routes/ordonnance.routes';
import rappelRoutes       from './routes/rappel.routes';
import messageRoutes      from './routes/message.routes';
import notificationRoutes from './routes/notification.routes';
import dashboardRoutes    from './routes/dashboard.routes';
import rapportRoutes      from './routes/rapport.routes';
import profilRoutes       from './routes/profil.routes';
import adminRoutes        from './routes/admin.routes';
import localisationRoutes from './routes/localisation.routes';
import telemedicineRoutes    from './routes/telemedicine.routes';
import patientsRoutes        from './routes/patients.routes';
import disponibilitesRoutes  from './routes/disponibilites.routes';
import assignationRoutes     from './routes/assignation.routes';
import assistantRoutes       from './routes/assistant.routes';
import chatRoutes            from './routes/chat.routes';

dotenv.config();

const app  = express();
const PORT = Number(process.env.PORT) || 5000;
/** 0.0.0.0 : accessible depuis le réseau local (téléphone / tablette), pas seulement localhost */
const HOST = process.env.HOST || '0.0.0.0';

// Middlewares — CORP cross-origin pour que /uploads (photos profil) s’affichent depuis le front (autre port / domaine)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth',          authRoutes);
app.use('/api/mesures',       mesureRoutes);
app.use('/api/medicaments',   medicamentRoutes);
app.use('/api/ordonnances',   ordonnanceRoutes);
app.use('/api/rappels',       rappelRoutes);
app.use('/api/messages',      messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard',     dashboardRoutes);
app.use('/api/rapports',      rapportRoutes);
app.use('/api/profil',        profilRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/localisation',  localisationRoutes);
app.use('/api/rendez-vous',   telemedicineRoutes);
app.use('/api/patients',      patientsRoutes);
app.use('/api/disponibilites',disponibilitesRoutes);
app.use('/api/assignation',   assignationRoutes);
app.use('/api/assistant',    assistantRoutes);
app.use('/api/patient',     chatRoutes);

function lireVersionApi(): string {
  try {
    const pkgPath = path.join(__dirname, '../package.json');
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const v = (JSON.parse(raw) as { version?: string }).version;
    return typeof v === 'string' && v.trim() ? v.trim() : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Health check (clients web / mobile : disponibilité + repère de version)
app.get('/api/health', (_req, res) => {
  res.json({
    status:     'OK',
    message:    'HyperTrack API operationnelle',
    version:    lireVersionApi(),
    serverTime: new Date().toISOString(),
  });
});

const start = async () => {
  try {
    const databaseConnected = await testConnection();
    if (databaseConnected) {
      await ensureSchemaPatches();
      invalidateProfilsCardiologuesColumnCache();
    } else {
      console.warn('⚠️  Schéma DB non vérifié: MySQL indisponible au démarrage.');
    }
    await verifyMailer();
    initFirebase();
    verifyAgora();
    demarrerScheduler();

    app.listen(PORT, HOST, () => {
      console.log(`🚀 API sur le port ${PORT} (toutes interfaces : ${HOST})`);
      console.log(`   → http://localhost:${PORT}/api/health`);
      console.log(`   → depuis un appareil sur le Wi-Fi : http://<IPv4-de-ce-PC>:${PORT}/api/health`);
    });

  } catch (error) {
    console.error('❌ Erreur au démarrage:', error);
    process.exit(1);
  }
};

start();

export default app;
