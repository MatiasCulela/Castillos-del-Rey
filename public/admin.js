document.addEventListener("DOMContentLoaded", () => {
  const username = localStorage.getItem("username");
  const rol = localStorage.getItem("rol");

if (!username || (rol !== "admin" && rol !== "jefe")) {
  alert("Acceso no autorizado.");
  window.location.href = "/login";
  return;
}


  document.getElementById("usernameDisplay").textContent = username;

  document.getElementById("btnCerrarSesion").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "/login";
  });

  // Variables globales para calendario
  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();
  let reservasGlobales = [];

  // Crear modal para detalle de reserva
  const modal = document.getElementById("detalleReservaModal");

  // ================== SECCIONES ==================
  function mostrarSeccion(seccionId) {
    const secciones = document.querySelectorAll(".section");
    secciones.forEach(sec => {
      sec.style.display = "none"; // ocultar todas
    });
    const target = document.getElementById(seccionId);
    if (target) target.style.display = "block"; // mostrar la deseada
  }

  // ================== NAV LATERAL ==================
  document.getElementById("navReservas").addEventListener("click", () => {
    mostrarSeccion("sectionReservas");
  });

  document.getElementById("navCastillos").addEventListener("click", () => {
    mostrarSeccion("sectionCastillos");
    mostrarCastillos();
  });

document.getElementById("navClientes").addEventListener("click", () => {
  if (rol === "jefe") {
    mostrarSeccion("sectionClientes");
    mostrarClientes();
  } else {
    alert("No tienes autorizacion para entrar.");
    mostrarSeccion("sectionReservas"); // o redirigir a otra sección segura
  }
});


  document.getElementById("navEstadisticas").addEventListener("click", () => {
    mostrarSeccion("sectionEstadisticas");
    cargarEstadisticas();
  });

  document.getElementById("navHistorial").addEventListener("click", () => {
  mostrarSeccion("sectionHistorial");
  mostrarHistorial();
});


  // ================== RESERVAS ==================
  async function mostrarReservas(ruta) {
    try {
      const res = await fetch(ruta);
      if (!res.ok) throw new Error("Error al obtener reservas");
      const data = await res.json();
      mostrarTablaReservas(data);
    } catch (error) {
      alert("Error al cargar reservas.");
      console.error(error);
    }
  }

  function mostrarTablaReservas(reservas) {
    const container = document.getElementById("reservasContainer");
    container.innerHTML = "";

    if (reservas.length === 0) {
      container.textContent = "No hay reservas para mostrar.";
      return;
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>Castillo</th>
        <th>Usuario</th>
        <th>Dirección</th>
        <th>Celular</th>
        <th>Fecha</th>
        <th>Hora Inicio</th>
        <th>Hora Fin</th>
        <th>Estado</th>
        <th>Acciones</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    reservas.forEach(r => {
      const tr = document.createElement("tr");

      const direccionInput = document.createElement("input");
      direccionInput.type = "text";
      direccionInput.value = r.direccion || "";

      const celularInput = document.createElement("input");
      celularInput.type = "text";
      celularInput.value = r.celular || "";

      const btnGuardar = document.createElement("button");
      btnGuardar.textContent = "Guardar Datos";
      btnGuardar.addEventListener("click", async () => {
  try {
    
    const username = localStorage.getItem("username");

          const res = await fetch("/reserva/actualizar-datos", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id_reserva: r.id_reserva,
              direccion: direccionInput.value,
              celular: celularInput.value,
              username: username
            })
          });
          const json = await res.json();

          if (json.success) alert("Datos actualizados correctamente");
          else alert("Error al actualizar datos: " + json.message);
        } catch (error) {
          alert("Error al actualizar datos");
          console.error(error);
        }
      });

      let acciones = "";
      if (r.estado === "pendiente") {
        acciones = `
          <button onclick="actualizarEstado(${r.id_reserva}, 'confirmada')">Confirmar</button>
          <button onclick="actualizarEstado(${r.id_reserva}, 'cancelada')">Cancelar</button>
        `;
      } else if (r.estado === "confirmada") {
        acciones = `<button onclick="actualizarEstado(${r.id_reserva}, 'cancelada')">Cancelar</button>`;
      } else if (r.estado === "cancelada") {
        acciones = `<button onclick="actualizarEstado(${r.id_reserva}, 'confirmada')">Confirmar</button>`;
      }

      const tdCastillo = document.createElement("td");
      tdCastillo.textContent = r.nombre_castillo || "";

      const tdUsuario = document.createElement("td");
      tdUsuario.textContent = `${r.nombre_cliente || ""} ${r.apellido_cliente || ""}`;

      const tdDireccion = document.createElement("td");
      tdDireccion.appendChild(direccionInput);

      const tdCelular = document.createElement("td");
      tdCelular.appendChild(celularInput);

      const tdFecha = document.createElement("td");
      tdFecha.textContent = r.fecha_reserva;

      const tdHoraInicio = document.createElement("td");
      tdHoraInicio.textContent = r.hora_inicio;

      const tdHoraFin = document.createElement("td");
      tdHoraFin.textContent = r.hora_fin;

      const tdEstado = document.createElement("td");
      tdEstado.textContent = r.estado;

      const tdAcciones = document.createElement("td");
      tdAcciones.innerHTML = acciones;
      tdAcciones.appendChild(btnGuardar);

      tr.appendChild(tdCastillo);
      tr.appendChild(tdUsuario);
      tr.appendChild(tdDireccion);
      tr.appendChild(tdCelular);
      tr.appendChild(tdFecha);
      tr.appendChild(tdHoraInicio);
      tr.appendChild(tdHoraFin);
      tr.appendChild(tdEstado);
      tr.appendChild(tdAcciones);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  }

