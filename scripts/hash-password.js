const bcrypt = require("bcryptjs");

const password = "12345678";

bcrypt.hash(password, 12).then((hash) => {
  console.log(hash);
});

// run : npx tsx scripts/hash-password.js