import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect,
  signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

/* 🔥 CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyBmRXxzIOr3sevzlXQQDaWKlpEXEB7si1Y",
  authDomain: "peluqueria-eacca.firebaseapp.com",
  projectId: "peluqueria-eacca",
  storageBucket: "peluqueria-eacca.firebasestorage.app",
  messagingSenderId: "104134229616",
  appId: "1:104134229616:web:64673e422f16a682fafeb5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* ===== DEFAULTS ===== */
const DEFAULT_CONCEPTOS = ["Corte", "Tinte", "Peinado", "Manicura", "Inicio Caja"];
const DEFAULT_TRABAJADORES = [
  { id: "TR02", nombre: "" },
  { id: "TR03", nombre: "" },
  { id: "TR04", nombre: "" },
  { id: "TR05", nombre: "" },
  { id: "TR06", nombre: "" },
];

/* Estado en memoria */
let conceptos = [...DEFAULT_CONCEPTOS];
let trabajadores = [...DEFAULT_TRABAJADORES];
let unsubConceptos = null;
let unsubTrabajadores = null;

/* ===== DOM ===== */
const viewToggleBtn   = document.getElementById("viewToggleBtn");
const loginBtn        = document.getElementById("loginBtn");
const logoutBtn       = document.getElementById("logoutBtn");
const userEmailEl     = document.getElementById("userEmail");
const form            = document.getElementById("form");
const fechaEl         = document.getElementById("fecha");
const tipoEl          = document.getElementById("tipo");
const conceptoEl      = document.getElementById("concepto");
const trabajadorEl    = document.getElementById("trabajador");
const importeEl       = document.getElementById("importe");
const gratisEl        = document.getElementById("gratis");
const submitBtn       = document.getElementById("submitBtn");
const cancelEditBtn   = document.getElementById("cancelEditBtn");
const tabla           = document.getElementById("tabla");
const ingresosEl      = document.getElementById("ingresos");
const gastosEl        = document.getElementById("gastos");
const balanceEl       = document.getElementById("balance");
const mesFiltroEl     = document.getElementById("mesFiltro");
const resumenTrabEl   = document.getElementById("resumenTrabajadores");
const totalPagarEl    = document.getElementById("totalPagar");
const facturacionBodyEl  = document.getElementById("facturacionBody");
const totalFactEl     = document.getElementById("totalFacturacion");
const totalNominaEl   = document.getElementById("totalNomina");
const totalDifEl      = document.getElementById("totalDiferencia");

// Config DOM
const listaConceptosEl    = document.getElementById("listaConceptos");
const listaTrabajadoresEl = document.getElementById("listaTrabajadores");
const nuevoConceptoEl     = document.getElementById("nuevoConcepto");
const nuevoTrIdEl         = document.getElementById("nuevoTrId");
const nuevoTrNombreEl     = document.getElementById("nuevoTrNombre");
const btnAddConcepto      = document.getElementById("btnAddConcepto");
const btnAddTrabajador    = document.getElementById("btnAddTrabajador");

let movimientos = [];
let unsubscribe = null;
let editId = null;

/* ===== HELPERS ===== */
function fechaHoy() { return new Date().toISOString().split("T")[0]; }
function eur(n) { return (Number(n || 0)).toFixed(2) + " €"; }
function mesKey(fecha) { return (fecha || "").slice(0, 7); }
function netoMovimiento(m) {
  if (m.tipo !== "Ingreso") return 0;
  const imp = Number(m.importe || 0);
  return m.gratis ? imp : imp * 0.4;
}
function facturacionMovimiento(m) {
  if (m.tipo !== "Ingreso" || m.gratis) return 0;
  return Number(m.importe || 0);
}
function requireUser() {
  if (!auth.currentUser) { alert("Primero inicia sesión con Google."); return false; }
  return true;
}

/* ===== TABS ===== */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-btn--active"));
    document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
    btn.classList.add("tab-btn--active");
    document.getElementById("tab-" + btn.dataset.tab).style.display = "";
  });
});

