export function errorHandler(err, _req, res, _next) {
  console.error("❌ Error:", err);

  const status = err.statusCode || 500;
  res.status(status).json({
    ok: false,
    message: err.message || "Error interno del servidor",
  });
}
