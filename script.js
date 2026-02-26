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

/* ===== DEFAULT CONFIG ===== */
const DEFAULT_TIPOS = ["Ingreso", "Gasto", "Inicio de Caja"];
const DEFAULT_CONCEPTOS = ["Corte", "Inicio Caja"];
// trabajadores: { id, porcentaje }
const DEFAULT_TRABAJADORES = [
  { id: "TR02", porcentaje: 40 },
  { id: "TR03", porcentaje: 40 },
  { id: "TR04", porcentaje: 40 },
  { id: "TR05", porcentaje: 40 },
  { id: "TR06", porcentaje: 60 },
];

/* ===== STATE ===== */
let config = {
  tipos: [...DEFAULT_TIPOS],
  conceptos: [...DEFAULT_CONCEPTOS],
  trabajadores: DEFAULT_TRABAJADORES.map(t => ({ ...t }))
};
let movimientos = [];
let unsubscribe = null;
let editId = null;

/* ===== DOM ===== */
const viewToggleBtn = document.getElementById("viewToggleBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmailEl = document.getElementById("userEmail");

const form = document.getElementById("form");
const fechaEl = document.getElementById("fecha");
const tipoEl = document.getElementById("tipo");
const conceptoEl = document.getElementById("concepto");
const trabajadorEl = document.getElementById("trabajador");
const importeEl = document.getElementById("importe");
const gratisEl = document.getElementById("gratis");
const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const tabla = document.getElementById("tabla");
const ingresosEl = document.getElementById("ingresos");
const gastosEl = document.getElementById("gastos");
const balanceEl = document.getElementById("balance");

const mesFiltroEl = document.getElementById("mesFiltro");
const mesFiltroStatsEl = document.getElementById("mesFiltroStats");
const mesFiltroTablaEl = document.getElementById("mesFiltroTabla");

const resumenTrabajadoresEl = document.getElementById("resumenTrabajadores");
const totalPagarEl = document.getElementById("totalPagar");
const facturacionBodyEl = document.getElementById("facturacionBody");
const totalFacturacionEl = document.getElementById("totalFacturacion");
const totalNominaEl = document.getElementById("totalNomina");
const totalDiferenciaEl = document.getElementById("totalDiferencia");

/* Config tab DOM */
const tiposListEl = document.getElementById("tiposList");
const conceptosListEl = document.getElementById("conceptosList");
const trabajadoresListEl = document.getElementById("trabajadoresList");
const nuevoTipoEl = document.getElementById("nuevoTipo");
const nuevoConceptoEl = document.getElementById("nuevoConcepto");
const nuevoTrabajadorEl = document.getElementById("nuevoTrabajador");
const nuevoPorcentajeEl = document.getElementById("nuevoPorcentaje");
const addTipoBtn = document.getElementById("addTipoBtn");
const addConceptoBtn = document.getElementById("addConceptoBtn");
const addTrabajadorBtn = document.getElementById("addTrabajadorBtn");

/* ===== HELPERS ===== */
function fechaHoy() {
  return new Date().toISOString().split("T")[0];
}
function eur(n) {
  return (Number(n || 0)).toFixed(2) + " €";
}
function mesKey(fecha) {
  return (fecha || "").slice(0, 7);
}
function getPorcentajeTrabajador(trabajadorId) {
  if (!trabajadorId) return 40;
  const t = config.trabajadores.find(x => x.id === trabajadorId);
  return t ? Number(t.porcentaje) : 40;
}
function netoMovimiento(m) {
  if (m.tipo !== "Ingreso") return 0;
  const imp = Number(m.importe || 0);
  if (m.gratis) return imp;
  const pct = getPorcentajeTrabajador(m.trabajador);
  return imp * (pct / 100);
}
function facturacionMovimiento(m) {
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

/* ===== TABS ===== */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-btn--active"));
    btn.classList.add("tab-btn--active");
    const tab = btn.dataset.tab;
    document.getElementById("tab-caja").style.display = tab === "caja" ? "" : "none";
    document.getElementById("tab-config").style.display = tab === "config" ? "" : "none";
  });
});

/* ===== Vista PC/Móvil ===== */
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

