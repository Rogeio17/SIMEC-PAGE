import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";

import {
  crearMaterial,
  listarMateriales,
  listarCatalogoMateriales,
  agregarTagMaterial,
  quitarTagMaterial,
  actualizarMaterial,
  eliminarMaterial
} from "../controllers/materialesController.js";

import {
  exportMaterialesExcel,
  exportMaterialesPdf
} from "../controllers/exportMaterialesController.js";

import {
  listarLotesDeMaterial,
  crearLoteParaMaterial
} from "../controllers/materialLotesController.js";

const router = express.Router();

router.use(requireAuth);


router.get("/export/excel", requireRole("admin"), exportMaterialesExcel);
router.get("/export/pdf", requireRole("admin"), exportMaterialesPdf);


router.get("/", listarMateriales);

// Catálogo (con etiquetas)
router.get("/catalogo", listarCatalogoMateriales);

// Etiquetas por material
router.post("/:id/tags", requireRole("admin"), agregarTagMaterial);
router.delete("/:id/tags/:tagId", requireRole("admin"), quitarTagMaterial);


router.post("/", requireRole("admin"), crearMaterial);
router.put("/:id", requireRole("admin"), actualizarMaterial);
router.delete("/:id", requireRole("admin"), eliminarMaterial);


router.get("/:materialId/lotes", requireRole("admin"), listarLotesDeMaterial);
router.post("/:materialId/lotes", requireRole("admin"), crearLoteParaMaterial);

export default router;
