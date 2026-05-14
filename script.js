import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect,
  signOut, onAuthStateChanged,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

/* ─── Firebase config ─────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyBmRXxzIOr3sevzlXQQDaWKlpEXEB7si1Y",
  authDomain: "peluqueria-eacca.firebaseapp.com",
  projectId: "peluqueria-eacca",
  storageBucket: "peluqueria-eacca.firebasestorage.app",
  messagingSenderId: "104134229616",
  appId: "1:104134229616:web:64673e422f16a682fafeb5"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

/* ═══════════════════════════════════════════════════
   ADMIN DATA — localStorage
═══════════════════════════════════════════════════ */
const DEFAULTS = {
  tipos:        ["Ingreso", "Gasto", "Inicio de Caja"],
  conceptos:    ["Corte", "Inicio Caja"],
  trabajadores: ["TR02", "TR03", "TR04", "TR05", "TR06"]
};

function getAdminData(key) {
  try {
    const raw = localStorage.getItem("admin_" + key);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return [...DEFAULTS[key]];
}
function saveAdminData(key, arr) {
  localStorage.setItem("admin_" + key, JSON.stringify(arr));
}

/* ─── Poblar selects del formulario y filtros ─── */
function populateFormSelects() {
  const tipos        = getAdminData("tipos");
  const conceptos    = getAdminData("conceptos");
  const trabajadores = getAdminData("trabajadores");

  tipoEl.innerHTML = tipos.map(t => `<option value="${t}">${t}</option>`).join("");
  conceptoEl.innerHTML = conceptos.map(c => `<option value="${c}">${c}</option>`).join("");
  trabajadorEl.innerHTML = `<option value="">—</option>` +
    trabajadores.map(t => `<option value="${t}">${t}</option>`).join("");

  // Filtros (guardar selección actual)
  const selTipo     = filtroTipoEl?.value     || "";
  const selConcepto = filtroConceptoEl?.value  || "";
  const selTrab     = filtroTrabajadorEl?.value || "";

  if (filtroTipoEl) {
    filtroTipoEl.innerHTML = `<option value="">Todos</option>` +
      tipos.map(t => `<option value="${t}"${t===selTipo?" selected":""}>${t}</option>`).join("");
  }
  if (filtroConceptoEl) {
    filtroConceptoEl.innerHTML = `<option value="">Todos</option>` +
      conceptos.map(c => `<option value="${c}"${c===selConcepto?" selected":""}>${c}</option>`).join("");
  }
  if (filtroTrabajadorEl) {
    filtroTrabajadorEl.innerHTML = `<option value="">Todos</option>` +
      trabajadores.map(t => `<option value="${t}"${t===selTrab?" selected":""}>${t}</option>`).join("");
  }
}

/* ═══════════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════════ */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-btn--active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("tab-content--active"));
    btn.classList.add("tab-btn--active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("tab-content--active");
    if (btn.dataset.tab === "admin") renderAdminLists();
  });
});

/* ═══════════════════════════════════════════════════
   ADMIN — Listas
═══════════════════════════════════════════════════ */
function renderAdminList(key, ulId) {
  const ul = document.getElementById(ulId);
  if (!ul) return;
  const items = getAdminData(key);
  if (items.length === 0) {
    ul.innerHTML = `<li class="admin-empty">Sin elementos</li>`;
    return;
  }
  ul.innerHTML = items.map((item, i) => `
    <li class="admin-item">
      <span class="admin-item__name">${item}</span>
      <div class="admin-item__actions">
        <button class="btn btn--outline btn--sm" type="button"
          data-key="${key}" data-index="${i}" data-action="edit">Editar</button>
        <button class="btn btn--danger btn--sm" type="button"
          data-key="${key}" data-index="${i}" data-action="delete">Borrar</button>
      </div>
    </li>
  `).join("");
}

function renderAdminLists() {
  renderAdminList("tipos",        "listaTipos");
  renderAdminList("conceptos",    "listaConceptos");
  renderAdminList("trabajadores", "listaTrabajadores");
}

function setupAddBtn(btnId, inputId, key, ulId) {
  const btn   = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  if (!btn || !input) return;

  btn.addEventListener("click", () => {
    const val = input.value.trim();
    if (!val) { input.focus(); return; }
    const items = getAdminData(key);
    if (items.includes(val)) { alert(`"${val}" ya existe.`); return; }
    items.push(val);
    saveAdminData(key, items);
    input.value = "";
    renderAdminList(key, ulId);
    populateFormSelects();
  });
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); btn.click(); } });
}

