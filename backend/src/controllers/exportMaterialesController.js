import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import pool from "../config/db.js";

export async function exportMaterialesExcel(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT
         m.id,
         m.codigo,
         m.nombre,
         m.stock_actual,
         m.stock_minimo,
         m.ubicacion,
         p.nombre AS proveedor_nombre,
         m.ticket_numero,
         m.requiere_protocolo,
         m.protocolo_texto,
         m.precio_unitario
       FROM materiales m
       LEFT JOIN proveedores p ON p.id = m.proveedor_id
       WHERE m.activo = 1
       ORDER BY m.id DESC`
    );

    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet("Materiales");

    sh.columns = [
      { header: "ID", key: "id", width: 8 },
      { header: "Código", key: "codigo", width: 15 },
      { header: "Nombre", key: "nombre", width: 30 },
      { header: "Stock", key: "stock_actual", width: 10 },
      { header: "Stock mínimo", key: "stock_minimo", width: 12 },
      { header: "Ubicación", key: "ubicacion", width: 15 },
      { header: "Proveedor", key: "proveedor_nombre", width: 20 },
      { header: "Ticket", key: "ticket_numero", width: 15 },
      { header: "Req. Protocolo", key: "requiere_protocolo", width: 14 },
      { header: "Protocolo", key: "protocolo_texto", width: 25 },
      { header: "Precio unitario", key: "precio_unitario", width: 14 },
    ];

    rows.forEach(r => sh.addRow(r));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=materiales.xlsx");

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ exportMaterialesExcel:", err);
    res.status(500).json({ ok: false, message: "Error al exportar materiales (Excel)" });
  }
}

export async function exportMaterialesPdf(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT codigo, nombre, stock_actual, ubicacion
       FROM materiales
       WHERE activo = 1
       ORDER BY id DESC`
    );

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=materiales.pdf");

    doc.pipe(res);

    doc.fontSize(18).text("Reporte de Materiales", { align: "center" });
    doc.moveDown();

    rows.forEach(r => {
      doc.fontSize(10).text(
        `${r.codigo} - ${r.nombre} | Stock: ${r.stock_actual} | Ubicación: ${r.ubicacion || "-"}`,
        { width: 520 }
      );
    });

    doc.end();
  } catch (err) {
    console.error("❌ exportMaterialesPdf:", err);
    res.status(500).json({ ok: false, message: "Error al exportar materiales (PDF)" });
  }
}