window.actualizarEstado = async function(id_reserva, estado) {
  try {
    const username = localStorage.getItem("username"); // ✅ obtenemos username

    const res = await fetch("/reserva/estado", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_reserva, estado, username }) // ✅ enviamos username
    });
    if (!res.ok) throw new Error("Error al actualizar estado");
    mostrarReservas("/reservas-admin");
    await cargarReservas();
    mostrarCalendario(currentMonth, currentYear);
  } catch (error) {
    alert("Error al actualizar el estado de la reserva.");
    console.error(error);
  }
};



  document.getElementById("btnVerPendientes").addEventListener("click", () => mostrarReservas("/reservas-admin?estado=pendiente"));
  document.getElementById("btnVerConfirmadas").addEventListener("click", () => mostrarReservas("/reservas-admin?estado=confirmada"));
  document.getElementById("btnVerCanceladas").addEventListener("click", () => mostrarReservas("/reservas-admin?estado=cancelada"));

  // ================== FILTRADO POR CLIENTE ==================
  async function cargarClientes() {
    try {
      const res = await fetch("/clientes-con-reservas");
      if (!res.ok) throw new Error("Error al cargar clientes");
      const clientes = await res.json();

      const select = document.getElementById("selectCliente");
      select.innerHTML = '<option value="">-- Seleccione un cliente --</option>';

      clientes.forEach(c => {
        const option = document.createElement("option");
        option.value = `${c.nombre_cliente} ${c.apellido_cliente}`;
        option.textContent = `${c.nombre_cliente} ${c.apellido_cliente}`;
        select.appendChild(option);
      });
    } catch (error) {
      console.error("Error al cargar clientes:", error);
    }
  }

  document.getElementById("btnVerReservasCliente").addEventListener("click", async () => {
    const select = document.getElementById("selectCliente");
    const nombreApellido = select.value;
    if (!nombreApellido) {
      alert("Seleccione un cliente");
      return;
    }

    const [nombre, apellido] = nombreApellido.split(" ");

    try {
      const res = await fetch("/reservas-admin"); 
      if (!res.ok) throw new Error("Error al obtener reservas");
      const data = await res.json();

      const filtradas = data.filter(r => r.nombre_cliente === nombre && r.apellido_cliente === apellido);
      mostrarTablaReservas(filtradas);
    } catch (error) {
      console.error(error);
      alert("Error al filtrar reservas por cliente");
    }
  });

  cargarClientes();

