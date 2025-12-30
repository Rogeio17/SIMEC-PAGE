import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";

import {
  crearProyecto,
  listarProyectos,
  obtenerMaterialesDeProyecto
} from "../controllers/proyectosController.js";

import {
  eliminarProyecto } from "../controllers/proyectosController.js";

const router = express.Router();

/* ----------- PROYECTOS ----------- */
router.post("/", crearProyecto);
router.get("/", listarProyectos);
router.put("/eliminar/:id", eliminarProyecto);
router.use(requireAuth);
router.get("/", listarProyectos);

/* ----------- MATERIALES DEL PROYECTO ----------- */
router.get("/:id/materiales", obtenerMaterialesDeProyecto);
router.post("/", requireRole("admin"), crearProyecto);

export default router;

