module.exports = {
  user: "sa_2",       // Ej: "sa"
  password: "nacho0420",    // Ej: "123456"
  server: "localhost",          // O el nombre de tu instancia
  database: "Reserva_castillo",
  options: {
    encrypt: false,             // Cambia a true si usas Azure
    trustServerCertificate: true,
  },
};