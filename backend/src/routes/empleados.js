import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  listarEmpleados,
  crearEmpleado,
  actualizarEmpleado,
  listarResguardosHerramientas,
  crearResguardoHerramienta,
  devolverResguardoHerramienta,
} from "../controllers/empleadosController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", listarEmpleados);
router.post("/", requireRole("admin"), crearEmpleado);
router.put("/:id", requireRole("admin"), actualizarEmpleado);

router.get("/herramientas/resguardos", listarResguardosHerramientas);
router.post("/herramientas/resguardos", requireRole("admin"), crearResguardoHerramienta);
router.post("/herramientas/resguardos/:id/devolver", requireRole("admin"), devolverResguardoHerramienta);

export default router;
