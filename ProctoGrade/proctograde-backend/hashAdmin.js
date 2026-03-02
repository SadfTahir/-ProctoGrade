const bcrypt = require("bcryptjs");

async function run() {
  const plain = "Iqra3087Iqra3395";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plain, salt);
  console.log("Hashed password:", hash);
}

run();

