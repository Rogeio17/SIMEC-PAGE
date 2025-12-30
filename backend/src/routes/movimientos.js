import express from "express";

import {
  registrarEntradaGeneral,
  registrarSalidaGeneral,
  listarMovimientosGlobal,
  registrarSalida,
  listarMovimientosPorProyecto,
  ajustarMovimiento
} from "../controllers/movimientosController.js";

const router = express.Router();

router.use(requireAuth);

router.post("/entrada", requireRole("admin"), entrada);
router.post("/salida", requireRole("admin"), salida);

router.get("/", listarMovimientosGlobal);

router.post("/proyecto/:id/salida", registrarSalida);

router.get("/proyecto/:id/movimientos", listarMovimientosPorProyecto);

router.post("/ajustar/:movimiento_id", ajustarMovimiento);

export default router;
