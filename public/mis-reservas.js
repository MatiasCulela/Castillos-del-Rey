// Verificar sesión y rol
const username = localStorage.getItem("username");
const rol = localStorage.getItem("rol");

if (!username || rol !== "cliente") {
  alert("No tenés permisos para acceder a esta página.");
  window.location.href = "/login";
}

// Cerrar sesión
document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("username");
  localStorage.removeItem("rol");
  localStorage.removeItem("logueado");
  window.location.href = "/login";
});

// Función para cargar reservas del usuario
async function cargarReservas() {
  try {
    const res = await fetch(`/mis-reservas?username=${username}`);
    const reservas = await res.json();

    const tbody = document.querySelector("#tablaReservas tbody");
    tbody.innerHTML = "";

    if (reservas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9">No hay reservas</td></tr>`;
      return;
    }

    reservas.forEach(r => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.id_reserva}</td>
        <td>${r.nombre_castillo || r.id_castillo}</td>
        <td>${r.fecha_reserva}</td>
        <td>${r.hora_inicio}</td>
        <td>${r.hora_fin}</td>
        <td>${r.estado}</td>
        <td>${r.direccion}</td>
        <td>${r.celular}</td>
        <td>
          ${r.estado !== "cancelada" ? `<button class="cancelar-btn" data-id="${r.id_reserva}">Cancelar</button>` : ""}
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Botones de cancelar reserva
    document.querySelectorAll(".cancelar-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id_reserva = btn.dataset.id;
        if (!confirm("¿Querés cancelar esta reserva?")) return;

        try {
          const resCancel = await fetch("/reserva/estado", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_reserva, estado: "cancelada" })
          });
          const json = await resCancel.json();
          if (json.success) {
            alert("Reserva cancelada con éxito.");
            cargarReservas();
          } else {
            alert("No se pudo cancelar la reserva.");
          }
        } catch (err) {
          console.error("Error al cancelar:", err);
          alert("Error al cancelar reserva.");
        }
      });
    });

  } catch (err) {
    console.error("Error al cargar reservas:", err);
    alert("No se pudieron cargar las reservas.");
  }
}

// Cargar reservas al iniciar
cargarReservas();
