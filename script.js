import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  onAuthStateChanged,
  getRedirectResult,
  setPersistence,
  browserLocalPersistence
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect,
  signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

/* 🔥 CONFIG */
const firebaseConfig = {
apiKey: "AIzaSyBmRXxzIOr3sevzlXQQDaWKlpEXEB7si1Y",
authDomain: "peluqueria-eacca.firebaseapp.com",
@@ -36,12 +24,14 @@ const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" }); // fuerza elegir cuenta
provider.setCustomParameters({ prompt: "select_account" });

/* DOM */
const viewToggleBtn = document.getElementById("viewToggleBtn");

// DOM
const userEmailEl = document.getElementById("userEmail");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmailEl = document.getElementById("userEmail");

const form = document.getElementById("form");
const fechaEl = document.getElementById("fecha");
@@ -51,6 +41,9 @@ const trabajadorEl = document.getElementById("trabajador");
const importeEl = document.getElementById("importe");
const gratisEl = document.getElementById("gratis");

const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const tabla = document.getElementById("tabla");
const ingresosEl = document.getElementById("ingresos");
const gastosEl = document.getElementById("gastos");
@@ -60,9 +53,16 @@ const mesFiltroEl = document.getElementById("mesFiltro");
const resumenTrabajadoresEl = document.getElementById("resumenTrabajadores");
const totalPagarEl = document.getElementById("totalPagar");

const facturacionBodyEl = document.getElementById("facturacionBody");
const totalFacturacionEl = document.getElementById("totalFacturacion");
const totalNominaEl = document.getElementById("totalNomina");
const totalDiferenciaEl = document.getElementById("totalDiferencia");

let movimientos = [];
let unsubscribe = null;
let editId = null;

/* Helpers */
function fechaHoy() {
return new Date().toISOString().split("T")[0];
}
@@ -73,38 +73,76 @@ function mesKey(fecha) {
return (fecha || "").slice(0, 7);
}
function netoMovimiento(m) {
  // Nómina solo en ingresos
if (m.tipo !== "Ingreso") return 0;
const imp = Number(m.importe || 0);
return m.gratis ? imp : imp * 0.4;
}
function facturacionMovimiento(m) {
  // Facturación: ingresos NO gratis
  if (m.tipo !== "Ingreso") return 0;
  if (m.gratis) return 0;
  return Number(m.importe || 0);
}
function requireUser() {
  if (!auth.currentUser) {
    alert("Primero inicia sesión con Google.");
    return false;
  }
  return true;
}

/* ===== Vista PC/Móvil (forzada) ===== */
function applyViewMode(mode) {
  document.body.classList.remove("force-mobile", "force-desktop");
  if (mode === "mobile") document.body.classList.add("force-mobile");
  if (mode === "desktop") document.body.classList.add("force-desktop");
  if (viewToggleBtn) viewToggleBtn.textContent = `Vista: ${mode === "mobile" ? "Móvil" : "PC"}`;
  localStorage.setItem("viewMode", mode);
}

(function initViewMode() {
  const saved = localStorage.getItem("viewMode");
  if (saved === "mobile" || saved === "desktop") {
    applyViewMode(saved);
  } else {
    // Por defecto: PC
    applyViewMode("desktop");
  }
})();

if (viewToggleBtn) {
  viewToggleBtn.addEventListener("click", () => {
    const isMobile = document.body.classList.contains("force-mobile");
    applyViewMode(isMobile ? "desktop" : "mobile");
  });
}

/* ===== Init inputs ===== */
if (fechaEl) fechaEl.value = fechaHoy();

// Persistencia
if (mesFiltroEl) {
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  mesFiltroEl.value = ym;
  mesFiltroEl.addEventListener("change", () => renderSidebar());
}

/* ===== Auth persistence ===== */
try {
await setPersistence(auth, browserLocalPersistence);
console.log("✅ Auth persistence: browserLocalPersistence");
} catch (e) {
console.error("❌ setPersistence error:", e);
}

// Captura redirect (por si acaso; con popup normalmente no se usa)
try {
  const result = await getRedirectResult(auth);
  console.log(result?.user ? "✅ Redirect user: " + result.user.email : "ℹ️ Redirect result: sin usuario");
} catch (e) {
  console.error("❌ getRedirectResult ERROR:", e);
}

// LOGIN: Popup primero, Redirect si el popup está bloqueado
/* ===== Login / Logout ===== */
if (loginBtn) {
loginBtn.addEventListener("click", async () => {
try {
      console.log("➡️ Login (popup)...");
await signInWithPopup(auth, provider);
} catch (e) {
      console.error("❌ Popup login error:", e);
      // Si el popup está bloqueado, hacemos redirect como plan B
      console.error("Popup login error:", e);
if (e?.code === "auth/popup-blocked" || e?.code === "auth/cancelled-popup-request") {
alert("Popup bloqueado. Probando con redirect…");
await signInWithRedirect(auth, provider);
@@ -121,6 +159,7 @@ if (logoutBtn) {
});
}

/* ===== Auth state ===== */
onAuthStateChanged(auth, (user) => {
console.log("🔄 AUTH STATE:", user ? user.email : "NO USER");

@@ -132,12 +171,19 @@ onAuthStateChanged(auth, (user) => {
if (unsubscribe) unsubscribe();
unsubscribe = null;

    if (tabla) tabla.innerHTML = `<tr><td colspan="8">Inicia sesión para ver/crear movimientos.</td></tr>`;
    movimientos = [];
    if (tabla) tabla.innerHTML = `<tr><td colspan="8">Inicia sesión para ver los movimientos.</td></tr>`;
if (ingresosEl) ingresosEl.textContent = "0 €";
if (gastosEl) gastosEl.textContent = "0 €";
if (balanceEl) balanceEl.textContent = "0 €";

if (resumenTrabajadoresEl) resumenTrabajadoresEl.innerHTML = "";
if (totalPagarEl) totalPagarEl.textContent = "0 €";

    if (facturacionBodyEl) facturacionBodyEl.innerHTML = `<tr><td colspan="4">—</td></tr>`;
    if (totalFacturacionEl) totalFacturacionEl.textContent = "0 €";
    if (totalNominaEl) totalNominaEl.textContent = "0 €";
    if (totalDiferenciaEl) totalDiferenciaEl.textContent = "0 €";
return;
}

@@ -159,58 +205,74 @@ function iniciarRealtime() {
render();
},
(err) => {
      console.error("❌ FIRESTORE ERROR:", err);
      console.error("FIRESTORE ERROR:", err);
alert("Firestore: " + (err.code || err.message));
}
);
}

function requireUser() {
  if (!auth.currentUser) {
    alert("Primero inicia sesión con Google.");
    return false;
  }
  return true;
}
/* ===== Form submit ===== */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireUser()) return;

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!requireUser()) return;
  const tipo = tipoEl.value;
  const trabajador = trabajadorEl.value;

    const tipo = tipoEl.value;
    const trabajador = trabajadorEl.value;
  if (tipo === "Ingreso" && trabajador === "") {
    alert("Debes seleccionar un trabajador para un Ingreso.");
    return;
  }

    if (tipo === "Ingreso" && trabajador === "") {
      alert("Debes seleccionar un trabajador para un Ingreso.");
      return;
    }
  const importe = Math.abs(parseFloat(importeEl.value));
  if (Number.isNaN(importe)) {
    alert("Importe no válido");
    return;
  }

    const importe = Math.abs(parseFloat(importeEl.value));
    if (Number.isNaN(importe)) {
      alert("Importe no válido");
      return;
  const mov = {
    fecha: fechaEl.value,
    tipo: tipoEl.value,
    concepto: conceptoEl.value,
    trabajador: trabajadorEl.value || "",
    gratis: !!gratisEl.checked,
    importe: Number(importe),
    updatedAt: serverTimestamp()
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "movimientos", editId), mov);
      editId = null;
      submitBtn.textContent = "Añadir";
      cancelEditBtn.style.display = "none";
    } else {
      await addDoc(collection(db, "movimientos"), {
        ...mov,
        createdAt: serverTimestamp()
      });
}

    await addDoc(collection(db, "movimientos"), {
      fecha: fechaEl.value,
      tipo: tipoEl.value,
      concepto: conceptoEl.value,
      trabajador: trabajadorEl.value || "",
      gratis: !!gratisEl.checked,
      importe: Number(importe),
      createdAt: serverTimestamp()
    });

form.reset();
fechaEl.value = fechaHoy();
  });
}
  } catch (err) {
    console.error("SAVE ERROR:", err);
    alert("No se pudo guardar: " + (err.code || err.message));
  }
});

