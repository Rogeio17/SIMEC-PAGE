import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";

import {
  crearMaterial,
  listarMateriales,
  actualizarMaterial,
  eliminarMaterial
} from "../controllers/materialesController.js";

import {
  exportMaterialesExcel,
  exportMaterialesPdf
} from "../controllers/exportMaterialesController.js";

const router = express.Router();

router.use(requireAuth);

// ✅ EXPORT (primero para que se vea claro)
router.get("/export/excel", requireRole("admin"), exportMaterialesExcel);
router.get("/export/pdf", requireRole("admin"), exportMaterialesPdf);

// LISTAR
router.get("/", listarMateriales);

// CRUD admin
router.post("/", requireRole("admin"), crearMaterial);
router.put("/:id", requireRole("admin"), actualizarMaterial);
router.delete("/:id", requireRole("admin"), eliminarMaterial);

export default router;
