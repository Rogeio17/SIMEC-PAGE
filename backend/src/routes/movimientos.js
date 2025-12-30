import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";

import {
  registrarEntradaGeneral,
  registrarSalidaGeneral,
  listarMovimientosGlobal,
  registrarSalida,
  listarMovimientosPorProyecto,
  listarMovimientosPorProyectoYEtapa, // ✅ IMPORTANTE
  ajustarMovimiento
} from "../controllers/movimientosController.js";

const router = express.Router();

// ✅ Todo movimientos requiere login
router.use(requireAuth);

// Entradas/Salidas generales (solo admin)
router.post("/entrada", requireRole("admin"), registrarEntradaGeneral);
router.post("/salida", requireRole("admin"), registrarSalidaGeneral);

// Movimientos globales
router.get("/", listarMovimientosGlobal);

// Salida a proyecto (solo admin si así lo quieres)
router.post("/proyecto/:id/salida", requireRole("admin"), registrarSalida);

// Movimientos de un proyecto (todas las etapas)
router.get("/proyecto/:id/movimientos", listarMovimientosPorProyecto);

// ✅ Movimientos de un proyecto filtrados por etapa
router.get("/proyecto/:id/etapa/:etapaId/movimientos", listarMovimientosPorProyectoYEtapa);

// Si tienes este endpoint, déjalo
router.post("/ajustar/:movimiento_id", ajustarMovimiento);

export default router;
