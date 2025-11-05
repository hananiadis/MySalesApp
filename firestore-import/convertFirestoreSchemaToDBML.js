// convertFirestoreSchemaToDBML.js
const fs = require('fs');

const schema = JSON.parse(fs.readFileSync('./firestore_schema.json', 'utf8'));
let dbml = '';

for (const [collection, fields] of Object.entries(schema)) {
  dbml += `Table ${collection} {\n`;
  if (fields && Object.keys(fields).length > 0) {
    for (const [field, type] of Object.entries(fields)) {
      const mappedType =
        type === 'string' ? 'varchar'
        : type === 'number' ? 'float'
        : type === 'boolean' ? 'boolean'
        : type === 'array' ? 'json'
        : type === 'object' ? 'json'
        : 'varchar';
      dbml += `  ${field} ${mappedType}\n`;
    }
  } else {
    dbml += `  id varchar [note: 'No fields found']\n`;
  }
  dbml += '}\n\n';
}

fs.writeFileSync('./firestore_schema.dbml', dbml);
console.log('✅ firestore_schema.dbml created successfully');
