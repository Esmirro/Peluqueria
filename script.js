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

/* AUTH */
authBar.style.display = "flex";
loginBtn.onclick = () => signInWithRedirect(auth, provider);
logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  if (!user) {
    userEmail.textContent = "";
    loginBtn.style.display = "inline";
    logoutBtn.style.display = "none";
    tabla.innerHTML = "";
    return;
  }

  userEmail.textContent = user.email;
  loginBtn.style.display = "none";
  logoutBtn.style.display = "inline";

  const q = query(collection(db, "movimientos"), orderBy("fecha"));
  onSnapshot(q, snap => {
    movimientos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });
});

/* FORM */
form.onsubmit = async e => {
  e.preventDefault();
  const f = form;

  await addDoc(collection(db, "movimientos"), {
    fecha: f.fecha.value,
    tipo: f.tipo.value,
    concepto: f.concepto.value,
    trabajador: f.trabajador.value,
    gratis: f.gratis.checked,
    importe: Number(f.importe.value)
  });

  form.reset();
};

/* RENDER */
function render() {
  let ing = 0, gas = 0;
  tabla.innerHTML = "";

  movimientos.forEach(m => {
    if (m.tipo === "Ingreso" && !m.gratis) ing += m.importe;
    if (m.tipo === "Gasto") gas += m.importe;

    const neto = m.gratis ? m.importe : m.importe * 0.4;

    tabla.innerHTML += `
      <tr>
        <td>${m.fecha}</td>
        <td>${m.tipo}</td>
        <td>${m.concepto}</td>
        <td>${m.trabajador}</td>
        <td>${m.gratis ? "Sí" : "No"}</td>
        <td>${m.importe.toFixed(2)} €</td>
        <td>${neto.toFixed(2)} €</td>
        <td><button onclick="borrar('${m.id}')">Borrar</button></td>
      </tr>
    `;
  });

  ingresosEl.textContent = ing.toFixed(2) + " €";
  gastosEl.textContent = gas.toFixed(2) + " €";
  balanceEl.textContent = (ing - gas).toFixed(2) + " €";

  renderSidebar();
}

window.borrar = async id => {
  if (confirm("¿Borrar?")) await deleteDoc(doc(db, "movimientos", id));
};

function renderSidebar() {
  const mes = mesFiltro.value;
  let total = 0;
  resumenTrabajadores.innerHTML = "";

  const map = {};
  movimientos.forEach(m => {
    if (m.tipo !== "Ingreso") return;
    if (mes && !m.fecha.startsWith(mes)) return;
    const neto = m.gratis ? m.importe : m.importe * 0.4;
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
    Importe: m.importe,
    Neto: m.gratis ? m.importe : m.importe * 0.4
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Caja");
  XLSX.writeFile(wb, "caja.xlsx");
};