/* ===== Init inputs ===== */
if (fechaEl) fechaEl.value = fechaHoy();
function initMesFiltro(el) {
  if (!el) return;
  const d = new Date();
  el.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
initMesFiltro(mesFiltroEl);
initMesFiltro(mesFiltroStatsEl);
initMesFiltro(mesFiltroTablaEl);

mesFiltroEl?.addEventListener("change", () => renderSidebar());
mesFiltroStatsEl?.addEventListener("change", () => renderStats());
mesFiltroTablaEl?.addEventListener("change", () => renderTabla());

/* ===== CONFIG: Firestore ===== */
async function loadConfig() {
  try {
    const snap = await getDoc(doc(db, "config", "main"));
    if (snap.exists()) {
      const d = snap.data();
      if (d.tipos) config.tipos = d.tipos;
      if (d.conceptos) config.conceptos = d.conceptos;
      if (d.trabajadores) config.trabajadores = d.trabajadores;
    }
  } catch (e) {
    console.warn("No se pudo cargar config, usando defaults:", e);
  }
  applyConfigToForm();
  renderConfigTab();
}

async function saveConfig() {
  try {
    await setDoc(doc(db, "config", "main"), {
      tipos: config.tipos,
      conceptos: config.conceptos,
      trabajadores: config.trabajadores
    });
  } catch (e) {
    console.error("Error guardando config:", e);
    alert("Error guardando configuración: " + (e.code || e.message));
  }
}

function applyConfigToForm() {
  /* Tipos */
  tipoEl.innerHTML = "";
  config.tipos.forEach(t => {
    const o = document.createElement("option");
    o.value = t; o.textContent = t;
    tipoEl.appendChild(o);
  });

  /* Conceptos */
  conceptoEl.innerHTML = "";
  config.conceptos.forEach(c => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    conceptoEl.appendChild(o);
  });

  /* Trabajadores */
  trabajadorEl.innerHTML = `<option value="">—</option>`;
  config.trabajadores.forEach(t => {
    const o = document.createElement("option");
    o.value = t.id; o.textContent = `${t.id} (${t.porcentaje}%)`;
    trabajadorEl.appendChild(o);
  });
}

/* ===== CONFIG TAB RENDER ===== */
function renderConfigTab() {
  renderConfigList(tiposListEl, config.tipos, "tipo");
  renderConfigList(conceptosListEl, config.conceptos, "concepto");
  renderTrabajadoresList();
}

function renderConfigList(container, items, kind) {
  container.innerHTML = "";
  if (items.length === 0) {
    container.innerHTML = `<div class="config-item"><span style="color:var(--muted)">Sin elementos</span></div>`;
    return;
  }
  items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "config-item";
    div.innerHTML = `
      <span class="config-item__name">${item}</span>
      <button class="btn btn--ghost config-item__del" type="button" data-kind="${kind}" data-idx="${idx}" title="Eliminar">✕</button>
    `;
    container.appendChild(div);
  });
}

function renderTrabajadoresList() {
  trabajadoresListEl.innerHTML = "";
  if (config.trabajadores.length === 0) {
    trabajadoresListEl.innerHTML = `<div class="config-item"><span style="color:var(--muted)">Sin trabajadores</span></div>`;
    return;
  }
  config.trabajadores.forEach((t, idx) => {
    const div = document.createElement("div");
    div.className = "config-item";
    div.innerHTML = `
      <span class="config-item__name">${t.id}</span>
      <div class="config-item__pct">
        <input type="number" class="config-pct-input" value="${t.porcentaje}" min="0" max="100" data-idx="${idx}" title="% nómina" />
        <span style="color:var(--muted);font-size:12px;">%</span>
      </div>
      <button class="btn btn--ghost config-item__del" type="button" data-kind="trabajador" data-idx="${idx}" title="Eliminar">✕</button>
    `;
    container.appendChild(div);
  });

  /* Live update porcentaje */
  trabajadoresListEl.querySelectorAll(".config-pct-input").forEach(input => {
    input.addEventListener("change", async () => {
      const idx = Number(input.dataset.idx);
      config.trabajadores[idx].porcentaje = Number(input.value);
      await saveConfig();
      render();
    });
  });
}

/* Config delete delegation */
[tiposListEl, conceptosListEl, trabajadoresListEl].forEach(el => {
  el?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".config-item__del");
    if (!btn) return;
    const kind = btn.dataset.kind;
    const idx = Number(btn.dataset.idx);

    if (!confirm("¿Eliminar este elemento?")) return;

    if (kind === "tipo") config.tipos.splice(idx, 1);
    else if (kind === "concepto") config.conceptos.splice(idx, 1);
    else if (kind === "trabajador") config.trabajadores.splice(idx, 1);

    await saveConfig();
    applyConfigToForm();
    renderConfigTab();
    render();
  });
});

/* Add tipo */
addTipoBtn?.addEventListener("click", async () => {
  const val = nuevoTipoEl.value.trim();
  if (!val) return;
  if (config.tipos.includes(val)) { alert("Ya existe."); return; }
  config.tipos.push(val);
  nuevoTipoEl.value = "";
  await saveConfig();
  applyConfigToForm();
  renderConfigTab();
});

