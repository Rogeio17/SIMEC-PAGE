function getToken() {
  return localStorage.getItem("token");
}

function setToken(t) {
  localStorage.setItem("token", t);
}

function logout() {
  localStorage.removeItem("token");
  location.href = "/login.html";
}

// 🔒 Si no hay token y no estás en login -> manda a login
(function protect() {
  const token = getToken();
  const isLogin = location.pathname.endsWith("/login.html") || location.pathname.endsWith("login.html");

  if (!token && !isLogin) location.href = "/login.html";
})();

// 🔐 Login
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const msg = document.getElementById("msg");
  const btn = document.getElementById("btn");

  msg.textContent = "";
  btn.disabled = true;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!data.ok) {
      msg.textContent = data.message || "No se pudo iniciar sesión";
      btn.disabled = false;
      return;
    }

    setToken(data.token);
    msg.textContent = "Entrando…";
    msg.classList.add("ok");
    location.href = "/index.html";
  } catch (e) {
    msg.textContent = "Error de conexión";
    btn.disabled = false;
  }
}

