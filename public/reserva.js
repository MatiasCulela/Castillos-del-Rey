// ================= ELEMENTOS =================
const fechaInput = document.getElementById("fecha");
const horaInicioInput = document.getElementById("hora_inicio");
const horaFinInput = document.getElementById("hora_fin");
const listaCastillos = document.getElementById("listaCastillos");
const direccionInput = document.getElementById("direccion");
const celularInput = document.getElementById("celular");
const nombreClienteInput = document.getElementById("nombre_cliente");
const apellidoClienteInput = document.getElementById("apellido_cliente");

let castillos = [];
let castilloSeleccionadoId = null;

// ================= FUNCIONES AUXILIARES =================
function normalizarHoraCompleta(horaStr) {
  if (!horaStr) return "00:00:00";
  const [hh, mm] = horaStr.split(":");
  const hhNorm = hh.padStart(2, "0");
  const mmNorm = mm.padStart(2, "0");
  return `${hhNorm}:${mmNorm}:00`; // formato HH:MM:SS
}

function horaAMinutos(horaStr) {
  if (!horaStr) return 0;
  const parts = horaStr.split(":");
  const hh = Number(parts[0]) || 0;
  const mm = Number(parts[1]) || 0;
  return hh * 60 + mm;
}

// ================= RENDERIZAR CASTILLOS =================
async function renderCastillos() {
  listaCastillos.innerHTML = "";

  try {
    const res = await fetch("/castillos/activos");
    if (!res.ok) throw new Error("Error al obtener castillos activos");
    castillos = await res.json();

    if (castillos.length === 0) {
      listaCastillos.textContent = "No hay castillos para mostrar.";
      return;
    }

    castillos.forEach(castillo => {
      const card = document.createElement("div");
      card.className = "castillo-card seleccionable";
      card.dataset.id = castillo.id_castillo;

      let imgRuta = castillo.foto && castillo.foto !== "" ? castillo.foto : "img/default.jpg";
      if (!imgRuta.startsWith("/")) imgRuta = "/" + imgRuta;

      card.innerHTML = `
        <img src="${imgRuta}" alt="Castillo ${castillo.id_castillo}" />
        <h3>${castillo.nombre}</h3>
        <p>${castillo.descripcion}</p>
        <button type="button" class="btn-seleccionar">Seleccionar</button>
      `;

      card.querySelector(".btn-seleccionar").addEventListener("click", () => {
        document.querySelectorAll(".seleccionable").forEach(el => el.classList.remove("seleccionado"));
        card.classList.add("seleccionado");
        castilloSeleccionadoId = castillo.id_castillo;
      });

      listaCastillos.appendChild(card);
    });

  } catch (error) {
    console.error("Error al cargar castillos:", error);
    listaCastillos.textContent = "No se pudieron cargar los castillos.";
  }
}

// ================= VALIDACIONES =================
function validarCelular(celular) {
  const regex = /^(09\d{7}|\+5989\d{7})$/;
  return regex.test(celular);
}

function validarDireccion(direccion) {
  return direccion.length >= 5;
}

// ================= RESERVAR =================
async function reservar(e) {
  e.preventDefault();

  if (!castilloSeleccionadoId) {
    alert("Por favor seleccioná un castillo.");
    return;
  }

  let fecha = fechaInput.value;
  let hora_inicio = normalizarHoraCompleta(horaInicioInput.value);
  let hora_fin = normalizarHoraCompleta(horaFinInput.value);

  const direccion = direccionInput.value.trim();
  const celular = celularInput.value.trim();
  const nombre_cliente = nombreClienteInput.value.trim();
  const apellido_cliente = apellidoClienteInput.value.trim();

  if (!fecha || !horaInicioInput.value || !horaFinInput.value || !direccion || !celular || !nombre_cliente || !apellido_cliente) {
    alert("Por favor completá todos los campos.");
    return;
  }

  if (!validarCelular(celular)) {
    alert("El celular ingresado no es válido. Ejemplo: 09XXXXXXX o +5989XXXXXXX");
    return;
  }

  if (!validarDireccion(direccion)) {
    alert("La dirección debe tener al menos 5 caracteres.");
    return;
  }

  const inicioMinSeleccionado = horaAMinutos(horaInicioInput.value);
  const finMinSeleccionado = horaAMinutos(horaFinInput.value);

  if (finMinSeleccionado <= inicioMinSeleccionado) {
    alert("La hora de fin debe ser posterior a la hora de inicio.");
    return;
  }

  const username = localStorage.getItem("username");
  if (!username) {
    alert("No estás logueado.");
    return;
  }

  const datosReserva = { 
    fecha, 
    hora_inicio, 
    hora_fin, 
    id_castillo: castilloSeleccionadoId, 
    username, 
    direccion, 
    celular,
    nombre_cliente,
    apellido_cliente
  };

  try {
    const res = await fetch("/reserva", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datosReserva),
    });

    const json = await res.json();

    if (json.success) {
      alert("Reserva realizada con éxito.");
      fechaInput.value = "";
      horaInicioInput.value = "";
      horaFinInput.value = "";
      direccionInput.value = "";
      celularInput.value = "";
      nombreClienteInput.value = "";
      apellidoClienteInput.value = "";
      castilloSeleccionadoId = null;
      document.querySelectorAll(".seleccionable").forEach(el => el.classList.remove("seleccionado"));
    } else {
      // NUEVO: mensaje específico si el castillo está inactivo
      if (json.message && json.message.toLowerCase().includes("mantenimiento")) {
        alert("Este castillo está temporalmente en mantenimiento y no puede ser reservado.");
      } else {
        alert("Error al reservar: " + (json.message || "respuesta no exitosa"));
      }
    }

  } catch (error) {
    console.error("Error al enviar reserva:", error);
    alert("Hubo un error al enviar la reserva.");
  }
}


// ================= EVENTOS =================
document.getElementById("formReserva").addEventListener("submit", reservar);

renderCastillos();
