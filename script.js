// ===== Firebase imports (MODULE) =====
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

import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// ===== Firebase config (COMPLETA) =====
const firebaseConfig = {
  apiKey: "AIzaSyBmRXxzIOr3sevzlXQQDaWKlpEXEB7si1Y",
  authDomain: "peluqueria-eacca.firebaseapp.com",
  projectId: "peluqueria-eacca",
  storageBucket: "peluqueria-eacca.firebasestorage.app",
  messagingSenderId: "104134229616",
  appId: "1:104134229616:web:64673e422f16a682fafeb5"
};

// ===== Init =====
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// ===== DOM =====
const authBar = document.getElementById("authBar");
const userEmailEl = document.getElementById("userEmail");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

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
const resumenTrabajadoresEl = document.getElementById("resumenTrabajadores");
const totalPagarEl = document.getElementById("totalPagar");

// ===== State =====
let movimientos = [];
let unsubscribe = null;
let editId = null;

// ===== Helpers =====
function fechaHoy() {
  return new Date().toISOString().split("T")[0];
}
function eur(n) {
  return (Number(n || 0)).toFixed(2) + " €";
}
function mesKey(fecha) {
  return (fecha || "").slice(0, 7); // YYYY-MM
}
function netoMovimiento(m) {
  // Neto solo tiene sentido en Ingresos
  if (m.tipo !== "Ingreso") return 0;
  const imp = Number(m.importe || 0);
  return m.gratis ? imp : imp * 0.4;
}
function requireUser() {
  if (!auth.currentUser) {
    alert("Primero inicia sesión con Google.");
    return false;
  }
  return true;
}

// ===== UI init =====
if (authBar) authBar.style.display = "flex";
if (fechaEl) fechaEl.value = fechaHoy();

// mes filtro default: mes actual
if (mesFiltroEl) {
  const d = new Date();
  const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  mesFiltroEl.value = ym;
  mesFiltroEl.addEventListener("change", () => renderSidebar());
}

// ===== Auth buttons =====
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    try {
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error("LOGIN ERROR:", e);
      alert("Error de login: " + (e.code || e.message));
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("LOGOUT ERROR:", e);
    }
  });
}

// ===== Auth state =====
onAuthStateChanged(auth, (user) => {
  console.log("🔄 AUTH STATE:", user ? user.email : "NO USER");

  if (!user) {
    userEmailEl.textContent = "";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";

    if (unsubscribe) unsubscribe();
    unsubscribe = null;

    movimientos = [];
    tabla.innerHTML = `<tr><td colspan="8">Inicia sesión para ver los movimientos.</td></tr>`;
    ingresosEl.textContent = "0 €";
    gastosEl.textContent = "0 €";
    balanceEl.textContent = "0 €";
    resumenTrabajadoresEl.innerHTML = "";
    totalPagarEl.textContent = "0 €";
    return;
  }

  userEmailEl.textContent = user.email || "";
  loginBtn.style.display = "none";
  logoutBtn.style.display = "inline-block";

  iniciarRealtime();
});

function iniciarRealtime() {
  if (unsubscribe) unsubscribe();

  // Orden simple para evitar problemas de índices
  const q = query(collection(db, "movimientos"), orderBy("fecha", "desc"));

  unsubscribe = onSnapshot(
    q,
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

// ===== Form submit =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireUser()) return;

  const tipo = tipoEl.value;
  const trabajador = trabajadorEl.value;

  if (tipo !== "Inicio de Caja" && tipo !== "Gasto" && trabajador === "") {
    alert("Debes seleccionar un trabajador para un Ingreso.");
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

    form.reset();
    fechaEl.value = fechaHoy();
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
});

// ===== Render =====
function render() {
  tabla.innerHTML = "";

  let ingresos = 0;
  let gastos = 0;

  movimientos.forEach((m) => {
    const imp = Number(m.importe || 0);

    // Gratis no suma a ingresos
    if ((m.tipo === "Ingreso" || m.tipo === "Inicio de Caja") && !m.gratis) ingresos += imp;
    if (m.tipo === "Gasto") gastos += imp;

    const neto = netoMovimiento(m);

    tabla.innerHTML += `
      <tr>
        <td>${m.fecha || ""}</td>
        <td>${m.tipo || ""}</td>
        <td>${m.concepto || ""}</td>
        <td>${m.trabajador || "—"}</td>
        <td>${m.gratis ? '<span class="badge">Sí</span>' : '<span class="badge">No</span>'}</td>
        <td class="right">${eur(imp)}</td>
        <td class="right"><b>${neto ? eur(neto) : "—"}</b></td>
        <td class="right">
          <button class="btn btn--secondary" type="button" data-action="edit" data-id="${m.id}">Editar</button>
          <button class="btn danger" type="button" data-action="delete" data-id="${m.id}">Borrar</button>
        </td>
      </tr>
    `;
  });

  ingresosEl.textContent = eur(ingresos);
  gastosEl.textContent = eur(gastos);
  balanceEl.textContent = eur(ingresos - gastos);

  renderSidebar();
}

// Delegación de eventos para editar/borrar
tabla.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!action || !id) return;

  if (!requireUser()) return;

  if (action === "delete") {
    if (!confirm("¿Borrar este movimiento?")) return;
    try {
      await deleteDoc(doc(db, "movimientos", id));
    } catch (err) {
      console.error("DELETE ERROR:", err);
      alert("No se pudo borrar: " + (err.code || err.message));
    }
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

// ===== Sidebar render =====
function renderSidebar() {
  const mes = mesFiltroEl ? mesFiltroEl.value : "";
  const totales = {};
  let total = 0;

  movimientos.forEach((m) => {
    if (m.tipo !== "Ingreso") return; // pagos solo por ingresos
    if (!m.trabajador) return;
    if (mes && mesKey(m.fecha) !== mes) return;

    const neto = netoMovimiento(m);
    totales[m.trabajador] = (totales[m.trabajador] || 0) + neto;
  });

  const keys = Object.keys(totales).sort();
  resumenTrabajadoresEl.innerHTML = "";

  if (keys.length === 0) {
    resumenTrabajadoresEl.innerHTML = `<div class="worker"><div><b>Sin datos</b><small>No hay ingresos en ese mes</small></div><div>—</div></div>`;
    totalPagarEl.textContent = "0 €";
    return;
  }

  keys.forEach((t) => {
    total += totales[t];
    resumenTrabajadoresEl.innerHTML += `
      <div class="worker">
        <div>
          <b>${t}</b>
          <small>${mes || "Todos los meses"}</small>
        </div>
        <div><b>${eur(totales[t])}</b></div>
      </div>
    `;
  });

  totalPagarEl.textContent = eur(total);
}

// ===== Excel export =====
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
