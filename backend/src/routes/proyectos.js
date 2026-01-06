import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { crearProyecto, listarProyectos, borrarProyecto, archivarProyecto,restaurarProyecto } from "../controllers/proyectosController.js";

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
router.delete("/:id", requireRole("admin"), borrarProyecto);


router.get("/:id/export/excel", exportProyectoExcel);
router.get("/:id/export/pdf", exportProyectoPdf);


router.get("/:id/etapas/:etapaId/export/excel", exportEtapaExcel);
router.get("/:id/etapas/:etapaId/export/pdf", exportEtapaPdf);
router.patch("/:id/archivar", requireRole("admin"), archivarProyecto);
router.delete("/:id", requireRole("admin"), borrarProyecto);
router.patch("/:id/restaurar", requireRole("admin"), restaurarProyecto);

export default router;
