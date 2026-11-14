// =========================================================
// سكربت إنشاء وبذر قاعدة بيانات "مسكة" (Maska Database Seeder)
// يتضمن الأسعار، الكوبونات التي يكونها الأدمن، والتقييمات والملاحظات
// =========================================================

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');

const DB_PATH = path.join(__dirname, 'maska.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : ('msk-' + Math.random().toString(36).substring(2, 9));
}

function hashPassword(pass) {
  return crypto.createHash('sha256').update(pass).digest('hex');
}

console.log('🌸 جاري إنشاء وتحديث قاعدة بيانات "مسكة" (maska.db)...');

// حذف قاعدة البيانات القديمة لضمان تطبيق أي تعديلات في هيكل الجداول بنسبة 100%
if (fs.existsSync(DB_PATH)) {
  try {
    fs.unlinkSync(DB_PATH);
  } catch (e) {}
}

const db = new DatabaseSync(DB_PATH);

// قراءة وتطبيق المخطط الشامل
const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schemaSql);
console.log('✅ تم إنشاء وتحديث الجداول والفهارس بنجاح.');

// تنظيف الجداول وتصفير العدادات التلقائية
db.exec(`
  PRAGMA foreign_keys = OFF;
  DELETE FROM price_change_logs;
  DELETE FROM customer_feedback;
  DELETE FROM customer_reviews;
  DELETE FROM coupon_usages;
  DELETE FROM payments;
  DELETE FROM delivery_tracking_logs;
  DELETE FROM order_status_history;
  DELETE FROM custom_bouquet_details;
  DELETE FROM order_items;
  DELETE FROM orders;
  DELETE FROM coupons;
  DELETE FROM bouquets;
  DELETE FROM flower_inventory;
  DELETE FROM delivery_zones_pricing;
  DELETE FROM addresses;
  DELETE FROM customer_profiles;
  DELETE FROM driver_profiles;
  DELETE FROM user_roles;
  DELETE FROM roles;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
  PRAGMA foreign_keys = ON;
`);

// 1. بذر الأدوار
const insertRole = db.prepare(`INSERT INTO roles (id, name, display_name, description) VALUES (?, ?, ?, ?)`);
insertRole.run(1, 'admin', 'مدير النظام', 'صلاحية كاملة لإدارة المتجر والأسعار والكوبونات والتقارير');
insertRole.run(2, 'florist', 'منسّق زهور', 'استلام وتجهيز باقات الاستوديو وتخصيم المخزون ومراجعة ملاحظات الزبائن');
insertRole.run(3, 'driver', 'مندوب توصيل', 'استلام الطلبات، فتح الموقع على خرائط جوجل وتأكيد التسليم');
insertRole.run(4, 'customer', 'زبون المتجر', 'تصميم الباقات وتأكيد الطلبات وتتبعها وتقييم الخدمة');

const roles = {};
db.prepare(`SELECT id, name FROM roles`).all().forEach(r => { roles[r.name] = r.id; });

// 2. بذر المستخدمين
const insertUser = db.prepare(`
  INSERT INTO users (id, full_name, phone, email, password_hash, status)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const assignRole = db.prepare(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`);

const adminId = uuid();
const floristId = uuid();
const driver1Id = uuid();
const driver2Id = uuid();
const customer1Id = uuid();
const customer2Id = uuid();
const customer3Id = uuid();

const usersData = [
  { id: adminId, name: 'محمد المنفي', phone: '0911111111', email: 'admin@maska.ly', pass: 'admin123', role: 'admin' },
  { id: floristId, name: 'فاطمة الورفلي', phone: '0912222222', email: 'florist@maska.ly', pass: 'florist123', role: 'florist' },
  { id: driver1Id, name: 'طارق الزوي', phone: '0923333333', email: 'driver1@maska.ly', pass: 'driver123', role: 'driver' },
  { id: driver2Id, name: 'معتز القماطي', phone: '0924444444', email: 'driver2@maska.ly', pass: 'driver123', role: 'driver' },
  { id: customer1Id, name: 'سارة المحمودي', phone: '0915555555', email: 'sara@gmail.com', pass: 'customer123', role: 'customer' },
  { id: customer2Id, name: 'أحمد الفيتوري', phone: '0926666666', email: 'ahmed@gmail.com', pass: 'customer123', role: 'customer' },
  { id: customer3Id, name: 'نور الهدى الشريف', phone: '0917777777', email: 'nour@gmail.com', pass: 'customer123', role: 'customer' }
];