/* ===== VISTA PC/MÓVIL ===== */
function applyViewMode(mode) {
  document.body.classList.remove("force-mobile", "force-desktop");
  if (mode === "mobile") document.body.classList.add("force-mobile");
  if (mode === "desktop") document.body.classList.add("force-desktop");
  if (viewToggleBtn) viewToggleBtn.textContent = `Vista: ${mode === "mobile" ? "Móvil" : "PC"}`;
  localStorage.setItem("viewMode", mode);
}
(function initViewMode() {
  const saved = localStorage.getItem("viewMode");
  applyViewMode(saved === "mobile" ? "mobile" : "desktop");
})();
if (viewToggleBtn) {
  viewToggleBtn.addEventListener("click", () => {
    applyViewMode(document.body.classList.contains("force-mobile") ? "desktop" : "mobile");
  });
}

/* ===== INIT INPUTS ===== */
if (fechaEl) fechaEl.value = fechaHoy();
if (mesFiltroEl) {
  const d = new Date();
  mesFiltroEl.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  mesFiltroEl.addEventListener("change", () => renderSidebar());
}

/* ===== AUTH PERSISTENCE ===== */
try {
  await setPersistence(auth, browserLocalPersistence);
} catch (e) { console.error("setPersistence error:", e); }

/* ===== LOGIN / LOGOUT ===== */
loginBtn?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e?.code === "auth/popup-blocked" || e?.code === "auth/cancelled-popup-request") {
      await signInWithRedirect(auth, provider);
    } else {
      alert("LOGIN ERROR: " + (e.code || e.message));
    }
  }
});
logoutBtn?.addEventListener("click", () => signOut(auth));

/* ===== AUTH STATE ===== */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    userEmailEl.textContent = "";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    if (unsubscribe) unsubscribe();
    if (unsubConceptos) unsubConceptos();
    if (unsubTrabajadores) unsubTrabajadores();
    unsubscribe = unsubConceptos = unsubTrabajadores = null;
    movimientos = [];
    tabla.innerHTML = `<tr><td colspan="8">Inicia sesión para ver los movimientos.</td></tr>`;
    ingresosEl.textContent = gastosEl.textContent = balanceEl.textContent = "0 €";
    resumenTrabEl.innerHTML = "";
    totalPagarEl.textContent = "0 €";
    facturacionBodyEl.innerHTML = `<tr><td colspan="4">—</td></tr>`;
    totalFactEl.textContent = totalNominaEl.textContent = totalDifEl.textContent = "0 €";
    // Reset config a defaults
    conceptos = [...DEFAULT_CONCEPTOS];
    trabajadores = [...DEFAULT_TRABAJADORES];
    renderConceptoSelect();
    renderTrabajadorSelect();
    renderConfigConceptos();
    renderConfigTrabajadores();
    return;
  }

  userEmailEl.textContent = user.email || "";
  loginBtn.style.display = "none";
  logoutBtn.style.display = "inline-block";
  iniciarRealtime();
  iniciarConfig();
});