// ================== CASTILLOS ==================
async function mostrarCastillos() {
  try {
    const res = await fetch("/castillos");
    if (!res.ok) throw new Error("Error al obtener castillos");
    const castillos = await res.json();

    const container = document.getElementById("castillosContainer");
    container.innerHTML = "";

    if (castillos.length === 0) {
      container.textContent = "No hay castillos para mostrar.";
      return;
    }

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>ID</th>
        <th>Nombre</th>
        <th>Descripción</th>
        <th>Imagen</th>
        <th>Capacidad</th>
        <th>Precio</th>
        <th>Activo/Inactivo</th>
        <th>Reservas</th>
        <th>Acciones</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    castillos.forEach(c => {
      const tr = document.createElement("tr");

      // Normalizamos el valor activo para que sea siempre 0 o 1 numérico
      const estado = Number(c.activo) === 1 ? 1 : 0;

      // Imagen
      let imgRuta = c.foto && c.foto !== "" ? c.foto : "img/default.jpg";
      if (!imgRuta.startsWith("/")) imgRuta = "/" + imgRuta;
      const imgElem = document.createElement("img");
      imgElem.src = imgRuta;
      imgElem.width = 80;

      // Botón editar
      const tdAcciones = document.createElement("td");
      const btn = document.createElement("button");
      btn.textContent = "Editar";
      btn.addEventListener("click", () => editarCastillo(c));
      tdAcciones.appendChild(btn);

      // Select activo/inactivo
      const select = document.createElement("select");
      select.classList.add("select-estado-castillo");
      select.dataset.id = c.id_castillo;

      const optionActivo = document.createElement("option");
      optionActivo.value = "1";
      optionActivo.textContent = "Activo";

      const optionInactivo = document.createElement("option");
      optionInactivo.value = "0";
      optionInactivo.textContent = "Inactivo";

      select.appendChild(optionActivo);
      select.appendChild(optionInactivo);

      // ✅ Aquí corregimos la comparación
      select.value = String(estado);

      // Columnas de la tabla
      tr.appendChild(document.createElement("td")).textContent = c.id_castillo;
      tr.appendChild(document.createElement("td")).textContent = c.nombre;
      tr.appendChild(document.createElement("td")).textContent = c.descripcion;

      const tdImg = document.createElement("td");
      tdImg.appendChild(imgElem);
      tr.appendChild(tdImg);

      tr.appendChild(document.createElement("td")).textContent = c.capacidad;
      tr.appendChild(document.createElement("td")).textContent = c.precio;

      const tdActivo = document.createElement("td");
      tdActivo.appendChild(select);
      tr.appendChild(tdActivo);

      tr.appendChild(document.createElement("td")).textContent = c.reservas_count;
      tr.appendChild(tdAcciones);

      // Pintamos según estado
      tr.style.backgroundColor = estado === 1 ? "#e0ffe0" : "#ffe0e0";

      tbody.appendChild(tr);

      // Evento de cambio
      select.addEventListener("change", async (e) => {
        const id_castillo = e.target.dataset.id;
        const activo = Number(e.target.value);
        try {
          
          const username = localStorage.getItem("username"); // ✅
          
          const res = await fetch("/castillo/estado", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_castillo, activo, username })
          });
          const json = await res.json();
          if (!json.success) throw new Error(json.message);

          // Actualizamos fondo y select según lo guardado en la DB
          tr.style.backgroundColor = activo === 1 ? "#e0ffe0" : "#ffe0e0";
          alert(json.message);
        } catch (err) {
          console.error(err);
          alert("Error al actualizar estado del castillo");
        }
      });

    });

    table.appendChild(tbody);
    container.appendChild(table);

  } catch (error) {
    alert("Error al cargar castillos.");
    console.error(error);
  }
}







  function editarCastillo(c) {
    document.getElementById("editarCastilloModal").style.display = "block";
    document.getElementById("editId").value = c.id_castillo;
    document.getElementById("editNombre").value = c.nombre;
    document.getElementById("editDescripcion").value = c.descripcion;
    document.getElementById("editCapacidad").value = c.capacidad;
    document.getElementById("editPrecio").value = c.precio;
    document.getElementById("editImagen").value = "";
  }

  document.getElementById("btnCancelarEdit").addEventListener("click", () => {
    document.getElementById("editarCastilloModal").style.display = "none";
  });

  document.getElementById("btnGuardarCastillo").addEventListener("click", async () => {
    const id = document.getElementById("editId").value;
    const nombre = document.getElementById("editNombre").value;
    const descripcion = document.getElementById("editDescripcion").value;
    const capacidad = parseInt(document.getElementById("editCapacidad").value);
    const precio = parseFloat(document.getElementById("editPrecio").value);
    const imagenFile = document.getElementById("editImagen").files[0];

    const formData = new FormData();
    formData.append("id_castillo", id);
    formData.append("nombre", nombre);
    formData.append("descripcion", descripcion);
    formData.append("capacidad", capacidad);
    formData.append("precio", precio);
    if (imagenFile) formData.append("imagen", imagenFile);

    try {
      const res = await fetch("/castillo/modificar", { method: "PUT", body: formData });
      const json = await res.json();
      if (json.success) {
        alert("Castillo modificado con éxito");
        document.getElementById("editarCastilloModal").style.display = "none";
        mostrarCastillos();
      } else alert("Error al modificar castillo: " + json.message);
    } catch (error) {
      alert("Error al modificar castillo");
      console.error(error);
    }
  });
  document.getElementById("formAgregarCastillo").addEventListener("submit", async (e) => {
  e.preventDefault();

  const formData = new FormData();
  formData.append("nombre", document.getElementById("nombreCastillo").value);
  formData.append("descripcion", document.getElementById("descripcionCastillo").value);
  formData.append("capacidad", document.getElementById("capacidadCastillo").value);
  formData.append("precio", document.getElementById("precioCastillo").value);
  formData.append("foto", document.getElementById("fotoCastillo").files[0]);

  try {
    const res = await fetch("/castillos", {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    alert(data.message);

    if (data.success) {
      // Si todo salió bien, refresca la tabla de castillos
      mostrarCastillos(); 
      e.target.reset(); // limpia el formulario
    }
  } catch (err) {
    console.error("Error al agregar castillo:", err);
    alert("Hubo un error al agregar el castillo.");
  }
});


  // ================== CALENDARIO ==================
  async function cargarReservas() {
    try {
      const res = await fetch("/reservas-admin?estado=confirmada");
      if (!res.ok) throw new Error("Error al obtener reservas");
      reservasGlobales = await res.json();
    } catch (error) {
      alert("Error al cargar reservas.");
      console.error(error);
    }
  }

  function parseFechaLocal(fechaStr) {
    if (!fechaStr) return null;
    const m = fechaStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const year = Number(m[1]);
      const month = Number(m[2]);
      const day = Number(m[3]);
      return new Date(year, month - 1, day);
    }
    const d = new Date(fechaStr);
    if (!isNaN(d)) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return null;
  }

  function parseFechaHoraLocal(fechaStr, horaStr) {
    const base = parseFechaLocal(fechaStr);
    if (!base) return null;
    if (!horaStr) return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0);
    const parts = horaStr.split(":").map(s => Number(s));
    const hh = parts[0] || 0;
    const mm = parts[1] || 0;
    const ss = parts[2] || 0;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, ss);
  }

  async function mostrarCalendario(mes, anio) {
    const container = document.getElementById("calendarioContainer");
    if (!container) return;
    container.innerHTML = "";

    const primerDia = new Date(anio, mes, 1).getDay();
    const diasMes = new Date(anio, mes + 1, 0).getDate();

    const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const diasSemana = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

    const controles = document.createElement("div");
    controles.style.textAlign = "center";
    controles.style.marginBottom = "10px";

    const btnPrev = document.createElement("button");
    btnPrev.textContent = "<";
    btnPrev.style.marginRight = "10px";
    btnPrev.addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      mostrarCalendario(currentMonth, currentYear);
    });

    const btnNext = document.createElement("button");
    btnNext.textContent = ">";
    btnNext.style.marginLeft = "10px";
    btnNext.addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      mostrarCalendario(currentMonth, currentYear);
    });

    const tituloMes = document.createElement("span");
    tituloMes.classList.add("mes");
    tituloMes.textContent = `${meses[mes]} ${anio}`;
    tituloMes.style.fontSize = "1.5rem";
    tituloMes.style.fontWeight = "bold";

    controles.appendChild(btnPrev);
    controles.appendChild(tituloMes);
    controles.appendChild(btnNext);
    container.appendChild(controles);

    const diasHeader = document.createElement("div");
    diasHeader.classList.add("dias-semana");
    diasSemana.forEach(d => {
      const diaDiv = document.createElement("div");
      diaDiv.textContent = d;
      diasHeader.appendChild(diaDiv);
    });
    container.appendChild(diasHeader);

    const calendario = document.createElement("div");
    calendario.classList.add("calendario");
    calendario.style.display = "grid";
    calendario.style.gridTemplateColumns = "repeat(7, 1fr)";
    calendario.style.gap = "10px";

    for (let i = 0; i < primerDia; i++) {
      const placeholder = document.createElement("div");
      calendario.appendChild(placeholder);
    }

    for (let dia = 1; dia <= diasMes; dia++) {
      const diaDiv = document.createElement("div");
      diaDiv.classList.add("dia");

      const titulo = document.createElement("h4");
      titulo.textContent = dia;
      diaDiv.appendChild(titulo);

      const reservasDia = reservasGlobales.filter(r => {
        const fecha = parseFechaLocal(r.fecha_reserva);
        return fecha && fecha.getDate() === dia && fecha.getMonth() === mes && fecha.getFullYear() === anio;
      });

      reservasDia.forEach(r => {
        const slot = document.createElement("div");
        slot.classList.add("reserva-slot", r.estado);

        const fechaInicio = parseFechaHoraLocal(r.fecha_reserva, r.hora_inicio);
        const fechaFin = parseFechaHoraLocal(r.fecha_reserva, r.hora_fin);

        const formatHora = h => ("0"+h.getHours()).slice(-2) + ":" + ("0"+h.getMinutes()).slice(-2);

        slot.textContent = `${r.nombre_castillo} (${formatHora(fechaInicio)}-${formatHora(fechaFin)})`;

        slot.addEventListener("click", () => {
          document.getElementById("detalleContenido").innerHTML = `
            <p><strong>Castillo:</strong> ${r.nombre_castillo}</p>
            <p><strong>Dirección:</strong> ${r.direccion}</p>
            <p><strong>Celular:</strong> ${r.celular}</p>
            <p><strong>Hora:</strong> ${formatHora(fechaInicio)} - ${formatHora(fechaFin)}</p>
            <p><strong>Estado:</strong> ${r.estado}</p>
          `;
          modal.style.display = "block";
        });

        diaDiv.appendChild(slot);
      });

      calendario.appendChild(diaDiv);
    }

    container.appendChild(calendario);
  }

  // inicializamos
  (async () => {
    await cargarReservas();
    mostrarCalendario(currentMonth, currentYear);
    mostrarSeccion("sectionReservas"); // mostrar solo reservas al inicio
  })();

  

