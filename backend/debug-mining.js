const cheerio = require('cheerio');

async function probe(url, label) {
  console.log(`\n=== ${label} ===`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ffxivlog.com/1.0)', 'Accept': 'text/html' }
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const allClasses = [...new Set($('table').map((_, t) => $(t).attr('class')).get())];
  console.log('Table classes:', allClasses);
  console.log('Total tables:', $('table').length);
  console.log('h2 count:', $('h2').length, '| h3 count:', $('h3').length);

  // First table with data rows
  const dataTbl = $('table').filter((_, t) => $(t).find('tr').length > 2).first();
  console.log('First data table class:', dataTbl.attr('class'));
  console.log('Headers:', dataTbl.find('tr').first().find('th').map((_, th) => $(th).text().trim()).get());
  const rows = dataTbl.find('tr').slice(1, 4);
  rows.each((i, row) => {
    console.log(`Row ${i+1}:`, $(row).find('td').map((_, td) => $(td).text().trim().slice(0, 35)).get());
  });

  // h2/h3 sample
  $('h2').slice(0, 5).each((_, h) => console.log('h2:', $(h).text().trim().replace(/\[.*?\]/g, '')));
  $('h3').slice(0, 6).each((_, h) => console.log('h3:', $(h).text().trim().replace(/\[.*?\]/g, '')));
}

(async () => {
  await probe('https://ffxiv.consolegameswiki.com/wiki/Miner_Node_Locations', 'Miner Node Locations');
  await new Promise(r => setTimeout(r, 1200));
  await probe('https://ffxiv.consolegameswiki.com/wiki/Unspoiled_Nodes', 'Unspoiled Nodes');
})().catch(e => { console.error(e); process.exit(1); });
