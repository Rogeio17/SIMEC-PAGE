import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const hdr = req.headers.authorization || "";
    const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ ok: false, message: "No autenticado" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; 
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "Token inválido" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, message: "No autenticado" });
    if (!roles.includes(req.user.rol)) return res.status(403).json({ ok: false, message: "Sin permisos" });
    next();
  };
}
