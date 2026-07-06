const b = require('bcryptjs');
async function main() {
  const h1 = await b.hash('dispatch123', 12);
  const h2 = await b.hash('Super#2026', 12);
  console.log('admin:', h1);
  console.log('superadmin:', h2);
}
main();
