import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  crearMaterial,
  listarMateriales,
  actualizarMaterial,
  eliminarMaterial
} from "../controllers/materialesController.js";

const router = express.Router();

// Todo materiales requiere login
router.use(requireAuth);

// Listar (cualquier usuario logueado)
router.get("/", listarMateriales);

// CRUD (solo admin)
router.post("/", requireRole("admin"), crearMaterial);
router.put("/:id", requireRole("admin"), actualizarMaterial);
router.delete("/:id", requireRole("admin"), eliminarMaterial);

export default router;