// ================== CLIENTES(estado)==================
async function mostrarClientes() {
  try {
    const res = await fetch("/clientes");
    if (!res.ok) return; // <-- línea corregida: ya no lanza alerta ni error
    const clientes = await res.json();

    const container = document.getElementById("clientesContainer");
    container.innerHTML = "";

    if (clientes.length === 0) {
      container.textContent = "No hay clientes registrados.";
      return;
    }

    const table = document.createElement("table");
    table.classList.add("tabla-clientes");

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th>Username</th>
        <th>Password</th>
        <th>Correo</th>
        <th>Rol</th>
        <th>Estado</th>
        <th>Acciones</th> 
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    clientes.forEach(c => {
      const tr = document.createElement("tr");

      // Convertimos activo a número para el select
      const activoValue = c.activo ? 1 : 0;

      tr.innerHTML = `
        <td>${c.username}</td>
        <td>${"*".repeat(c.password ? c.password.length : 6)}</td>
        <td>${c.correo || ""}</td>
        <td>${c.rol}</td>
        <td>
          <select data-id="${c.id_usuario}" class="select-estado-cliente">
            <option value="1" ${activoValue === 1 ? 'selected' : ''}>Activo</option>
            <option value="0" ${activoValue === 0 ? 'selected' : ''}>Inactivo</option>
          </select>
        </td>
        <td>
          <button class="btnEditarUsuario" data-id="${c.id_usuario}">Editar</button>
          <button class="btnBorrarUsuario" data-id="${c.id_usuario}">Borrar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    const scrollDiv = document.createElement("div");
    scrollDiv.classList.add("scroll-table");
    scrollDiv.appendChild(table);

    container.appendChild(scrollDiv);

    

    

    // ================== EVENTO PARA BORRAR USUARIO ==================
    document.querySelectorAll(".btnBorrarUsuario").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const id = e.target.getAttribute("data-id");
        const confirmar = confirm("¿Seguro que deseas borrar este usuario?");
        if (!confirmar) return;

        const username_hist = localStorage.getItem("username"); // ✅

        const res = await fetch(`/usuarios/${id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username_hist }) // ✅
});
        const data = await res.json();

        if (data.success) {
          alert("Usuario eliminado correctamente");
          mostrarClientes(); // refresca la tabla
        } else {
          alert("Error al eliminar usuario");
        }
      });
    });



    // ================== CREAR NUEVO USUARIO ==================