usersData.forEach(u => {
  insertUser.run(u.id, u.name, u.phone, u.email, hashPassword(u.pass), 'active');
  assignRole.run(u.id, roles[u.role]);
});

// 3. بذر السائقين
const insertDriver = db.prepare(`
  INSERT INTO driver_profiles (user_id, vehicle_type, plate_number, national_id, current_status, current_lat, current_lng, last_location_update, total_deliveries, rating)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
`);
insertDriver.run(driver1Id, 'سيارة هيونداي تبريد', 'طرابلس 5-14820', '11994028374', 'busy', 32.885400, 13.187200, 185, 4.96);
insertDriver.run(driver2Id, 'دراجة نارية سريعة', 'طرابلس 12-8831', '11996039281', 'available', 32.891200, 13.195600, 92, 4.89);

// 4. بذر العناوين والمواقع
const insertAddress = db.prepare(`
  INSERT INTO addresses (id, user_id, title, recipient_name, recipient_phone, city, zone, street, landmark, latitude, longitude, google_maps_url, is_default)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const addrSara = uuid();
const addrAhmed = uuid();
const addrNour = uuid();

insertAddress.run(addrSara, customer1Id, 'المنزل', 'سارة المحمودي', '0915555555', 'طرابلس', 'النوفليين', 'شارع عمر المختار المتفرع', 'بجوار مسجد القدس، عمارة الأمل الدور 2', 32.887200, 13.191300, 'https://www.google.com/maps?q=32.887200,13.191300', 1);
insertAddress.run(addrAhmed, customer2Id, 'مقر العمل', 'أحمد الفيتوري', '0926666666', 'طرابلس', 'السياحية', 'شارع الفيلات', 'أمام مصرف الأمان السياحية', 32.862400, 13.109200, 'https://www.google.com/maps?q=32.862400,13.109200', 1);
insertAddress.run(addrNour, customer3Id, 'صالة المناسبات', 'نور الهدى الشريف', '0917777777', 'طرابلس', 'بن عاشور', 'شارع الظل', 'خلف مدرسة الفنون، صالة الفردوس', 32.881100, 13.189500, 'https://www.google.com/maps?q=32.881100,13.189500', 1);

// 5. بذر جدول تسعير التوصيل حسب المناطق (Delivery Zones Pricing)
const insertZone = db.prepare(`
  INSERT INTO delivery_zones_pricing (id, city, zone_name, delivery_fee, estimated_minutes, is_active)
  VALUES (?, ?, ?, ?, ?, ?)
`);
insertZone.run(1, 'طرابلس', 'طرابلس المركز', 10.0, 45, 1);
insertZone.run(2, 'طرابلس', 'النوفليين وبن عاشور', 10.0, 40, 1);
insertZone.run(3, 'طرابلس', 'السياحية وحي الأندلس', 10.0, 50, 1);
insertZone.run(4, 'طرابلس', 'تاجوراء', 15.0, 65, 1);
insertZone.run(5, 'طرابلس', 'جنزور', 15.0, 65, 1);
insertZone.run(6, 'بنغازي', 'كافة مناطق بنغازي', 15.0, 90, 1);
insertZone.run(7, 'مصراتة', 'كافة مناطق مصراتة', 15.0, 90, 1);

// 6. بذر مخزون الزهور وأسعار السيقان
const insertFlower = db.prepare(`
  INSERT INTO flower_inventory (id, name_ar, color, unit_price, stock_quantity, alert_threshold, is_available)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertFlower.run(1, 'وردة جورية وردية', 'وردي', 4.0, 120, 20, 1);
insertFlower.run(2, 'توليب أبيض نقي', 'أبيض', 5.0, 85, 15, 1);
insertFlower.run(3, 'جبسوفيلا ناعمة', 'أبيض', 5.0, 60, 15, 1);
insertFlower.run(4, 'فاوانيا ملكية فاخرة', 'وردي مذهب', 9.0, 25, 10, 1);
insertFlower.run(5, 'وردة جورية حمراء', 'أحمر قرمزي', 5.0, 90, 20, 1);
insertFlower.run(6, 'أغصان أوكالبتوس مريمية', 'أخضر مريمي', 3.0, 75, 15, 1);

// 7. بذر الباقات الجاهزة وأسعارها
const insertBouquet = db.prepare(`
  INSERT INTO bouquets (id, title, slug, occasion_tag, price, description, image_svg_path, is_featured, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
insertBouquet.run(1, 'ربيع وردي', 'pink-spring', 'عيد ميلاد', 64.0, 'باقة مفعمة بالبهجة والحيوية تجمع ورود الجوري الزاهية والتوليب النضر.', 'assets/bouquet-pink-spring.svg', 1, 1);
insertBouquet.run(2, 'أناقة العاج', 'ivory-elegance', 'زفاف', 78.0, 'تناغم ملكي يفيض بالنقاء والصفاء، مصمم لمناسبات الزفاف والخطوبة الفاخرة.', 'assets/bouquet-ivory-elegance.svg', 1, 1);
insertBouquet.run(3, 'همسة المريمي', 'sage-whisper', 'شكر', 92.0, 'مزيج هادئ وأنيق من درجات الخوخي والوردي العتيق مع أغصان المريمية العطرة.', 'assets/bouquet-sage-whisper.svg', 0, 1);
insertBouquet.run(4, 'الباقة الملكية', 'royal-bouquet', 'تخرج', 120.0, 'باقة ضخمة ومهيبة تليق بمناسبات التخرج والإنجازات الكبرى وتتويج النجاح.', 'assets/bouquet-royal.svg', 1, 1);

// 8. بذر الكوبونات التي أنشأها الأدمن للتخفيضات (Admin Created Coupons)
const insertCoupon = db.prepare(`
  INSERT INTO coupons (id, code, title, discount_type, discount_value, min_order_amount, max_discount_cap, valid_until, usage_limit, used_count, per_user_limit, created_by_admin_id, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '+30 days'), ?, ?, ?, ?, ?)
`);
insertCoupon.run(1, 'MASKA15', 'كوبون الترحيب بمسكة', 'fixed', 15.0, 60.0, null, 200, 14, 1, adminId, 1);
insertCoupon.run(2, 'MASKA20', 'خصم الباقات الفاخرة', 'fixed', 20.0, 100.0, null, 100, 6, 1, adminId, 1);
insertCoupon.run(3, 'GRAD2026', 'عرض موسم التخرج والنجاح', 'percent', 20.0, 80.0, 40.0, 150, 8, 1, adminId, 1);
insertCoupon.run(4, 'SPRING10', 'تخفيض باقات الربيع', 'fixed', 10.0, 50.0, null, 100, 2, 1, adminId, 1);

const couponMap = {};
db.prepare(`SELECT id, code FROM coupons`).all().forEach(c => { couponMap[c.code] = c.id; });

// 9. بذر الطلبات
const insertOrder = db.prepare(`
  INSERT INTO orders (
    id, order_number, customer_id, address_id, recipient_name, recipient_phone,
    delivery_city, delivery_zone, delivery_address_details, delivery_lat, delivery_lng,
    delivery_window, status, assigned_florist_id, assigned_driver_id,
    subtotal, discount_amount, delivery_fee, total_amount, coupon_id, customer_notes
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+2 hours'), ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertOrderItem = db.prepare(`
  INSERT INTO order_items (id, order_id, item_type, bouquet_id, item_title, quantity, unit_price, total_price)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertCustomDetail = db.prepare(`
  INSERT INTO custom_bouquet_details (id, order_item_id, wrap_type, ribbon_color, wax_seal_text, seal_stamp, seal_color, flower_composition_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertStatusLog = db.prepare(`
  INSERT INTO order_status_history (order_id, status, changed_by_user_id, comment)
  VALUES (?, ?, ?, ?)
`);

const insertPayment = db.prepare(`
  INSERT INTO payments (id, order_id, method, status, transaction_ref, amount, paid_at, notes)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
`);

// --- طلب #1048: سارة المحمودي (قيد التجهيز مع فاطمة) ---
const order1048Id = uuid();
insertOrder.run(
  order1048Id,
  '1048',
  customer1Id,
  addrSara,
  'سارة المحمودي',
  '0915555555',
  'طرابلس',
  'النوفليين',
  'بجوار مسجد القدس، عمارة الأمل الدور 2',
  32.887200,
  13.191300,
  'preparing',
  floristId,
  null,
  150.0,
  15.0,
  10.0,
  145.0,
  couponMap['MASKA15'],
  'يرجى كتابة الكرت بخط رقعة أنيق والعناية بختم الشمع الأحمر الملكي'
);

const item1048Id = uuid();
insertOrderItem.run(item1048Id, order1048Id, 'custom_studio', null, 'باقة مخصصة (استوديو مسكة)', 1, 150.0, 150.0);
insertCustomDetail.run(
  uuid(),
  item1048Id,
  'ورق كرافت فاخر',
  'شريط وردي مذهب',
  'أجمل اللحظات هي التي تبدأ بوردة صادقة… كل عام وأنتِ مصدر النور والبهجة في حياتنا.',
  'MASKA 🌸',
  'أحمر قرمزي ملكي',
  JSON.stringify([
    { flower: 'وردة جورية وردية', count: 6, unit_price: 4, total: 24 },
    { flower: 'توليب أبيض نقي', count: 5, unit_price: 5, total: 25 },
    { flower: 'فاوانيا ملكية فاخرة', count: 3, unit_price: 9, total: 27 },
    { flower: 'غلاف وشريط كرافت', count: 1, unit_price: 14, total: 14 }
  ])
);
insertStatusLog.run(order1048Id, 'confirmed', adminId, 'تم تأكيد الطلب وتطبيق كود الخصم MASKA15 بنجاح');
insertStatusLog.run(order1048Id, 'preparing', floristId, 'بدأت خبيرة الزهور فاطمة الورفلي بتنسيق الباقة وقص السيقان وتجهيز الكرت الشمعي');
insertPayment.run(uuid(), order1048Id, 'cash_on_delivery', 'pending', null, 145.0, 'الدفع كاش عند الاستلام والمعاينة');

// تسجيل استخدام الكوبون للطلب 1048
db.prepare(`
  INSERT INTO coupon_usages (coupon_id, order_id, user_id, discount_applied)
  VALUES (?, ?, ?, ?)
`).run(couponMap['MASKA15'], order1048Id, customer1Id, 15.0);

// --- طلب #1049: أحمد الفيتوري (خرج للتوصيل) ---
const order1049Id = uuid();
insertOrder.run(order1049Id, '1049', customer2Id, addrAhmed, 'أحمد الفيتوري', '0926666666', 'طرابلس', 'السياحية', 'شارع الفيلات، أمام مصرف الأمان', 32.862400, 13.109200, 'out_for_delivery', floristId, driver1Id, 64.0, 0.0, 10.0, 74.0, null, 'التسليم للاستقبال في العمارة');
const item1049Id = uuid();
insertOrderItem.run(item1049Id, order1049Id, 'ready_bouquet', 1, 'ربيع وردي', 1, 64.0, 64.0);
insertStatusLog.run(order1049Id, 'confirmed', adminId, 'تم تأكيد الطلب ومطابقة الأصناف');
insertStatusLog.run(order1049Id, 'preparing', floristId, 'تم تنسيق وتجهيز باقة ربيع وردي');
insertStatusLog.run(order1049Id, 'ready_for_pickup', floristId, 'الباقة جاهزة بانتظار استلام المندوب');
insertStatusLog.run(order1049Id, 'out_for_delivery', driver1Id, 'استلم السائق طارق الباقة وانطلق باتجاه السياحية');
insertPayment.run(uuid(), order1049Id, 'sadad', 'paid', 'SADAD-TX-994182', 74.0, 'تم السداد بنجاح عبر خدمة سداد المدار');

// مسار السائق GPS للطلب 1049
const insertTrackingLog = db.prepare(`INSERT INTO delivery_tracking_logs (order_id, driver_id, lat, lng, speed, recorded_at) VALUES (?, ?, ?, ?, ?, datetime('now', ?))`);
insertTrackingLog.run(order1049Id, driver1Id, 32.891200, 13.195600, 35.0, '-25 minutes');
insertTrackingLog.run(order1049Id, driver1Id, 32.882100, 13.164500, 48.0, '-15 minutes');
insertTrackingLog.run(order1049Id, driver1Id, 32.871000, 13.132000, 42.0, '-5 minutes');
insertTrackingLog.run(order1049Id, driver1Id, 32.862400, 13.109200, 15.0, '0 minutes');

// --- طلب #1050: طلب جديد وارد ---
const order1050Id = uuid();
insertOrder.run(order1050Id, '1050', customer3Id, addrNour, 'نور الهدى الشريف', '0917777777', 'طرابلس', 'بن عاشور', 'صالة الفردوس للمناسبات', 32.881100, 13.189500, 'pending', null, null, 78.0, 0.0, 10.0, 88.0, null, 'الباقة لعروس في الصالة يرجى الحذر الشديد');
const item1050Id = uuid();
insertOrderItem.run(item1050Id, order1050Id, 'ready_bouquet', 2, 'أناقة العاج', 1, 78.0, 78.0);
insertStatusLog.run(order1050Id, 'pending', customer3Id, 'تم إنشاء الطلب بانتظار التأكيد');
insertPayment.run(uuid(), order1050Id, 'cash_on_delivery', 'pending', null, 88.0, 'الدفع عند الاستلام كاش');

// --- طلب #1051: تم التسليم ---
const order1051Id = uuid();
insertOrder.run(order1051Id, '1051', customer1Id, addrSara, 'طارق المنفي', '0919998877', 'طرابلس', 'زاوية الدهماني', 'شارع النصر، فيلا رقم 14', 32.898000, 13.195000, 'delivered', floristId, driver1Id, 96.0, 0.0, 10.0, 106.0, null, 'تم التسليم مع بطاقة إهداء فاخرة');
const item1051Id = uuid();
insertOrderItem.run(item1051Id, order1051Id, 'custom_studio', null, 'باقة استوديو فاخرة', 1, 96.0, 96.0);
insertStatusLog.run(order1051Id, 'delivered', driver1Id, 'تم تسليم الباقة باليد للمستلم واستلام المبلغ نقداً بنجاح');
insertPayment.run(uuid(), order1051Id, 'cash_on_delivery', 'paid', 'COD-CASH-1051', 106.0, 'تم استلام المبلغ نقداً');

// 10. بذر تقييمات وملاحظات الزبائن (Customer Reviews & Ratings)
const insertReview = db.prepare(`
  INSERT INTO customer_reviews (
    id, order_id, customer_id, driver_id, rating_overall, rating_flowers, rating_delivery, rating_packaging,
    customer_comment, customer_name_display, city, is_approved, is_featured, admin_reply, admin_reply_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-2 days'))
`);

// تقييم سارة الورفلي للطلب #1048
insertReview.run(
  uuid(),
  order1048Id,
  customer1Id,
  null,
  5, 5, 5, 5,
  'طلبت باقة ربيع وردي لعيد ميلاد أختي، التغليف اليدوي والكرت المكتوب بخط أنيق مع الختم الشمعي خلى المفاجأة استثنائية! والورد قعد نضر ومفتح أكثر من 12 يوم.',
  'سارة الورفلي',
  'طرابلس',
  1,
  1,
  'نسعد جداً برضاكِ يا سارة ونفخر بكوننا جزءاً من أفراحكم الغالية 🌸'
);

// تقييم أسامة التاجوري للطلب #1049
insertReview.run(
  uuid(),
  order1049Id,
  customer2Id,
  driver1Id,
  5, 5, 5, 5,
  'فكرة المصمم الذكي اختصرت عليّ ساعات من التفكير. حددت ميزانيتي والمناسبة واقترحلي توليفة زهور وتنسيق أفخم مما تخيلت، والتوصيل كان في الموعد بالدقيقة.',
  'م. أسامة التاجوري',
  'بنغازي',
  1,
  1,
  'شهادة نعتز بها يا بشمهندس أسامة، سرعة ودقة التوصيل عهدنا دائماً 🌿'
);

// تقييم نور الهدى القماطي للطلب #1050
insertReview.run(
  uuid(),
  order1050Id,
  customer3Id,
  driver2Id,
  5, 5, 5, 5,
  'باقة أناقة العاج في يوم عقد قراني كانت حديث كل الحاضرين في الصالة! لمسة زهور التوليب البيضاء مع شريط الساتان راقية جداً وذوق لا يوصف.',
  'نور الهدى القماطي',
  'مصراتة',
  1,
  1,
  'ألف ألف مبارك يا نور، تتهنوا يا رب وربي يجعل أيامكم كلها أفراح وزهور 💍'
);

// تقييم طارق المنفي للطلب #1051
insertReview.run(
  uuid(),
  order1051Id,
  customer1Id,
  driver1Id,
  5, 5, 5, 5,
  'التوصيل كان سريع جداً والمندوب طارق كان في قمة الاحترام واللباقة، والتغليف الملكي فخم يشرف بجد.',
  'طارق المنفي',
  'طرابلس',
  1,
  0,
  'أهلاً بك دائماً أخي طارق، نسعد بخدمتك في كل مناسبة ✨'
);

// 11. بذر اقتراحات وملاحظات الزبائن العامة (Customer Feedback)
const insertFeedback = db.prepare(`
  INSERT INTO customer_feedback (customer_name, phone, feedback_type, subject, message, status, admin_notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertFeedback.run('ريان الترهوني', '0913344556', 'suggestion', 'إضافة نباتات الظل والصباريات', 'نتمنى توفير قسم لنباتات الزينة الداخلية والصباريات في الموقع بجانب باقات الورد.', 'reviewed', 'فكرة ممتازة لإضافتها في التحديث القادم');
insertFeedback.run('عمر المجبري', '0925566778', 'compliment', 'إشادة بتجربة الاستوديو', 'تجربة تصميم الباقة لحظياً وتغير السعر مباشرة في الاستوديو رهيبة وفريدة في ليبيا!', 'resolved', 'تم شكر العميل وتقديم كود خصم خاص له');

// 12. بذر سجل تعديل الأسعار (Price Change Audit Logs)
const insertPriceLog = db.prepare(`
  INSERT INTO price_change_logs (item_type, item_id, item_name, old_price, new_price, changed_by_user_id, reason)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
insertPriceLog.run('flower', 4, 'فاوانيا ملكية فاخرة', 8.0, 9.0, adminId, 'تعديل السعر بناءً على تكلفة الشحنة الهولندية الجديدة');
insertPriceLog.run('bouquet', 4, 'الباقة الملكية', 115.0, 120.0, adminId, 'إضافة لمسات شريط مخملي فاخر وعناصر إضافية للباقة');

console.log('🎉 تم بذر كافة الأسعار، الكوبونات، الملاحظات والتقييمات بنجاح!');
console.log('--------------------------------------------------');
console.log('📌 إحصائيات قاعدة بيانات "مسكة":');
const stats = {
  users: db.prepare(`SELECT COUNT(*) as c FROM users`).get().c,
  drivers: db.prepare(`SELECT COUNT(*) as c FROM driver_profiles`).get().c,
  zones: db.prepare(`SELECT COUNT(*) as c FROM delivery_zones_pricing`).get().c,
  inventory: db.prepare(`SELECT COUNT(*) as c FROM flower_inventory`).get().c,
  bouquets: db.prepare(`SELECT COUNT(*) as c FROM bouquets`).get().c,
  coupons: db.prepare(`SELECT COUNT(*) as c FROM coupons`).get().c,
  orders: db.prepare(`SELECT COUNT(*) as c FROM orders`).get().c,
  reviews: db.prepare(`SELECT COUNT(*) as c FROM customer_reviews`).get().c,
  feedback: db.prepare(`SELECT COUNT(*) as c FROM customer_feedback`).get().c,
  price_logs: db.prepare(`SELECT COUNT(*) as c FROM price_change_logs`).get().c
};
console.table(stats);
console.log('📁 مسار ملف قاعدة البيانات:', DB_PATH);
console.log('--------------------------------------------------');
