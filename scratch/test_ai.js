const fetch = require('node-fetch');

async function run() {
  try {
    const res = await fetch('http://localhost:3000/api/ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: we need an auth token! Or we can just import search.js's router and call it manually? No, requires running express app.
      },
      body: JSON.stringify({
        query: "Which recipe is the cheapest to craft right now based on live market board prices?"
      })
    });
    console.log(res.status);
    console.log(await res.text());
  } catch(e) {
    console.error(e);
  }
}
run();
