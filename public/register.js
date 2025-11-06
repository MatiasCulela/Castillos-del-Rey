document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = form.username.value.trim();
    const correo = form.correo.value.trim(); // ✅ cambiado de email → correo
    const password = form.password.value.trim();
    const confirmPassword = form.confirm_password.value.trim();

    if (!username || !correo || !password || !confirmPassword) { // ✅ ahora valida el correo también
      alert("Por favor, completa todos los campos.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Las contraseñas no coinciden.");
      return;
    }

    try {
      const res = await fetch("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, correo }), // ✅ cambiado email → correo
      });

      const data = await res.json();

      if (data.success) {
        alert("¡Registro exitoso! Ahora podés iniciar sesión.");
        window.location.href = "/login.html";
      } else {
        alert(data.message || "Error al registrarse.");
      }
    } catch (error) {
      alert("Error al conectarse al servidor.");
      console.error("Error:", error);
    }
  });
});
