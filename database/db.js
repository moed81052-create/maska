// =============================================================================
// وحدة التحكم والتعامل مع قاعدة بيانات مسكة | MASKA DATABASE CLIENT
// =============================================================================
// يدعم محرك MySQL 8.0+ كمحرك أساسي ومتقدم، مع دعم SQLite كمحرك احتياطي.
// يتم تكوين محددات الاتصال تلقائياً عبر ملف .env
// =============================================================================

const path = require('path');
const crypto = require('crypto');

// تحميل متغيرات البيئة من ملف .env تلقائياً
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (e) {}
}

const DB_CONNECTION = (process.env.DB_CONNECTION || 'mysql').toLowerCase();
const DB_CLIENT = (process.env.DB_CLIENT || (DB_CONNECTION === 'mysql' ? 'mysql2' : 'sqlite')).toLowerCase();
const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:1234@127.0.0.1:3306/maska_db';

const isMySQL = DB_CONNECTION === 'mysql' || DB_CLIENT === 'mysql' || DB_CLIENT === 'mysql2' || DATABASE_URL.startsWith('mysql');

let mysqlPool = null;
let sqliteDb = null;

function hashPassword(pass) {
  return crypto.createHash('sha256').update(pass).digest('hex');
}

function resolveDbPath() {
  if (process.env.DB_PATH) return path.resolve(process.env.DB_PATH);
  if (process.env.DB_FILE) return path.resolve(process.env.DB_FILE);
  if (DATABASE_URL.startsWith('sqlite://')) {
    const rawPath = DATABASE_URL.replace('sqlite://', '').replace(/^\/+/, '');
    return path.resolve(rawPath);
  }
  return path.join(__dirname, 'maska.db');
}

const DB_PATH = resolveDbPath();

if (isMySQL) {
  const mysql = require('mysql2/promise');
  mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_DATABASE || 'maska_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  });
  console.log(`🔌 تم تهيئة مجمع اتصالات MySQL 8.0 بنجاح: ${process.env.DB_DATABASE || 'maska_db'} (${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306})`);
} else {
  const { DatabaseSync } = require('node:sqlite');
  sqliteDb = new DatabaseSync(DB_PATH);
  console.log(`🔌 تم فتح قاعدة بيانات SQLite: ${DB_PATH}`);
}

