// script.js (ES MODULE)

// ====== Firebase imports ======
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// ====== Si ya inicializaste Firebase en index.html (window.db), lo usamos.
// Si no, lo inicializamos aquí (robusto).
const firebaseConfig = {
  apiKey: "AIzaSyBmRXxzIOr3sevzlXQQDaWKlpEXEB7si1Y",
  authDomain: "peluqueria-eacca.firebaseapp.com",
  projectId: "peluqueria-eacca",
  storageBucket: "peluqueria-eacca.firebasestorage.app",
  messagingSenderId: "104134229616",
  appId: "1:104134229616:web:64673e422f16a682fafeb5",
  measurementId: "G-KF9MGY7YVV"
};

const db = window.db || getFirestore(initializeApp(firebaseConfig));

// ====== Estado ======
let movimientos = []; // [{id, fecha, tipo, concepto, trabajador, gratis, importe}]
let editId = null;

// Colección Firestore
const MOVS_COL = collection(db, "movimientos");

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
  return (fecha || "").slice(0, 7); // YYYY-MM
}

function calcularNeto(m) {
  return m.gratis ? m.importe : m.importe * 0.4;
}

function eur(n) {
  return Number(n || 0).toFixed(2) + " €";
}

// ====== Init UI ======
fechaEl.value = fechaHoy();

if (mesFiltroEl) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  mesFiltroEl.value = `${yyyy}-${mm}`;
  mesFiltroEl.addEventListener("change", () => renderResumenTrabajadores());
}

// ====== Tiempo real Firestore ======
const q = query(MOVS_COL, orderBy("fecha", "asc"), orderBy("createdAt", "asc"));

onSnapshot(
  q,
  (snap) => {
    movimientos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Asegurar tipos
    movimientos = movimientos.map((m) => ({
      ...m,
      gratis: Boolean(m.gratis),
      importe: Number(m.importe || 0)
    }));

    render();
  },
  (err) => {
    console.error("Error onSnapshot:", err);
    alert("Error conectando con Firestore. Revisa reglas/permiso o conexión.");
  }
);

// ====== Crear / Editar ======
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const tipo = tipoEl.value;
  const trabajador = trabajadorEl.value;

  if (tipo !== "Inicio de Caja" && trabajador === "") {
    alert("Debes seleccionar un trabajador");
    return;
  }

  const importe = Math.abs(parseFloat(importeEl.value));
  if (Number.isNaN(importe)) {
    alert("Importe no válido");
    return;
  }

  const mov = {
    fecha: fechaEl.value,
    tipo: tipoEl.value,
    concepto: conceptoEl.value,
    trabajador: trabajadorEl.value || "",
    gratis: gratisEl.checked,
    importe
  };

  try {
    if (editId === null) {
      await addDoc(MOVS_COL, {
        ...mov,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(doc(db, "movimientos", editId), {
        ...mov,
        updatedAt: serverTimestamp()
      });
      editId = null;
    }

    form.reset();
    fechaEl.value = fechaHoy();
  } catch (err) {
    console.error("Error guardando:", err);
    alert("No se pudo guardar. Revisa permisos/reglas de Firestore.");
  }
});

// ====== Render ======
function render() {
  renderTabla();
  renderDashboard();
  renderResumenTrabajadores();
}

function renderTabla() {
  tabla.innerHTML = "";

  // Si quieres newest-first, invierte:
  // const lista = [...movimientos].reverse();
  const lista = movimientos;

  lista.forEach((m) => {
    const neto = calcularNeto(m);

    tabla.innerHTML += `
      <tr>
        <td>${m.fecha || ""}</td>
        <td>${m.tipo || ""}</td>
        <td>${m.concepto || ""}</td>
        <td>${m.trabajador || ""}</td>
        <td>${m.gratis ? "Sí" : "No"}</td>
        <td class="right">${eur(m.importe)}</td>
        <td class="right"><b>${eur(neto)}</b></td>
        <td class="right">
          <button class="edit" data-id="${m.id}">Editar</button>
          <button class="delete" data-id="${m.id}">Borrar</button>
        </td>
      </tr>
    `;
  });
}

function renderDashboard() {
  let ingresos = 0;
  let gastos = 0;

  movimientos.forEach((m) => {
    // ✅ Gratis NO suma a ingresos (ni Inicio de Caja si gratis)
    if ((m.tipo === "Ingreso" || m.tipo === "Inicio de Caja") && !m.gratis) ingresos += m.importe;
    if (m.tipo === "Gasto") gastos += m.importe;
  });

  ingresosEl.textContent = eur(ingresos);
  gastosEl.textContent = eur(gastos);
  balanceEl.textContent = eur(ingresos - gastos);
}

// Sidebar: subtotal por trabajador filtrable por mes (solo ingresos)
function renderResumenTrabajadores() {
  if (!resumenTrabajadoresEl || !totalPagarEl) return;

  const mesSel = mesFiltroEl ? mesFiltroEl.value : ""; // YYYY-MM o ""
  const totales = {};

  movimientos.forEach((m) => {
    if (mesSel && mesKey(m.fecha) !== mesSel) return;
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
        <div><b>${eur(total)}</b></div>
      </div>
    `;
  });

  totalPagarEl.textContent = eur(totalPagar);
}

// ====== Delegación de eventos Editar/Borrar ======
tabla.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.getAttribute("data-id");
  if (!id) return;

  const isEdit = btn.classList.contains("edit");
  const isDelete = btn.classList.contains("delete");

  if (isEdit) {
    const m = movimientos.find((x) => x.id === id);
    if (!m) return;

    fechaEl.value = m.fecha || fechaHoy();
    tipoEl.value = m.tipo || "Ingreso";
    conceptoEl.value = m.concepto || "Corte";
    trabajadorEl.value = m.trabajador || "";
    importeEl.value = Number(m.importe || 0);
    gratisEl.checked = Boolean(m.gratis);

    editId = id;
    return;
  }

  if (isDelete) {
    if (!confirm("¿Borrar este movimiento?")) return;

    try {
      await deleteDoc(doc(db, "movimientos", id));
      if (editId === id) editId = null;
    } catch (err) {
      console.error("Error borrando:", err);
      alert("No se pudo borrar. Revisa permisos/reglas de Firestore.");
    }
  }
});

// ====== Excel (incluye Neto) ======
window.descargarExcel = function descargarExcel() {
  const data = movimientos.map((m) => {
    const netoNum = calcularNeto(m);

    return {
      Fecha: formatoFecha(m.fecha),
      Tipo: m.tipo,
      Concepto: m.concepto,
      Trabajador: m.trabajador,
      Gratis: m.gratis ? "Sí" : "No",
      Importe: Number(m.importe || 0),
      Neto: Number(netoNum || 0).toFixed(2).replace(".", ",")
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Caja");
  XLSX.writeFile(wb, "caja.xlsx");
};
