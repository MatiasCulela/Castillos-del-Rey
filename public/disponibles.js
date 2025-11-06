document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("castillosContainer");

  try {
    const res = await fetch("/castillos/activos");
    const castillos = await res.json();

    container.innerHTML = "";

    castillos.forEach(c => {
      const card = document.createElement("div");
      card.className = "card";

      // Usar la foto de la base de datos si existe, si no imagen por defecto
      let imgSrc = c.foto && c.foto !== "" ? c.foto : "img/default.jpg";
      if (!imgSrc.startsWith("/")) imgSrc = "/" + imgSrc;

      card.innerHTML = `
        <img src="${imgSrc}" alt="${c.nombre}" />
        <h3>${c.nombre}</h3>
        <p>${c.descripcion}</p>
        <p>Capacidad: ${c.capacidad}</p>
        <p>Precio: $${c.precio}</p>
        <button onclick="seleccionarCastillo(${c.id_castillo})">Reservar</button>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    container.innerHTML = "<p>Error cargando castillos.</p>";
    console.error(error);
  }
});

function seleccionarCastillo(id) {
  localStorage.setItem("castilloSeleccionado", id);
  window.location.href = "reserva.html";
}