module.exports = {
  isMySQL,
  db: isMySQL ? mysqlPool : sqliteDb,
  pool: mysqlPool,
  DB_PATH,
  DB_CLIENT,
  DB_CONNECTION,
  DATABASE_URL,

  // 1. تسجيل الدخول والتحقق من المستخدم والدور
  async authenticateUser(phone, password) {
    const hash = hashPassword(password);
    if (isMySQL) {
      const [rows] = await mysqlPool.execute(`
        SELECT u.id, u.full_name, u.phone, u.email, u.status, r.name as role_name, r.display_name as role_display
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE u.phone = ? AND u.password_hash = ? AND u.status = 'active'
      `, [phone, hash]);
      return rows[0] || null;
    } else {
      const user = sqliteDb.prepare(`
        SELECT u.id, u.full_name, u.phone, u.email, u.status, r.name as role_name, r.display_name as role_display
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE u.phone = ? AND u.password_hash = ? AND u.status = 'active'
      `).get(phone, hash);
      return user || null;
    }
  },

  // 2. إحصائيات لوحة الإدارة الرئيسية
  async getDashboardStats() {
    if (isMySQL) {
      const [[r1]] = await mysqlPool.query(`SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = CURDATE()`);
      const [[r2]] = await mysqlPool.query(`SELECT COALESCE(SUM(total_amount), 0) as s, COALESCE(SUM(delivery_fee), 0) as df FROM orders WHERE DATE(created_at) = CURDATE()`);
      const [[r3]] = await mysqlPool.query(`SELECT COUNT(*) as c FROM orders WHERE status = 'preparing'`);
      const [[r4]] = await mysqlPool.query(`SELECT COUNT(*) as c FROM flower_inventory WHERE stock_quantity <= alert_threshold`);
      const [[r5]] = await mysqlPool.query(`SELECT COUNT(*) as c FROM driver_profiles WHERE current_status IN ('available', 'busy')`);
      
      const [[rDriverToday]] = await mysqlPool.query(`
        SELECT 
          COALESCE(SUM(driver_profit), 0) as today_driver_profits,
          COALESCE(SUM(CASE WHEN type = 'order_collection' THEN amount ELSE 0 END), 0) as today_cash_collected
        FROM driver_custody_transactions
        WHERE DATE(created_at) = CURDATE()
      `);

      const [[rSettledToday]] = await mysqlPool.query(`
        SELECT COALESCE(SUM(net_cash_received), 0) as today_cash_settled
        FROM driver_settlements
        WHERE DATE(created_at) = CURDATE()
      `);

      const totalSales = Number(r2?.s || 0);
      const deliveryFees = Number(r2?.df || 0);
      const storeNetProfit = Math.max(0, totalSales - deliveryFees);

      return {
        todayOrders: Number(r1?.c || 0),
        todaySales: totalSales,
        todayDeliveryFees: deliveryFees,
        todayStoreProfit: storeNetProfit,
        todayDriverEarnings: Number(rDriverToday?.today_driver_profits || deliveryFees),
        todayCashCollected: Number(rDriverToday?.today_cash_collected || 0),
        todayCashSettled: Number(rSettledToday?.today_cash_settled || 0),
        preparingCount: Number(r3?.c || 0),
        lowStockCount: Number(r4?.c || 0),
        activeDrivers: Number(r5?.c || 0)
      };
    } else {
      const todayOrders = sqliteDb.prepare(`SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')`).get().c;
      const r2 = sqliteDb.prepare(`SELECT COALESCE(SUM(total_amount), 0) as s, COALESCE(SUM(delivery_fee), 0) as df FROM orders WHERE date(created_at) = date('now')`).get();
      const preparingCount = sqliteDb.prepare(`SELECT COUNT(*) as c FROM orders WHERE status = 'preparing'`).get().c;
      const lowStockCount = sqliteDb.prepare(`SELECT COUNT(*) as c FROM flower_inventory WHERE stock_quantity <= alert_threshold`).get().c;
      const activeDrivers = sqliteDb.prepare(`SELECT COUNT(*) as c FROM driver_profiles WHERE current_status IN ('available', 'busy')`).get().c;
      
      const totalSales = Number(r2?.s || 0);
      const deliveryFees = Number(r2?.df || 0);
      const storeNetProfit = Math.max(0, totalSales - deliveryFees);

      return {
        todayOrders,
        todaySales: totalSales,
        todayDeliveryFees: deliveryFees,
        todayStoreProfit: storeNetProfit,
        todayDriverEarnings: deliveryFees,
        todayCashCollected: 0,
        todayCashSettled: 0,
        preparingCount,
        lowStockCount,
        activeDrivers
      };
    }
  },

  // 3. جلب قائمة الطلبات للداشبورد مع تفاصيل السائق والمنسق
  async getAllOrders(limit = 50) {
    const numLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
    const sql = `
      SELECT 
        o.id,
        o.order_number,
        o.recipient_name,
        o.recipient_phone,
        o.delivery_city,
        o.delivery_zone,
        o.delivery_address_details,
        o.delivery_lat,
        o.delivery_lng,
        o.status,
        o.total_amount,
        o.delivery_window,
        o.customer_notes,
        o.created_at,
        o.assigned_florist_id,
        o.assigned_driver_id,
        f.full_name as florist_name,
        d.full_name as driver_name,
        d.phone as driver_phone,
        dp.vehicle_type,
        dp.plate_number
      FROM orders o
      LEFT JOIN users f ON o.assigned_florist_id = f.id
      LEFT JOIN users d ON o.assigned_driver_id = d.id
      LEFT JOIN driver_profiles dp ON d.id = dp.user_id
      ORDER BY o.created_at DESC
      LIMIT ?
    `;
    if (isMySQL) {
      const [rows] = await mysqlPool.query(sql, [numLimit]);
      return rows;
    } else {
      return sqliteDb.prepare(sql).all(numLimit);
    }
  },

  // 4. استرجاع تفاصيل طلب كاملة بكرت الإهداء ومسار السائق
  async getOrderDetails(orderNumber) {
    const orderSql = `
      SELECT 
        o.*,
        f.full_name as florist_name,
        d.full_name as driver_name,
        d.phone as driver_phone,
        dp.vehicle_type,
        dp.plate_number,
        dp.current_lat as driver_lat,
        dp.current_lng as driver_lng,
        p.method as payment_method,
        p.status as payment_status
      FROM orders o
      LEFT JOIN users f ON o.assigned_florist_id = f.id
      LEFT JOIN users d ON o.assigned_driver_id = d.id
      LEFT JOIN driver_profiles dp ON d.id = dp.user_id
      LEFT JOIN payments p ON o.id = p.order_id
      WHERE o.order_number = ?
    `;

    const itemsSql = `
      SELECT 
        oi.*,
        cbd.wrap_type,
        cbd.ribbon_color,
        cbd.wax_seal_text,
        cbd.seal_stamp,
        cbd.seal_color,
        cbd.flower_composition_json
      FROM order_items oi
      LEFT JOIN custom_bouquet_details cbd ON oi.id = cbd.order_item_id
      WHERE oi.order_id = ?
    `;

    const historySql = `
      SELECT h.*, u.full_name as author_name
      FROM order_status_history h
      LEFT JOIN users u ON h.changed_by_user_id = u.id
      WHERE h.order_id = ?
      ORDER BY h.created_at ASC
    `;

    const logsSql = `
      SELECT lat, lng, speed, recorded_at
      FROM delivery_tracking_logs
      WHERE order_id = ?
      ORDER BY recorded_at ASC
    `;

    if (isMySQL) {
      const [orders] = await mysqlPool.execute(orderSql, [String(orderNumber)]);
      const order = orders[0];
      if (!order) return null;

      const [items] = await mysqlPool.execute(itemsSql, [order.id]);
      const [history] = await mysqlPool.execute(historySql, [order.id]);
      const [trackingLogs] = await mysqlPool.execute(logsSql, [order.id]);

      return {
        order,
        items,
        history,
        trackingLogs
      };
    } else {
      const order = sqliteDb.prepare(orderSql).get(orderNumber);
      if (!order) return null;

      const items = sqliteDb.prepare(itemsSql).all(order.id);
      const history = sqliteDb.prepare(historySql).all(order.id);
      const trackingLogs = sqliteDb.prepare(logsSql).all(order.id);

      return {
        order,
        items,
        history,
        trackingLogs
      };
    }
  },

  // 5. استرجاع قائمة السائقين وحالتهم وإحداثياتهم
  async getDriversList() {
    const sql = `
      SELECT 
        u.id,
        u.full_name,
        u.phone,
        dp.vehicle_type,
        dp.plate_number,
        dp.current_status,
        dp.current_lat,
        dp.current_lng,
        dp.total_deliveries,
        dp.rating,
        COALESCE(dp.current_custody_amount, 0) as current_custody_amount,
        COALESCE(dp.pending_earnings, 0) as pending_earnings,
        COALESCE(dp.total_collected_cash, 0) as total_collected_cash,
        COALESCE(dp.total_earned_commission, 0) as total_earned_commission,
        COALESCE(dp.settled_amount_total, 0) as settled_amount_total,
        (SELECT COUNT(*) FROM orders o WHERE o.assigned_driver_id = u.id AND o.status IN ('preparing', 'out_for_delivery')) as active_deliveries_count
      FROM driver_profiles dp
      JOIN users u ON dp.user_id = u.id
      WHERE u.status = 'active'
      ORDER BY u.full_name ASC
    `;
    if (isMySQL) {
      const [rows] = await mysqlPool.query(sql);
      return rows;
    } else {
      return sqliteDb.prepare(sql).all();
    }
  },

  // 5b. استرجاع قائمة منسقي الزهور وحجم المهام الحالية
  async getFloristsList() {
    const sql = `
      SELECT 
        u.id,
        u.full_name,
        u.phone,
        u.email,
        u.status,
        (SELECT COUNT(*) FROM orders o WHERE o.assigned_florist_id = u.id AND o.status IN ('confirmed', 'preparing')) as active_tasks_count
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name = 'florist' AND u.status = 'active'
      ORDER BY u.full_name ASC
    `;
    if (isMySQL) {
      const [rows] = await mysqlPool.query(sql);
      return rows;
    } else {
      return sqliteDb.prepare(sql).all();
    }
  },

  // 6. تحديث موقع السائق اللحظي بالـ GPS
  async updateDriverLocation(driverId, lat, lng, orderId = null, speed = 0) {
    if (isMySQL) {
      await mysqlPool.execute(`
        UPDATE driver_profiles
        SET current_lat = ?, current_lng = ?, last_location_update = NOW()
        WHERE user_id = ?
      `, [lat, lng, driverId]);

      if (orderId) {
        await mysqlPool.execute(`
          INSERT INTO delivery_tracking_logs (order_id, driver_id, lat, lng, speed)
          VALUES (?, ?, ?, ?, ?)
        `, [orderId, driverId, lat, lng, speed]);
      }
    } else {
      sqliteDb.prepare(`
        UPDATE driver_profiles
        SET current_lat = ?, current_lng = ?, last_location_update = datetime('now')
        WHERE user_id = ?
      `).run(lat, lng, driverId);

      if (orderId) {
        sqliteDb.prepare(`
          INSERT INTO delivery_tracking_logs (order_id, driver_id, lat, lng, speed)
          VALUES (?, ?, ?, ?, ?)
        `).run(orderId, driverId, lat, lng, speed);
      }
    }
    return true;
  },

  // 7. جلب حالة المخزون الحي للزهور للاستوديو وصور الزوايا المتعددة
  async getFlowerStock() {
    const sql = `
      SELECT 
        id, 
        name_ar, 
        color, 
        image_url, 
        image_front, 
        image_side, 
        image_top, 
        image_stem, 
        images_angles_json, 
        description, 
        unit_price, 
        stock_quantity, 
        alert_threshold, 
        is_available, 
        created_at
      FROM flower_inventory
      ORDER BY id ASC
    `;
    if (isMySQL) {
      const [rows] = await mysqlPool.query(sql);
      return rows;
    } else {
      return sqliteDb.prepare(sql).all();
    }
  },

  // 7b. إضافة صنف ورد جديد مع صور الزوايا المتعددة
  async addFlower(data) {
    const name_ar = data.name_ar ? data.name_ar.trim() : (data.name ? data.name.trim() : '');
    if (!name_ar) throw new Error('اسم الزهرة مطلوب');
    const color = data.color ? data.color.trim() : 'وردي';
    const unit_price = Number(data.unit_price || data.unitPrice || 5);
    const stock_quantity = Number(data.stock_quantity || data.stockQuantity || 50);
    const alert_threshold = Number(data.alert_threshold || data.alertThreshold || 15);
    const image_front = data.image_front || data.imageFront || data.image_url || '/assets/flowers/pink-rose-front.svg';
    const image_side = data.image_side || data.imageSide || '/assets/flowers/pink-rose-side.svg';
    const image_top = data.image_top || data.imageTop || '/assets/flowers/pink-rose-top.svg';
    const image_stem = data.image_stem || data.imageStem || '/assets/flowers/pink-rose-stem.svg';
    const image_url = data.image_url || image_front;
    const description = data.description ? data.description.trim() : '';

    if (isMySQL) {
      const [res] = await mysqlPool.execute(`
        INSERT INTO flower_inventory (
          name_ar, color, image_url, image_front, image_side, image_top, image_stem,
          description, unit_price, stock_quantity, alert_threshold, is_available
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        name_ar, color, image_url, image_front, image_side, image_top, image_stem,
        description, unit_price, stock_quantity, alert_threshold
      ]);
      const [rows] = await mysqlPool.execute(`SELECT * FROM flower_inventory WHERE id = ?`, [res.insertId]);
      return rows[0];
    } else {
      const info = sqliteDb.prepare(`
        INSERT INTO flower_inventory (
          name_ar, color, unit_price, stock_quantity, alert_threshold, is_available
        ) VALUES (?, ?, ?, ?, ?, 1)
      `).run(name_ar, color, unit_price, stock_quantity, alert_threshold);
      return sqliteDb.prepare(`SELECT * FROM flower_inventory WHERE id = ?`).get(info.lastInsertRowid);
    }
  },

  // 7c. تعديل بيانات صنف ورد بالكامل بما في ذلك صور الزوايا
  async updateFlower(id, data) {
    if (isMySQL) {
      const [existing] = await mysqlPool.execute(`SELECT * FROM flower_inventory WHERE id = ?`, [id]);
      if (!existing || existing.length === 0) throw new Error('الزهرة غير موجودة');
      const current = existing[0];

      const name_ar = data.name_ar !== undefined ? data.name_ar : current.name_ar;
      const color = data.color !== undefined ? data.color : current.color;
      const unit_price = data.unit_price !== undefined ? Number(data.unit_price) : current.unit_price;
      const stock_quantity = data.stock_quantity !== undefined ? Number(data.stock_quantity) : current.stock_quantity;
      const alert_threshold = data.alert_threshold !== undefined ? Number(data.alert_threshold) : current.alert_threshold;
      const is_available = data.is_available !== undefined ? (data.is_available ? 1 : 0) : current.is_available;
      const image_url = data.image_url !== undefined ? data.image_url : current.image_url;
      const image_front = data.image_front !== undefined ? data.image_front : current.image_front;
      const image_side = data.image_side !== undefined ? data.image_side : current.image_side;
      const image_top = data.image_top !== undefined ? data.image_top : current.image_top;
      const image_stem = data.image_stem !== undefined ? data.image_stem : current.image_stem;
      const description = data.description !== undefined ? data.description : current.description;

      await mysqlPool.execute(`
        UPDATE flower_inventory SET
          name_ar = ?, color = ?, image_url = ?, image_front = ?, image_side = ?,
          image_top = ?, image_stem = ?, description = ?, unit_price = ?,
          stock_quantity = ?, alert_threshold = ?, is_available = ?
        WHERE id = ?
      `, [
        name_ar, color, image_url, image_front, image_side, image_top, image_stem,
        description, unit_price, stock_quantity, alert_threshold, is_available, id
      ]);
      const [rows] = await mysqlPool.execute(`SELECT * FROM flower_inventory WHERE id = ?`, [id]);
      return rows[0];
    } else {
      if (data.stock_quantity !== undefined && data.unit_price !== undefined) {
        sqliteDb.prepare(`UPDATE flower_inventory SET stock_quantity = ?, unit_price = ? WHERE id = ?`).run(data.stock_quantity, data.unit_price, id);
      } else if (data.stock_quantity !== undefined) {
        sqliteDb.prepare(`UPDATE flower_inventory SET stock_quantity = ? WHERE id = ?`).run(data.stock_quantity, id);
      }
      return sqliteDb.prepare(`SELECT * FROM flower_inventory WHERE id = ?`).get(id);
    }
  },

  // 7d. حذف صنف ورد مع التحقق من عدم استخدامه في باقات
  async deleteFlower(id) {
    if (isMySQL) {
      const [recipes] = await mysqlPool.execute(`
        SELECT b.title FROM bouquet_flowers bf
        JOIN bouquets b ON bf.bouquet_id = b.id
        WHERE bf.flower_id = ?
      `, [id]);
      if (recipes.length > 0) {
        const bouquetNames = recipes.map(r => r.title).join('، ');
        throw new Error(`لا يمكن حذف هذه الوردة لأنها مستخدمة في الباقات التالية: (${bouquetNames}). يجب إزالتها من تركيبة الباقات أولاً أو تعطيل توفرها.`);
      }

      await mysqlPool.execute(`DELETE FROM flower_inventory WHERE id = ?`, [id]);
      return { success: true, message: 'تم حذف الوردة من المخزون بنجاح' };
    } else {
      sqliteDb.prepare(`DELETE FROM flower_inventory WHERE id = ?`).run(id);
      return { success: true, message: 'تم حذف الوردة بنجاح' };
    }
  },

  // 8. تحديث كمية صنف في مخزون الزهور
  async updateFlowerStock(flowerId, quantity, unitPrice = null) {
    if (isMySQL) {
      if (unitPrice !== null) {
        await mysqlPool.execute(`
          UPDATE flower_inventory
          SET stock_quantity = ?, unit_price = ?
          WHERE id = ?
        `, [quantity, unitPrice, flowerId]);
      } else {
        await mysqlPool.execute(`
          UPDATE flower_inventory
          SET stock_quantity = ?
          WHERE id = ?
        `, [quantity, flowerId]);
      }
      const [rows] = await mysqlPool.execute(`SELECT * FROM flower_inventory WHERE id = ?`, [flowerId]);
      return rows[0];
    } else {
      if (unitPrice !== null) {
        sqliteDb.prepare(`
          UPDATE flower_inventory
          SET stock_quantity = ?, unit_price = ?
          WHERE id = ?
        `).run(quantity, unitPrice, flowerId);
      } else {
        sqliteDb.prepare(`
          UPDATE flower_inventory
          SET stock_quantity = ?
          WHERE id = ?
        `).run(quantity, flowerId);
      }
      return sqliteDb.prepare(`SELECT * FROM flower_inventory WHERE id = ?`).get(flowerId);
    }
  },

  // 9. تسجيل حساب زبون جديد
  async registerCustomer({ fullName, phone, email, password }) {
    if (isMySQL) {
      const [existing] = await mysqlPool.execute(
        `SELECT id FROM users WHERE phone = ? OR (email IS NOT NULL AND email != '' AND email = ?)`,
        [phone, email || '']
      );
      if (existing.length > 0) {
        throw new Error('رقم الهاتف أو البريد الإلكتروني مسجل مسبقاً');
      }

      const userId = crypto.randomUUID ? crypto.randomUUID() : ('msk-' + Math.random().toString(36).substring(2, 9));
      const hash = hashPassword(password);

      await mysqlPool.execute(`
        INSERT INTO users (id, full_name, phone, email, password_hash, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `, [userId, fullName, phone, email || null, hash]);

      const [roles] = await mysqlPool.query(`SELECT id FROM roles WHERE name = 'customer'`);
      if (roles.length > 0) {
        await mysqlPool.execute(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [userId, roles[0].id]);
      }

      await mysqlPool.execute(`INSERT INTO customer_profiles (user_id) VALUES (?)`, [userId]);

      return {
        id: userId,
        full_name: fullName,
        phone,
        email,
        role: 'customer'
      };
    } else {
      const existing = sqliteDb.prepare(`SELECT id FROM users WHERE phone = ? OR (email IS NOT NULL AND email = ?)`).get(phone, email || '');
      if (existing) {
        throw new Error('رقم الهاتف أو البريد الإلكتروني مسجل مسبقاً');
      }

      const userId = crypto.randomUUID ? crypto.randomUUID() : ('msk-' + Math.random().toString(36).substring(2, 9));
      const hash = hashPassword(password);

      sqliteDb.prepare(`
        INSERT INTO users (id, full_name, phone, email, password_hash, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(userId, fullName, phone, email || null, hash);

      const customerRole = sqliteDb.prepare(`SELECT id FROM roles WHERE name = 'customer'`).get();
      if (customerRole) {
        sqliteDb.prepare(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`).run(userId, customerRole.id);
      }

      sqliteDb.prepare(`INSERT INTO customer_profiles (user_id) VALUES (?)`).run(userId);

      return {
        id: userId,
        full_name: fullName,
        phone,
        email,
        role: 'customer'
      };
    }
  },

  // 10. التحقق من صلاحية كود الخصم (Coupon Validation)
  async validateCoupon(code, subtotal = 0) {
    let coupon = null;
    if (isMySQL) {
      const [rows] = await mysqlPool.execute(`
        SELECT * FROM coupons
        WHERE code = ? AND is_active = 1 AND (valid_until IS NULL OR valid_until > NOW())
      `, [code.toUpperCase()]);
      coupon = rows[0];
    } else {
      coupon = sqliteDb.prepare(`
        SELECT * FROM coupons
        WHERE code = ? AND is_active = 1 AND (valid_until IS NULL OR valid_until > datetime('now'))
      `).get(code.toUpperCase());
    }

    if (!coupon) {
      return { valid: false, message: 'كود الخصم غير صحيح أو منتهي الصلاحية' };
    }

    if (subtotal < coupon.min_order_amount) {
      return {
        valid: false,
        message: `الحد الأدنى للطلب لتفعيل هذا الكود هو ${coupon.min_order_amount} د.ل`
      };
    }

    const discountAmount = coupon.discount_type === 'percent'
      ? (subtotal * coupon.discount_value / 100)
      : coupon.discount_value;

    return {
      valid: true,
      coupon_id: coupon.id,
      code: coupon.code,
      discountAmount,
      finalTotal: Math.max(subtotal - discountAmount, 0)
    };
  },

  // 11. إنشاء طلب جديد وتخزينه بالكامل في قاعدة البيانات
  async createOrder(data) {
    const orderId = crypto.randomUUID ? crypto.randomUUID() : ('msk-' + Math.random().toString(36).substring(2, 9));
    const deliveryFee = typeof data.deliveryFee === 'number' ? data.deliveryFee : 10.0;
    const discountAmount = typeof data.discountAmount === 'number' ? data.discountAmount : 0.0;
    const subtotal = +data.subtotal || 0;
    const totalAmount = Math.max(subtotal - discountAmount + deliveryFee, 0);

    if (isMySQL) {
      const [[maxRow]] = await mysqlPool.query(`SELECT MAX(CAST(order_number AS UNSIGNED)) as max_num FROM orders`);
      const nextNum = String(maxRow && maxRow.max_num ? maxRow.max_num + 1 : 1052);

      await mysqlPool.execute(`
        INSERT INTO orders (
          id, order_number, customer_id, address_id,
          recipient_name, recipient_phone, delivery_city, delivery_zone, delivery_address_details,
          delivery_lat, delivery_lng, delivery_window, status,
          subtotal, discount_amount, delivery_fee, total_amount, coupon_id, customer_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?)
      `, [
        orderId,
        nextNum,
        data.customerId || null,
        data.addressId || null,
        data.recipientName,
        data.recipientPhone,
        data.city || 'طرابلس',
        data.zone || 'المركز',
        data.addressDetails || '',
        data.lat || 32.8872,
        data.lng || 13.1913,
        data.deliveryWindow ? new Date(data.deliveryWindow) : new Date(Date.now() + 2 * 3600000),
        subtotal,
        discountAmount,
        deliveryFee,
        totalAmount,
        data.couponId || null,
        data.notes || ''
      ]);

      if (Array.isArray(data.items)) {
        for (const item of data.items) {
          const itemId = crypto.randomUUID ? crypto.randomUUID() : ('item-' + Math.random().toString(36).substring(2, 9));
          const isCustom = item.itemType === 'custom_studio' || item.name?.includes('مخصصة');

          await mysqlPool.execute(`
            INSERT INTO order_items (id, order_id, item_type, bouquet_id, item_title, quantity, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            itemId,
            orderId,
            isCustom ? 'custom_studio' : 'ready_bouquet',
            item.bouquetId || null,
            item.name || item.title || 'باقة مسكة',
            item.quantity || 1,
            item.price || 0,
            (item.price || 0) * (item.quantity || 1)
          ]);

          if (isCustom && (item.waxSealText || item.flowers || data.waxSealText)) {
            await mysqlPool.execute(`
              INSERT INTO custom_bouquet_details (id, order_item_id, wrap_type, ribbon_color, wax_seal_text, seal_stamp, seal_color, flower_composition_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              crypto.randomUUID ? crypto.randomUUID() : ('cbd-' + Math.random().toString(36).substring(2, 9)),
              itemId,
              item.wrapType || data.wrapType || 'ورق كرافت فاخر',
              item.ribbonColor || data.ribbonColor || 'وردي مذهب',
              item.waxSealText || data.waxSealText || 'أجمل اللحظات هي التي تبدأ بوردة صادقة…',
              'MASKA 🌸',
              'أحمر قرمزي ملكي',
              JSON.stringify(item.flowers || [])
            ]);
          }
        }
      }

      await mysqlPool.execute(`
        INSERT INTO order_status_history (order_id, status, comment)
        VALUES (?, 'confirmed', 'تم تأكيد الطلب وحفظه في النظام بنجاح')
      `, [orderId]);

      await mysqlPool.execute(`
        INSERT INTO payments (id, order_id, method, status, amount)
        VALUES (?, ?, ?, ?, ?)
      `, [
        crypto.randomUUID ? crypto.randomUUID() : ('pay-' + Math.random().toString(36).substring(2, 9)),
        orderId,
        data.paymentMethod || 'cash_on_delivery',
        data.paymentMethod === 'cash_on_delivery' ? 'pending' : 'paid',
        totalAmount
      ]);

      return await this.getOrderDetails(nextNum);
    } else {
      const maxRow = sqliteDb.prepare(`SELECT MAX(CAST(order_number AS INTEGER)) as max_num FROM orders`).get();
      const nextNum = String(maxRow && maxRow.max_num ? maxRow.max_num + 1 : 1052);

      sqliteDb.prepare(`
        INSERT INTO orders (
          id, order_number, customer_id, address_id,
          recipient_name, recipient_phone, delivery_city, delivery_zone, delivery_address_details,
          delivery_lat, delivery_lng, delivery_window, status,
          subtotal, discount_amount, delivery_fee, total_amount, coupon_id, customer_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?)
      `).run(
        orderId,
        nextNum,
        data.customerId || null,
        data.addressId || null,
        data.recipientName,
        data.recipientPhone,
        data.city || 'طرابلس',
        data.zone || 'المركز',
        data.addressDetails || '',
        data.lat || 32.8872,
        data.lng || 13.1913,
        data.deliveryWindow || new Date(Date.now() + 2 * 3600000).toISOString(),
        subtotal,
        discountAmount,
        deliveryFee,
        totalAmount,
        data.couponId || null,
        data.notes || ''
      );

      if (Array.isArray(data.items)) {
        data.items.forEach(item => {
          const itemId = crypto.randomUUID ? crypto.randomUUID() : ('item-' + Math.random().toString(36).substring(2, 9));
          const isCustom = item.itemType === 'custom_studio' || item.name?.includes('مخصصة');

          sqliteDb.prepare(`
            INSERT INTO order_items (id, order_id, item_type, bouquet_id, item_title, quantity, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            itemId,
            orderId,
            isCustom ? 'custom_studio' : 'ready_bouquet',
            item.bouquetId || null,
            item.name || item.title || 'باقة مسكة',
            item.quantity || 1,
            item.price || 0,
            (item.price || 0) * (item.quantity || 1)
          );

          if (isCustom && (item.waxSealText || item.flowers || data.waxSealText)) {
            sqliteDb.prepare(`
              INSERT INTO custom_bouquet_details (id, order_item_id, wrap_type, ribbon_color, wax_seal_text, seal_stamp, seal_color, flower_composition_json)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              crypto.randomUUID ? crypto.randomUUID() : ('cbd-' + Math.random().toString(36).substring(2, 9)),
              itemId,
              item.wrapType || data.wrapType || 'ورق كرافت فاخر',
              item.ribbonColor || data.ribbonColor || 'وردي مذهب',
              item.waxSealText || data.waxSealText || 'أجمل اللحظات هي التي تبدأ بوردة صادقة…',
              'MASKA 🌸',
              'أحمر قرمزي ملكي',
              JSON.stringify(item.flowers || [])
            );
          }
        });
      }

      sqliteDb.prepare(`
        INSERT INTO order_status_history (order_id, status, comment)
        VALUES (?, 'confirmed', 'تم تأكيد الطلب وحفظه في النظام بنجاح')
      `).run(orderId);

      sqliteDb.prepare(`
        INSERT INTO payments (id, order_id, method, status, amount)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        crypto.randomUUID ? crypto.randomUUID() : ('pay-' + Math.random().toString(36).substring(2, 9)),
        orderId,
        data.paymentMethod || 'cash_on_delivery',
        data.paymentMethod === 'cash_on_delivery' ? 'pending' : 'paid',
        totalAmount
      );

      return await this.getOrderDetails(nextNum);
    }
  },

  // 12. تحديث حالة الطلب
  async updateOrderStatus(orderNumber, newStatus, changedByUserId = null, comment = '') {
    if (isMySQL) {
      const [orders] = await mysqlPool.execute(`SELECT id, assigned_driver_id FROM orders WHERE order_number = ?`, [String(orderNumber)]);
      const order = orders[0];
      if (!order) return null;

      await mysqlPool.execute(`
        UPDATE orders
        SET status = ?, updated_at = NOW()
        WHERE id = ?
      `, [newStatus, order.id]);

      await mysqlPool.execute(`
        INSERT INTO order_status_history (order_id, status, changed_by_user_id, comment)
        VALUES (?, ?, ?, ?)
      `, [order.id, newStatus, changedByUserId, comment || `تم تحديث الحالة إلى: ${newStatus}`]);

      if (newStatus === 'delivered') {
        await mysqlPool.execute(`UPDATE payments SET status = 'paid', paid_at = NOW() WHERE order_id = ?`, [order.id]);
        
        // حساب العهدة النقدية وأرباح التوصيل للسائق الميداني
        const [ordRows] = await mysqlPool.execute(
          `SELECT o.id, o.order_number, o.total_amount, o.delivery_fee, o.assigned_driver_id, p.method as payment_method 
           FROM orders o 
           LEFT JOIN payments p ON o.id = p.order_id 
           WHERE o.id = ?`,
          [order.id]
        );
        const fullOrder = ordRows[0];

        if (fullOrder && fullOrder.assigned_driver_id) {
          const driverId = fullOrder.assigned_driver_id;
          const totalAmount = Number(fullOrder.total_amount) || 0;
          const deliveryFee = Number(fullOrder.delivery_fee) || 10.00;
          const isCash = fullOrder.payment_method === 'cash_on_delivery' || !fullOrder.payment_method;

          // إذا كان الدفع نقداً: يُضاف إجمالي الطلب للعهدة النقدية المعلقة للسائق
          const custodyToAdd = isCash ? totalAmount : 0;
          const driverProfit = deliveryFee; // ربح السائق من التوصيل

          await mysqlPool.execute(`
            UPDATE driver_profiles 
            SET current_custody_amount = current_custody_amount + ?,
                total_collected_cash = total_collected_cash + ?,
                total_earned_commission = total_earned_commission + ?,
                pending_earnings = pending_earnings + ?,
                total_deliveries = total_deliveries + 1
            WHERE user_id = ?
          `, [custodyToAdd, custodyToAdd, driverProfit, driverProfit, driverId]);

          // الحصول على رصيد العهدة بعد التحديث
          const [dpRows] = await mysqlPool.execute(`SELECT current_custody_amount FROM driver_profiles WHERE user_id = ?`, [driverId]);
          const balanceAfter = dpRows[0] ? Number(dpRows[0].current_custody_amount) : 0;

          // تسجيل حركة مالية تفصيلية في سجل العهدة
          await mysqlPool.execute(`
            INSERT INTO driver_custody_transactions 
              (driver_id, order_id, type, amount, delivery_fee, driver_profit, balance_after, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            driverId,
            fullOrder.id,
            isCash ? 'order_collection' : 'delivery_earning',
            custodyToAdd,
            deliveryFee,
            driverProfit,
            balanceAfter,
            isCash 
              ? `تحصيل كاش عند التسليم للطلب #${fullOrder.order_number} (+${custodyToAdd} د.ل عهدة | +${driverProfit} د.ل ربح توصيل)`
              : `ربح توصيل للطلب الإلكتروني #${fullOrder.order_number} (+${driverProfit} د.ل)`
          ]);
        }
      }

      return await this.getOrderDetails(orderNumber);
    } else {
      const order = sqliteDb.prepare(`SELECT id, assigned_driver_id FROM orders WHERE order_number = ?`).get(orderNumber);
      if (!order) return null;

      sqliteDb.prepare(`
        UPDATE orders
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(newStatus, order.id);

      sqliteDb.prepare(`
        INSERT INTO order_status_history (order_id, status, changed_by_user_id, comment)
        VALUES (?, ?, ?, ?)
      `).run(order.id, newStatus, changedByUserId, comment || `تم تحديث الحالة إلى: ${newStatus}`);

      if (newStatus === 'delivered') {
        sqliteDb.prepare(`UPDATE payments SET status = 'paid', paid_at = datetime('now') WHERE order_id = ?`).run(order.id);
        if (order.assigned_driver_id) {
          sqliteDb.prepare(`UPDATE driver_profiles SET total_deliveries = total_deliveries + 1 WHERE user_id = ?`).run(order.assigned_driver_id);
        }
      }

      return await this.getOrderDetails(orderNumber);
    }
  },

  // 13. إسناد وتوجيه الطلب لمنسق أو سائق
  async assignOrderStaff(orderNumber, { floristId, driverId, status }, changedByUserId = null) {
    if (isMySQL) {
      const [orders] = await mysqlPool.execute(`SELECT id, status, assigned_florist_id, assigned_driver_id FROM orders WHERE order_number = ?`, [String(orderNumber)]);
      const order = orders[0];
      if (!order) return null;

      let updates = [];
      let params = [];
      const comments = [];

      if (floristId !== undefined) {
        const newFloristId = floristId === '' ? null : floristId;
        updates.push(`assigned_florist_id = ?`);
        params.push(newFloristId);

        if (newFloristId && newFloristId !== order.assigned_florist_id) {
          const [florists] = await mysqlPool.execute(`SELECT full_name FROM users WHERE id = ?`, [newFloristId]);
          comments.push(`توجيه لمنسقة الورد: ${florists[0]?.full_name || newFloristId}`);
        } else if (!newFloristId && order.assigned_florist_id) {
          comments.push('إلغاء إسناد منسقة الورد');
        }
      }

      if (driverId !== undefined) {
        const newDriverId = driverId === '' ? null : driverId;
        updates.push(`assigned_driver_id = ?`);
        params.push(newDriverId);

        if (newDriverId && newDriverId !== order.assigned_driver_id) {
          const [drivers] = await mysqlPool.execute(`SELECT full_name FROM users WHERE id = ?`, [newDriverId]);
          comments.push(`توجيه لسائق التوصيل: ${drivers[0]?.full_name || newDriverId}`);
        } else if (!newDriverId && order.assigned_driver_id) {
          comments.push('إلغاء إسناد سائق التوصيل');
        }
      }

      let finalStatus = order.status;
      if (status) {
        finalStatus = status;
        updates.push(`status = ?`);
        params.push(status);
      } else {
        if (driverId && ['confirmed', 'preparing'].includes(order.status)) {
          finalStatus = 'out_for_delivery';
          updates.push(`status = 'out_for_delivery'`);
        } else if (floristId && order.status === 'confirmed') {
          finalStatus = 'preparing';
          updates.push(`status = 'preparing'`);
        }
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        params.push(order.id);
        await mysqlPool.execute(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);
      }

      if (comments.length > 0) {
        await mysqlPool.execute(`
          INSERT INTO order_status_history (order_id, status, changed_by_user_id, comment)
          VALUES (?, ?, ?, ?)
        `, [order.id, finalStatus, changedByUserId, comments.join(' | ')]);
      }

      return await this.getOrderDetails(orderNumber);
    } else {
      const order = sqliteDb.prepare(`SELECT id, status, assigned_florist_id, assigned_driver_id FROM orders WHERE order_number = ?`).get(orderNumber);
      if (!order) return null;

      let updates = [];
      let params = [];
      const comments = [];

      if (floristId !== undefined) {
        const newFloristId = floristId === '' ? null : floristId;
        updates.push(`assigned_florist_id = ?`);
        params.push(newFloristId);

        if (newFloristId && newFloristId !== order.assigned_florist_id) {
          const florist = sqliteDb.prepare(`SELECT full_name FROM users WHERE id = ?`).get(newFloristId);
          comments.push(`توجيه لمنسقة الورد: ${florist?.full_name || newFloristId}`);
        } else if (!newFloristId && order.assigned_florist_id) {
          comments.push('إلغاء إسناد منسقة الورد');
        }
      }

      if (driverId !== undefined) {
        const newDriverId = driverId === '' ? null : driverId;
        updates.push(`assigned_driver_id = ?`);
        params.push(newDriverId);

        if (newDriverId && newDriverId !== order.assigned_driver_id) {
          const driver = sqliteDb.prepare(`SELECT full_name FROM users WHERE id = ?`).get(newDriverId);
          comments.push(`توجيه لسائق التوصيل: ${driver?.full_name || newDriverId}`);
        } else if (!newDriverId && order.assigned_driver_id) {
          comments.push('إلغاء إسناد سائق التوصيل');
        }
      }

      let finalStatus = order.status;
      if (status) {
        finalStatus = status;
        updates.push(`status = ?`);
        params.push(status);
      } else {
        if (driverId && ['confirmed', 'preparing'].includes(order.status)) {
          finalStatus = 'out_for_delivery';
          updates.push(`status = 'out_for_delivery'`);
        } else if (floristId && order.status === 'confirmed') {
          finalStatus = 'preparing';
          updates.push(`status = 'preparing'`);
        }
      }

      if (updates.length > 0) {
        updates.push(`updated_at = datetime('now')`);
        params.push(order.id);
        sqliteDb.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      if (comments.length > 0) {
        sqliteDb.prepare(`
          INSERT INTO order_status_history (order_id, status, changed_by_user_id, comment)
          VALUES (?, ?, ?, ?)
        `).run(order.id, finalStatus, changedByUserId, comments.join(' | '));
      }

      return await this.getOrderDetails(orderNumber);
    }
  },

  // 14. جلب جميع الكوبونات للإدارة مع إحصائيات الاستخدام
  async getAllCoupons() {
    const sql = `
      SELECT 
        c.*,
        u.full_name as creator_name,
        (SELECT COUNT(*) FROM coupon_usages cu WHERE cu.coupon_id = c.id) as real_usage_count
      FROM coupons c
      LEFT JOIN users u ON c.created_by_admin_id = u.id
      ORDER BY c.created_at DESC
    `;
    if (isMySQL) {
      const [rows] = await mysqlPool.query(sql);
      return rows;
    } else {
      return sqliteDb.prepare(sql).all();
    }
  },

  // 15. إنشاء كوبون تخفيض جديد بواسطة الأدمن
  async createCoupon(adminId, data) {
    const code = data.code.trim().toUpperCase();

    if (isMySQL) {
      const [existing] = await mysqlPool.execute(`SELECT id FROM coupons WHERE code = ?`, [code]);
      if (existing.length > 0) {
        throw new Error(`كود الكوبون ${code} مسجل مسبقاً`);
      }

      const [result] = await mysqlPool.execute(`
        INSERT INTO coupons (
          code, title, discount_type, discount_value, min_order_amount,
          max_discount_cap, valid_until, usage_limit, per_user_limit,
          created_by_admin_id, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        code,
        data.title || 'كوبون تخفيض مسكة',
        data.discountType || 'fixed',
        +data.discountValue || 10,
        +data.minOrderAmount || 0,
        data.maxDiscountCap ? +data.maxDiscountCap : null,
        data.validUntil ? new Date(data.validUntil) : null,
        +data.usageLimit || 100,
        +data.perUserLimit || 1,
        adminId
      ]);

      const [coupons] = await mysqlPool.execute(`SELECT * FROM coupons WHERE id = ?`, [result.insertId]);
      return coupons[0];
    } else {
      const existing = sqliteDb.prepare(`SELECT id FROM coupons WHERE code = ?`).get(code);
      if (existing) {
        throw new Error(`كود الكوبون ${code} مسجل مسبقاً`);
      }

      const info = sqliteDb.prepare(`
        INSERT INTO coupons (
          code, title, discount_type, discount_value, min_order_amount,
          max_discount_cap, valid_until, usage_limit, per_user_limit,
          created_by_admin_id, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        code,
        data.title || 'كوبون تخفيض مسكة',
        data.discountType || 'fixed',
        +data.discountValue || 10,
        +data.minOrderAmount || 0,
        data.maxDiscountCap ? +data.maxDiscountCap : null,
        data.validUntil || null,
        +data.usageLimit || 100,
        +data.perUserLimit || 1,
        adminId
      );

      return sqliteDb.prepare(`SELECT * FROM coupons WHERE id = ?`).get(info.lastInsertRowid);
    }
  },

  // 16. تفعيل أو تعطيل كوبون
  async toggleCouponStatus(couponId, isActive) {
    if (isMySQL) {
      await mysqlPool.execute(`UPDATE coupons SET is_active = ? WHERE id = ?`, [isActive ? 1 : 0, couponId]);
      const [rows] = await mysqlPool.execute(`SELECT * FROM coupons WHERE id = ?`, [couponId]);
      return rows[0];
    } else {
      sqliteDb.prepare(`UPDATE coupons SET is_active = ? WHERE id = ?`).run(isActive ? 1 : 0, couponId);
      return sqliteDb.prepare(`SELECT * FROM coupons WHERE id = ?`).get(couponId);
    }
  },

  // 17. حذف كوبون
  async deleteCoupon(couponId) {
    if (isMySQL) {
      await mysqlPool.execute(`DELETE FROM coupons WHERE id = ?`, [couponId]);
      return { success: true, message: 'تم حذف الكوبون بنجاح' };
    } else {
      sqliteDb.prepare(`DELETE FROM coupons WHERE id = ?`).run(couponId);
      return { success: true, message: 'تم حذف الكوبون بنجاح' };
    }
  },

  // 18. استرجاع تقييمات وآراء الزبائن
  async getCustomerReviews({ onlyApproved = false, onlyFeatured = false } = {}) {
    let sql = `
      SELECT 
        r.*,
        o.order_number,
        d.full_name as driver_name,
        u.full_name as customer_real_name
      FROM customer_reviews r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN users d ON r.driver_id = d.id
      LEFT JOIN users u ON r.customer_id = u.id
      WHERE 1=1
    `;
    if (onlyApproved) {
      sql += ` AND r.is_approved = 1`;
    }
    if (onlyFeatured) {
      sql += ` AND r.is_featured = 1 AND r.is_approved = 1`;
    }
    sql += ` ORDER BY r.created_at DESC`;

    if (isMySQL) {
      const [rows] = await mysqlPool.query(sql);
      return rows;
    } else {
      return sqliteDb.prepare(sql).all();
    }
  },

  // 19. إضافة تقييم وملاحظة جديدة من الزبون بعد استلام الطلب
  async addCustomerReview(data) {
    const reviewId = crypto.randomUUID ? crypto.randomUUID() : ('rev-' + Math.random().toString(36).substring(2, 9));

    if (isMySQL) {
      let order = null;
      if (data.orderNumber) {
        const [orders] = await mysqlPool.execute(`SELECT id, customer_id, assigned_driver_id, delivery_city FROM orders WHERE order_number = ?`, [data.orderNumber]);
        order = orders[0] || null;
      }

      const customerId = data.customerId || (order ? order.customer_id : null);
      const driverId = data.driverId || (order ? order.assigned_driver_id : null);

      await mysqlPool.execute(`
        INSERT INTO customer_reviews (
          id, order_id, customer_id, driver_id,
          rating_overall, rating_flowers, rating_delivery, rating_packaging,
          customer_comment, customer_name_display, city, is_approved, is_featured
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `, [
        reviewId,
        order ? order.id : null,
        customerId,
        driverId,
        Math.min(5, Math.max(1, +data.ratingOverall || 5)),
        data.ratingFlowers ? Math.min(5, Math.max(1, +data.ratingFlowers)) : null,
        data.ratingDelivery ? Math.min(5, Math.max(1, +data.ratingDelivery)) : null,
        data.ratingPackaging ? Math.min(5, Math.max(1, +data.ratingPackaging)) : null,
        data.comment.trim(),
        data.customerName || 'عميل مسكة',
        data.city || (order ? order.delivery_city : 'طرابلس'),
        data.isFeatured ? 1 : 0
      ]);

      const [rows] = await mysqlPool.execute(`SELECT * FROM customer_reviews WHERE id = ?`, [reviewId]);
      return rows[0];
    } else {
      let order = null;
      if (data.orderNumber) {
        order = sqliteDb.prepare(`SELECT id, customer_id, assigned_driver_id, delivery_city FROM orders WHERE order_number = ?`).get(data.orderNumber);
      }

      const customerId = data.customerId || (order ? order.customer_id : null);
      const driverId = data.driverId || (order ? order.assigned_driver_id : null);

      sqliteDb.prepare(`
        INSERT INTO customer_reviews (
          id, order_id, customer_id, driver_id,
          rating_overall, rating_flowers, rating_delivery, rating_packaging,
          customer_comment, customer_name_display, city, is_approved, is_featured
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(
        reviewId,
        order ? order.id : null,
        customerId,
        driverId,
        Math.min(5, Math.max(1, +data.ratingOverall || 5)),
        data.ratingFlowers ? Math.min(5, Math.max(1, +data.ratingFlowers)) : null,
        data.ratingDelivery ? Math.min(5, Math.max(1, +data.ratingDelivery)) : null,
        data.ratingPackaging ? Math.min(5, Math.max(1, +data.ratingPackaging)) : null,
        data.comment.trim(),
        data.customerName || 'عميل مسكة',
        data.city || (order ? order.delivery_city : 'طرابلس'),
        data.isFeatured ? 1 : 0
      );

      return sqliteDb.prepare(`SELECT * FROM customer_reviews WHERE id = ?`).get(reviewId);
    }
  },

  // 20. رد الإدارة على تقييم الزبون
  async replyToReview(reviewId, replyText) {
    if (isMySQL) {
      await mysqlPool.execute(`
        UPDATE customer_reviews
        SET admin_reply = ?, admin_reply_at = NOW()
        WHERE id = ?
      `, [replyText.trim(), reviewId]);

      const [rows] = await mysqlPool.execute(`SELECT * FROM customer_reviews WHERE id = ?`, [reviewId]);
      return rows[0];
    } else {
      sqliteDb.prepare(`
        UPDATE customer_reviews
        SET admin_reply = ?, admin_reply_at = datetime('now')
        WHERE id = ?
      `).run(replyText.trim(), reviewId);

      return sqliteDb.prepare(`SELECT * FROM customer_reviews WHERE id = ?`).get(reviewId);
    }
  },

  // 21. تحديد التقييم كـ مميز ليظهر في قسم التوصيات بالصفحة الرئيسية
  async toggleReviewFeatured(reviewId, isFeatured) {
    if (isMySQL) {
      await mysqlPool.execute(`
        UPDATE customer_reviews
        SET is_featured = ?
        WHERE id = ?
      `, [isFeatured ? 1 : 0, reviewId]);

      const [rows] = await mysqlPool.execute(`SELECT * FROM customer_reviews WHERE id = ?`, [reviewId]);
      return rows[0];
    } else {
      sqliteDb.prepare(`
        UPDATE customer_reviews
        SET is_featured = ?
        WHERE id = ?
      `).run(isFeatured ? 1 : 0, reviewId);

      return sqliteDb.prepare(`SELECT * FROM customer_reviews WHERE id = ?`).get(reviewId);
    }
  },

  // 22. تقديم ملاحظة أو اقتراح أو شكوى عامة من الزبائن
  async submitCustomerFeedback(data) {
    if (isMySQL) {
      const [result] = await mysqlPool.execute(`
        INSERT INTO customer_feedback (customer_name, phone, feedback_type, subject, message, status)
        VALUES (?, ?, ?, ?, ?, 'new')
      `, [
        data.name.trim(),
        data.phone ? data.phone.trim() : null,
        data.type || 'suggestion',
        data.subject.trim(),
        data.message.trim()
      ]);

      const [rows] = await mysqlPool.execute(`SELECT * FROM customer_feedback WHERE id = ?`, [result.insertId]);
      return rows[0];
    } else {
      const info = sqliteDb.prepare(`
        INSERT INTO customer_feedback (customer_name, phone, feedback_type, subject, message, status)
        VALUES (?, ?, ?, ?, ?, 'new')
      `).run(
        data.name.trim(),
        data.phone ? data.phone.trim() : null,
        data.type || 'suggestion',
        data.subject.trim(),
        data.message.trim()
      );

      return sqliteDb.prepare(`SELECT * FROM customer_feedback WHERE id = ?`).get(info.lastInsertRowid);
    }
  },

  // 23. جلب جميع الملاحظات والاقتراحات للإدارة
  async getAllCustomerFeedback() {
    if (isMySQL) {
      const [rows] = await mysqlPool.query(`SELECT * FROM customer_feedback ORDER BY created_at DESC`);
      return rows;
    } else {
      return sqliteDb.prepare(`SELECT * FROM customer_feedback ORDER BY created_at DESC`).all();
    }
  },

  // 24. جلب قائمة أسعار التوصيل حسب المناطق والمدن
  async getDeliveryZonesPricing() {
    const sql = `SELECT * FROM delivery_zones_pricing WHERE is_active = 1 ORDER BY city, zone_name`;
    if (isMySQL) {
      const [rows] = await mysqlPool.query(sql);
      return rows;
    } else {
      return sqliteDb.prepare(sql).all();
    }
  },

  // 25. تعديل سعر توصيل منطقة مع تسجيل السجل الرقابي
  async updateDeliveryZoneFee(zoneId, newFee, adminId = null, reason = '') {
    if (isMySQL) {
      const [zones] = await mysqlPool.execute(`SELECT * FROM delivery_zones_pricing WHERE id = ?`, [zoneId]);
      const zone = zones[0];
      if (!zone) throw new Error('المنطقة غير موجودة');

      await mysqlPool.execute(`UPDATE delivery_zones_pricing SET delivery_fee = ? WHERE id = ?`, [newFee, zoneId]);

      await mysqlPool.execute(`
        INSERT INTO price_change_logs (item_type, item_id, item_name, old_price, new_price, changed_by_user_id, reason)
        VALUES ('delivery_zone', ?, ?, ?, ?, ?, ?)
      `, [String(zoneId), `${zone.city} — ${zone.zone_name}`, zone.delivery_fee, newFee, adminId, reason || 'تعديل سعر التوصيل للمنطقة']);

      const [updated] = await mysqlPool.execute(`SELECT * FROM delivery_zones_pricing WHERE id = ?`, [zoneId]);
      return updated[0];
    } else {
      const zone = sqliteDb.prepare(`SELECT * FROM delivery_zones_pricing WHERE id = ?`).get(zoneId);
      if (!zone) throw new Error('المنطقة غير موجودة');

      sqliteDb.prepare(`UPDATE delivery_zones_pricing SET delivery_fee = ? WHERE id = ?`).run(newFee, zoneId);

      sqliteDb.prepare(`
        INSERT INTO price_change_logs (item_type, item_id, item_name, old_price, new_price, changed_by_user_id, reason)
        VALUES ('delivery_zone', ?, ?, ?, ?, ?, ?)
      `).run(zoneId, `${zone.city} — ${zone.zone_name}`, zone.delivery_fee, newFee, adminId, reason || 'تعديل سعر التوصيل للمنطقة');

      return sqliteDb.prepare(`SELECT * FROM delivery_zones_pricing WHERE id = ?`).get(zoneId);
    }
  },

  // 26. تعديل سعر ساق الورد مع تسجيل السجل الرقابي
  async updateFlowerPrice(flowerId, newPrice, adminId = null, reason = '') {
    if (isMySQL) {
      const [flowers] = await mysqlPool.execute(`SELECT * FROM flower_inventory WHERE id = ?`, [flowerId]);
      const flower = flowers[0];
      if (!flower) throw new Error('الصنف غير موجود');

      await mysqlPool.execute(`UPDATE flower_inventory SET unit_price = ? WHERE id = ?`, [newPrice, flowerId]);

      await mysqlPool.execute(`
        INSERT INTO price_change_logs (item_type, item_id, item_name, old_price, new_price, changed_by_user_id, reason)
        VALUES ('flower', ?, ?, ?, ?, ?, ?)
      `, [String(flowerId), flower.name_ar, flower.unit_price, newPrice, adminId, reason || 'تعديل سعر الساق بالاستوديو']);

      const [updated] = await mysqlPool.execute(`SELECT * FROM flower_inventory WHERE id = ?`, [flowerId]);
      return updated[0];
    } else {
      const flower = sqliteDb.prepare(`SELECT * FROM flower_inventory WHERE id = ?`).get(flowerId);
      if (!flower) throw new Error('الصنف غير موجود');

      sqliteDb.prepare(`UPDATE flower_inventory SET unit_price = ? WHERE id = ?`).run(newPrice, flowerId);

      sqliteDb.prepare(`
        INSERT INTO price_change_logs (item_type, item_id, item_name, old_price, new_price, changed_by_user_id, reason)
        VALUES ('flower', ?, ?, ?, ?, ?, ?)
      `).run(flowerId, flower.name_ar, flower.unit_price, newPrice, adminId, reason || 'تعديل سعر الساق بالاستوديو');

      return sqliteDb.prepare(`SELECT * FROM flower_inventory WHERE id = ?`).get(flowerId);
    }
  },

  // 27. تعديل سعر باقة جاهزة مع تسجيل السجل الرقابي
  async updateBouquetPrice(bouquetId, newPrice, adminId = null, reason = '') {
    if (isMySQL) {
      const [bouquets] = await mysqlPool.execute(`SELECT * FROM bouquets WHERE id = ?`, [bouquetId]);
      const bouquet = bouquets[0];
      if (!bouquet) throw new Error('الباقة غير موجودة');

      await mysqlPool.execute(`UPDATE bouquets SET price = ? WHERE id = ?`, [newPrice, bouquetId]);

      await mysqlPool.execute(`
        INSERT INTO price_change_logs (item_type, item_id, item_name, old_price, new_price, changed_by_user_id, reason)
        VALUES ('bouquet', ?, ?, ?, ?, ?, ?)
      `, [String(bouquetId), bouquet.title, bouquet.price, newPrice, adminId, reason || 'تعديل سعر الباقة الجاهزة']);

      const [updated] = await mysqlPool.execute(`SELECT * FROM bouquets WHERE id = ?`, [bouquetId]);
      return updated[0];
    } else {
      const bouquet = sqliteDb.prepare(`SELECT * FROM bouquets WHERE id = ?`).get(bouquetId);
      if (!bouquet) throw new Error('الباقة غير موجودة');

      sqliteDb.prepare(`UPDATE bouquets SET price = ? WHERE id = ?`).run(newPrice, bouquetId);

      sqliteDb.prepare(`
        INSERT INTO price_change_logs (item_type, item_id, item_name, old_price, new_price, changed_by_user_id, reason)
        VALUES ('bouquet', ?, ?, ?, ?, ?, ?)
      `).run(bouquetId, bouquet.title, bouquet.price, newPrice, adminId, reason || 'تعديل سعر الباقة الجاهزة');

      return sqliteDb.prepare(`SELECT * FROM bouquets WHERE id = ?`).get(bouquetId);
    }
  },

  // 28. سجل الرقابة وتغير الأسعار
  async getPriceChangeHistory(limit = 30) {
    const numLimit = Math.max(1, Math.min(500, parseInt(limit, 10) || 30));
    const sql = `
      SELECT 
        l.*,
        u.full_name as author_name
      FROM price_change_logs l
      LEFT JOIN users u ON l.changed_by_user_id = u.id
      ORDER BY l.changed_at DESC
      LIMIT ?
    `;
    if (isMySQL) {
      const [rows] = await mysqlPool.query(sql, [numLimit]);
      return rows;
    } else {
      return sqliteDb.prepare(sql).all(numLimit);
    }
  },

  // 29. جلب الطلبات المسندة لسائق معين مع تفاصيل الباقة والوجهة والماهية
  async getDriverOrders(driverUserId) {
    let sql = `
      SELECT 
        o.*,
        f.full_name as florist_name,
        d.full_name as driver_name,
        d.phone as driver_phone,
        dp.vehicle_type,
        dp.plate_number,
        p.method as payment_method,
        p.status as payment_status
      FROM orders o
      LEFT JOIN users f ON o.assigned_florist_id = f.id
      LEFT JOIN users d ON o.assigned_driver_id = d.id
      LEFT JOIN driver_profiles dp ON d.id = dp.user_id
      LEFT JOIN payments p ON o.id = p.order_id
    `;
    let params = [];
    if (driverUserId) {
      sql += ` WHERE o.assigned_driver_id = ? OR (o.assigned_driver_id IS NULL AND o.status IN ('confirmed', 'preparing', 'out_for_delivery')) `;
      params.push(driverUserId);
    }
    sql += `
      ORDER BY 
        CASE o.status
          WHEN 'out_for_delivery' THEN 1
          WHEN 'preparing' THEN 2
          WHEN 'confirmed' THEN 3
          WHEN 'delivered' THEN 4
          ELSE 5
        END,
        o.created_at DESC
    `;

    const itemsSql = `
      SELECT 
        oi.*,
        cbd.wrap_type,
        cbd.ribbon_color,
        cbd.wax_seal_text,
        cbd.seal_stamp,
        cbd.seal_color,
        cbd.flower_composition_json
      FROM order_items oi
      LEFT JOIN custom_bouquet_details cbd ON oi.id = cbd.order_item_id
      WHERE oi.order_id = ?
    `;

    if (isMySQL) {
      const [orders] = await mysqlPool.query(sql, params);
      const results = [];
      for (const ord of orders) {
        const [items] = await mysqlPool.execute(itemsSql, [ord.id]);
        results.push({ ...ord, items });
      }
      return results;
    } else {
      const orders = sqliteDb.prepare(sql).all(...params);
      return orders.map(ord => {
        const items = sqliteDb.prepare(itemsSql).all(ord.id);
        return { ...ord, items };
      });
    }
  },

  // 30. تحديث حالة السائق (متاح / مشغول / غير متصل)
  async updateDriverProfileStatus(driverUserId, status) {
    if (isMySQL) {
      await mysqlPool.execute(`
        UPDATE driver_profiles
        SET current_status = ?, last_location_update = NOW()
        WHERE user_id = ?
      `, [status, driverUserId]);

      const [rows] = await mysqlPool.execute(`SELECT * FROM driver_profiles WHERE user_id = ?`, [driverUserId]);
      return rows[0];
    } else {
      sqliteDb.prepare(`
        UPDATE driver_profiles
        SET current_status = ?, last_location_update = datetime('now')
        WHERE user_id = ?
      `).run(status, driverUserId);

      return sqliteDb.prepare(`SELECT * FROM driver_profiles WHERE user_id = ?`).get(driverUserId);
    }
  },

  // 31. جلب كافة الباقات مع تركيبة وتوليفة الورود الخاصة بكل باقة
  async getAllBouquets() {
    if (isMySQL) {
      const [bouquets] = await mysqlPool.query(`SELECT * FROM bouquets ORDER BY is_featured DESC, id ASC`);
      const results = [];
      for (const b of bouquets) {
        const [flowers] = await mysqlPool.execute(`
          SELECT 
            bf.flower_id,
            bf.quantity_stems,
            bf.notes,
            fi.name_ar as flower_name,
            fi.color,
            fi.unit_price as stem_price,
            fi.image_front,
            fi.image_side,
            fi.image_top,
            fi.image_stem,
            fi.image_url,
            fi.stock_quantity as flower_stock
          FROM bouquet_flowers bf
          JOIN flower_inventory fi ON bf.flower_id = fi.id
          WHERE bf.bouquet_id = ?
          ORDER BY bf.quantity_stems DESC
        `, [b.id]);

        const totalStems = flowers.reduce((sum, f) => sum + (f.quantity_stems || 0), 0);
        const totalCost = flowers.reduce((sum, f) => sum + ((f.quantity_stems || 0) * Number(f.stem_price || 0)), 0);

        results.push({
          ...b,
          flowers,
          total_stems: totalStems,
          total_cost: totalCost
        });
      }
      return results;
    } else {
      const bouquets = sqliteDb.prepare(`SELECT * FROM bouquets ORDER BY is_featured DESC, id ASC`).all();
      return bouquets.map(b => ({ ...b, flowers: [], total_stems: 0, total_cost: 0 }));
    }
  },

  // 32. استرجاع تفاصيل باقة محددة مع وصفة الورود
  async getBouquetDetails(id) {
    if (isMySQL) {
      const [rows] = await mysqlPool.execute(`SELECT * FROM bouquets WHERE id = ?`, [id]);
      const bouquet = rows[0];
      if (!bouquet) return null;

      const [flowers] = await mysqlPool.execute(`
        SELECT 
          bf.flower_id,
          bf.quantity_stems,
          bf.notes,
          fi.name_ar as flower_name,
          fi.color,
          fi.unit_price as stem_price,
          fi.image_front,
          fi.image_side,
          fi.image_top,
          fi.image_stem,
          fi.image_url,
          fi.stock_quantity as flower_stock
        FROM bouquet_flowers bf
        JOIN flower_inventory fi ON bf.flower_id = fi.id
        WHERE bf.bouquet_id = ?
        ORDER BY bf.quantity_stems DESC
      `, [id]);

      const totalStems = flowers.reduce((sum, f) => sum + (f.quantity_stems || 0), 0);
      const totalCost = flowers.reduce((sum, f) => sum + ((f.quantity_stems || 0) * Number(f.stem_price || 0)), 0);

      return {
        ...bouquet,
        flowers,
        total_stems: totalStems,
        total_cost: totalCost
      };
    } else {
      const bouquet = sqliteDb.prepare(`SELECT * FROM bouquets WHERE id = ?`).get(id);
      return bouquet ? { ...bouquet, flowers: [], total_stems: 0, total_cost: 0 } : null;
    }
  },

  // 33. إنشاء باقة جديدة مع إلزامية اختيار الورود من قائمة الورود المسجلة بالمخزون
  async createBouquet(data) {
    const title = (data.title || '').trim();
    if (!title) throw new Error('عنوان الباقة مطلوب');
    const price = Number(data.price || 0);
    if (price <= 0) throw new Error('سعر الباقة يجب أن يكون أكبر من صفر');
    const occasion_tag = (data.occasion_tag || data.category || 'عام').trim();
    const slug = data.slug || (title.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substring(2, 6));
    const description = (data.description || '').trim();
    const image_svg_path = data.image_svg_path || data.image || '/assets/bouquet-pink-spring.svg';
    const is_featured = data.is_featured ? 1 : 0;
    const is_active = data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1;

    // التحقق الصارم من تركيبة الورود: "وماتقدرش ادخل وردة من برا القائمة لين اضيفها في قائمة الورود"
    const recipeItems = Array.isArray(data.flowers) ? data.flowers : [];
    if (recipeItems.length === 0) {
      throw new Error('يجب تحديد تركيبة الباقة وعدد الورود من كل صنف من قائمة الورود المسجلة بالمخزون.');
    }

    if (isMySQL) {
      // 1. التحقق من أن كل صنف موجود في جدول flower_inventory
      for (const item of recipeItems) {
        const fId = Number(item.flower_id || item.flowerId || item.id);
        const qty = Number(item.quantity_stems || item.qty || item.quantity || 1);
        if (!fId || isNaN(fId)) {
          throw new Error('معرف الوردة غير صالح');
        }
        if (qty <= 0) {
          throw new Error('عدد الورود يجب أن يكون 1 على الأقل');
        }

        const [exists] = await mysqlPool.execute(`SELECT id, name_ar FROM flower_inventory WHERE id = ?`, [fId]);
        if (exists.length === 0) {
          throw new Error(`الوردة برقم [${fId}] غير موجودة في قائمة الورود. لا يمكن إضافتها للباقة حتى تسجل أولاً في مخزون الورود.`);
        }
      }

      // 2. إدراج الباقة في جدول bouquets
      const [bRes] = await mysqlPool.execute(`
        INSERT INTO bouquets (
          title, slug, occasion_tag, price, description, image_svg_path, is_featured, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [title, slug, occasion_tag, price, description, image_svg_path, is_featured, is_active]);

      const newBouquetId = bRes.insertId;

      // 3. إدراج الورود في جدول bouquet_flowers
      for (const item of recipeItems) {
        const fId = Number(item.flower_id || item.flowerId || item.id);
        const qty = Number(item.quantity_stems || item.qty || item.quantity || 1);
        const notes = item.notes ? String(item.notes).trim() : null;

        await mysqlPool.execute(`
          INSERT INTO bouquet_flowers (bouquet_id, flower_id, quantity_stems, notes)
          VALUES (?, ?, ?, ?)
        `, [newBouquetId, fId, qty, notes]);
      }

      return await this.getBouquetDetails(newBouquetId);
    } else {
      throw new Error('إنشاء الباقات وتوليفاتها مدعوم في قاعدة بيانات MySQL');
    }
  },

  // 34. تعديل باقة وتحديث توليفة ورودها
  async updateBouquet(id, data) {
    if (isMySQL) {
      const [existing] = await mysqlPool.execute(`SELECT * FROM bouquets WHERE id = ?`, [id]);
      if (existing.length === 0) throw new Error('الباقة غير موجودة');
      const current = existing[0];

      const title = data.title !== undefined ? String(data.title).trim() : current.title;
      const price = data.price !== undefined ? Number(data.price) : current.price;
      const occasion_tag = data.occasion_tag !== undefined ? String(data.occasion_tag).trim() : current.occasion_tag;
      const description = data.description !== undefined ? String(data.description).trim() : current.description;
      const image_svg_path = data.image_svg_path !== undefined ? data.image_svg_path : current.image_svg_path;
      const is_featured = data.is_featured !== undefined ? (data.is_featured ? 1 : 0) : current.is_featured;
      const is_active = data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active;

      await mysqlPool.execute(`
        UPDATE bouquets SET
          title = ?, price = ?, occasion_tag = ?, description = ?,
          image_svg_path = ?, is_featured = ?, is_active = ?
        WHERE id = ?
      `, [title, price, occasion_tag, description, image_svg_path, is_featured, is_active, id]);

      // تحديث توليفة الورود إذا تم تمريرها
      if (Array.isArray(data.flowers)) {
        if (data.flowers.length === 0) {
          throw new Error('يجب تحديد تركيبة الباقة وعدد الورود من قائمة الورود المسجلة بالمخزون.');
        }

        // التحقق من وجود كل صنف
        for (const item of data.flowers) {
          const fId = Number(item.flower_id || item.flowerId || item.id);
          const [exists] = await mysqlPool.execute(`SELECT id, name_ar FROM flower_inventory WHERE id = ?`, [fId]);
          if (exists.length === 0) {
            throw new Error(`الوردة برقم [${fId}] غير موجودة في قائمة الورود. لا يمكن إضافتها للباقة حتى تسجل أولاً في مخزون الورود.`);
          }
        }

        // استبدال الوصفة
        await mysqlPool.execute(`DELETE FROM bouquet_flowers WHERE bouquet_id = ?`, [id]);
        for (const item of data.flowers) {
          const fId = Number(item.flower_id || item.flowerId || item.id);
          const qty = Number(item.quantity_stems || item.qty || item.quantity || 1);
          const notes = item.notes ? String(item.notes).trim() : null;
          await mysqlPool.execute(`
            INSERT INTO bouquet_flowers (bouquet_id, flower_id, quantity_stems, notes)
            VALUES (?, ?, ?, ?)
          `, [id, fId, qty, notes]);
        }
      }

      return await this.getBouquetDetails(id);
    } else {
      throw new Error('تعديل الباقات وتوليفاتها مدعوم في قاعدة بيانات MySQL');
    }
  },

  // 35. حذف باقة
  async deleteBouquet(id) {
    if (isMySQL) {
      await mysqlPool.execute(`DELETE FROM bouquets WHERE id = ?`, [id]);
      return { success: true, message: 'تم حذف الباقة بنجاح' };
    } else {
      return { success: true, message: 'تم حذف الباقة' };
    }
  },

  // ===========================================================================
  // النظام المالي للعهد النقدية وأرباح التوصيل والتسويات (Financial System)
  // ===========================================================================

  // 36. استرجاع الملخص المالي لسائق معين (العهدة، أرباح التوصيل، الحركات، والتسويات)
  async getDriverFinancialSummary(driverId) {
    if (isMySQL) {
      const [drivers] = await mysqlPool.execute(`
        SELECT 
          u.id,
          u.full_name,
          u.phone,
          u.avatar_url,
          dp.vehicle_type,
          dp.plate_number,
          dp.current_status,
          COALESCE(dp.current_custody_amount, 0) as current_custody_amount,
          COALESCE(dp.total_collected_cash, 0) as total_collected_cash,
          COALESCE(dp.total_earned_commission, 0) as total_earned_commission,
          COALESCE(dp.pending_earnings, 0) as pending_earnings,
          COALESCE(dp.settled_amount_total, 0) as settled_amount_total,
          dp.total_deliveries,
          dp.rating
        FROM users u
        JOIN driver_profiles dp ON u.id = dp.user_id
        WHERE u.id = ?
      `, [driverId]);

      const driver = drivers[0];
      if (!driver) return null;

      // حركات العهدة الأخيرة
      const [txs] = await mysqlPool.execute(`
        SELECT dct.*, o.order_number
        FROM driver_custody_transactions dct
        LEFT JOIN orders o ON dct.order_id = o.id
        WHERE dct.driver_id = ?
        ORDER BY dct.created_at DESC
        LIMIT 40
      `, [driverId]);

      // سجل التسويات مع الإدارة
      const [settlements] = await mysqlPool.execute(`
        SELECT ds.*, a.full_name as admin_name
        FROM driver_settlements ds
        JOIN users a ON ds.admin_id = a.id
        WHERE ds.driver_id = ?
        ORDER BY ds.created_at DESC
        LIMIT 20
      `, [driverId]);

      // إحصائيات وأرباح السائق اليومية
      const [[todayDriverStat]] = await mysqlPool.query(`
        SELECT 
          COUNT(DISTINCT order_id) as today_delivered_count,
          COALESCE(SUM(driver_profit), 0) as today_earnings,
          COALESCE(SUM(CASE WHEN type = 'order_collection' THEN amount ELSE 0 END), 0) as today_cash_collected
        FROM driver_custody_transactions
        WHERE driver_id = ? AND DATE(created_at) = CURDATE()
      `, [driverId]);

      const todayEarnings = Number(todayDriverStat?.today_earnings || 0);
      const todayDelivered = Number(todayDriverStat?.today_delivered_count || 0);
      const todayCash = Number(todayDriverStat?.today_cash_collected || 0);

      const custody = Number(driver.current_custody_amount) || 0;
      const earnings = Number(driver.pending_earnings) || 0;
      const netDue = Math.max(0, custody - earnings);

      return {
        driver: {
          ...driver,
          current_custody_amount: custody,
          pending_earnings: earnings,
          net_cash_due_to_admin: netDue,
          net_due: netDue,
          today_earnings: todayEarnings,
          today_delivered_count: todayDelivered,
          today_cash_collected: todayCash
        },
        profile: {
          ...driver,
          current_custody_amount: custody,
          pending_earnings: earnings,
          net_cash_due_to_admin: netDue,
          net_due: netDue,
          delivered_count: driver.total_deliveries || 0,
          today_earnings: todayEarnings,
          today_delivered_count: todayDelivered,
          today_cash_collected: todayCash
        },
        today: {
          earnings: todayEarnings,
          delivered_count: todayDelivered,
          cash_collected: todayCash
        },
        transactions: txs,
        recent_transactions: txs,
        settlements,
        recent_settlements: settlements,
        net_cash_due_to_admin: netDue,
        net_due: netDue
      };
    } else {
      const driver = sqliteDb.prepare(`
        SELECT u.id, u.full_name, u.phone, dp.*
        FROM users u JOIN driver_profiles dp ON u.id = dp.user_id
        WHERE u.id = ?
      `).get(driverId);
      return { 
        driver, 
        profile: driver,
        today: { earnings: 0, delivered_count: 0, cash_collected: 0 },
        transactions: [], 
        settlements: [], 
        net_cash_due_to_admin: 0 
      };
    }
  },

  // 37. استرجاع نظرة شاملة على العهد المالية لكافة السائقين للإدارة
  async getAllDriversFinancials() {
    if (isMySQL) {
      const [drivers] = await mysqlPool.query(`
        SELECT 
          u.id,
          u.full_name,
          u.phone,
          dp.vehicle_type,
          dp.plate_number,
          dp.current_status,
          COALESCE(dp.current_custody_amount, 0) as current_custody_amount,
          COALESCE(dp.total_collected_cash, 0) as total_collected_cash,
          COALESCE(dp.total_earned_commission, 0) as total_earned_commission,
          COALESCE(dp.pending_earnings, 0) as pending_earnings,
          COALESCE(dp.settled_amount_total, 0) as settled_amount_total,
          dp.total_deliveries,
          (SELECT COUNT(*) FROM orders o WHERE o.assigned_driver_id = u.id AND o.status = 'delivered') as delivered_orders_count,
          (SELECT COUNT(*) FROM orders o WHERE o.assigned_driver_id = u.id AND o.status IN ('preparing', 'out_for_delivery')) as active_orders_count,
          (SELECT COALESCE(SUM(dct.driver_profit), 0) FROM driver_custody_transactions dct WHERE dct.driver_id = u.id AND DATE(dct.created_at) = CURDATE()) as today_earnings,
          (SELECT COUNT(DISTINCT dct.order_id) FROM driver_custody_transactions dct WHERE dct.driver_id = u.id AND dct.type = 'order_collection' AND DATE(dct.created_at) = CURDATE()) as today_delivered_count,
          (SELECT COALESCE(SUM(dct.amount), 0) FROM driver_custody_transactions dct WHERE dct.driver_id = u.id AND dct.type = 'order_collection' AND DATE(dct.created_at) = CURDATE()) as today_cash_collected
        FROM users u
        JOIN driver_profiles dp ON u.id = dp.user_id
        WHERE u.status = 'active'
        ORDER BY dp.current_custody_amount DESC
      `);

      // إحصائيات مالية إجمالية لليوم
      const [[todayGeneralStats]] = await mysqlPool.query(`
        SELECT 
          COALESCE(SUM(total_amount), 0) as today_sales,
          COALESCE(SUM(delivery_fee), 0) as today_delivery_fees,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as today_delivered_orders
        FROM orders
        WHERE DATE(created_at) = CURDATE()
      `);

      const [[todaySettledStats]] = await mysqlPool.query(`
        SELECT 
          COALESCE(SUM(net_cash_received), 0) as today_cash_settled,
          COALESCE(SUM(custody_cleared), 0) as today_custody_cleared,
          COALESCE(SUM(driver_earnings_deducted), 0) as today_driver_payouts
        FROM driver_settlements
        WHERE DATE(created_at) = CURDATE()
      `);

      let totalCustody = 0;
      let totalPendingEarnings = 0;
      let totalSettled = 0;
      let totalCollected = 0;
      let todayDriverEarningsTotal = 0;
      let todayCashCollectedTotal = 0;
      let todayDeliveredTotal = 0;

      const formattedDrivers = drivers.map(d => {
        const custody = Number(d.current_custody_amount) || 0;
        const earnings = Number(d.pending_earnings) || 0;
        const netDue = Math.max(0, custody - earnings);
        const tEarnings = Number(d.today_earnings) || 0;
        const tDelivered = Number(d.today_delivered_count) || 0;
        const tCash = Number(d.today_cash_collected) || 0;

        totalCustody += custody;
        totalPendingEarnings += earnings;
        totalSettled += (Number(d.settled_amount_total) || 0);
        totalCollected += (Number(d.total_collected_cash) || 0);
        todayDriverEarningsTotal += tEarnings;
        todayCashCollectedTotal += tCash;
        todayDeliveredTotal += tDelivered;

        return {
          ...d,
          current_custody_amount: custody,
          pending_earnings: earnings,
          net_due_to_admin: netDue,
          net_due: netDue,
          vehicle_plate: d.plate_number,
          delivered_count: d.delivered_orders_count || d.total_deliveries || 0,
          today_earnings: tEarnings,
          today_delivered_count: tDelivered,
          today_cash_collected: tCash
        };
      });

      const todayStoreSales = Number(todayGeneralStats?.today_sales || 0);
      const todayDeliveryFees = Number(todayGeneralStats?.today_delivery_fees || 0);
      const todayStoreProfit = Math.max(0, todayStoreSales - todayDeliveryFees);
      const todayCashSettled = Number(todaySettledStats?.today_cash_settled || 0);

      return {
        drivers: formattedDrivers,
        totals: {
          total_custody_in_street: totalCustody,
          totalCustody,
          total_pending_earnings: totalPendingEarnings,
          totalDriverEarnings: totalPendingEarnings,
          total_net_due_to_admin: Math.max(0, totalCustody - totalPendingEarnings),
          totalNetDue: Math.max(0, totalCustody - totalPendingEarnings),
          total_settled_historically: totalSettled,
          totalSettled,
          total_collected_historically: totalCollected,
          totalCollected,
          // ملخص الأرباح والتدفقات المالية اليومية
          today: {
            today_store_sales: todayStoreSales,
            todayStoreSales,
            today_store_profit: todayStoreProfit,
            todayStoreProfit,
            today_driver_earnings: todayDriverEarningsTotal,
            todayDriverEarnings: todayDriverEarningsTotal,
            today_cash_collected: todayCashCollectedTotal,
            todayCashCollected: todayCashCollectedTotal,
            today_cash_settled: todayCashSettled,
            todayCashSettled,
            today_delivered_orders: Number(todayGeneralStats?.today_delivered_orders || todayDeliveredTotal),
            todayDeliveredOrders: Number(todayGeneralStats?.today_delivered_orders || todayDeliveredTotal)
          }
        }
      };
    } else {
      return { drivers: [], totals: {} };
    }
  },

  // 38. تسوية العهدة النقدية واستلام المبالغ من السائق بواسطة الإدارة
  async settleDriverCustody({ driverId, adminId, custodyCleared, driverEarningsDeducted = 0, netCashReceived, notes = '' }) {
    if (isMySQL) {
      const settlementNumber = `SETTLE-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
      const cleared = Number(custodyCleared) || 0;
      const earningsDeducted = Number(driverEarningsDeducted) || 0;
      const cashReceived = netCashReceived !== undefined && netCashReceived !== null 
        ? Number(netCashReceived) 
        : Math.max(0, cleared - earningsDeducted);

      // تسجيل إيصال التسوية
      const [res] = await mysqlPool.execute(`
        INSERT INTO driver_settlements 
          (settlement_number, driver_id, admin_id, custody_cleared, driver_earnings_deducted, net_cash_received, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [settlementNumber, driverId, adminId, cleared, earningsDeducted, cashReceived, notes || 'تسوية نقدية وتوريد العهدة للإدارة']);

      const settlementId = res.insertId;

      // تحديث ملف السائق وتخصيم العهدة المسواة وتصفية الأرباح المعلقة المسلمة
      await mysqlPool.execute(`
        UPDATE driver_profiles 
        SET current_custody_amount = GREATEST(0, current_custody_amount - ?),
            pending_earnings = GREATEST(0, pending_earnings - ?),
            settled_amount_total = settled_amount_total + ?
        WHERE user_id = ?
      `, [cleared, earningsDeducted, cashReceived, driverId]);

      // استعلام الرصيد المتبقي
      const [dpRows] = await mysqlPool.execute(`SELECT current_custody_amount FROM driver_profiles WHERE user_id = ?`, [driverId]);
      const balanceAfter = dpRows[0] ? Number(dpRows[0].current_custody_amount) : 0;

      // تسجيل حركة الحساب في السجل المالي
      await mysqlPool.execute(`
        INSERT INTO driver_custody_transactions
          (driver_id, settlement_id, type, amount, driver_profit, balance_after, description)
        VALUES (?, ?, 'admin_settlement', ?, ?, ?, ?)
      `, [
        driverId,
        settlementId,
        -cleared,
        -earningsDeducted,
        balanceAfter,
        `تسوية عهدة واستلام نقدي برقم #${settlementNumber} (توريد ${cashReceived} د.ل للإدارة)`
      ]);

      return {
        id: settlementId,
        settlement_number: settlementNumber,
        driver_id: driverId,
        admin_id: adminId,
        custody_cleared: cleared,
        driver_earnings_deducted: earningsDeducted,
        net_cash_received: cashReceived,
        balance_after: balanceAfter,
        created_at: new Date()
      };
    } else {
      return null;
    }
  },

  // 39. استرجاع سجل تاريخ التسويات المالية الشامل للإدارة
  async getSettlementsHistory(limit = 50) {
    if (isMySQL) {
      const [rows] = await mysqlPool.query(`
        SELECT 
          ds.*,
          d.full_name as driver_name,
          d.phone as driver_phone,
          a.full_name as admin_name
        FROM driver_settlements ds
        JOIN users d ON ds.driver_id = d.id
        JOIN users a ON ds.admin_id = a.id
        ORDER BY ds.created_at DESC
        LIMIT ${Number(limit) || 50}
      `);
      return rows;
    } else {
      return [];
    }
  }
};
