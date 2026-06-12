require('dotenv').config();
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`)
  .then(r => r.json())
  .then(j => console.log(j.models ? j.models.map(m => m.name) : j));