setupAddBtn("btnAddTipo",        "nuevoTipo",        "tipos",        "listaTipos");
setupAddBtn("btnAddConcepto",    "nuevoConcepto",    "conceptos",    "listaConceptos");
setupAddBtn("btnAddTrabajador",  "nuevoTrabajador",  "trabajadores", "listaTrabajadores");

["listaTipos", "listaConceptos", "listaTrabajadores"].forEach(ulId => {
  const ul = document.getElementById(ulId);
  if (!ul) return;
  ul.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const { key, index, action } = btn.dataset;
    const i = parseInt(index, 10);
    if (action === "delete") {
      const items = getAdminData(key);
      if (!confirm(`¿Borrar "${items[i]}"?`)) return;
      items.splice(i, 1);
      saveAdminData(key, items);
      renderAdminList(key, ulId);
      populateFormSelects();
    }
    if (action === "edit") {
      const items = getAdminData(key);
      openModal(items[i], newVal => {
        items[i] = newVal;
        saveAdminData(key, items);
        renderAdminList(key, ulId);
        populateFormSelects();
      });
    }
  });
});

/* ═══════════════════════════════════════════════════
   MODAL
═══════════════════════════════════════════════════ */
const modal        = document.getElementById("adminModal");
const modalInput   = document.getElementById("modalInput");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel  = document.getElementById("modalCancel");
let modalCallback  = null;

function openModal(currentVal, callback) {
  modalInput.value = currentVal;
  modalCallback = callback;
  modal.style.display = "flex";
  setTimeout(() => modalInput.focus(), 50);
}
function closeModal() {
  modal.style.display = "none";
  modalCallback = null;
}
modalConfirm.addEventListener("click", () => {
  const val = modalInput.value.trim();
  if (!val) { modalInput.focus(); return; }
  if (modalCallback) modalCallback(val);
  closeModal();
});
modalCancel.addEventListener("click", closeModal);
modalInput.addEventListener("keydown", e => {
  if (e.key === "Enter")  modalConfirm.click();
  if (e.key === "Escape") closeModal();
});
modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

/* ═══════════════════════════════════════════════════
   DOM REFS — formulario caja
═══════════════════════════════════════════════════ */
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

// Stats filtros
const statsDesdeEl      = document.getElementById("statsDesde");
const statsHastaEl      = document.getElementById("statsHasta");
const statsPeriodEl     = document.getElementById("statsPeriod");
const btnLimpiarStatsEl = document.getElementById("btnLimpiarStats");

const mesFiltroEl            = document.getElementById("mesFiltro");
const resumenTrabajadoresEl  = document.getElementById("resumenTrabajadores");
const totalPagarEl           = document.getElementById("totalPagar");
const facturacionBodyEl      = document.getElementById("facturacionBody");
const totalFacturacionEl     = document.getElementById("totalFacturacion");
const totalNominaEl          = document.getElementById("totalNomina");
const totalDiferenciaEl      = document.getElementById("totalDiferencia");

// Filtros tabla
const filtroDesdeEl      = document.getElementById("filtroDesde");
const filtroHastaEl      = document.getElementById("filtroHasta");
const filtroTipoEl       = document.getElementById("filtroTipo");
const filtroConceptoEl   = document.getElementById("filtroConcepto");
const filtroTrabajadorEl = document.getElementById("filtroTrabajador");
const btnLimpiarFiltros  = document.getElementById("btnLimpiarFiltros");
const filtroContadorEl   = document.getElementById("filtroContador");

let movimientos = [];
let unsubscribe = null;
let editId      = null;

/* Poblar selects al cargar */
populateFormSelects();

/* Stats filtros — listeners */
statsDesdeEl?.addEventListener("change", () => renderStats());
statsHastaEl?.addEventListener("change", () => renderStats());
btnLimpiarStatsEl?.addEventListener("click", () => {
  if (statsDesdeEl) statsDesdeEl.value = "";
  if (statsHastaEl) statsHastaEl.value = "";
  renderStats();
});

/* ─── Escuchar cambios en filtros ─── */
[filtroDesdeEl, filtroHastaEl, filtroTipoEl, filtroConceptoEl, filtroTrabajadorEl].forEach(el => {
  el?.addEventListener("change", () => renderTabla());
});

