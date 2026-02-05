import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider,
  signInWithRedirect, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

/* 🔥 CONFIG */
const firebaseConfig = {
  apiKey: "AIzaSyBmRXxzIOr3sevzlXQQDaWKlpEXEB7si1Y",
  authDomain: "peluqueria-eacca.firebaseapp.com",
  projectId: "peluqueria-eacca"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/* DOM */
const authBar = document.getElementById("authBar");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const userEmail = document.getElementById("userEmail");

const form = document.getElementById("form");
const tabla = document.getElementById("tabla");

const ingresosEl = document.getElementById("ingresos");
const gastosEl = document.getElementById("gastos");
const balanceEl = document.getElementById("balance");

const mesFiltro = document.getElementById("mesFiltro");
const resumenTrabajadores = document.getElementById("resumenTrabajadores");
const totalPagar = document.getElementById("totalPagar");

let movimientos = [];
let unsubscribe = null; // para parar el listener si hace falta

function safeSet(el, prop, value) {
  if (el) el[prop] = value;
}

/* AUTH UI */
if (authBar) authBar.style.display = "flex";

if (loginBtn) {
  loginBtn.onclick = async () => {
    console.log("➡️ Click login: signInWithRedirect");
    try {
      await signInWithRedirect(auth, provider);
    } catch (e) {
      console.error("❌ LOGIN ERROR:", e);
      alert("Error login: " + (e.code || e.message || e));
    }
  };
}

if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("❌ LOGOUT ERROR:", e);
    }
  };
}

/* AUTH STATE */
onAuthStateChanged(auth, (user) => {
  console.log("🔄 AUTH STATE:", user ? user.email : "NO USER");

  if (!user) {
    safeSet(userEmail, "textContent", "");
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";

    // Parar Firestore realtime si estaba activo
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    // No vaciamos la tabla del todo para que veas que falta login
    if (tabla) tabla.innerHTML = `<tr><td colspan="8">Inicia sesión para ver los movimientos.</td></tr>`;
    return;
  }

  safeSet(userEmail, "textContent", user.email || "");
  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-block";

  // Iniciar Firestore SOLO cuando hay usuario
  const q = query(collection(db, "movimientos"), orderBy("fecha"));

  // Si ya había un onSnapshot activo, lo paramos y lo recreamos
  if (unsubscribe) unsubscribe();

  unsubscribe = onSnapshot(
    q,
    (snap) => {
      movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => {
      console.error("❌ FIRESTORE ERROR:", err);
      alert("Firestore bloqueado: " + (err.code || err.message));
    }
  );
});

/* FORM */
if (form) {
  form.onsubmit = async (e) => {
    e.preventDefault();
    const f = form;

    // Si no hay usuario, no permitimos guardar
    if (!auth.currentUser) {
      alert("Primero inicia sesión con Google.");
      return;
    }

    try {
      await addDoc(collection(db, "movimientos"), {
        fecha: f.fecha.value,
        tipo: f.tipo.value,
        concepto: f.concepto.value,
        trabajador: f.trabajador.value,
        gratis: f.gratis.checked,
        importe: Number(f.importe.value)
      });

      form.reset();
    } catch (err) {
      console.error("❌ ADDDOC ERROR:", err);
      alert("No se pudo guardar: " + (err.code || err.message));
    }
  };
}

/* RENDER */
function render() {
  let ing = 0, gas = 0;
  if (!tabla) return;
  tabla.innerHTML = "";

  movimientos.forEach(m => {
    const importe = Number(m.importe || 0);
    const neto = m.gratis ? importe : importe * 0.4;

    if (m.tipo === "Ingreso" && !m.gratis) ing += importe;
    if (m.tipo === "Gasto") gas += importe;

    tabla.innerHTML += `
      <tr>
        <td>${m.fecha || ""}</td>
        <td>${m.tipo || ""}</td>
        <td>${m.concepto || ""}</td>
        <td>${m.trabajador || ""}</td>
        <td>${m.gratis ? "Sí" : "No"}</td>
        <td>${importe.toFixed(2)} €</td>
        <td>${neto.toFixed(2)} €</td>
        <td><button onclick="borrar('${m.id}')">Borrar</button></td>
      </tr>
    `;
  });

  if (ingresosEl) ingresosEl.textContent = ing.toFixed(2) + " €";
  if (gastosEl) gastosEl.textContent = gas.toFixed(2) + " €";
  if (balanceEl) balanceEl.textContent = (ing - gas).toFixed(2) + " €";

  renderSidebar();
}

window.borrar = async (id) => {
  if (!auth.currentUser) {
    alert("Primero inicia sesión con Google.");
    return;
  }
  if (confirm("¿Borrar?")) {
    try {
      await deleteDoc(doc(db, "movimientos", id));
    } catch (err) {
      console.error("❌ DELETE ERROR:", err);
      alert("No se pudo borrar: " + (err.code || err.message));
    }
  }
};

function renderSidebar() {
  if (!mesFiltro || !resumenTrabajadores || !totalPagar) return;

  const mes = mesFiltro.value;
  let total = 0;
  resumenTrabajadores.innerHTML = "";

  const map = {};
  movimientos.forEach(m => {
    if (m.tipo !== "Ingreso") return;
    if (mes && !(m.fecha || "").startsWith(mes)) return;

    const importe = Number(m.importe || 0);
    const neto = m.gratis ? importe : importe * 0.4;

    if (!m.trabajador) return;
    map[m.trabajador] = (map[m.trabajador] || 0) + neto;
  });

  Object.entries(map).forEach(([t, v]) => {
    total += v;
    resumenTrabajadores.innerHTML += `<div>${t}: ${v.toFixed(2)} €</div>`;
  });

  totalPagar.textContent = total.toFixed(2) + " €";
}

/* EXCEL */
window.descargarExcel = () => {
  const data = movimientos.map(m => ({
    Fecha: m.fecha,
    Tipo: m.tipo,
    Trabajador: m.trabajador,
    Importe: Number(m.importe || 0),
    Neto: m.gratis ? Number(m.importe || 0) : Number(m.importe || 0) * 0.4
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Caja");
  XLSX.writeFile(wb, "caja.xlsx");
};