/* ===== REALTIME MOVIMIENTOS ===== */
function iniciarRealtime() {
  if (unsubscribe) unsubscribe();
  const q = query(collection(db, "movimientos"), orderBy("fecha", "desc"));
  unsubscribe = onSnapshot(q, (snap) => {
    movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, (err) => {
    console.error("FIRESTORE ERROR:", err);
    alert("Firestore: " + (err.code || err.message));
  });
}

/* ===== CONFIG: CONCEPTOS Y TRABAJADORES EN FIRESTORE ===== */
async function iniciarConfig() {
  // Conceptos
  const conceptosRef = doc(db, "config", "conceptos");
  unsubConceptos = onSnapshot(conceptosRef, async (snap) => {
    if (snap.exists()) {
      conceptos = snap.data().lista || DEFAULT_CONCEPTOS;
    } else {
      // Primera vez: inicializar con defaults
      await setDoc(conceptosRef, { lista: DEFAULT_CONCEPTOS });
      conceptos = [...DEFAULT_CONCEPTOS];
    }
    renderConceptoSelect();
    renderConfigConceptos();
  });

  // Trabajadores
  const trabajadoresRef = doc(db, "config", "trabajadores");
  unsubTrabajadores = onSnapshot(trabajadoresRef, async (snap) => {
    if (snap.exists()) {
      trabajadores = snap.data().lista || DEFAULT_TRABAJADORES;
    } else {
      await setDoc(trabajadoresRef, { lista: DEFAULT_TRABAJADORES });
      trabajadores = [...DEFAULT_TRABAJADORES];
    }
    renderTrabajadorSelect();
    renderConfigTrabajadores();
  });
}

/* ===== RENDER SELECTS DEL FORMULARIO ===== */
function renderConceptoSelect() {
  const current = conceptoEl.value;
  conceptoEl.innerHTML = "";
  conceptos.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    conceptoEl.appendChild(opt);
  });
  if (conceptos.includes(current)) conceptoEl.value = current;
}

function renderTrabajadorSelect() {
  const current = trabajadorEl.value;
  trabajadorEl.innerHTML = `<option value="">—</option>`;
  trabajadores.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.nombre ? `${t.id} – ${t.nombre}` : t.id;
    trabajadorEl.appendChild(opt);
  });
  if (trabajadores.some(t => t.id === current)) trabajadorEl.value = current;
}

/* ===== RENDER LISTAS DE CONFIGURACIÓN ===== */
function renderConfigConceptos() {
  if (!listaConceptosEl) return;
  listaConceptosEl.innerHTML = "";
  if (conceptos.length === 0) {
    listaConceptosEl.innerHTML = `<div class="config-empty">Sin conceptos. Añade el primero.</div>`;
    return;
  }
  conceptos.forEach((c, i) => {
    const item = document.createElement("div");
    item.className = "config-item";
    item.innerHTML = `
      <div class="config-item__info"><span>${c}</span></div>
      <button class="btn btn--danger" type="button" data-idx="${i}">Borrar</button>
    `;
    item.querySelector("button").addEventListener("click", () => borrarConcepto(i));
    listaConceptosEl.appendChild(item);
  });
}

function renderConfigTrabajadores() {
  if (!listaTrabajadoresEl) return;
  listaTrabajadoresEl.innerHTML = "";
  if (trabajadores.length === 0) {
    listaTrabajadoresEl.innerHTML = `<div class="config-empty">Sin trabajadores. Añade el primero.</div>`;
    return;
  }
  trabajadores.forEach((t, i) => {
    const item = document.createElement("div");
    item.className = "config-item";
    item.innerHTML = `
      <div class="config-item__info">
        <span>${t.id}</span>
        ${t.nombre ? `<small>${t.nombre}</small>` : ""}
      </div>
      <button class="btn btn--danger" type="button" data-idx="${i}">Borrar</button>
    `;
    item.querySelector("button").addEventListener("click", () => borrarTrabajador(i));
    listaTrabajadoresEl.appendChild(item);
  });
}

/* ===== CRUD CONCEPTOS ===== */
async function guardarConceptos() {
  if (!requireUser()) return;
  await setDoc(doc(db, "config", "conceptos"), { lista: conceptos });
}
async function guardarTrabajadores() {
  if (!requireUser()) return;
  await setDoc(doc(db, "config", "trabajadores"), { lista: trabajadores });
}

btnAddConcepto?.addEventListener("click", async () => {
  if (!requireUser()) return;
  const val = nuevoConceptoEl.value.trim();
  if (!val) return;
  if (conceptos.includes(val)) { alert("Ese concepto ya existe."); return; }
  conceptos.push(val);
  nuevoConceptoEl.value = "";
  await guardarConceptos();
});

nuevoConceptoEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); btnAddConcepto.click(); }
});

