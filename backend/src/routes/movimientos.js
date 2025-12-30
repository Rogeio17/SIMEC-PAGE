import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";

import {
  registrarEntradaGeneral,
  registrarSalidaGeneral,
  listarMovimientosGlobal,
  registrarSalida,
  listarMovimientosPorProyecto,
  listarMovimientosPorProyectoYEtapa,
  ajustarMovimiento
} from "../controllers/movimientosController.js";

const router = express.Router();

router.use(requireAuth);

router.post("/entrada", requireRole("admin"), registrarEntradaGeneral);
router.post("/salida", requireRole("admin"), registrarSalidaGeneral);

router.get("/", listarMovimientosGlobal);

router.post("/proyecto/:id/salida", requireRole("admin"), registrarSalida);
router.get("/proyecto/:id/movimientos", listarMovimientosPorProyecto);
router.get("/proyecto/:id/etapa/:etapaId/movimientos", listarMovimientosPorProyectoYEtapa);

// compatibilidad (si no lo usas, igual no falla)
router.post("/ajustar/:movimiento_id", ajustarMovimiento);

export default router;
