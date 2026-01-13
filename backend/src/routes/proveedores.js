import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import { listarProveedores, crearProveedor, actualizarProvedor,activarProveedor, desactivarProveedor, } from "../controllers/proveedoresController.js";

const router = Router();

router.use(requireAuth);


router.get("/", listarProveedores);
router.post("/", requireRole("admin"), crearProveedor);
router.put("/:id", requireRole("admin"), actualizarProvedor);
router.patch("/:id/activar", requireRole("admin"), activarProveedor);
router.patch("/:id/desactivar", requireRole("admin"), desactivarProveedor);


export default router;
