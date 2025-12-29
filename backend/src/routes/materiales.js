import express from "express";
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


router.post("/", crearMaterial);     
router.get("/", listarMateriales);    
router.put("/:id", actualizarMaterial); 
router.put("/eliminar/:id", eliminarMaterial);


router.post("/entrada", registrarEntradaGeneral);  
router.post("/salida", registrarSalidaGeneral);    

export default router;
