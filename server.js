const express = require('express');
const sql = require('mssql');
const config = require('./dbconfig');
const nodemailer = require("nodemailer");
const crypto = require("crypto");


// ===================== CONEXIÓN GLOBAL A SQL SERVER =====================
let pool;
sql.connect(config)
  .then(p => {
    pool = p;
    console.log("Conectado a SQL Server");
  })
  .catch(err => console.error("Error conectando a SQL Server:", err));

const cors = require('cors');
const path = require('path');
const multer = require('multer');


const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));

// ===================== MULTER CONFIG =====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public/img"));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// ===================== FUNCIONES AUXILIARES =====================
function horaAMinutos(horaStr) {
  if (!horaStr) return 0;
  const parts = horaStr.split(":");
  const hh = Number(parts[0]) || 0;
  const mm = Number(parts[1]) || 0;
  return hh * 60 + mm;
}

async function getUsuarioId(username) {
  const pool = await sql.connect(config);
  const result = await pool.request()
    .input('username', sql.VarChar, username)
    .query('SELECT id_usuario FROM usuario WHERE username = @username');

  if (result.recordset.length === 0) return null;
  return result.recordset[0].id_usuario;
}

// Normaliza hora a "HH:mm:ss"
function normalizarHoraCompleta(horaStr) {
  if (!horaStr) return null;
  const parts = horaStr.split(':');
  const hh = String(Number(parts[0] || 0)).padStart(2, '0');
  const mm = String(Number(parts[1] || 0)).padStart(2, '0');
  return `${hh}:${mm}:00`;
}

// Formatea fecha a "YYYY-MM-DD"
function formatDate(date) {
  if (!date) return null;
  return new Date(date).toISOString().split("T")[0];
}
// ===================== REGISTRAR ACCIONES EN HISTORIAL =====================
async function registrarHistorial(id_usuario, accion) {
  try {
    console.log("📘 registrando historial:", { id_usuario, accion }); // 👈 agregado

    const pool = await sql.connect(config);
    await pool.request()
      .input("usuario_id", sql.Int, id_usuario)
      .input("accion", sql.NVarChar(200), accion)
      .input("fecha", sql.DateTime, new Date())
      .query(`
        INSERT INTO Historial (usuario_id, accion, fecha)
        VALUES (@usuario_id, @accion, @fecha)
      `);

    console.log("✅ Historial guardado correctamente."); // 👈 agregado
  } catch (err) {
    console.error("❌ Error registrando historial:", err);
  }
}




// ===================== DISPONIBILIDAD DE CASTILLO =====================
async function isCastilloDisponible(id_castillo, fecha, hora_inicioStr, hora_finStr) {
  const pool = await sql.connect(config);
  const hora_inicio = normalizarHoraCompleta(hora_inicioStr);
  const hora_fin = normalizarHoraCompleta(hora_finStr);

  const result = await pool.request()
    .input("fecha_reserva", sql.Date, fecha)
    .input("id_castillo", sql.Int, id_castillo)
    .input("hora_inicio", sql.VarChar(8), hora_inicio)
    .input("hora_fin", sql.VarChar(8), hora_fin)
    .query(`
      SELECT 1 
      FROM reserva 
      WHERE id_castillo = @id_castillo 
        AND fecha_reserva = @fecha_reserva 
        AND estado IN ('pendiente','confirmada')
        AND (hora_inicio < @hora_fin AND hora_fin > @hora_inicio)
    `);

  return result.recordset.length === 0;
}

