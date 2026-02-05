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
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

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
provider.setCustomParameters({ prompt: "select_account" }); // fuerza elegir cuenta

// DOM
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

const tabla = document.getElementById("tabla");
const ingresosEl = document.getElementById("ingresos");
const gastosEl = document.getElementById("gastos");
const balanceEl = document.getElementById("balance");

const mesFiltroEl = document.getElementById("mesFiltro");
const resumenTrabajadoresEl = document.getElementById("resumenTrabajadores");
const totalPagarEl = document.getElementById("totalPagar");

let movimientos = [];
let unsubscribe = null;

function fechaHoy() {
  return new Date().toISOString().split("T")[0];
}
function eur(n) {
  return (Number(n || 0)).toFixed(2) + " €";
}
function mesKey(fecha) {
  return (fecha || "").slice(0, 7);
}
function netoMovimiento(m) {
  if (m.tipo !== "Ingreso") return 0;
  const imp = Number(m.importe || 0);
  return m.gratis ? imp : imp * 0.4;
}

if (fechaEl) fechaEl.value = fechaHoy();

// Persistencia
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
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    try {
      console.log("➡️ Login (popup)...");
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error("❌ Popup login error:", e);
      // Si el popup está bloqueado, hacemos redirect como plan B
      if (e?.code === "auth/popup-blocked" || e?.code === "auth/cancelled-popup-request") {
        alert("Popup bloqueado. Probando con redirect…");
        await signInWithRedirect(auth, provider);
      } else {
        alert("LOGIN ERROR: " + (e.code || e.message));
      }
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

onAuthStateChanged(auth, (user) => {
  console.log("🔄 AUTH STATE:", user ? user.email : "NO USER");

  if (!user) {
    if (userEmailEl) userEmailEl.textContent = "";
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";

    if (unsubscribe) unsubscribe();
    unsubscribe = null;

    if (tabla) tabla.innerHTML = `<tr><td colspan="8">Inicia sesión para ver/crear movimientos.</td></tr>`;
    if (ingresosEl) ingresosEl.textContent = "0 €";
    if (gastosEl) gastosEl.textContent = "0 €";
    if (balanceEl) balanceEl.textContent = "0 €";
    if (resumenTrabajadoresEl) resumenTrabajadoresEl.innerHTML = "";
    if (totalPagarEl) totalPagarEl.textContent = "0 €";
    return;
  }

  if (userEmailEl) userEmailEl.textContent = user.email || "";
  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-block";

  iniciarRealtime();
});

function iniciarRealtime() {
  if (unsubscribe) unsubscribe();
  const q = query(collection(db, "movimientos"), orderBy("fecha", "desc"));

  unsubscribe = onSnapshot(
    q,
    (snap) => {
      movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => {
      console.error("❌ FIRESTORE ERROR:", err);
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

if (form) {
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
    if (Number.isNaN(importe)) {
      alert("Importe no válido");
      return;
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

function render() {
  if (!tabla) return;

  tabla.innerHTML = "";
  let ingresos = 0;
  let gastos = 0;

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
          <button type="button" onclick="borrar('${m.id}')">Borrar</button>
        </td>
      </tr>
    `;
  });

  if (ingresosEl) ingresosEl.textContent = eur(ingresos);
  if (gastosEl) gastosEl.textContent = eur(gastos);
  if (balanceEl) balanceEl.textContent = eur(ingresos - gastos);

  renderSidebar();
}

window.borrar = async (id) => {
  if (!requireUser()) return;
  if (!confirm("¿Borrar este movimiento?")) return;
  await deleteDoc(doc(db, "movimientos", id));
};

function renderSidebar() {
  if (!mesFiltroEl || !resumenTrabajadoresEl || !totalPagarEl) return;

  const mes = mesFiltroEl.value;
  const totales = {};
  let total = 0;

  movimientos.forEach((m) => {
    if (m.tipo !== "Ingreso") return;
    if (!m.trabajador) return;
    if (mes && mesKey(m.fecha) !== mes) return;

    const neto = netoMovimiento(m);
    totales[m.trabajador] = (totales[m.trabajador] || 0) + neto;
  });

  const keys = Object.keys(totales).sort();
  resumenTrabajadoresEl.innerHTML = "";

  if (keys.length === 0) {
    resumenTrabajadoresEl.innerHTML = `<div>Sin datos para ese mes</div>`;
    totalPagarEl.textContent = "0 €";
    return;
  }

  keys.forEach((t) => {
    total += totales[t];
    resumenTrabajadoresEl.innerHTML += `<div>${t}: ${eur(totales[t])}</div>`;
  });

  totalPagarEl.textContent = eur(total);
}
