import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { exportProyectoExcel, exportProyectoPDF } from "../controllers/exportController.js";


import {
  crearProyecto,
  listarProyectos,
  obtenerMaterialesDeProyecto,
  eliminarProyecto,
} from "../controllers/proyectosController.js";

const router = express.Router();

// Exportación de proyectos
router.get("/:id/export/excel", exportProyectoExcel);
router.get("/:id/export/pdf", exportProyectoPDF);

// 🔒 Todo proyectos requiere login
router.use(requireAuth);

// ✅ Cualquiera logueado puede VER proyectos
router.get("/", listarProyectos);

// 🔒 SOLO admin puede CREAR y ELIMINAR proyectos
router.post("/", requireRole("admin"), crearProyecto);
router.put("/eliminar/:id", requireRole("admin"), eliminarProyecto);

// ✅ Cualquiera logueado puede ver materiales del proyecto (si quieres)
router.get("/:id/materiales", obtenerMaterialesDeProyecto);

export default router;
