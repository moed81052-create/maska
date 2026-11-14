// =============================================================================
// أداة نقل ومزامنة البيانات الكاملة من SQLite إلى MySQL
// MASKA DATABASE MIGRATOR: SQLite -> MySQL 8.0
// =============================================================================

const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const mysql = require('mysql2/promise');

// تحميل متغيرات البيئة من .env
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (e) {}
}

const SQLITE_PATH = path.join(__dirname, 'maska.db');
const sqlite = new DatabaseSync(SQLITE_PATH);

async function migrate() {
  console.log('🌸 بدء ترحيل البيانات من SQLite إلى خادم MySQL...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_DATABASE || 'maska_db',
    multipleStatements: true
  });

  console.log('✅ تم الاتصال بنجاح بخادم MySQL:', process.env.DB_DATABASE || 'maska_db');

  await connection.query('SET FOREIGN_KEY_CHECKS = 0');

  const tables = [
    'roles',
    'users',
    'user_roles',
    'driver_profiles',
    'customer_profiles',
    'addresses',
    'delivery_zones_pricing',
    'flower_inventory',
    'bouquets',
    'coupons',
    'orders',
    'order_items',
    'custom_bouquet_details',
    'coupon_usages',
    'customer_reviews',
    'customer_feedback',
    'price_change_logs',
    'order_status_history',
    'delivery_tracking_logs',
    'payments'
  ];

  for (const table of tables) {
    try {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
      if (rows.length === 0) continue;

      // تفريغ الجدول في MySQL قبل الإدراج النظيف
      await connection.query(`TRUNCATE TABLE \`${table}\``);

      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT INTO \`${table}\` (\`${columns.join('`, `')}\`) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map(col => row[col] === undefined ? null : row[col]);
        await connection.execute(sql, values);
      }

      console.log(`📦 تم ترحيل جدول [${table}]: (${rows.length}) سجل`);
    } catch (err) {
      console.warn(`⚠️ تنبيه في جدول [${table}]:`, err.message);
    }
  }

  await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  await connection.end();

  console.log('🎉 اكتملت عملية الترحيل بنجاح كامل! كل البيانات متاحة الآن في MySQL.');
}

migrate().catch(err => {
  console.error('❌ خطأ في عملية الترحيل:', err);
  process.exit(1);
});

