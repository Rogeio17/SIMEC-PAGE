import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  listarEtapasProyecto,
  crearEtapaProyecto,
  cerrarEtapa,
  obtenerEtapaActiva,
} from "../controllers/etapasController.js";

const router = Router();

router.use(requireAuth);

// ver etapas de un proyecto
router.get("/proyectos/:id/etapas", listarEtapasProyecto);

// obtener etapa activa
router.get("/proyectos/:id/etapas/activa", obtenerEtapaActiva);

// crear etapa (admin)
router.post("/proyectos/:id/etapas", requireRole("admin"), crearEtapaProyecto);

// cerrar etapa (admin)
router.post("/etapas/:etapaId/cerrar", requireRole("admin"), cerrarEtapa);

export default router;
