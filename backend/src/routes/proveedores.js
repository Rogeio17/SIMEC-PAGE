import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { listarProveedores, crearProveedor, actualizarProvedor,activarProveedor, desactivarProveedor, } from "../controllers/proveedoresController.js";

const router = Router();

router.use(requireAuth);


router.get("/", listarProveedores);
router.put("/:id", requireRole("admin"), actualizarProvedor);
router.patch("/:id/activar", requireRole("admin"), activarProveedor);
router.patch("/:id/desactivar", requireRole("admin"), desactivarProveedor);
router.post("/", requireRole("admin"), crearProveedor);

export default router;
