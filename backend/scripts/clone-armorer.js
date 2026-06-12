const fs = require('fs');

let scrape = fs.readFileSync('backend/scripts/scrape-alchemy.js', 'utf8');
scrape = scrape.replace(/scrape-alchemy\.js/g, 'scrape-armorer.js');
scrape = scrape.replace(/ALC_JOB = 14/g, 'ARM_JOB = 10');
scrape = scrape.replace(/ALC_JOB/g, 'ARM_JOB');
scrape = scrape.replace(/ALC/g, 'ARM');
scrape = scrape.replace(/alchemy-recipes\.json/g, 'armorer-recipes.json');
scrape = scrape.replace(/isAlchemyConsumable/g, 'isArmorerRecipe');
scrape = scrape.replace(/Alchemy/g, 'Armorer');
scrape = scrape.replace(/ALCHEMY/g, 'ARMORER');
scrape = scrape.replace(/alchemy/g, 'armorer');
fs.writeFileSync('backend/scripts/scrape-armorer.js', scrape);

let migrate = fs.readFileSync('backend/scripts/migrate-alchemy.js', 'utf8');
migrate = migrate.replace(/migrate-alchemy\.js/g, 'migrate-armorer.js');
migrate = migrate.replace(/alchemy-recipes\.json/g, 'armorer-recipes.json');
migrate = migrate.replace(/Alchemy/g, 'Armorer');
migrate = migrate.replace(/ALC/g, 'ARM');
migrate = migrate.replace(/alchemy/g, 'armorer');
fs.writeFileSync('backend/scripts/migrate-armorer.js', migrate);