const btnNuevoUsuario = document.getElementById("btnNuevoUsuario");
const formNuevoUsuario = document.getElementById("formNuevoUsuario");

if (btnNuevoUsuario) {
  btnNuevoUsuario.addEventListener("click", () => {
    formNuevoUsuario.style.display = "block";
  });
}

document.getElementById("btnCancelarUsuario").addEventListener("click", () => {
  formNuevoUsuario.style.display = "none";
});

// Guardar cambios
document.getElementById("btnGuardarUsuario").addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  const username = document.getElementById("nuevoUsername").value.trim();
  const password = document.getElementById("nuevoPassword").value.trim();
  const correo = document.getElementById("nuevoCorreo").value.trim();
  const rol = document.getElementById("nuevoRol").value;
  const activo = document.getElementById("nuevoActivo").value;

  if (!username || !password || !correo) {
    alert("Por favor, completa todos los campos.");
    return;
  }

  try {
    const username_hist = localStorage.getItem("username"); // ✅ usuario que hace la acción

    const res = await fetch("/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, correo, rol, activo,username_hist }),
    });

    const data = await res.json();

    if (data.success) {
      alert("Usuario creado correctamente.");
      formNuevoUsuario.style.display = "none";
      mostrarClientes(); // refresca la tabla
    } else {
      alert(data.message || "Error al crear el usuario.");
    }
  } catch (err) {
    console.error("Error:", err);
    alert("Error en el servidor.");
  }
});
// ================== EDITAR USUARIO ==================
// Abrir modal al hacer clic en el botón de editar
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("btnEditarUsuario")) {
    const id = e.target.getAttribute("data-id");
    const fila = e.target.closest("tr");
    const username = fila.children[0].textContent;
    const password = fila.children[1].textContent;
    const correo = fila.children[2].textContent;
    const rol = fila.children[3].textContent;
    const activo = fila.children[4].querySelector("select").value;

    document.getElementById("editUserId").value = id;
    document.getElementById("editUsername").value = username;
    document.getElementById("editPassword").value = password;
    document.getElementById("editCorreo").value = correo;
    document.getElementById("editRol").value = rol;
    document.getElementById("editActivo").value = activo;

    document.getElementById("editarUsuarioModal").style.display = "block";
  }
});

