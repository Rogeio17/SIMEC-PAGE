import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  crearProyecto,
  listarProyectos
} from "../controllers/proyectosController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", listarProyectos);
router.post("/", requireRole("admin"), crearProyecto);

export default router;
