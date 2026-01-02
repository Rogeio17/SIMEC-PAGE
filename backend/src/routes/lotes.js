import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { ajustarLote } from "../controllers/lotesController.js";

const router = express.Router();

router.use(requireAuth);

// Ajustar cantidad del lote (sin crear lote nuevo)
router.post("/:loteId/ajustar", requireRole("admin"), ajustarLote);

export default router;
