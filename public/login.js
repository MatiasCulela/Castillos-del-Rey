document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = form.username.value.trim();
    const password = form.password.value.trim();

    if (!username || !password) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Error del servidor:", errorText);
        alert(`Error en el servidor: ${res.status}`);
        return;
      }

      const data = await res.json();

      if (data.success) {
        localStorage.setItem("username", username);
        localStorage.setItem("logueado", "true");
        localStorage.setItem("rol", data.rol);

        // 🔹 Permitir que "jefe" también vaya a /admin
        if (data.rol === "admin" || data.rol === "jefe") {
          window.location.href = "/admin";
        } else {
          window.location.href = "/inicio.html";
        }
      } else {
        // 🔥 Mostrar el mensaje que manda el backend
        alert(data.message || "Usuario o contraseña incorrectos.");
      }
    } catch (error) {
      console.error("Fetch error:", error);
      alert("Error en el servidor, intentá nuevamente.");
    }
  });

  // ================= CERRAR SESIÓN =================
  const btnCerrarSesion = document.getElementById("btnCerrarSesion");
  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "/";
    });
  }
});
