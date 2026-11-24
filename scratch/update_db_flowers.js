const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '1234',
    database: 'maska_db'
  });

  const flowers = [
    { id: 1, top: '/assets/flowers/clean/pink-rose-top.png' },
    { id: 2, top: '/assets/flowers/clean/white-tulip-top.png' },
    { id: 3, top: '/assets/flowers/clean/baby-breath-top.png' },
    { id: 4, top: '/assets/flowers/clean/peony-top.png' },
    { id: 5, top: '/assets/flowers/clean/red-rose-top.png' },
    { id: 6, top: '/assets/flowers/clean/eucalyptus-top.png' },
    { id: 7, top: '/assets/flowers/clean/orchid-top.png' },
    { id: 8, top: '/assets/flowers/clean/sunflower-top.png' },
    { id: 9, top: '/assets/flowers/clean/lily-top.png' }
  ];

  for (const f of flowers) {
    await conn.query('UPDATE flower_inventory SET image_top = ?, image_front = COALESCE(NULLIF(image_front, ""), ?) WHERE id = ?', [f.top, f.top, f.id]);
    console.log(`Updated flower ID ${f.id} with ${f.top}`);
  }

  const [rows] = await conn.query('SELECT id, name_ar, color, image_top FROM flower_inventory');
  console.log('Database verification:');
  console.table(rows);

  await conn.end();
}

main().catch(console.error);
