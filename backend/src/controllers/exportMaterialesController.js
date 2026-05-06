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
const SIMEC_RED = "#b91c1c";

function drawSimecHeader(doc, title) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, left, 18, { width: 140 });
    }
  } catch {}

  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .fillColor("#111")
    .text("SIMEC INGENIERIA", left + 160, 22, {
      width: right - (left + 160),
      align: "right",
    });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#444")
    .text("SOLUCIÓN INTEGRAL DE SISTEMAS ELÉCTRICOS", left + 160, 40, {
      width: right - (left + 160),
      align: "right",
    });

  doc.moveTo(left, 70).lineTo(right, 70).lineWidth(1).strokeColor(SIMEC_RED).stroke();

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#111")
    .text(title, left, 82);

  const now = new Date();
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#666")
    .text(
      `Fecha: ${now.toLocaleDateString()}  Hora: ${now.toLocaleTimeString()}`,
      left,
      100
    );

  doc.fillColor("#111");
  doc.y = 120;
}

function drawSimpleTable(doc, columns, rows) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // Renglones compactos: todo queda dentro de la misma raya/fila.
  const headerH = 16;
  const rowH = 15;
  const fontSize = 9.2;
  const cellPadX = 4;
  const cellPadY = 3;

  const totalW = columns.reduce((s, c) => s + c.w, 0);
  const colW = columns.map(c => (c.w / totalW) * width);

  const drawHeader = () => {
    const headerY = doc.y;
    doc.rect(left, headerY, width, headerH).fill(SIMEC_RED);
    doc.fillColor("#fff").font("Helvetica-Bold").fontSize(fontSize);

    let x = left;
    columns.forEach((c, i) => {
      doc.text(c.label, x + cellPadX, headerY + 3.5, {
        width: colW[i] - cellPadX * 2,
        height: headerH - 4,
        align: c.align || "left",
        lineBreak: false,
        ellipsis: true,
      });
      // PDFKit mueve doc.y después de text(); lo regresamos para que no descuadre columnas.
      doc.y = headerY;
      x += colW[i];
    });

    doc.y = headerY + headerH;
    doc.fillColor("#111").font("Helvetica").fontSize(fontSize);
  };

  drawHeader();

  rows.forEach(r => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }

    const rowY = doc.y;

    // Renglón completo, tipo hoja con rayas.
    doc
      .rect(left, rowY, width, rowH)
      .lineWidth(0.35)
      .strokeColor("#d1d5db")
      .stroke();

    let xx = left;
    r.forEach((val, i) => {
      // Separadores verticales suaves para que todo quede dentro de su columna.
      if (i > 0) {
        doc
          .moveTo(xx, rowY)
          .lineTo(xx, rowY + rowH)
          .lineWidth(0.25)
          .strokeColor("#e5e7eb")
          .stroke();
      }

      doc.fillColor("#111").font("Helvetica").fontSize(fontSize);
      doc.text(String(val ?? ""), xx + cellPadX, rowY + cellPadY, {
        width: colW[i] - cellPadX * 2,
        height: rowH - cellPadY,
        align: columns[i].align || "left",
        lineBreak: false,
        ellipsis: true,
      });
      // Mantiene todas las celdas al mismo nivel del renglón.
      doc.y = rowY;
      xx += colW[i];
    });

    doc.y = rowY + rowH;
  });

  doc.moveDown(0.25);
}

function setupMaterialesSheet(sheet) {
  sheet.columns = [
    { header: "Código", key: "codigo", width: 18 },
    { header: "Material", key: "nombre", width: 42 },
    { header: "Stock", key: "stock_actual", width: 12 },
    { header: "Ubicación", key: "ubicacion", width: 24 },
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFB91C1C" },
  };

  sheet.columns.forEach(col => {
    col.alignment = { vertical: "middle", wrapText: false };
  });
}

/* ==================== EXPORT MATERIALES (EXCEL) ==================== */
export async function exportMaterialesExcel(_req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT codigo, nombre, stock_actual, ubicacion
       FROM materiales
       WHERE activo = 1
       ORDER BY id DESC`
    );

    const wb = new ExcelJS.Workbook();
    const sh = wb.addWorksheet("Materiales");

    setupMaterialesSheet(sh);

    rows.forEach(r => sh.addRow({
      codigo: r.codigo,
      nombre: r.nombre,
      stock_actual: String(r.stock_actual ?? 0),
      ubicacion: r.ubicacion || "-",
    }));

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

/* ==================== EXPORT MATERIALES (PDF) ==================== */
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

    const applyHeader = () => drawSimecHeader(doc, "Reporte de Materiales");
    applyHeader();
    doc.on("pageAdded", applyHeader);

    drawSimpleTable(
      doc,
      [
        { label: "Código", w: 18 },
        { label: "Material", w: 52 },
        { label: "Stock", w: 15, align: "right" },
        { label: "Ubicación", w: 15 },
      ],
      rows.map(r => [
        r.codigo,
        r.nombre,
        String(r.stock_actual ?? 0),
        r.ubicacion || "-",
      ])
    );

    doc.end();
  } catch (err) {
    console.error("❌ exportMaterialesPdf:", err);
    res.status(500).json({ ok: false, message: "Error al exportar materiales (PDF)" });
  }
}
