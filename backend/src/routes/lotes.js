import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  actualizarLote,
  ajustarCantidadLote,
  eliminarLote,
} from "../controllers/materialLotesController.js";

const router = express.Router();

router.use(requireAuth);


router.put("/:loteId", requireRole("admin"), actualizarLote);


router.post("/:loteId/ajustar", requireRole("admin"), ajustarCantidadLote);


router.delete("/:loteId", requireRole("admin"), eliminarLote);

export default router;
