import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";

import { crearProyecto, listarProyectos } from "../controllers/proyectosController.js";
import { exportProyectoExcel, exportProyectoPdf } from "../controllers/exportController.js";

const router = express.Router();

router.use(requireAuth);

// listar proyectos (cualquier usuario logueado)
router.get("/", listarProyectos);

// crear proyecto (solo admin)
router.post("/", requireRole("admin"), crearProyecto);

// ✅ EXPORTS POR PROYECTO (como antes)
router.get("/:id/export/excel", requireRole("admin"), exportProyectoExcel);
router.get("/:id/export/pdf", requireRole("admin"), exportProyectoPdf);

export default router;
