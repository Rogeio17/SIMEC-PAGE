import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";

import {
  registrarEntradaGeneral,
  registrarSalidaGeneral,
  listarMovimientosGlobal,
  registrarSalida,
  listarMovimientosPorProyecto,
  ajustarMovimiento,
} from "../controllers/movimientosController.js";

const router = express.Router();

// 🔒 Todo movimientos requiere login
router.use(requireAuth);

// ✅ Cualquiera logueado puede VER movimientos
router.get("/", listarMovimientosGlobal);
router.get("/proyecto/:id/movimientos", listarMovimientosPorProyecto);

// 🔒 Solo admin puede registrar entrada/salida general
router.post("/entrada", requireRole("admin"), registrarEntradaGeneral);
router.post("/salida", requireRole("admin"), registrarSalidaGeneral);

// 🔒 Salida a proyecto: SOLO admin (porque mueve stock)
router.post("/proyecto/:id/salida", requireRole("admin"), registrarSalida);

// 🔒 Ajustes: SOLO admin
router.post("/ajustar/:movimiento_id", requireRole("admin"), ajustarMovimiento);

export default router;
