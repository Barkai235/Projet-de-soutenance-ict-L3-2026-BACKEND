import multer  from 'multer';
import path    from 'path';
import fs      from 'fs';

// Créer le dossier uploads si inexistant
const uploadDir = path.join(__dirname, '../../uploads/photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext    = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `photo-${unique}${ext}`);
  },
});

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/pjpeg',
  'image/x-png',
]);

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const okMime = ALLOWED_MIME.has(file.mimetype);
  // Certains navigateurs / mobiles envoient application/octet-stream malgré une image valide
  const okOctet =
    file.mimetype === 'application/octet-stream' && ALLOWED_EXT.has(ext);
  if (okMime || okOctet) {
    cb(null, true);
  } else {
    cb(new Error('Format non supporté. Utilisez JPG, PNG ou WebP.'));
  }
};

export const uploadPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});