btnLimpiarFiltros?.addEventListener("click", () => {
  if (filtroDesdeEl)      filtroDesdeEl.value      = "";
  if (filtroHastaEl)      filtroHastaEl.value      = "";
  if (filtroTipoEl)       filtroTipoEl.value       = "";
  if (filtroConceptoEl)   filtroConceptoEl.value   = "";
  if (filtroTrabajadorEl) filtroTrabajadorEl.value = "";
  renderTabla();
});

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
function fechaHoy() { return new Date().toISOString().split("T")[0]; }

function eur(n) {
  return (Number(n || 0)).toLocaleString("es-ES", {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }) + " €";
}

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

function tipoBadge(tipo) {
  const map = {
    "Ingreso":       "badge--ingreso",
    "Gasto":         "badge--gasto",
    "Inicio de Caja":"badge--inicio"
  };
  const cls = map[tipo] || "badge--default";
  return `<span class="badge ${cls}">${tipo}</span>`;
}

/* ═══════════════════════════════════════════════════
   VISTA PC / MÓVIL
═══════════════════════════════════════════════════ */
function applyViewMode(mode) {
  document.body.classList.remove("force-mobile", "force-desktop");
  if (mode === "mobile")  document.body.classList.add("force-mobile");
  if (mode === "desktop") document.body.classList.add("force-desktop");
  if (viewToggleBtn) viewToggleBtn.textContent = mode === "mobile" ? "🖥" : "📱";
  localStorage.setItem("viewMode", mode);
}
(function initViewMode() {
  const saved = localStorage.getItem("viewMode");
  applyViewMode(saved === "mobile" ? "mobile" : "desktop");
})();
viewToggleBtn?.addEventListener("click", () => {
  applyViewMode(document.body.classList.contains("force-mobile") ? "desktop" : "mobile");
});

/* ═══════════════════════════════════════════════════
   INIT INPUTS
═══════════════════════════════════════════════════ */
if (fechaEl) fechaEl.value = fechaHoy();
if (mesFiltroEl) {
  const d = new Date();
  mesFiltroEl.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  mesFiltroEl.addEventListener("change", () => renderSidebar());
}

/* ═══════════════════════════════════════════════════
   AUTH
═══════════════════════════════════════════════════ */
try {
  await setPersistence(auth, browserLocalPersistence);
} catch (e) { console.error("setPersistence:", e); }

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

onAuthStateChanged(auth, user => {
  if (!user) {
    if (userEmailEl) userEmailEl.textContent = "";
    if (loginBtn)  loginBtn.style.display  = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    movimientos = [];
    resetUI();
    return;
  }
  if (userEmailEl) userEmailEl.textContent = user.email || "";
  if (loginBtn)  loginBtn.style.display  = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-flex";
  iniciarRealtime();
});

function resetUI() {
  if (tabla) tabla.innerHTML = `<tr><td colspan="8" class="empty-cell">Inicia sesión para ver los movimientos.</td></tr>`;
  if (ingresosEl) ingresosEl.textContent = "0,00 €";
  if (gastosEl)   gastosEl.textContent   = "0,00 €";
  if (balanceEl)  balanceEl.textContent  = "0,00 €";
  if (statsPeriodEl) statsPeriodEl.textContent = "";
  if (resumenTrabajadoresEl) resumenTrabajadoresEl.innerHTML = "";
  if (totalPagarEl)          totalPagarEl.textContent = "0,00 €";
  if (facturacionBodyEl)     facturacionBodyEl.innerHTML = `<tr><td colspan="4" class="empty-cell">—</td></tr>`;
  if (totalFacturacionEl)    totalFacturacionEl.textContent = "0,00 €";
  if (totalNominaEl)         totalNominaEl.textContent = "0,00 €";
  if (totalDiferenciaEl)     totalDiferenciaEl.textContent = "0,00 €";
  if (filtroContadorEl)      filtroContadorEl.textContent = "";
}

function iniciarRealtime() {
  if (unsubscribe) unsubscribe();
  const q = query(collection(db, "movimientos"), orderBy("fecha", "desc"));
  unsubscribe = onSnapshot(q,
    snap => {
      movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    },
    err => { console.error("FIRESTORE:", err); alert("Firestore: " + (err.code || err.message)); }
  );
}