// ===================== LISTAR TODAS LAS RESERVAS POR ESTADO (ADMIN) =====================
app.get('/reservas-admin', async (req, res) => {
  const { estado, nombre_cliente, apellido_cliente } = req.query;
  try {
    const pool = await sql.connect(config);

    let query = `
      SELECT r.id_reserva, 
             c.nombre AS nombre_castillo,
             r.nombre_cliente,
             r.apellido_cliente,
             r.fecha_reserva,
             LEFT(r.hora_inicio,5) AS hora_inicio,
             LEFT(r.hora_fin,5) AS hora_fin,
             r.estado,
             r.direccion,
             r.celular
      FROM reserva r
      LEFT JOIN castillo c ON r.id_castillo = c.id_castillo
      WHERE 1=1
    `;

    const request = pool.request();

    if (estado) {
      query += ` AND r.estado = @estado`;
      request.input('estado', sql.NVarChar(50), estado);
    }

    if (nombre_cliente && apellido_cliente) {
      query += ` AND r.nombre_cliente = @nombre_cliente AND r.apellido_cliente = @apellido_cliente`;
      request.input('nombre_cliente', sql.NVarChar(100), nombre_cliente);
      request.input('apellido_cliente', sql.NVarChar(100), apellido_cliente);
    }

    query += ` ORDER BY r.fecha_reserva, r.hora_inicio`;

    const result = await request.query(query);

    const reservas = result.recordset.map(r => ({
      ...r,
      fecha_reserva: formatDate(r.fecha_reserva)
    }));

    res.json(reservas);

  } catch (err) {
    console.error("Error al obtener reservas para admin:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// ===================== LISTAR CLIENTES CON RESERVAS =====================
app.get('/clientes-con-reservas', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT DISTINCT r.nombre_cliente, r.apellido_cliente, r.celular
      FROM reserva r
      WHERE r.nombre_cliente IS NOT NULL AND r.apellido_cliente IS NOT NULL
      ORDER BY r.nombre_cliente, r.apellido_cliente
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error al obtener clientes con reservas:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// ===================== LOGIN =====================
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const pool = await sql.connect(config);

    // Buscar usuario por username
    const usuarioResult = await pool.request()
      .input('username', sql.VarChar, username)
      .query(`SELECT id_usuario, username, password, rol, activo
              FROM usuario
              WHERE username = @username`);

    if (usuarioResult.recordset.length === 0) {
      // Usuario no existe
      return res.json({ 
        success: false, 
        type: "no_registrado", 
        message: "Esta cuenta no existe, debes registrarte." 
      });
    }

    const usuario = usuarioResult.recordset[0];

    // Verificar estado activo
    if (!usuario.activo) {
      return res.json({ 
        success: false, 
        type: "inhabilitado", 
        message: "Tu acceso está inhabilitado. Contacta al administrador." 
      });
    }

    // Verificar contraseña
    if (usuario.password !== password) {
      return res.json({ 
        success: false, 
        type: "error_password", 
        message: "Contraseña incorrecta." 
      });
    }

    // Si todo OK
    res.json({
      success: true,
      message: "Inicio de sesión exitoso",
      rol: usuario.rol,
      id_usuario: usuario.id_usuario
    });

  } catch (err) {
    console.error("Error en /login:", err);
    res.status(500).json({ 
      success: false, 
      type: "server", 
      message: "Error interno del servidor" 
    });
  }
});
// ==========================
// 1️⃣ Petición para solicitar recuperación de contraseña
// ==========================
app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const pool = await sql.connect(config);

    // Verificamos si el email existe
    const result = await pool
      .request()
      .input("correo", sql.VarChar, email)
      .query("SELECT id_usuario FROM Usuario WHERE correo = @correo");

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Correo no encontrado" });
    }

    // Generamos token único y fecha de expiración
    const token = crypto.randomBytes(20).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hora

// Guardamos el token y expiración en la base
await pool.request()
  .input("correo", sql.VarChar, email) // ← cambiamos 'correo' por 'email'
  .input("token", sql.VarChar, token)
  .input("expires", sql.DateTime, expires)
  .query(`
    UPDATE Usuario
    SET resetToken = @token, resetTokenExpires = @expires
    WHERE correo = @correo
  `);


    // Configuración de envío de correo (Gmail)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "mculela@gmail.com", // ⚠️ reemplazá con tu gmail
        pass: "lvtp gygv ejqm pbnq", // ⚠️ no tu contraseña normal
      },
    });

    const mailOptions = {
      from: "Castillo del Rey <tuCorreo@gmail.com>",
      to: email,
      subject: "Restablece tu contraseña",
      html: `
        <p>Recibimos una solicitud para restablecer tu contraseña.</p>
        <p>Haz clic en el siguiente enlace para cambiarla:</p>
        <a href="http://localhost:3000/reset-password.html?token=${token}">
          Restablecer contraseña
        </a>
        <p>Este enlace expirará en 1 hora.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: "Te enviamos un correo para que puedas reestablecer tu contraseña" });

  } catch (err) {
    console.error("Error en /forgot-password:", err);
    res.status(500).json({ message: "Error del servidor" });
  }
});
// ==========================
// 2️⃣ Restablecer la contraseña (desde el enlace del mail)
// ==========================
app.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  try {
    const pool = await sql.connect(config);

    // Buscamos al usuario que tiene ese token
    const result = await pool.request()
      .input("token", sql.VarChar, token)
      .query("SELECT correo, resetTokenExpires FROM Usuario WHERE resetToken = @token");

    if (result.recordset.length === 0) {
      return res.status(400).json({ message: "Token inválido" });
    }

    const user = result.recordset[0];

    // Verificamos si el token expiró
    if (new Date() > new Date(user.resetTokenExpires)) {
      return res.status(400).json({ message: "El enlace expiró, solicitá uno nuevo." });
    }

    // Actualizamos la contraseña y borramos el token
    await pool.request()
      .input("correo", sql.VarChar, user.correo)
      .input("password", sql.VarChar, password) // más adelante la encriptamos
      .query(`
        UPDATE Usuario
        SET password = @password,
            resetToken = NULL,
            resetTokenExpires = NULL
        WHERE correo = @correo
      `);

    res.json({ message: "Contraseña actualizada con éxito. Ya podés iniciar sesión." });
  } catch (err) {
    console.error("Error en /reset-password:", err);
    res.status(500).json({ message: "Error del servidor" });
  }
});





// ===================== REGISTER =====================
app.post('/register', async (req, res) => {
  const { username, password, correo } = req.body; // ✅ agregamos "correo"
  

  try {
    const pool = await sql.connect(config);

    // Verificar si el usuario ya existe
    const check = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT * FROM usuario WHERE username = @username');

    if (check.recordset.length > 0) {
      return res.json({ success: false, message: "El usuario ya existe" });
    }

    // ✅ Insertar también el correo
    await pool.request()
      .input('username', sql.VarChar, username)
      .input('password', sql.VarChar, password)
      .input('correo', sql.VarChar, correo)
      .input('rol', sql.VarChar, 'cliente')
      .query('INSERT INTO usuario (username, password, correo, rol) VALUES (@username, @password, @correo, @rol)');

    res.json({ success: true, message: "Usuario registrado correctamente" });

  } catch (err) {
    console.error("Error en /register:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});


// ===================== RESERVA (CREAR) =====================
app.post('/reserva', async (req, res) => {
  try {
    let { fecha, hora_inicio, hora_fin, id_castillo, username, direccion, celular, nombre_cliente, apellido_cliente } = req.body;

    if (!fecha || !hora_inicio || !hora_fin || !id_castillo || !username || !direccion || !celular || !nombre_cliente || !apellido_cliente) {
      return res.status(400).json({ success: false, message: "Faltan datos para la reserva" });
    }

    const hora_inicio_norm = normalizarHoraCompleta(hora_inicio);
    const hora_fin_norm = normalizarHoraCompleta(hora_fin);

    const [hIni, mIni] = hora_inicio_norm.split(':').map(Number);
    const [hFin, mFin] = hora_fin_norm.split(':').map(Number);
    const inicioMin = hIni * 60 + mIni;
    const finMin = hFin * 60 + mFin;

    if (finMin <= inicioMin) {
      return res.status(400).json({ success: false, message: "La hora de fin debe ser posterior a la hora de inicio" });
    }

    const id_usuario = await getUsuarioId(username);
    if (!id_usuario) return res.status(400).json({ success: false, message: "Usuario no encontrado" });

    // 🔹 Nuevo: verificamos si el castillo está activo
    const pool = await sql.connect(config);
    const castilloCheck = await pool.request()
      .input("id_castillo", sql.Int, id_castillo)
      .query(`SELECT activo FROM castillo WHERE id_castillo = @id_castillo`);

    if (castilloCheck.recordset.length === 0) {
      return res.status(404).json({ success: false, message: "Castillo no encontrado" });
    }

    const castilloActivo = castilloCheck.recordset[0].activo;
    if (castilloActivo === false || castilloActivo === 0) {
      return res.status(400).json({ success: false, message: "Castillo en mantenimiento, no se puede reservar" });
    }

    // Verificar disponibilidad horaria
    const disponible = await isCastilloDisponible(id_castillo, fecha, hora_inicio_norm, hora_fin_norm);
    if (!disponible) return res.status(400).json({ success: false, message: "El castillo ya está reservado en ese horario" });

    // Insertar la reserva
    await pool.request()
      .input("fecha_reserva", sql.Date, fecha)
      .input("hora_inicio", sql.VarChar(8), hora_inicio_norm)
      .input("hora_fin", sql.VarChar(8), hora_fin_norm)
      .input("id_castillo", sql.Int, id_castillo)
      .input("id_usuario", sql.Int, id_usuario)
      .input("estado", sql.NVarChar(50), "pendiente")
      .input("direccion", sql.NVarChar(200), direccion)
      .input("celular", sql.NVarChar(20), celular)
      .input("nombre_cliente", sql.NVarChar(100), nombre_cliente)
      .input("apellido_cliente", sql.NVarChar(100), apellido_cliente)
      .query(`
        INSERT INTO reserva (fecha_reserva, hora_inicio, hora_fin, id_castillo, id_usuario, estado, direccion, celular, nombre_cliente, apellido_cliente)
        VALUES (@fecha_reserva, @hora_inicio, @hora_fin, @id_castillo, @id_usuario, @estado, @direccion, @celular, @nombre_cliente, @apellido_cliente)
      `);

    res.json({ success: true, message: "Reserva realizada con éxito" });

  } catch (err) {
    console.error("Error en /reserva:", err);
    res.status(500).json({ success: false, message: "Error al realizar la reserva", error: err.message });
  }
});


// ===================== CASTILLOS DISPONIBLES CON ESTADO Y CANTIDAD DE RESERVAS =====================
app.get('/castillos/disponibles', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT c.id_castillo,
             c.nombre,
             c.descripcion,
             c.capacidad,
             c.precio,
             c.foto,
             c.activo,
             (SELECT COUNT(*) 
              FROM reserva r 
              WHERE r.id_castillo = c.id_castillo 
                AND r.estado IN ('pendiente','confirmada')) AS cantidad_reservas
      FROM castillo c
      ORDER BY c.nombre
    `);

    const castillos = result.recordset.map(c => ({
      id_castillo: c.id_castillo,
      nombre: c.nombre,
      descripcion: c.descripcion,
      capacidad: c.capacidad,
      precio: c.precio,
      foto: c.foto,
      estado: c.activo ? 'activo' : 'inactivo',
      reservas_count: c.cantidad_reservas
    }));

    res.json(castillos);
  } catch (error) {
    console.error('Error al obtener castillos:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});



// ===================== RUTA ÚNICA /reservas =====================
app.get('/reservas', async (req, res) => {
  const { fecha, id_castillo } = req.query;
  try {
    const pool = await sql.connect(config);

    if (fecha && id_castillo) {
      const result = await pool.request()
        .input('fecha_reserva', sql.Date, fecha)
        .input('id_castillo', sql.Int, id_castillo)
        .query(`
          SELECT id_reserva,
                 fecha_reserva,
                 LEFT(hora_inicio,5) AS hora_inicio,
                 LEFT(hora_fin,5) AS hora_fin,
                 estado,
                 nombre_cliente,
                 apellido_cliente,
                 direccion,
                 celular
          FROM reserva
          WHERE id_castillo = @id_castillo
            AND fecha_reserva = @fecha_reserva
            AND estado IN ('pendiente','confirmada')
        `);

      const reservas = result.recordset.map(r => ({
        ...r,
        fecha_reserva: formatDate(r.fecha_reserva)
      }));

      return res.json(reservas);
    }

    const all = await pool.request().query(`
      SELECT 
        r.id_reserva, 
        r.id_castillo, 
        c.nombre AS nombre_castillo, 
        r.id_usuario,
        r.fecha_reserva,
        LEFT(r.hora_inicio,5) AS hora_inicio,
        LEFT(r.hora_fin,5) AS hora_fin,
        r.estado,
        r.direccion,
        r.celular,
        r.nombre_cliente,      -- ✅ ahora incluidos
        r.apellido_cliente     -- ✅ ahora incluidos
      FROM reserva r
      LEFT JOIN castillo c ON r.id_castillo = c.id_castillo
      ORDER BY r.fecha_reserva, r.hora_inicio
    `);

    const reservas = all.recordset.map(r => ({
      ...r,
      fecha_reserva: formatDate(r.fecha_reserva)
    }));

    res.json(reservas);

  } catch (err) {
    console.error("Error al obtener reservas:", err);
    res.status(500).json({ error: "Error interno" });
  }
});


// ===================== MIS RESERVAS =====================
app.get('/mis-reservas', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ error: "Falta parámetro username" });
  }

  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input("username", sql.VarChar, username)
      .query(`
        SELECT r.id_reserva, r.id_castillo, c.nombre AS nombre_castillo,
               r.fecha_reserva,
               LEFT(r.hora_inicio,5) AS hora_inicio,
               LEFT(r.hora_fin,5) AS hora_fin,
               r.estado,
               r.direccion,
               r.celular
        FROM reserva r
        INNER JOIN usuario u ON r.id_usuario = u.id_usuario
        LEFT JOIN castillo c ON r.id_castillo = c.id_castillo
        WHERE u.username = @username
        ORDER BY r.fecha_reserva DESC, r.hora_inicio
      `);

    const reservas = result.recordset.map(r => ({
      ...r,
      fecha_reserva: formatDate(r.fecha_reserva)
    }));

    res.json(reservas);
  } catch (err) {
    console.error("Error en /mis-reservas:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// ===================== RESERVAS POR ESTADO =====================
app.get('/reservas/:estado', async (req, res) => {
  const { estado } = req.params;
  try {
    const pool = await sql.connect(config);
    const result = await pool.request()
      .input('estado', sql.NVarChar(50), estado)
      .query(`
        SELECT r.id_reserva, r.id_castillo, c.nombre AS nombre_castillo, r.id_usuario,
               r.fecha_reserva,
               LEFT(r.hora_inicio,5) AS hora_inicio,
               LEFT(r.hora_fin,5) AS hora_fin,
               r.estado,
               r.direccion,
               r.celular
        FROM reserva r
        LEFT JOIN castillo c ON r.id_castillo = c.id_castillo
        WHERE r.estado = @estado
        ORDER BY r.fecha_reserva, r.hora_inicio
      `);

    const reservas = result.recordset.map(r => ({
      ...r,
      fecha_reserva: formatDate(r.fecha_reserva)
    }));

    res.json(reservas);
  } catch (error) {
    console.error(`Error al obtener reservas ${estado}:`, error);
    res.status(500).json({ error: "Error interno" });
  }
});

// ===================== ACTUALIZAR ESTADO =====================
app.put('/reserva/estado', async (req, res) => {
  const { id_reserva, estado, username } = req.body; // agregar username para historial
  try {
    const pool = await sql.connect(config);
    await pool.request()
      .input("id_reserva", sql.Int, id_reserva)
      .input("estado", sql.NVarChar(50), estado)
      .query("UPDATE reserva SET estado = @estado WHERE id_reserva = @id_reserva");

    // ======= AGREGAR PARA HISTORIAL =======
    const id_usuario = await getUsuarioId(username);
   if (id_usuario) {
  await registrarHistorial(id_usuario, `Actualizar reserva: cambiado estado de reserva ${id_reserva} a ${estado}`);
}
    // ======= FIN HISTORIAL =======

    res.json({ success: true });
  } catch (err) {
    console.error("Error al actualizar estado de reserva:", err);
    res.status(500).json({ success: false });
  }
});


// ===================== ACTUALIZAR DIRECCIÓN Y CELULAR =====================
app.put('/reserva/actualizar-datos', async (req, res) => {
  const { id_reserva, direccion, celular, username } = req.body; // agregar username
  if (!id_reserva || !direccion || !celular) {
    return res.status(400).json({ success: false, message: "Faltan datos" });
  }

  try {
    console.log("Datos recibidos en /reserva/actualizar-datos:", { id_reserva, direccion, celular, username }); // 👈 Verificación

    const pool = await sql.connect(config);
    await pool.request()
      .input("id_reserva", sql.Int, id_reserva)
      .input("direccion", sql.NVarChar(200), direccion)
      .input("celular", sql.NVarChar(20), celular)
      .query("UPDATE reserva SET direccion = @direccion, celular = @celular WHERE id_reserva = @id_reserva");

// ======= AGREGAR PARA HISTORIAL =======
const id_usuario = await getUsuarioId(username);

if (id_usuario) {
  await registrarHistorial(id_usuario, `Modificar reserva: Modificados datos de reserva ${id_reserva}`);
}
// ======= FIN HISTORIAL =======
    res.json({ success: true });
  } catch (err) {
    console.error("Error al actualizar datos de la reserva:", err);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});




// ===================== LISTADO DE CLIENTES =====================
app.get('/clientes', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT id_usuario, username, password, correo, rol, activo
      FROM usuario
      ORDER BY username
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error al obtener clientes:", err);
    res.status(500).json({ error: "Error interno" });
  }
});


// ===================== ACTUALIZAR ESTADO DE CLIENTE =====================
app.put('/cliente/estado', async (req, res) => {
  let { id_usuario, activo, username } = req.body; // agregado username para historial

  // Convertimos id_usuario a número
  id_usuario = Number(id_usuario);

  if (!id_usuario || activo === undefined) {
    return res.status(400).json({ success: false, message: "Faltan datos o id_usuario inválido" });
  }

  try {
    const pool = await sql.connect(config);
    await pool.request()
      .input("id_usuario", sql.Int, id_usuario)
      .input("activo", sql.Bit, activo ? 1 : 0)
      .query("UPDATE usuario SET activo=@activo WHERE id_usuario=@id_usuario");

// ======= AGREGAR PARA HISTORIAL =======
const id_usuario_hist = await getUsuarioId(username);
if (id_usuario_hist) {
  await registrarHistorial(id_usuario_hist, `Actualizar cliente: Usuario ${id_usuario} ${activo ? "activado" : "desactivado"}`);
}
// ======= FIN HISTORIAL =======


    res.json({ success: true, message: `Usuario ${activo ? "activado" : "desactivado"} correctamente` });
  } catch (err) {
    console.error("Error al actualizar estado del cliente:", err);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
});


// ================== CREAR NUEVO USUARIO ==================
app.post("/usuarios", async (req, res) => {
  const { username, password, correo, rol, activo, username_hist } = req.body; // agregado username_hist para historial

  try {
    const pool = await sql.connect(config);

    // Verificar si ya existe el username
    const existe = await pool
      .request()
      .input("username", sql.VarChar, username)
      .query("SELECT * FROM usuario WHERE username = @username");

    if (existe.recordset.length > 0) {
      return res.json({ success: false, message: "El usuario ya existe." });
    }

    // Insertar nuevo usuario
    await pool
      .request()
      .input("username", sql.VarChar, username)
      .input("password", sql.VarChar, password)
      .input("correo", sql.VarChar, correo)
      .input("rol", sql.VarChar, rol)
      .input("activo", sql.Bit, activo)
      .query(
        "INSERT INTO usuario (username, password, correo, rol, activo) VALUES (@username, @password, @correo, @rol, @activo)"
      );

// ======= AGREGAR PARA HISTORIAL =======
const id_usuario_hist = await getUsuarioId(username_hist);
if (id_usuario_hist) {
  await registrarHistorial(id_usuario_hist, `Crear usuario: ${username}`);
}
// ======= FIN HISTORIAL =======


    res.json({ success: true });
  } catch (err) {
    console.error("Error al crear usuario:", err);
    res.status(500).json({ success: false, message: "Error en el servidor." });
  }
});


// ================== EDITAR USUARIO ==================
app.put("/usuarios/:id", async (req, res) => {
  const { id } = req.params;
  const { username, correo, password, rol, activo, username_hist } = req.body; // agregado username_hist para historial

  try {
    const pool = await sql.connect(config);

    let query = `
      UPDATE usuario
      SET username = @username,
          correo = @correo,
          rol = @rol,
          activo = @activo
    `;
    if (password && password.trim() !== "") {
      query += `, password = @password`;
    }
    query += ` WHERE id_usuario = @id`;

    await pool
      .request()
      .input("id", sql.Int, id)
      .input("username", sql.VarChar, username)
      .input("correo", sql.VarChar, correo)
      .input("rol", sql.VarChar, rol)
      .input("activo", sql.Bit, activo)
      .input("password", sql.VarChar, password)
      .query(query);

// ======= AGREGAR PARA HISTORIAL =======
const id_usuario_hist = await getUsuarioId(username_hist);
if (id_usuario_hist) {
  await registrarHistorial(id_usuario_hist, `Editar usuario: ${username}`);
}
// ======= FIN HISTORIAL =======


    res.json({ success: true });
  } catch (err) {
    console.error("Error al actualizar usuario:", err);
    res.status(500).json({ success: false });
  }
});

// ================== ELIMINAR USUARIO ==================
app.delete('/usuarios/:id', async (req, res) => {
  const id_usuario = parseInt(req.params.id);
  const { username_hist } = req.body; // agregado username_hist para historial

  if (!id_usuario) {
    return res.status(400).json({ success: false, message: "ID de usuario inválido." });
  }

  try {
    // Eliminamos todas las reservas asociadas al usuario primero (si aplica)
    await pool.request()
      .input('id_usuario', sql.Int, id_usuario)
      .query('DELETE FROM reserva WHERE id_usuario = @id_usuario');

    // Luego eliminamos el usuario
    await pool.request()
      .input('id_usuario', sql.Int, id_usuario)
      .query('DELETE FROM usuario WHERE id_usuario = @id_usuario');

// ======= AGREGAR PARA HISTORIAL =======
const id_usuario_hist_real = await getUsuarioId(username_hist);
if (id_usuario_hist_real) {
  await registrarHistorial(id_usuario_hist_real, `Eliminar usuario: ${id_usuario}`);
}
// ======= FIN HISTORIAL =======


    res.json({ success: true, message: "Usuario eliminado correctamente." });
  } catch (err) {
    console.error("Error al eliminar usuario:", err);
    res.status(500).json({ success: false, message: "Error al eliminar usuario." });
  }
});






// ===================== LISTADO DE CASTILLOS =====================
app.get('/castillos', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT 
        id_castillo, 
        nombre, 
        descripcion, 
        capacidad, 
        precio, 
        foto, 
        activo, 
        ISNULL(
          (SELECT COUNT(*) FROM reserva WHERE reserva.id_castillo = castillo.id_castillo),
          0
        ) AS reservas_count
      FROM castillo
      ORDER BY nombre
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error al obtener castillos:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// ===================== AGREGAR CASTILLO =====================//
app.post("/castillos", upload.single("foto"), async (req, res) => {
  const { nombre, descripcion, capacidad, precio } = req.body;
  const foto = req.file ? req.file.filename : null; // nombre del archivo guardado
  const activo = 1; // por defecto activo

  try {
    const pool = await sql.connect(config);
    await pool.request()
      .input("nombre", sql.VarChar, nombre)
      .input("descripcion", sql.VarChar, descripcion)
      .input("capacidad", sql.Int, capacidad)
      .input("precio", sql.Decimal(10, 2), precio)
      .input("foto", sql.VarChar, foto)
      .input("activo", sql.Bit, activo)
      .query(`
        INSERT INTO castillo (nombre, descripcion, capacidad, precio, foto, activo)
        VALUES (@nombre, @descripcion, @capacidad, @precio, @foto, @activo)
      `);

    res.json({ success: true, message: "Castillo agregado correctamente" });
  } catch (err) {
    console.error("Error al agregar castillo:", err);
    res.status(500).json({ success: false, message: "Error al agregar castillo" });
  }
});




// ===================== ACTUALIZAR ESTADO DE CASTILLO =====================
app.put('/castillo/estado', async (req, res) => {
  try {
    const { id_castillo, activo, username } = req.body; // agregamos username para historial

    // Validación de datos
    if (!id_castillo || (activo !== 0 && activo !== 1 && activo !== "0" && activo !== "1")) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos. Se requiere id_castillo y un valor válido para activo (0 o 1)."
      });
    }

    // Convertimos valores por seguridad
    const id = Number(id_castillo);
    const estado = Number(activo) === 1 ? 1 : 0;

    const pool = await sql.connect(config);
    const result = await pool.request()
      .input("id_castillo", sql.Int, id)
      .input("activo", sql.Bit, estado)
      .query(`
        UPDATE castillo 
        SET activo = @activo
        WHERE id_castillo = @id_castillo
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ success: false, message: "Castillo no encontrado." });
    }

    console.log(`Castillo ${id} actualizado a estado: ${estado === 1 ? "Activo" : "Inactivo"}`);

// ======= AGREGAR PARA HISTORIAL =======
const id_usuario_hist = await getUsuarioId(username);
if (id_usuario_hist) {
  await registrarHistorial(id_usuario_hist, `Modificar castillo: Actualizado estado del castillo ${id_castillo} a ${estado === 1 ? "Activo" : "Inactivo"}`);
}
// ======= FIN HISTORIAL =======


    res.json({
      success: true,
      message: `Castillo ${estado === 1 ? "activado" : "desactivado"} correctamente`
    });

  } catch (err) {
    console.error("Error al actualizar estado del castillo:", err);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor"
    });
  }
});
// 🔹 Listar solo castillos activos (para el panel de reservas)
app.get("/castillos/activos", async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT * FROM castillo WHERE activo = 1
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error al obtener castillos activos:", err);
    res.status(500).send("Error al obtener castillos activos");
  }
});




// ===================== MODIFICAR CASTILLO CON IMAGEN =====================
app.put('/castillo/modificar', upload.single("imagen"), async (req, res) => {
  const { id_castillo, nombre, descripcion, capacidad, precio, username_hist } = req.body; // agregado username_hist para historial
  let foto = req.file ? "/img/" + req.file.filename : null;

  if (!id_castillo || !nombre || !descripcion || capacidad === undefined || precio === undefined) {
    return res.status(400).json({ success: false, message: "Faltan datos" });
  }

  try {
    const pool = await sql.connect(config);

    let query = `
      UPDATE castillo 
      SET nombre=@nombre, descripcion=@descripcion, capacidad=@capacidad, 
          precio=@precio
    `;
    if (foto) query += `, foto=@foto`;
    query += ` WHERE id_castillo=@id_castillo`;

    const request = pool.request()
      .input("id_castillo", sql.Int, id_castillo)
      .input("nombre", sql.NVarChar, nombre)
      .input("descripcion", sql.NVarChar, descripcion)
      .input("capacidad", sql.Int, capacidad)
      .input("precio", sql.Decimal(10, 2), precio)

    if (foto) request.input("foto", sql.NVarChar, foto);

    await request.query(query);

// ======= AGREGAR PARA HISTORIAL =======
const id_usuario_hist = await getUsuarioId(username_hist);
if (id_usuario_hist) {
  await registrarHistorial(id_usuario_hist, `Modificar castillo: Castillo modificado con id ${id_castillo}`);
}
// ======= FIN HISTORIAL =======


    res.json({ success: true, message: "Castillo modificado correctamente" });
  } catch (error) {
    console.error("Error al modificar castillo:", error);
    res.status(500).json({ success: false, message: "Error interno" });
  }
});




// ===================== ESTADÍSTICAS =====================

// 1) Uso de castillos
app.get('/estadisticas/castillos', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT c.nombre, COUNT(r.id_reserva) AS total_reservas
      FROM castillo c
      LEFT JOIN reserva r 
        ON c.id_castillo = r.id_castillo AND r.estado IN ('pendiente','confirmada')
      GROUP BY c.nombre
      ORDER BY total_reservas DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error en /estadisticas/castillos:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// 2) Períodos de mayor demanda (por mes)
app.get('/estadisticas/periodos', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT DATENAME(MONTH, r.fecha_reserva) AS mes, COUNT(r.id_reserva) AS total_reservas
      FROM reserva r
      WHERE r.estado IN ('pendiente','confirmada')
      GROUP BY DATENAME(MONTH, r.fecha_reserva), MONTH(r.fecha_reserva)
      ORDER BY MONTH(r.fecha_reserva)
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error en /estadisticas/periodos:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// 3) Reservas por estado
app.get('/estadisticas/estados', async (req, res) => {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT estado, COUNT(id_reserva) AS total
      FROM reserva
      GROUP BY estado
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Error en /estadisticas/estados:", err);
    res.status(500).json({ error: "Error interno" });
  }
});
// ===================== OBTENER HISTORIAL =====================
app.get('/historial', async (req, res) => {
  const { username } = req.query;

console.log("Username recibido en /historial:", username); // <-- ESTO ES LO NUEVO

  if (!username) {
    return res.status(400).json({ error: "Falta parámetro username" });
  }

  try {
    const pool = await sql.connect(config);

    // Verificamos el rol del usuario
    const usuarioResult = await pool.request()
      .input('username', sql.VarChar, username)
      .query('SELECT rol, id_usuario FROM usuario WHERE username=@username');

    if (usuarioResult.recordset.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const usuario = usuarioResult.recordset[0];
    if (usuario.rol !== 'jefe') {
      return res.status(403).json({ error: "Acceso denegado" });
    }

    // Obtenemos todo el historial ordenado por fecha desc
    const result = await pool.request()
      .query(`
        SELECT h.id_historial, u.username, h.accion, h.fecha
        FROM Historial h
        LEFT JOIN usuario u ON h.usuario_id = u.id_usuario
        ORDER BY h.fecha DESC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error("Error obteniendo historial:", err);
    res.status(500).json({ error: "Error interno" });
  }
});



// ===================== RUTAS HTML =====================
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// ===================== INICIAR SERVIDOR =====================
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // ✅ permite conexiones desde otros dispositivos de la red local

app.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

