import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { listarEmpleados, crearEmpleado, actualizarEmpleado } from "../controllers/empleadosController.js";

const router = express.Router();

router.use(requireAuth);

// listar (todos o solo activos con ?activo=1)
router.get("/", listarEmpleados);

// crear / actualizar (solo admin)
router.post("/", requireRole("admin"), crearEmpleado);
router.put("/:id", requireRole("admin"), actualizarEmpleado);

export default router;
