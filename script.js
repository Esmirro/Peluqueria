// script.js (ES MODULE)

// ===== Firebase imports =====
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

// ===== Firebase config =====
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

const mesFiltroEl = document.getElementById("mesFiltro");
const resumenTrabajadoresEl = document.getElementById("resumenTrabajadores");
const totalPagarEl = document.getElementById("totalPagar");

// ===== Estado =====
let movimientos = [];
let editId = null;
let unsubscribe = null;

// ===== Utils =====
function fechaHoy() {
  return new Date().toISOString().split("T")[0];
}
function eur(n) {
  return Number(n || 0).toFixed(2) + " €";
}
function mesKey(f) {
  return (f || "").slice(0, 7);
}
function calcularNeto(m) {
  return m.gratis ? m.importe : m.importe * 0.4;
}

// ===== AUTH UI =====
authBar.style.display = "block";

loginBtn.onclick = () => signInWithRedirect(auth, provider);
logoutBtn.onclick = () => signOut(auth);

// ===== Auth state =====
onAuthStateChanged(auth, (user) => {
  if (!user) {
    // No logueado
    userEmailEl.textContent = "";
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";

    if (unsubscribe) unsubscribe();
    movimientos = [];
    render();
    return;
  }

  // Logueado
  userEmailEl.textContent = user.email;
  loginBtn.style.display = "none";
  logoutBtn.style.display = "inline-block";

  iniciarFirestore();
});

// ===== Firestore realtime =====
function iniciarFirestore() {
  if (unsubscribe) unsubscribe();

  const q = query(
    collection(db, "movimientos"),
    orderBy("fecha", "asc"),
    orderBy("createdAt", "asc")
  );

  unsubscribe = onSnapshot(q, (snap) => {
    movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });
}

// ===== Form =====
fechaEl.value = fechaHoy();

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const mov = {
    fecha: fechaEl.value,
    tipo: tipoEl.value,
    concepto: conceptoEl.value,
    trabajador: trabajadorEl.value || "",
    gratis: gratisEl.checked,
    importe: Math.abs(parseFloat(importeEl.value))
  };

  if (editId) {
    await updateDoc(doc(db, "movimientos", editId), {
      ...mov,
      updatedAt: serverTimestamp()
    });
    editId = null;
  } else {
    await addDoc(collection(db, "movimientos"), {
      ...mov,
      createdAt: serverTimestamp()
    });
  }

  form.reset();
  fechaEl.value = fechaHoy();
});

// ===== Render =====
function render() {
  tabla.innerHTML = "";

  let ingresos = 0;
  let gastos = 0;

  movimientos.forEach(m => {
    if ((m.tipo === "Ingreso" || m.tipo === "Inicio de Caja") && !m.gratis)
      ingresos += m.importe;
    if (m.tipo === "Gasto") gastos += m.importe;

    tabla.innerHTML += `
      <tr>
        <td>${m.fecha}</td>
        <td>${m.tipo}</td>
        <td>${m.concepto}</td>
        <td>${m.trabajador}</td>
        <td>${m.gratis ? "Sí" : "No"}</td>
        <td class="right">${eur(m.importe)}</td>
        <td class="right"><b>${eur(calcularNeto(m))}</b></td>
        <td class="right">
          <button data-edit="${m.id}">Editar</button>
          <button data-del="${m.id}">Borrar</button>
        </td>
      </tr>
    `;
  });

  ingresosEl.textContent = eur(ingresos);
  gastosEl.textContent = eur(gastos);
  balanceEl.textContent = eur(ingresos - gastos);

  renderSidebar();
}

// ===== Sidebar =====
function renderSidebar() {
  if (!mesFiltroEl) return;

  const mes = mesFiltroEl.value;
  const tot = {};

  movimientos.forEach(m => {
    if (m.tipo !== "Ingreso") return;
    if (mes && mesKey(m.fecha) !== mes) return;
    if (!m.trabajador) return;

    tot[m.trabajador] = (tot[m.trabajador] || 0) + calcularNeto(m);
  });

  resumenTrabajadoresEl.innerHTML = "";
  let total = 0;

  Object.keys(tot).sort().forEach(t => {
    total += tot[t];
    resumenTrabajadoresEl.innerHTML += `
      <div class="worker-item">
        <b>${t}</b>
        <span>${eur(tot[t])}</span>
      </div>
    `;
  });

  totalPagarEl.textContent = eur(total);
}

// ===== Edit / Delete =====
tabla.onclick = async (e) => {
  const id = e.target.dataset.edit || e.target.dataset.del;
  if (!id) return;

  if (e.target.dataset.edit) {
    const m = movimientos.find(x => x.id === id);
    fechaEl.value = m.fecha;
    tipoEl.value = m.tipo;
    conceptoEl.value = m.concepto;
    trabajadorEl.value = m.trabajador;
    importeEl.value = m.importe;
    gratisEl.checked = m.gratis;
    editId = id;
  }

  if (e.target.dataset.del && confirm("¿Borrar este movimiento?")) {
    await deleteDoc(doc(db, "movimientos", id));
  }
};

// ===== Excel =====
window.descargarExcel = function () {
  const data = movimientos.map(m => ({
    Fecha: m.fecha,
    Tipo: m.tipo,
    Concepto: m.concepto,
    Trabajador: m.trabajador,
    Importe: m.importe,
    Neto: calcularNeto(m)
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Caja");
  XLSX.writeFile(wb, "caja.xlsx");
};

