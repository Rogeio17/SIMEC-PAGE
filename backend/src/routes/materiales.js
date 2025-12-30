import express from "express";
import { requiereAutch, requiereRole} from "../middlewares/auth.js";
import {
  crearMaterial,
  listarMateriales,
  actualizarMaterial
} from "../controllers/materialesController.js";

import {
  registrarEntradaGeneral,
  registrarSalidaGeneral
} from "../controllers/movimientosController.js";

import { 
  eliminarMaterial } from "../controllers/materialesController.js";

const router = express.Router();

router.use(requiereAutch);

router.get("/", listarMateriales); 

router.post("/", requireRole("admin"), crearMaterial);
router.put("/:id", requireRole("admin"), actualizarMaterial);
router.delete("/:id", requireRole("admin"), eliminarMaterial);

router.post("/entrada", registrarEntradaGeneral);  
router.post("/salida", registrarSalidaGeneral);    

export default router;