async function borrarConcepto(idx) {
  if (!requireUser()) return;
  if (!confirm(`¿Borrar el concepto "${conceptos[idx]}"?`)) return;
  conceptos.splice(idx, 1);
  await guardarConceptos();
}

/* ===== CRUD TRABAJADORES ===== */
btnAddTrabajador?.addEventListener("click", async () => {
  if (!requireUser()) return;
  const id     = nuevoTrIdEl.value.trim().toUpperCase();
  const nombre = nuevoTrNombreEl.value.trim();
  if (!id) { alert("El ID es obligatorio."); return; }
  if (trabajadores.some(t => t.id === id)) { alert("Ese ID ya existe."); return; }
  trabajadores.push({ id, nombre });
  nuevoTrIdEl.value = "";
  nuevoTrNombreEl.value = "";
  await guardarTrabajadores();
});

async function borrarTrabajador(idx) {
  if (!requireUser()) return;
  if (!confirm(`¿Borrar el trabajador "${trabajadores[idx].id}"?`)) return;
  trabajadores.splice(idx, 1);
  await guardarTrabajadores();
}

/* ===== FORM SUBMIT ===== */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireUser()) return;

  const tipo       = tipoEl.value;
  const trabajador = trabajadorEl.value;

  if (tipo === "Ingreso" && trabajador === "") {
    alert("Debes seleccionar un trabajador para un Ingreso.");
    return;
  }

  const importe = Math.abs(parseFloat(importeEl.value));
  if (Number.isNaN(importe)) { alert("Importe no válido"); return; }

  const mov = {
    fecha:      fechaEl.value,
    tipo,
    concepto:   conceptoEl.value,
    trabajador: trabajadorEl.value || "",
    gratis:     !!gratisEl.checked,
    importe:    Number(importe),
    updatedAt:  serverTimestamp()
  };

  try {
    if (editId) {
      await updateDoc(doc(db, "movimientos", editId), mov);
      editId = null;
      submitBtn.textContent = "Añadir";
      cancelEditBtn.style.display = "none";
    } else {
      await addDoc(collection(db, "movimientos"), { ...mov, createdAt: serverTimestamp() });
    }
    form.reset();
    fechaEl.value = fechaHoy();
    renderConceptoSelect();
    renderTrabajadorSelect();
  } catch (err) {
    console.error("SAVE ERROR:", err);
    alert("No se pudo guardar: " + (err.code || err.message));
  }
});

cancelEditBtn.addEventListener("click", () => {
  editId = null;
  form.reset();
  fechaEl.value = fechaHoy();
  submitBtn.textContent = "Añadir";
  cancelEditBtn.style.display = "none";
  renderConceptoSelect();
  renderTrabajadorSelect();
});

/* ===== RENDER TABLA + TOTALES ===== */
function render() {
  tabla.innerHTML = "";
  let ingresos = 0, gastos = 0;

  movimientos.forEach((m) => {
    const imp = Number(m.importe || 0);
    if ((m.tipo === "Ingreso" || m.tipo === "Inicio de Caja") && !m.gratis) ingresos += imp;
    if (m.tipo === "Gasto") gastos += imp;
    const neto = netoMovimiento(m);

    tabla.innerHTML += `
      <tr>
        <td>${m.fecha || ""}</td>
        <td>${m.tipo || ""}</td>
        <td>${m.concepto || ""}</td>
        <td>${m.trabajador || "—"}</td>
        <td>${m.gratis ? "Sí" : "No"}</td>
        <td class="right">${eur(imp)}</td>
        <td class="right">${neto ? eur(neto) : "—"}</td>
        <td class="right">
          <button class="btn btn--secondary" type="button" data-action="edit" data-id="${m.id}">Editar</button>
          <button class="btn btn--danger" type="button" data-action="delete" data-id="${m.id}">Borrar</button>
        </td>
      </tr>
    `;
  });

  ingresosEl.textContent = eur(ingresos);
  gastosEl.textContent   = eur(gastos);
  balanceEl.textContent  = eur(ingresos - gastos);
  renderSidebar();
}