/* Add concepto */
addConceptoBtn?.addEventListener("click", async () => {
  const val = nuevoConceptoEl.value.trim();
  if (!val) return;
  if (config.conceptos.includes(val)) { alert("Ya existe."); return; }
  config.conceptos.push(val);
  nuevoConceptoEl.value = "";
  await saveConfig();
  applyConfigToForm();
  renderConfigTab();
});

/* Add trabajador */
addTrabajadorBtn?.addEventListener("click", async () => {
  const id = nuevoTrabajadorEl.value.trim().toUpperCase();
  const pct = Number(nuevoPorcentajeEl.value) || 40;
  if (!id) return;
  if (config.trabajadores.find(t => t.id === id)) { alert("Ya existe."); return; }
  config.trabajadores.push({ id, porcentaje: pct });
  nuevoTrabajadorEl.value = "";
  nuevoPorcentajeEl.value = 40;
  await saveConfig();
  applyConfigToForm();
  renderConfigTab();
});

/* ===== Auth persistence ===== */
try {
  await setPersistence(auth, browserLocalPersistence);
} catch (e) {
  console.error("setPersistence error:", e);
}

/* ===== Login / Logout ===== */
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

logoutBtn?.addEventListener("click", async () => {
  await signOut(auth);
});

/* ===== Auth state ===== */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    userEmailEl && (userEmailEl.textContent = "");
    loginBtn && (loginBtn.style.display = "inline-block");
    logoutBtn && (logoutBtn.style.display = "none");

    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    movimientos = [];

    tabla.innerHTML = `<tr><td colspan="8">Inicia sesión para ver los movimientos.</td></tr>`;
    ingresosEl.textContent = gastosEl.textContent = balanceEl.textContent = "0 €";
    resumenTrabajadoresEl.innerHTML = "";
    totalPagarEl.textContent = "0 €";
    facturacionBodyEl.innerHTML = `<tr><td colspan="4">—</td></tr>`;
    totalFacturacionEl.textContent = totalNominaEl.textContent = totalDiferenciaEl.textContent = "0 €";
    return;
  }

  userEmailEl && (userEmailEl.textContent = user.email || "");
  loginBtn && (loginBtn.style.display = "none");
  logoutBtn && (logoutBtn.style.display = "inline-block");

  loadConfig().then(() => iniciarRealtime());
});

function iniciarRealtime() {
  if (unsubscribe) unsubscribe();
  const q = query(collection(db, "movimientos"), orderBy("fecha", "desc"));
  unsubscribe = onSnapshot(q,
    (snap) => {
      movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => {
      console.error("FIRESTORE ERROR:", err);
      alert("Firestore: " + (err.code || err.message));
    }
  );
}

/* ===== Form submit ===== */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireUser()) return;

  const tipo = tipoEl.value;
  const trabajador = trabajadorEl.value;

  if (tipo === "Ingreso" && trabajador === "") {
    alert("Debes seleccionar un trabajador para un Ingreso.");
    return;
  }

  const importe = Math.abs(parseFloat(importeEl.value));
  if (Number.isNaN(importe)) { alert("Importe no válido"); return; }

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
      await addDoc(collection(db, "movimientos"), { ...mov, createdAt: serverTimestamp() });
    }
    form.reset();
    fechaEl.value = fechaHoy();
  } catch (err) {
    alert("No se pudo guardar: " + (err.code || err.message));
  }
});

cancelEditBtn.addEventListener("click", () => {
  editId = null;
  form.reset();
  fechaEl.value = fechaHoy();
  submitBtn.textContent = "Añadir";
  cancelEditBtn.style.display = "none";
});

/* ===== Render ===== */
function render() {
  renderTabla();
  renderStats();
  renderSidebar();
}

function renderStats() {
  const mes = mesFiltroStatsEl?.value || "";
  let ingresos = 0;
  let gastos = 0;

  movimientos.forEach((m) => {
    if (mes && mesKey(m.fecha) !== mes) return;
    const imp = Number(m.importe || 0);
    if ((m.tipo === "Ingreso" || m.tipo === "Inicio de Caja") && !m.gratis) ingresos += imp;
    if (m.tipo === "Gasto") gastos += imp;
  });

  ingresosEl.textContent = eur(ingresos);
  gastosEl.textContent = eur(gastos);
  balanceEl.textContent = eur(ingresos - gastos);
}

