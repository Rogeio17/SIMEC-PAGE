import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  listarVehiculos,
  crearVehiculo,
  actualizarVehiculo,
  listarMantenimientos,
  crearMantenimiento,
  listarAlertasVehiculos,
} from "../controllers/vehiculosController.js";

const router = Router();
router.use(requireAuth);

router.get("/", listarVehiculos);
router.post("/", requireRole("admin"), crearVehiculo);
router.put("/:id", requireRole("admin"), actualizarVehiculo);

router.get("/alertas", listarAlertasVehiculos);
router.get("/:vehiculoId/mantenimientos", listarMantenimientos);
router.post("/:vehiculoId/mantenimientos", requireRole("admin"), crearMantenimiento);

export default router;
