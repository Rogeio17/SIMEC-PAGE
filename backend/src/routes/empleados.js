import express from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { listarEmpleados, crearEmpleado, actualizarEmpleado } from "../controllers/empleadosController.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", listarEmpleados);

router.post("/", requireRole("admin"), crearEmpleado);
router.put("/:id", requireRole("admin"), actualizarEmpleado);

export default router;