function render() {
  if (!tabla) return;
cancelEditBtn.addEventListener("click", () => {
  editId = null;
  form.reset();
  fechaEl.value = fechaHoy();
  submitBtn.textContent = "Añadir";
  cancelEditBtn.style.display = "none";
});

/* ===== Render main table + totals ===== */
function render() {
tabla.innerHTML = "";

let ingresos = 0;
let gastos = 0;

@@ -232,54 +294,146 @@ function render() {
       <td class="right">${eur(imp)}</td>
       <td class="right">${neto ? eur(neto) : "—"}</td>
       <td class="right">
          <button type="button" onclick="borrar('${m.id}')">Borrar</button>
          <button class="btn btn--secondary" type="button" data-action="edit" data-id="${m.id}">Editar</button>
          <button class="btn" style="border-color: rgba(239,68,68,.35); background: rgba(239,68,68,.14);" type="button" data-action="delete" data-id="${m.id}">Borrar</button>
       </td>
     </tr>
   `;
});

  if (ingresosEl) ingresosEl.textContent = eur(ingresos);
  if (gastosEl) gastosEl.textContent = eur(gastos);
  if (balanceEl) balanceEl.textContent = eur(ingresos - gastos);
  ingresosEl.textContent = eur(ingresos);
  gastosEl.textContent = eur(gastos);
  balanceEl.textContent = eur(ingresos - gastos);

renderSidebar();
}

window.borrar = async (id) => {
/* Delegación editar/borrar */
tabla.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!action || !id) return;

if (!requireUser()) return;
  if (!confirm("¿Borrar este movimiento?")) return;
  await deleteDoc(doc(db, "movimientos", id));
};

function renderSidebar() {
  if (!mesFiltroEl || !resumenTrabajadoresEl || !totalPagarEl) return;
  if (action === "delete") {
    if (!confirm("¿Borrar este movimiento?")) return;
    await deleteDoc(doc(db, "movimientos", id));
  }

  if (action === "edit") {
    const m = movimientos.find(x => x.id === id);
    if (!m) return;

    fechaEl.value = m.fecha || fechaHoy();
    tipoEl.value = m.tipo || "Ingreso";
    conceptoEl.value = m.concepto || "Corte";
    trabajadorEl.value = m.trabajador || "";
    importeEl.value = Number(m.importe || 0);
    gratisEl.checked = !!m.gratis;

    editId = id;
    submitBtn.textContent = "Guardar cambios";
    cancelEditBtn.style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

  const mes = mesFiltroEl.value;
  const totales = {};
  let total = 0;
/* ===== Sidebar: Pagos + Facturación ===== */
function renderSidebar() {
  const mes = mesFiltroEl?.value || "";
  const pagos = {};        // nómina por trabajador
  const facts = {};        // facturación por trabajador
  let totalNomina = 0;
  let totalFact = 0;

movimientos.forEach((m) => {
if (m.tipo !== "Ingreso") return;
if (!m.trabajador) return;
if (mes && mesKey(m.fecha) !== mes) return;

const neto = netoMovimiento(m);
    totales[m.trabajador] = (totales[m.trabajador] || 0) + neto;
    const fact = facturacionMovimiento(m);

    pagos[m.trabajador] = (pagos[m.trabajador] || 0) + neto;
    facts[m.trabajador] = (facts[m.trabajador] || 0) + fact;
});

  const keys = Object.keys(totales).sort();
  resumenTrabajadoresEl.innerHTML = "";
  const workers = Array.from(new Set([...Object.keys(pagos), ...Object.keys(facts)])).sort();

  if (keys.length === 0) {
    resumenTrabajadoresEl.innerHTML = `<div>Sin datos para ese mes</div>`;
  /* Pagos (listado) */
  resumenTrabajadoresEl.innerHTML = "";
  if (workers.length === 0) {
    resumenTrabajadoresEl.innerHTML = `<div class="worker"><div><b>Sin datos</b><small>No hay ingresos en ese mes</small></div><div>—</div></div>`;
totalPagarEl.textContent = "0 €";
  } else {
    workers.forEach((t) => {
      const p = pagos[t] || 0;
      totalNomina += p;
      resumenTrabajadoresEl.innerHTML += `
        <div class="worker">
          <div><b>${t}</b><small>${mes || "Todos los meses"}</small></div>
          <div><b>${eur(p)}</b></div>
        </div>
      `;
    });
    totalPagarEl.textContent = eur(totalNomina);
  }

  /* Facturación table */
  facturacionBodyEl.innerHTML = "";
  if (workers.length === 0) {
    facturacionBodyEl.innerHTML = `<tr><td colspan="4">—</td></tr>`;
    totalFacturacionEl.textContent = "0 €";
    totalNominaEl.textContent = "0 €";
    totalDiferenciaEl.textContent = "0 €";
return;
}

  keys.forEach((t) => {
    total += totales[t];
    resumenTrabajadoresEl.innerHTML += `<div>${t}: ${eur(totales[t])}</div>`;
  workers.forEach((t) => {
    const f = facts[t] || 0;
    const n = pagos[t] || 0;
    const d = f - n;

    totalFact += f;

    facturacionBodyEl.innerHTML += `
      <tr>
        <td>${t}</td>
        <td class="right">${eur(f)}</td>
        <td class="right">${eur(n)}</td>
        <td class="right"><b>${eur(d)}</b></td>
      </tr>
    `;
});

  totalPagarEl.textContent = eur(total);
  totalFacturacionEl.textContent = eur(totalFact);
  totalNominaEl.textContent = eur(totalNomina);
  totalDiferenciaEl.textContent = eur(totalFact - totalNomina);
}

/* ===== Excel export ===== */
window.descargarExcel = function () {
  const data = movimientos.map((m) => {
    const imp = Number(m.importe || 0);
    const neto = netoMovimiento(m);

    return {
      Fecha: m.fecha || "",
      Tipo: m.tipo || "",
      Concepto: m.concepto || "",
      Trabajador: m.trabajador || "",
      Gratis: m.gratis ? "Sí" : "No",
      Importe: imp.toFixed(2).replace(".", ","),
      Neto: neto ? neto.toFixed(2).replace(".", ",") : ""
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Caja");
  XLSX.writeFile(wb, "caja.xlsx");
};
