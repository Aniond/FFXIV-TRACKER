const fs = require('fs');

for (const file of ['src/Alchemy.jsx', 'src/Armorer.jsx']) {
  let text = fs.readFileSync(file, 'utf8');

  // Change adaptRecipes call
  text = text.replace('const adapted = adaptRecipes(rs)', 'const adapted = adaptRecipes(rs, false)');

  // Remove statFilter state
  text = text.replace("const [statFilter, setStatFilter] = useState('all')", "");

  // Remove statFilter from useMemo dependencies
  text = text.replace("q, statFilter, diffFilter, ingFilter", "q, diffFilter, ingFilter");

  // Remove statFilter logic from filter function
  text = text.replace("if (statFilter !== 'all' && r.primaryStat !== statFilter) return false\n", "");

  // Remove ['stat','Stat'] from sort buttons
  text = text.replace(/,\['stat','Stat'\]/g, "");

  // Remove stat sort logic
  text = text.replace(/if \(sortBy === 'stat'\)  result = \[\.\.\.result\]\.sort\(\(a, b\) =>\n      STAT_ORDER\.indexOf\(a\.primaryStat\) - STAT_ORDER\.indexOf\(b\.primaryStat\)\)/g, "");

  // Remove Buff filter UI completely
  const buffStart = text.indexOf('<div className="filter-row">');
  const diffRowStart = text.indexOf('<div className="diff-sort-row">');
  if (buffStart !== -1 && diffRowStart !== -1) {
    text = text.substring(0, buffStart) + text.substring(diffRowStart);
  }

  // Remove primaryStat from RecipeCard rendering
  text = text.replace(/const gc = STAT_TYPES\[recipe\.primaryStat\]\?\.color \|\| '#c5b8b0'/g, "const gc = '#c5b8b0'");
  text = text.replace(/const statLabel = STAT_TYPES\[recipe\.primaryStat\]\?\.label \|\| ''/g, "const statLabel = ''");
  text = text.replace(/<span className="rcard__tag" style=\{\{ '--gc': gc \}\}>\{statLabel\}<\/span>/g, "");

  // Remove hay building that uses primaryStat
  text = text.replace(/const hay = \[r.name, STAT_TYPES\[r.primaryStat\]\?\.label, \.\.\.r.ingredients\.map\(i => i.name\)\]/g, "const hay = [r.name, ...r.ingredients.map(i => i.name)]");

  fs.writeFileSync(file, text);
}
console.log('Fixed Alchemy and Armorer');
