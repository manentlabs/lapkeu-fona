const app = require("./src/app");
const sequelize = require("./src/config/database");

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database terkoneksi");

    app.listen(PORT, HOST, () => {
      console.log(`🚀 Server berjalan pada port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Gagal menjalankan server:", err);
    process.exit(1);
  }
}

start();
