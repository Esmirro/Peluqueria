// ====== Datos persistentes ======
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let editIndex = null;

// ====== DOM ======
const form = document.getElementById("form");
const tabla = document.getElementById("tabla");

const fechaEl = document.getElementById("fecha");
const tipoEl = document.getElementById("tipo");
const conceptoEl = document.getElementById("concepto");
const trabajadorEl = document.getElementById("trabajador");
const importeEl = document.getElementById("importe");
const gratisEl = document.getElementById("gratis");

const ingresosEl = document.getElementById("ingresos");
const gastosEl = document.getElementById("gastos");
const balanceEl = document.getElementById("balance");

// Sidebar (si existe en tu HTML)
const mesFiltroEl = document.getElementById("mesFiltro");
const resumenTrabajadoresEl = document.getElementById("resumenTrabajadores");
const totalPagarEl = document.getElementById("totalPagar");

// ====== Utilidades ======
function fechaHoy() {
  const hoy = new Date();
  return hoy.toISOString().split("T")[0];
}

function formatoFecha(fecha) {
  const d = new Date(fecha);
  return d.toLocaleDateString("es-ES");
}

function mesKey(fecha) {
  // "YYYY-MM-DD" -> "YYYY-MM"
  return (fecha || "").slice(0, 7);
}

function calcularNeto(m) {
  // Neto: 40% normal / 100% si gratis
  return m.gratis ? m.importe : m.importe * 0.4;
}

// ====== Inicialización ======
fechaEl.value = fechaHoy();

// Por defecto: mes actual en el filtro (si existe)
if (mesFiltroEl) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  mesFiltroEl.value = `${yyyy}-${mm}`;

  mesFiltroEl.addEventListener("change", () => {
    renderResumenTrabajadores();
  });
}

// ====== Form submit ======
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const tipo = tipoEl.value;
  const trabajador = trabajadorEl.value;

  if (tipo !== "Inicio de Caja" && trabajador === "") {
    alert("Debes seleccionar un trabajador");
    return;
  }

  const mov = {
    fecha: fechaEl.value,
    tipo: tipoEl.value,
    concepto: conceptoEl.value,
    trabajador: trabajadorEl.value || "",
    gratis: gratisEl.checked,
    importe: Math.abs(parseFloat(importeEl.value))
  };

  if (Number.isNaN(mov.importe)) {
    alert("Importe no válido");
    return;
  }

  if (editIndex === null) {
    movimientos.push(mov);
  } else {
    movimientos[editIndex] = mov;
    editIndex = null;
  }

  guardar();
  form.reset();
  fechaEl.value = fechaHoy();
});

// ====== Persistencia ======
function guardar() {
  localStorage.setItem("movimientos", JSON.stringify(movimientos));
  render();
}

// ====== Render principal ======
function render() {
  tabla.innerHTML = "";
  let ingresos = 0;
  let gastos = 0;

  movimientos.forEach((m, i) => {
    // ✅ Gratis NO suma a ingresos (solo se registra)
    if ((m.tipo === "Ingreso" || m.tipo === "Inicio de Caja") && !m.gratis) ingresos += m.importe;
    if (m.tipo === "Gasto") gastos += m.importe;

    const neto = calcularNeto(m);

    // ✅ 8 columnas: Neto y Acciones separados
    tabla.innerHTML += `
      <tr>
        <td>${m.fecha}</td>
        <td>${m.tipo}</td>
        <td>${m.concepto}</td>
        <td>${m.trabajador || ""}</td>
        <td>${m.gratis ? "Sí" : "No"}</td>
        <td class="right">${m.importe.toFixed(2)} €</td>
        <td class="right"><b>${neto.toFixed(2)} €</b></td>
        <td class="right">
          <button class="edit" onclick="editar(${i})">Editar</button>
          <button class="delete" onclick="borrar(${i})">Borrar</button>
        </td>
      </tr>
    `;
  });

  ingresosEl.textContent = ingresos.toFixed(2) + " €";
  gastosEl.textContent = gastos.toFixed(2) + " €";
  balanceEl.textContent = (ingresos - gastos).toFixed(2) + " €";

  renderResumenTrabajadores();
}

// ====== Editar / Borrar ======
function editar(i) {
  const m = movimientos[i];
  fechaEl.value = m.fecha;
  tipoEl.value = m.tipo;
  conceptoEl.value = m.concepto;
  trabajadorEl.value = m.trabajador;
  importeEl.value = m.importe;
  gratisEl.checked = m.gratis;
  editIndex = i;
}

function borrar(i) {
  if (confirm("¿Borrar este movimiento?")) {
    movimientos.splice(i, 1);
    guardar();
  }
}

// ====== Sidebar: subtotal por trabajador con filtro por mes ======
function renderResumenTrabajadores() {
  if (!resumenTrabajadoresEl || !totalPagarEl) return;

  const mesSel = mesFiltroEl ? mesFiltroEl.value : ""; // "YYYY-MM" o ""
  const totales = {}; // { TR02: number, ... }

  movimientos.forEach((m) => {
    // Filtrar por mes si hay seleccionado
    if (mesSel && mesKey(m.fecha) !== mesSel) return;

    // Solo ingresos para nóminas (si quieres incluir otros tipos, dímelo)
    if (m.tipo !== "Ingreso") return;

    if (!m.trabajador) return;

    const neto = calcularNeto(m);
    totales[m.trabajador] = (totales[m.trabajador] || 0) + neto;
  });

  const trabajadores = Object.keys(totales).sort((a, b) => a.localeCompare(b, "es"));

  resumenTrabajadoresEl.innerHTML = "";

  if (trabajadores.length === 0) {
    resumenTrabajadoresEl.innerHTML = `
      <div class="worker-item">
        <div>
          <b>Sin datos</b>
          <small>No hay ingresos con trabajador en este mes</small>
        </div>
        <div>—</div>
      </div>
    `;
    totalPagarEl.textContent = "0 €";
    return;
  }

  let totalPagar = 0;

  trabajadores.forEach((tr) => {
    const total = totales[tr] || 0;
    totalPagar += total;

    resumenTrabajadoresEl.innerHTML += `
      <div class="worker-item">
        <div>
          <b>${tr}</b>
          <small>${mesSel || "Todos los meses"}</small>
        </div>
        <div><b>${total.toFixed(2)} €</b></div>
      </div>
    `;
  });

  totalPagarEl.textContent = totalPagar.toFixed(2) + " €";
}

// ====== Excel ======
function descargarExcel() {
  const data = movimientos.map((m) => {
    const netoNum = calcularNeto(m);

    return {
      Fecha: formatoFecha(m.fecha),
      Tipo: m.tipo,
      Concepto: m.concepto,
      Trabajador: m.trabajador,
      Gratis: m.gratis ? "Sí" : "No",
      Importe: m.importe.toFixed(2).replace(".", ","),
      Neto: netoNum.toFixed(2).replace(".", ",")
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Caja");
  XLSX.writeFile(wb, "caja.xlsx");
}

// ====== Start ======
render();