// Guardar cambios
const btnGuardar = document.getElementById("btnGuardarNuevoUsuario");
btnGuardar.onclick = async () => { // ⚡ reemplaza addEventListener para evitar duplicados
  const id = document.getElementById("editUserId").value;
  const username = document.getElementById("editUsername").value;
  const correo = document.getElementById("editCorreo").value;
  const password = document.getElementById("editPassword").value;
  const rol = document.getElementById("editRol").value;
  const activo = document.getElementById("editActivo").value;

  const username_hist = localStorage.getItem("username"); // ✅

  const res = await fetch("/usuarios/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, correo, password, rol, activo, username_hist }),
  });

  const data = await res.json();

  if (data.success) {
    alert("Usuario actualizado correctamente");
    document.getElementById("editarUsuarioModal").style.display = "none";
    mostrarClientes(); // vuelve a cargar la tabla
  } else {
    alert("Error al actualizar usuario");
  }
};

// Cancelar edición
document.getElementById("btnCancelarUsuario").onclick = () => {
  document.getElementById("editarUsuarioModal").style.display = "none";
};




    // ================== EVENTO PARA CAMBIO DE ESTADO(cliente) ==================
    document.querySelectorAll('.select-estado-cliente').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id_usuario = Number(e.target.getAttribute('data-id'));
        const nuevoEstado = parseInt(e.target.value); // 1 o 0
        const username = localStorage.getItem("username"); // ✅
        if (!id_usuario) {
          console.error("ID de usuario inválido:", id_usuario);
          return;
        }
        try {
          const res = await fetch('/cliente/estado', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_usuario, activo: nuevoEstado, username})
          });
          const data = await res.json();
          if (!data.success) {
            console.error("Error al actualizar estado:", data.message);
          } else {
            console.log(`Usuario ${id_usuario} actualizado a ${nuevoEstado}`);
            // Actualizamos el objeto en la tabla para que refleje el cambio
            mostrarClientes(); 
          }
        } catch (err) {
          console.error("Error en fetch actualizar estado:", err);
        }
      });
    });

  } catch (error) {
    console.error(error);
    alert("Error al cargar los clientes.");
  }
}