/* Delegación editar/borrar */
tabla.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!action || !id || !requireUser()) return;

  if (action === "delete") {
    if (!confirm("¿Borrar este movimiento?")) return;
    await deleteDoc(doc(db, "movimientos", id));
  }

  if (action === "edit") {
    const m = movimientos.find(x => x.id === id);
    if (!m) return;
    fechaEl.value      = m.fecha || fechaHoy();
    tipoEl.value       = m.tipo || "Ingreso";
    conceptoEl.value   = m.concepto || "";
    trabajadorEl.value = m.trabajador || "";
    importeEl.value    = Number(m.importe || 0);
    gratisEl.checked   = !!m.gratis;
    editId             = id;
    submitBtn.textContent      = "Guardar cambios";
    cancelEditBtn.style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Volver a pestaña Caja si no estamos en ella
    document.querySelector('[data-tab="caja"]').click();
  }
});

/* ===== SIDEBAR ===== */
function renderSidebar() {
  const mes = mesFiltroEl?.value || "";
  const pagos = {}, facts = {};
  let totalNomina = 0, totalFact = 0;

  movimientos.forEach((m) => {
    if (m.tipo !== "Ingreso" || !m.trabajador) return;
    if (mes && mesKey(m.fecha) !== mes) return;
    const neto = netoMovimiento(m);
    const fact = facturacionMovimiento(m);
    pagos[m.trabajador] = (pagos[m.trabajador] || 0) + neto;
    facts[m.trabajador] = (facts[m.trabajador] || 0) + fact;
  });

  const workers = Array.from(new Set([...Object.keys(pagos), ...Object.keys(facts)])).sort();

  resumenTrabEl.innerHTML = "";
  if (workers.length === 0) {
    resumenTrabEl.innerHTML = `<div class="worker"><div><b>Sin datos</b><small>No hay ingresos en ese mes</small></div><div>—</div></div>`;
    totalPagarEl.textContent = "0 €";
  } else {
    workers.forEach((t) => {
      const p = pagos[t] || 0;
      totalNomina += p;
      resumenTrabEl.innerHTML += `
        <div class="worker">
          <div><b>${t}</b><small>${mes || "Todos los meses"}</small></div>
          <div><b>${eur(p)}</b></div>
        </div>
      `;
    });
    totalPagarEl.textContent = eur(totalNomina);
  }

  facturacionBodyEl.innerHTML = "";
  if (workers.length === 0) {
    facturacionBodyEl.innerHTML = `<tr><td colspan="4">—</td></tr>`;
    totalFactEl.textContent = totalNominaEl.textContent = totalDifEl.textContent = "0 €";
    return;
  }

  workers.forEach((t) => {
    const f = facts[t] || 0;
    const n = pagos[t] || 0;
    totalFact += f;
    facturacionBodyEl.innerHTML += `
      <tr>
        <td>${t}</td>
        <td class="right">${eur(f)}</td>
        <td class="right">${eur(n)}</td>
        <td class="right"><b>${eur(f - n)}</b></td>
      </tr>
    `;
  });

  totalFactEl.textContent     = eur(totalFact);
  totalNominaEl.textContent   = eur(totalNomina);
  totalDifEl.textContent      = eur(totalFact - totalNomina);
}

/* ===== EXCEL ===== */
window.descargarExcel = function () {
  const data = movimientos.map((m) => {
    const imp  = Number(m.importe || 0);
    const neto = netoMovimiento(m);
    return {
      Fecha:      m.fecha || "",
      Tipo:       m.tipo || "",
      Concepto:   m.concepto || "",
      Trabajador: m.trabajador || "",
      Gratis:     m.gratis ? "Sí" : "No",
      Importe:    imp.toFixed(2).replace(".", ","),
      Neto:       neto ? neto.toFixed(2).replace(".", ",") : ""
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Caja");
  XLSX.writeFile(wb, "caja.xlsx");
};
