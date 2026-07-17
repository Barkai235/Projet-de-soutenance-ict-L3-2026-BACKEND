import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import AssistantController from '../controllers/assistant.controller';

const router = Router();
router.use(authenticate);
router.use(authorize('patient'));

router.post('/message', AssistantController.message);

export default router;
