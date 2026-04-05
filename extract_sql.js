import fs from 'fs';
import path from 'path';

const migrationsDir = './drizzle/migrations';
const files = fs.readdirSync(migrationsDir);
const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

let fullSql = '';
for (const file of sqlFiles) {
  let content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  // Remove Drizzle-specific statement-breakpoints
  content = content.replace(/--> statement-breakpoint/g, ';');
  fullSql += content + '\n';
}

fs.writeFileSync('init.sql', fullSql);
console.log('SQL extracted to init.sql');
