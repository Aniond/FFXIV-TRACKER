require('dotenv').config();
const pool = require('./db.js');

async function run() {
  try {
    const { adaptRecipes } = await import('../src/cookingData.js');
    const res = await pool.query("SELECT * FROM recipes WHERE job = 'ALC' LIMIT 5");
    const adapted = adaptRecipes(res.rows, false);
    console.log(adapted.map(r => r.name));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