/* ═══════════════════════════════════════════════════
   FORM SUBMIT
═══════════════════════════════════════════════════ */
form.addEventListener("submit", async e => {
  e.preventDefault();
  if (!requireUser()) return;

  const tipo      = tipoEl.value;
  const trabajador = trabajadorEl.value;
  if (tipo === "Ingreso" && !trabajador) {
    alert("Selecciona un trabajador para un Ingreso.");
    return;
  }

  const importe = Math.abs(parseFloat(importeEl.value));
  if (Number.isNaN(importe)) { alert("Importe no válido"); return; }

  const mov = {
    fecha:      fechaEl.value,
    tipo,
    concepto:   conceptoEl.value,
    trabajador: trabajador || "",
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
    populateFormSelects();
  } catch (err) {
    console.error("SAVE:", err);
    alert("No se pudo guardar: " + (err.code || err.message));
  }
});

cancelEditBtn.addEventListener("click", () => {
  editId = null;
  form.reset();
  fechaEl.value = fechaHoy();
  populateFormSelects();
  submitBtn.textContent = "Añadir";
  cancelEditBtn.style.display = "none";
});

/* ═══════════════════════════════════════════════════
   RENDER — totales globales + tabla + sidebar
═══════════════════════════════════════════════════ */
function render() {
  renderStats();
  renderTabla();
  renderSidebar();
}

/* ─── Stats con filtro de fecha ─── */
function renderStats() {
  const desde = statsDesdeEl?.value || "";
  const hasta = statsHastaEl?.value || "";

  let ingresos = 0, gastos = 0;
  movimientos.forEach(m => {
    const imp = Number(m.importe || 0);
    if (desde && m.fecha < desde) return;
    if (hasta && m.fecha > hasta) return;
    if ((m.tipo === "Ingreso" || m.tipo === "Inicio de Caja") && !m.gratis) ingresos += imp;
    if (m.tipo === "Gasto") gastos += imp;
  });

  ingresosEl.textContent = eur(ingresos);
  gastosEl.textContent   = eur(gastos);
  balanceEl.textContent  = eur(ingresos - gastos);

  if (statsPeriodEl) {
    if (desde || hasta) {
      const d = desde ? new Date(desde).toLocaleDateString("es-ES") : "inicio";
      const h = hasta ? new Date(hasta).toLocaleDateString("es-ES") : "hoy";
      statsPeriodEl.textContent = `Período: ${d} → ${h}`;
    } else {
      statsPeriodEl.textContent = "Todos los movimientos";
    }
  }
}

/* ─── Tabla con filtros ─── */
function getFiltros() {
  return {
    desde:      filtroDesdeEl?.value      || "",
    hasta:      filtroHastaEl?.value      || "",
    tipo:       filtroTipoEl?.value       || "",
    concepto:   filtroConceptoEl?.value   || "",
    trabajador: filtroTrabajadorEl?.value || ""
  };
}

function filtrarMovimientos() {
  const f = getFiltros();
  return movimientos.filter(m => {
    if (f.desde      && m.fecha < f.desde)      return false;
    if (f.hasta      && m.fecha > f.hasta)      return false;
    if (f.tipo       && m.tipo       !== f.tipo)       return false;
    if (f.concepto   && m.concepto   !== f.concepto)   return false;
    if (f.trabajador && m.trabajador !== f.trabajador) return false;
    return true;
  });
}

function renderTabla() {
  const filtered = filtrarMovimientos();

  // Contador
  if (filtroContadorEl) {
    const hayFiltros = Object.values(getFiltros()).some(v => v !== "");
    filtroContadorEl.textContent = hayFiltros
      ? `${filtered.length} de ${movimientos.length} movimientos`
      : `${movimientos.length} movimientos`;
  }

  if (filtered.length === 0) {
    tabla.innerHTML = `<tr><td colspan="8" class="empty-cell">Sin movimientos para los filtros aplicados.</td></tr>`;
    return;
  }

  tabla.innerHTML = filtered.map(m => {
    const imp  = Number(m.importe || 0);
    const neto = netoMovimiento(m);
    return `
      <tr>
        <td>${m.fecha || ""}</td>
        <td>${tipoBadge(m.tipo)}</td>
        <td>${m.concepto || ""}</td>
        <td>${m.trabajador || "—"}</td>
        <td>${m.gratis ? '<span class="pill-gratis">Gratis</span>' : ""}</td>
        <td class="num">${eur(imp)}</td>
        <td class="num">${neto ? eur(neto) : "—"}</td>
        <td class="num" style="white-space:nowrap">
          <button class="btn btn--outline btn--sm" data-action="edit"   data-id="${m.id}">Editar</button>
          <button class="btn btn--danger  btn--sm" data-action="delete" data-id="${m.id}">Borrar</button>
        </td>
      </tr>
    `;
  }).join("");
}

