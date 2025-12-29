import { Router } from "express";
import { crearUsuario, listarUsuarios } from "../controllers/usersController.js";
import { requireAuth, requireRole } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", listarUsuarios);
router.post("/", crearUsuario);

export default router;
