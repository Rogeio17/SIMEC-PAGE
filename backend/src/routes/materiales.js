import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";

import {
  crearMaterial,
  listarMateriales,
  actualizarMaterial,
  eliminarMaterial,
} from "../controllers/materialesController.js";

import {
  registrarEntradaGeneral,
  registrarSalidaGeneral,
} from "../controllers/movimientosController.js";

const router = express.Router();

// 🔒 Todo materiales requiere login
router.use(requireAuth);

// ✅ Cualquiera logueado puede VER materiales
router.get("/", listarMateriales);

// 🔒 Solo admin puede CREAR/EDITAR/ELIMINAR (Admin Almacén)
router.post("/", requireRole("admin"), crearMaterial);
router.put("/:id", requireRole("admin"), actualizarMaterial);
router.delete("/:id", requireRole("admin"), eliminarMaterial);

// 🔒 Movimientos de stock desde materiales: SOLO admin
router.post("/entrada", requireRole("admin"), registrarEntradaGeneral);
router.post("/salida", requireRole("admin"), registrarSalidaGeneral);

export default router;
