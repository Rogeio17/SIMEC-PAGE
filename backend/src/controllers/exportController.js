import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import pool from "../config/db.js";

/* ==================== EXPORT PROYECTO EXCEL ==================== */
export async function exportProyectoExcel(req, res) {
  try {
    const proyectoId = Number(req.params.id);

    const [rows] = await pool.query(
      `SELECT
         p.clave AS proyecto_clave,
         p.nombre AS proyecto_nombre,
         e.nombre AS etapa_nombre,
         m.codigo AS material_codigo,
         m.nombre AS material_nombre,
         mv.cantidad,
         mv.tipo,
         mv.comentario,
         mv.creado_en,
         u.nombre AS usuario_nombre,
         u.email AS usuario_email,
         m.precio_unitario,
         (IFNULL(m.precio_unitario,0) * mv.cantidad) AS total
       FROM movimientos mv
       JOIN proyectos p ON p.id = mv.proyecto_id
       LEFT JOIN proyecto_etapas e ON e.id = mv.etapa_id
       JOIN materiales m ON m.id = mv.material_id
       LEFT JOIN usuarios u ON u.id = mv.usuario_id
       WHERE mv.proyecto_id = ?
       ORDER BY mv.creado_en ASC`,
      [proyectoId]
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Proyecto");

    sheet.columns = [
      { header: "Proyecto", key: "proyecto_nombre", width: 25 },
      { header: "Etapa", key: "etapa_nombre", width: 20 },
      { header: "Código", key: "material_codigo", width: 15 },
      { header: "Material", key: "material_nombre", width: 30 },
      { header: "Cantidad", key: "cantidad", width: 10 },
      { header: "Precio unitario", key: "precio_unitario", width: 15 },
      { header: "Total", key: "total", width: 15 },
      { header: "Usuario", key: "usuario_nombre", width: 20 },
      { header: "Fecha", key: "creado_en", width: 20 },
      { header: "Comentario", key: "comentario", width: 30 }
    ];

    rows.forEach(r => sheet.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=proyecto_${proyectoId}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ exportProyectoExcel:", err);
    res.status(500).json({ ok: false, message: "Error al exportar Excel" });
  }
}

/* ==================== EXPORT PROYECTO PDF ==================== */
export async function exportProyectoPdf(req, res) {
  try {
    const proyectoId = Number(req.params.id);

    const [rows] = await pool.query(
      `SELECT
         p.nombre AS proyecto_nombre,
         e.nombre AS etapa_nombre,
         m.nombre AS material_nombre,
         mv.cantidad,
         mv.creado_en,
         m.precio_unitario,
         (IFNULL(m.precio_unitario,0) * mv.cantidad) AS total
       FROM movimientos mv
       JOIN proyectos p ON p.id = mv.proyecto_id
       LEFT JOIN proyecto_etapas e ON e.id = mv.etapa_id
       JOIN materiales m ON m.id = mv.material_id
       WHERE mv.proyecto_id = ?
       ORDER BY mv.creado_en ASC`,
      [proyectoId]
    );

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=proyecto_${proyectoId}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(18).text("Reporte de Proyecto", { align: "center" });
    doc.moveDown();

    let totalGeneral = 0;

    rows.forEach(r => {
      totalGeneral += Number(r.total || 0);

      doc
        .fontSize(10)
        .text(
          `Etapa: ${r.etapa_nombre || "-"} | Material: ${r.material_nombre} | Cantidad: ${r.cantidad} | Total: $${r.total}`,
          { width: 520 }
        );
    });

    doc.moveDown();
    doc.fontSize(12).text(`TOTAL GENERAL: $${totalGeneral}`, {
      align: "right"
    });

    doc.end();
  } catch (err) {
    console.error("❌ exportProyectoPdf:", err);
    res.status(500).json({ ok: false, message: "Error al exportar PDF" });
  }
}