/* Delegación editar/borrar */
tabla.addEventListener("click", async e => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (!action || !id) return;
  if (!requireUser()) return;

  if (action === "delete") {
    if (!confirm("¿Borrar este movimiento?")) return;
    await deleteDoc(doc(db, "movimientos", id));
  }

  if (action === "edit") {
    const m = movimientos.find(x => x.id === id);
    if (!m) return;
    fechaEl.value      = m.fecha      || fechaHoy();
    tipoEl.value       = m.tipo       || "Ingreso";
    conceptoEl.value   = m.concepto   || "";
    trabajadorEl.value = m.trabajador || "";
    importeEl.value    = Number(m.importe || 0);
    gratisEl.checked   = !!m.gratis;

    editId = id;
    submitBtn.textContent = "Guardar cambios";
    cancelEditBtn.style.display = "inline-flex";

    // Cambiar a pestaña Caja
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("tab-btn--active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("tab-content--active"));
    document.querySelector('[data-tab="caja"]').classList.add("tab-btn--active");
    document.getElementById("tab-caja").classList.add("tab-content--active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

/* ─── Sidebar ─── */
function renderSidebar() {
  const mes  = mesFiltroEl?.value || "";
  const pagos = {}, facts = {};
  let totalNomina = 0, totalFact = 0;

  movimientos.forEach(m => {
    if (m.tipo !== "Ingreso" || !m.trabajador) return;
    if (mes && mesKey(m.fecha) !== mes) return;
    pagos[m.trabajador] = (pagos[m.trabajador] || 0) + netoMovimiento(m);
    facts[m.trabajador] = (facts[m.trabajador] || 0) + facturacionMovimiento(m);
  });

  const workers = Array.from(new Set([...Object.keys(pagos), ...Object.keys(facts)])).sort();

  resumenTrabajadoresEl.innerHTML = "";
  if (workers.length === 0) {
    resumenTrabajadoresEl.innerHTML = `<div class="worker-row"><span class="worker-row__name" style="color:var(--text2)">Sin datos</span></div>`;
    totalPagarEl.textContent = "0,00 €";
  } else {
    workers.forEach(t => {
      const p = pagos[t] || 0;
      totalNomina += p;
      resumenTrabajadoresEl.innerHTML += `
        <div class="worker-row">
          <span class="worker-row__name">${t}</span>
          <span class="worker-row__val">${eur(p)}</span>
        </div>`;
    });
    totalPagarEl.textContent = eur(totalNomina);
  }

  facturacionBodyEl.innerHTML = "";
  if (workers.length === 0) {
    facturacionBodyEl.innerHTML = `<tr><td colspan="4" class="empty-cell">—</td></tr>`;
    totalFacturacionEl.textContent = "0,00 €";
    totalNominaEl.textContent      = "0,00 €";
    totalDiferenciaEl.textContent  = "0,00 €";
    return;
  }

  workers.forEach(t => {
    const f = facts[t] || 0;
    const n = pagos[t]  || 0;
    totalFact += f;
    facturacionBodyEl.innerHTML += `
      <tr>
        <td>${t}</td>
        <td>${eur(f)}</td>
        <td>${eur(n)}</td>
        <td><b>${eur(f - n)}</b></td>
      </tr>`;
  });

  totalFacturacionEl.textContent = eur(totalFact);
  totalNominaEl.textContent      = eur(totalNomina);
  totalDiferenciaEl.textContent  = eur(totalFact - totalNomina);
}

/* ═══════════════════════════════════════════════════
   EXCEL EXPORT
═══════════════════════════════════════════════════ */
window.descargarExcel = function () {
  const filtered = filtrarMovimientos();
  const data = filtered.map(m => ({
    Fecha:      m.fecha || "",
    Tipo:       m.tipo  || "",
    Concepto:   m.concepto   || "",
    Trabajador: m.trabajador || "",
    Gratis:     m.gratis ? "Sí" : "No",
    Importe:    Number(m.importe || 0).toFixed(2).replace(".", ","),
    Neto:       netoMovimiento(m) ? netoMovimiento(m).toFixed(2).replace(".", ",") : ""
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Caja");
  XLSX.writeFile(wb, "caja.xlsx");
};
