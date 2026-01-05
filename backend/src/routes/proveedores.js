import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { listarProveedores, crearProveedor } from "../controllers/proveedoresController.js";

const router = Router();

router.use(requireAuth);


router.get("/", listarProveedores);


router.post("/", requireRole("admin"), crearProveedor);

export default router;
