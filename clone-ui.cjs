const fs = require('fs');

let jsx = fs.readFileSync('src/Alchemy.jsx', 'utf8');
jsx = jsx.replace(/Alchemy/g, 'Armorer');
jsx = jsx.replace(/alchemy/g, 'armorer');
jsx = jsx.replace(/ALC/g, 'ARM');
// Make sure to not mess up HTML tags, but ALC is only used in useRecipes('ALC') and component names.
fs.writeFileSync('src/Armorer.jsx', jsx);

let css = fs.readFileSync('src/Alchemy.css', 'utf8');
css = css.replace(/alchemy/g, 'armorer');
css = css.replace(/Alchemy/g, 'Armorer');
fs.writeFileSync('src/Armorer.css', css);