function renderTabla() {
  const mes = mesFiltroTablaEl?.value || "";
  tabla.innerHTML = "";

  const filtered = mes ? movimientos.filter(m => mesKey(m.fecha) === mes) : movimientos;

  if (filtered.length === 0) {
    tabla.innerHTML = `<tr><td colspan="8" style="color:var(--muted)">No hay movimientos${mes ? " en ese mes" : ""}.</td></tr>`;
    return;
  }

  filtered.forEach((m) => {
    const imp = Number(m.importe || 0);
    const neto = netoMovimiento(m);
    const pct = m.tipo === "Ingreso" ? getPorcentajeTrabajador(m.trabajador) : null;
    const pctLabel = pct !== null ? `<small style="color:var(--muted);font-size:10px;display:block;">${pct}%</small>` : "";

    tabla.innerHTML += `
      <tr>
        <td>${m.fecha || ""}</td>
        <td>${m.tipo || ""}</td>
        <td>${m.concepto || ""}</td>
        <td>${m.trabajador || "—"}</td>
        <td>${m.gratis ? "Sí" : "No"}</td>
        <td class="right">${eur(imp)}</td>
        <td class="right">${neto ? eur(neto) : "—"}${pctLabel}</td>
        <td class="right">
          <button class="btn btn--secondary" type="button" data-action="edit" data-id="${m.id}">Editar</button>
          <button class="btn" style="border-color:rgba(239,68,68,.35);background:rgba(239,68,68,.14);" type="button" data-action="delete" data-id="${m.id}">Borrar</button>
        </td>
      </tr>
    `;
  });
}

/* Delegación editar/borrar */
tabla.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!action || !id) return;
  if (!requireUser()) return;

  if (action === "delete") {
    if (!confirm("¿Borrar este movimiento?")) return;
    await deleteDoc(doc(db, "movimientos", id));
  }

  if (action === "edit") {
    const m = movimientos.find(x => x.id === id);
    if (!m) return;
    fechaEl.value = m.fecha || fechaHoy();
    tipoEl.value = m.tipo || "Ingreso";
    conceptoEl.value = m.concepto || config.conceptos[0] || "";
    trabajadorEl.value = m.trabajador || "";
    importeEl.value = Number(m.importe || 0);
    gratisEl.checked = !!m.gratis;
    editId = id;
    submitBtn.textContent = "Guardar cambios";
    cancelEditBtn.style.display = "inline-block";
    window.scrollTo({ top: 0, behavior: "smooth" });

    /* Cambiar a tab caja si estamos en config */
    document.querySelector('[data-tab="caja"]')?.click();
  }
});

/* ===== Sidebar ===== */
function renderSidebar() {
  const mes = mesFiltroEl?.value || "";
  const pagos = {};
  const facts = {};
  let totalNomina = 0;
  let totalFact = 0;

  movimientos.forEach((m) => {
    if (m.tipo !== "Ingreso") return;
    if (!m.trabajador) return;
    if (mes && mesKey(m.fecha) !== mes) return;

    const neto = netoMovimiento(m);
    const fact = facturacionMovimiento(m);
    pagos[m.trabajador] = (pagos[m.trabajador] || 0) + neto;
    facts[m.trabajador] = (facts[m.trabajador] || 0) + fact;
  });

  const workers = Array.from(new Set([...Object.keys(pagos), ...Object.keys(facts)])).sort();

  resumenTrabajadoresEl.innerHTML = "";
  if (workers.length === 0) {
    resumenTrabajadoresEl.innerHTML = `<div class="worker"><div><b>Sin datos</b><small>No hay ingresos en ese mes</small></div><div>—</div></div>`;
    totalPagarEl.textContent = "0 €";
  } else {
    workers.forEach((t) => {
      const p = pagos[t] || 0;
      totalNomina += p;
      const pct = getPorcentajeTrabajador(t);
      resumenTrabajadoresEl.innerHTML += `
        <div class="worker">
          <div><b>${t}</b><small>${mes || "Todos los meses"} · ${pct}% nómina</small></div>
          <div><b>${eur(p)}</b></div>
        </div>
      `;
    });
    totalPagarEl.textContent = eur(totalNomina);
  }

  facturacionBodyEl.innerHTML = "";
  if (workers.length === 0) {
    facturacionBodyEl.innerHTML = `<tr><td colspan="4">—</td></tr>`;
    totalFacturacionEl.textContent = totalNominaEl.textContent = totalDiferenciaEl.textContent = "0 €";
    return;
  }

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

  totalFacturacionEl.textContent = eur(totalFact);
  totalNominaEl.textContent = eur(totalNomina);
  totalDiferenciaEl.textContent = eur(totalFact - totalNomina);
}

/* ===== Excel export ===== */
window.descargarExcel = function () {
  const mes = mesFiltroTablaEl?.value || "";
  const source = mes ? movimientos.filter(m => mesKey(m.fecha) === mes) : movimientos;

  const data = source.map((m) => {
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
  XLSX.writeFile(wb, `caja${mes ? "_" + mes : ""}.xlsx`);
};
