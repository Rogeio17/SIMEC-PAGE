import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import pool from "../config/db.js";

// Helper: PDF a Buffer
function pdfToBuffer(buildFn) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      buildFn(doc);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

/* ==================== MATERIALES: EXPORT GENERAL ==================== */

export async function exportMaterialesExcel(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, codigo, nombre, stock_actual, stock_minimo, ubicacion, activo
       FROM materiales
       ORDER BY id DESC`
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Materiales");

    ws.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Código", key: "codigo", width: 18 },
      { header: "Nombre", key: "nombre", width: 35 },
      { header: "Stock actual", key: "stock_actual", width: 14 },
      { header: "Stock mínimo", key: "stock_minimo", width: 14 },
      { header: "Ubicación", key: "ubicacion", width: 20 },
      { header: "Activo", key: "activo", width: 10 },
    ];

    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true };

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="materiales.xlsx"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ exportMaterialesExcel:", err);
    res.status(500).json({ ok: false, message: "Error al exportar materiales" });
  }
}

export async function exportMaterialesPDF(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT codigo, nombre, stock_actual, ubicacion
       FROM materiales
       ORDER BY nombre ASC`
    );

    const buffer = await pdfToBuffer((doc) => {
      doc.fontSize(16).text("SIMEC - Reporte de Materiales", { align: "center" });
      doc.moveDown(0.8);
      doc.fontSize(10).text(`Total: ${rows.length}`);
      doc.moveDown(0.8);

      // Encabezados
      doc.fontSize(10).text("Código", 40, doc.y, { continued: true });
      doc.text("Nombre", 140, doc.y, { continued: true });
      doc.text("Stock", 380, doc.y, { continued: true });
      doc.text("Ubicación", 440, doc.y);

      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.4);

      rows.forEach((r) => {
        const y = doc.y;
        doc.text(String(r.codigo ?? ""), 40, y, { width: 90, ellipsis: true });
        doc.text(String(r.nombre ?? ""), 140, y, { width: 230, ellipsis: true });
        doc.text(String(r.stock_actual ?? ""), 380, y, { width: 50 });
        doc.text(String(r.ubicacion ?? ""), 440, y, { width: 115, ellipsis: true });
        doc.moveDown(0.35);

        // salto de página
        if (doc.y > 770) doc.addPage();
      });
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="materiales.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error("❌ exportMaterialesPDF:", err);
    res.status(500).json({ ok: false, message: "Error al exportar materiales PDF" });
  }
}

/* ==================== PROYECTO: EXPORT POR PROYECTO ==================== */

async function getReporteProyecto(idProyecto) {
  // Ajusta nombres de tablas/campos si difieren en tu BD.
  // Esto asume que tus movimientos guardan proyecto_id, material_id, tipo, cantidad, creado_en, comentario
  const [movs] = await pool.query(
    `SELECT m.creado_en, m.tipo, m.cantidad, m.comentario,
            mat.codigo, mat.nombre
     FROM movimientos m
     JOIN materiales mat ON mat.id = m.material_id
     WHERE m.proyecto_id = ?
     ORDER BY m.creado_en ASC`,
    [idProyecto]
  );

  const [proj] = await pool.query(
    `SELECT id, clave, nombre FROM proyectos WHERE id = ?`,
    [idProyecto]
  );

  return { proyecto: proj[0] || null, movimientos: movs };
}

export async function exportProyectoExcel(req, res) {
  try {
    const idProyecto = Number(req.params.id);
    const { proyecto, movimientos } = await getReporteProyecto(idProyecto);

    if (!proyecto) return res.status(404).json({ ok: false, message: "Proyecto no encontrado" });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Movimientos");

    ws.addRow([`Proyecto: ${proyecto.clave} - ${proyecto.nombre}`]);
    ws.addRow([]);
    ws.columns = [
      { header: "Fecha", key: "creado_en", width: 22 },
      { header: "Código", key: "codigo", width: 18 },
      { header: "Material", key: "nombre", width: 35 },
      { header: "Tipo", key: "tipo", width: 12 },
      { header: "Cantidad", key: "cantidad", width: 12 },
      { header: "Comentario", key: "comentario", width: 30 },
    ];

    // Encabezado en fila 3 (por el título y el salto)
    ws.getRow(3).font = { bold: true };

    movimientos.forEach((m) => ws.addRow(m));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="proyecto_${proyecto.clave}_movimientos.xlsx"`
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ exportProyectoExcel:", err);
    res.status(500).json({ ok: false, message: "Error al exportar proyecto" });
  }
}

export async function exportProyectoPDF(req, res) {
  try {
    const idProyecto = Number(req.params.id);
    const { proyecto, movimientos } = await getReporteProyecto(idProyecto);

    if (!proyecto) return res.status(404).json({ ok: false, message: "Proyecto no encontrado" });

    const buffer = await pdfToBuffer((doc) => {
      doc.fontSize(16).text("SIMEC - Reporte de Proyecto", { align: "center" });
      doc.moveDown(0.7);
      doc.fontSize(12).text(`${proyecto.clave} - ${proyecto.nombre}`);
      doc.moveDown(0.5);
      doc.fontSize(10).text(`Movimientos: ${movimientos.length}`);
      doc.moveDown(0.7);

      doc.fontSize(10).text("Fecha", 40, doc.y, { continued: true });
      doc.text("Material", 150, doc.y, { continued: true });
      doc.text("Tipo", 390, doc.y, { continued: true });
      doc.text("Cant.", 440, doc.y);

      doc.moveDown(0.3);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(0.4);

      movimientos.forEach((mv) => {
        const fecha = mv.creado_en ? new Date(mv.creado_en).toLocaleString() : "";
        const material = `${mv.codigo ?? ""} - ${mv.nombre ?? ""}`;

        const y = doc.y;
        doc.text(fecha, 40, y, { width: 105, ellipsis: true });
        doc.text(material, 150, y, { width: 235, ellipsis: true });
        doc.text(String(mv.tipo ?? ""), 390, y, { width: 45 });
        doc.text(String(mv.cantidad ?? ""), 440, y, { width: 50 });

        doc.moveDown(0.35);
        if (doc.y > 770) doc.addPage();
      });
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="proyecto_${proyecto.clave}_movimientos.pdf"`
    );
    res.send(buffer);
  } catch (err) {
    console.error("❌ exportProyectoPDF:", err);
    res.status(500).json({ ok: false, message: "Error al exportar proyecto PDF" });
  }
}
