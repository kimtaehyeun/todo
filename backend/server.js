require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
