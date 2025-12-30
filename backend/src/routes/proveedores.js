import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { listarProveedores, crearProveedor } from "../controllers/proveedoresController.js";

const router = Router();

router.use(requireAuth);

// cualquiera logueado puede listar proveedores
router.get("/", listarProveedores);

// solo admin puede crear
router.post("/", requireRole("admin"), crearProveedor);

export default router;