// ================== ESTADÍSTICAS (CHART.JS) ==================
let chartCastillosInstance = null;
let chartPeriodosInstance = null;
let chartEstadosInstance = null;

async function cargarEstadisticas() {
  try {
    // 1) Uso de castillos
    let res = await fetch("/estadisticas/castillos");
    let data = await res.json();
    let ctx1 = document.getElementById("chartCastillos").getContext("2d");

        // ✅ destruir chart anterior si existe
    if (chartCastillosInstance) chartCastillosInstance.destroy();
    
    chartCastillosInstance = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: data.map(d => d.nombre),
        datasets: [{
          label: "Reservas por castillo",
          data: data.map(d => d.total_reservas),
          backgroundColor: "rgba(75, 192, 192, 0.6)"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });

    // 2) Periodos de mayor demanda
    res = await fetch("/estadisticas/periodos");
    data = await res.json();
    let ctx2 = document.getElementById("chartPeriodos").getContext("2d");
     
    // ✅ destruir chart anterior si existe
    if (chartPeriodosInstance) chartPeriodosInstance.destroy();

    chartPeriodosInstance = new Chart(ctx2, {
      type: "line",
      data: {
        labels: data.map(d => d.mes),
        datasets: [{
          label: "Reservas por mes",
          data: data.map(d => d.total_reservas),
          borderColor: "rgba(255, 159, 64, 1)",
          fill: false,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });

    // 3) Estados de reservas
    res = await fetch("/estadisticas/estados");
    data = await res.json();
    let ctx3 = document.getElementById("chartEstados").getContext("2d");
    
    // ✅ destruir chart anterior si existe
    if (chartEstadosInstance) chartEstadosInstance.destroy();

    chartEstadosInstance = new Chart(ctx3, {
      type: "pie",
      data: {
        labels: data.map(d => d.estado),
        datasets: [{
          label: "Reservas por estado",
          data: data.map(d => d.total),
          backgroundColor: ["#36a2eb", "#4bc0c0", "#ff6384"]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false
      }
    });

  } catch (error) {
    console.error("Error al cargar estadísticas:", error);
  }
}
// ================== HISTORIAL ==================
async function mostrarHistorial() {
  const username = localStorage.getItem("username");


  try {
    const res = await fetch(`/historial?username=${username}`);
    if (!res.ok) throw new Error("Error al obtener historial");

    const historial = await res.json();

    const contenedor = document.getElementById("historialContainer");

    contenedor.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Fecha</th>
          </tr>
        </thead>
        <tbody>
          ${historial.map(h => `
            <tr>
              <td>${h.id_historial}</td>
              <td>${h.username}</td>
              <td>${h.accion}</td>
              <td>${new Date(h.fecha).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error("Error al cargar historial:", err);
    alert("No se pudo cargar el historial");
  }
}





});
