import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import { crearProyecto, listarProyectos } from "../controllers/proyectosController.js";
import {
  exportProyectoExcel,
  exportProyectoPdf,
  exportEtapaExcel,
  exportEtapaPdf
} from "../controllers/exportController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", listarProyectos);
router.post("/", crearProyecto);

// Export proyecto completo
router.get("/:id/export/excel", exportProyectoExcel);
router.get("/:id/export/pdf", exportProyectoPdf);

// ✅ Export por etapa
router.get("/:id/etapas/:etapaId/export/excel", exportEtapaExcel);
router.get("/:id/etapas/:etapaId/export/pdf", exportEtapaPdf);

export default router;
