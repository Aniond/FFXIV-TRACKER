require('dotenv').config();
const pool = require('./db.js');

async function run() {
  try {
    const res = await pool.query("SELECT job, expansion, COUNT(*) FROM recipes GROUP BY job, expansion");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
