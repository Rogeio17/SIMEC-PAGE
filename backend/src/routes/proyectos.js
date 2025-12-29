import express from "express";
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

/* ----------- MATERIALES DEL PROYECTO ----------- */
router.get("/:id/materiales", obtenerMaterialesDeProyecto);

export default router;

