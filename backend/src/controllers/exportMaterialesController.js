import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "../config/db.js";

/* ==================== PDF TEMPLATE (LOGO + HEADER) ==================== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.join(__dirname, "..", "assets", "simec-logo.jpg");

function drawSimecHeader(doc, { title }) {
  const left = doc.page.margins.left;
  const top = 22;
  const pageWidth = doc.page.width;
  const right = pageWidth - doc.page.margins.right;

  // Logo
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, left, top, { width: 150 });
    }
  } catch {
    // no-op if logo fails
  }

  // Text block
  const textX = left + 165;
  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("SIMEC INGENIERIA", textX, top + 6, { width: right - textX, align: "right" });
  doc
    .font("Helvetica")
    .fontSize(9)
    .text("SOLUCIÓN INTEGRAL DE SISTEMAS ELÉCTRICOS", textX, top + 26, {
      width: right - textX,
      align: "right",
    });

  doc.moveTo(left, 78).lineTo(right, 78).lineWidth(1).strokeColor("#C8C8C8").stroke();

  doc
    .fillColor("#111")
    .font("Helvetica-Bold")
    .fontSize(13)
    .text(title, left, 90, { width: right - left, align: "left" });

  const now = new Date();
  const meta = `Fecha: ${now.toLocaleDateString()}  Hora: ${now.toLocaleTimeString()}`;
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#444")
    .text(meta, left, 110, { width: right - left, align: "left" });

  doc.fillColor("#111");
  doc.y = 135;
}

function drawSimpleTable(doc, { columns, rows }) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const tableWidth = right - left;
  const startY = doc.y;
  const rowH = 18;

  const totalColW = columns.reduce((s, c) => s + c.w, 0);
  const colWs = columns.map(c => (c.w / totalColW) * tableWidth);

  function ensureSpace(extra = rowH * 2) {
    if (doc.y + extra > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  }

  // Header row
  ensureSpace();
  let x = left;
  doc.font("Helvetica-Bold").fontSize(9);
  columns.forEach((c, i) => {
    doc.text(c.label, x + 2, doc.y + 4, { width: colWs[i] - 4, align: c.align || "left" });
    x += colWs[i];
  });
  doc
    .moveTo(left, doc.y + rowH)
    .lineTo(right, doc.y + rowH)
    .lineWidth(1)
    .strokeColor("#C8C8C8")
    .stroke();
  doc.y += rowH;

  // Body rows
  doc.font("Helvetica").fontSize(9);
  rows.forEach(r => {
    ensureSpace();
    let xx = left;
    columns.forEach((c, i) => {
      const val = r[c.key] ?? "";
      doc.text(String(val), xx + 2, doc.y + 4, { width: colWs[i] - 4, align: c.align || "left" });
      xx += colWs[i];
    });
    doc.y += rowH;
  });

  doc
    .moveTo(left, doc.y + 2)
    .lineTo(right, doc.y + 2)
    .lineWidth(1)
    .strokeColor("#E3E3E3")
    .stroke();
  doc.y = Math.max(doc.y + 10, startY + 10);
}

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

    const applyHeader = () => drawSimecHeader(doc, { title: "Reporte de Materiales" });
    applyHeader();
    doc.on("pageAdded", applyHeader);

    drawSimpleTable(doc, {
      columns: [
        { label: "Código", w: 18 },
        { label: "Material", w: 52 },
        { label: "Stock", w: 15, align: "right" },
        { label: "Ubicación", w: 15 },
      ],
      rows: rows.map(r => [
        r.codigo,
        r.nombre,
        String(r.stock_actual ?? 0),
        r.ubicacion || "-",
      ]),
    });

    doc.end();
  } catch (err) {
    console.error("❌ exportMaterialesPdf:", err);
    res.status(500).json({ ok: false, message: "Error al exportar materiales (PDF)" });
  }
}
