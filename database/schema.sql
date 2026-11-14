-- =========================================================
-- قاعدة بيانات مشروع مسكة | MASKA FLOWER ATELIER DATABASE
-- الاسم: مسكة (maska.db)
-- النظام: Relational SQL (SQLite / PostgreSQL / MySQL Compatible)
-- =========================================================

PRAGMA foreign_keys = ON;

-- 1. جدول المستخدمين (Users & Authentication)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                       -- المعرف الفريد UUID
    full_name TEXT NOT NULL,                   -- الاسم الرباعي
    phone TEXT UNIQUE NOT NULL,                -- رقم الهاتف (مفتاح تسجيل الدخول الأساسي)
    email TEXT UNIQUE,                         -- البريد الإلكتروني (اختياري)
    password_hash TEXT NOT NULL,               -- كلمة المرور المشفرة
    avatar_url TEXT,                           -- صورة الحساب
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'banned', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول الأدوار الرئيسية (System Roles)
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,                 -- 'admin', 'florist', 'driver', 'customer'
    display_name TEXT NOT NULL,                -- 'مدير النظام', 'منسق زهور', 'سائق ومندوب', 'زبون'
    description TEXT
);

-- 3. جدول الربط بين المستخدمين والأدوار (User Roles Mapping)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL,
    role_id INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- 4. جدول ملف السائقين وأسطول التوصيل (Driver Profiles & Fleet)
CREATE TABLE IF NOT EXISTS driver_profiles (
    user_id TEXT PRIMARY KEY,
    vehicle_type TEXT DEFAULT 'سيارة',         -- 'سيارة', 'دراجة نارية'
    plate_number TEXT,                         -- رقم اللوحة
    national_id TEXT,                          -- الرقم الوطني
    current_status TEXT DEFAULT 'available' CHECK(current_status IN ('available', 'busy', 'offline')),
    current_lat REAL,                          -- خط العرض الحالي للسائق
    current_lng REAL,                          -- خط الطول الحالي للسائق
    last_location_update DATETIME,             -- توقيت آخر إشارة GPS
    total_deliveries INTEGER DEFAULT 0,        -- إجمالي الطلبات المسلّمة بنجاح
    rating REAL DEFAULT 5.0,                   -- تقييم أداء السائق
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. جدول ملفات الزبائن وتاريخ الولاء (Customer Profiles)
CREATE TABLE IF NOT EXISTS customer_profiles (
    user_id TEXT PRIMARY KEY,
    loyalty_points INTEGER DEFAULT 0,          -- نقاط الولاء
    total_spent REAL DEFAULT 0.0,              -- إجمالي ما تم إنفاقه
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. جدول العناوين والمواقع الجغرافية (Customer Addresses & GPS Locations)
CREATE TABLE IF NOT EXISTS addresses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT DEFAULT 'العنوان الرئيسي',       -- 'المنزل', 'العمل', 'صالة الأفراح'
    recipient_name TEXT NOT NULL,              -- اسم المستلم
    recipient_phone TEXT NOT NULL,             -- هاتف المستلم
    city TEXT NOT NULL,                        -- المدينة (طرابلس، بنغازي، مصراتة...)
    zone TEXT NOT NULL,                        -- المنطقة (النوفليين، السياحية، بن عاشور...)
    street TEXT,                               -- اسم الشارع
    landmark TEXT,                             -- أقرب نقطة دالة لتسهيل وصول السائق
    latitude REAL NOT NULL,                    -- خط العرض GPS
    longitude REAL NOT NULL,                   -- خط الطول GPS
    google_maps_url TEXT,                      -- رابط مباشر لخرائط جوجل
    is_default INTEGER DEFAULT 0,              -- هل هو العنوان الافتراضي (0 أو 1)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. جدول تسعير التوصيل حسب المناطق والمدن (Delivery Zones Pricing)
CREATE TABLE IF NOT EXISTS delivery_zones_pricing (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,                        -- طرابلس، بنغازي، مصراتة
    zone_name TEXT NOT NULL,                   -- النوفليين، السياحية، تاجوراء، جنزور...
    delivery_fee REAL NOT NULL,                -- قيمة التوصيل بالدينار (مثال: 10 أو 15)
    estimated_minutes INTEGER DEFAULT 60,      -- متوسط وقت التوصيل بالدقائق
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. جدول مخزون الزهور الطبيعية للاستوديو والأسعار (Flower Inventory & Studio Stock)
CREATE TABLE IF NOT EXISTS flower_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_ar TEXT NOT NULL,                     -- وردة جورية، توليب، جبسوفيلا، فاوانيا
    color TEXT NOT NULL,                       -- وردي، أبيض، أحمر، خوخي
    unit_price REAL NOT NULL,                  -- سعر الساق الواحدة بالدينار الليبي
    stock_quantity INTEGER DEFAULT 0,          -- الكمية المتوفرة بالمحل
    alert_threshold INTEGER DEFAULT 15,        -- حد التنبيه بنقص المخزون
    is_available INTEGER DEFAULT 1,            -- متاح للاختيار بالاستوديو والمصمم الذكي
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. جدول الباقات الجاهزة والأسعار (Ready Bouquets Catalog)
CREATE TABLE IF NOT EXISTS bouquets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,                       -- 'ربيع وردي', 'أناقة العاج', 'همسة المريمي', 'الباقة الملكية'
    slug TEXT UNIQUE NOT NULL,
    occasion_tag TEXT NOT NULL,                -- 'عيد ميلاد', 'زفاف', 'شكر', 'تخرج'
    price REAL NOT NULL,                       -- السعر بالدينار
    description TEXT,
    image_svg_path TEXT NOT NULL,              -- مسار رسمة الـ SVG
    is_featured INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. جدول الكوبونات والتخفيضات التي ينشئها الأدمن (Admin Managed Coupons)
CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,                 -- 'MASKA15', 'MASKA20', 'SPRING25'
    title TEXT NOT NULL,                       -- 'خصم بمناسبة الربيع', 'كوبون التخرج'
    discount_type TEXT DEFAULT 'fixed' CHECK(discount_type IN ('fixed', 'percent')),
    discount_value REAL NOT NULL,              -- 15 د.ل أو 20%
    min_order_amount REAL DEFAULT 0.0,         -- الحد الأدنى للطلب لتفعيل الكوبون
    max_discount_cap REAL,                     -- سقف الخصم الأقصى بالنسبة المئوية
    valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
    valid_until DATETIME,                      -- تاريخ انتهاء صلاحية الكوبون
    usage_limit INTEGER DEFAULT 100,           -- الحد الأقصى للاستخدام العام
    used_count INTEGER DEFAULT 0,              -- عدد مرات الاستخدام الفعلي
    per_user_limit INTEGER DEFAULT 1,          -- أقصى عدد مرات استخدام للزبون الواحد
    created_by_admin_id TEXT,                  -- الأدمن الذي أنشأ الكوبون
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_admin_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 11. سجل استخدام الكوبونات وتفاصيل المستفيدين (Coupon Redemptions History)
CREATE TABLE IF NOT EXISTS coupon_usages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coupon_id INTEGER NOT NULL,
    order_id TEXT NOT NULL,
    user_id TEXT,
    discount_applied REAL NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 12. جدول الطلبات الرئيسي (Orders Management)
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,                       -- UUID
    order_number TEXT UNIQUE NOT NULL,         -- رقم مرجعي سهل مثل '1048' أو 'MSK-1048'
    customer_id TEXT,                          -- الزبون صاحب الطلب
    address_id TEXT,                           -- معرف العنوان المحفوظ
    
    -- بيانات التسليم المباشرة (محفوظة لحظة الطلب لضمان ثباتها)
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    delivery_city TEXT NOT NULL,
    delivery_zone TEXT NOT NULL,
    delivery_address_details TEXT,
    delivery_lat REAL,                         -- إحداثيات GPS الدقيقة للتسليم
    delivery_lng REAL,
    delivery_window DATETIME NOT NULL,         -- موعد وتاريخ التسليم المفضل
    
    -- حالات الطلب وسير العمل
    status TEXT DEFAULT 'pending' CHECK(status IN (
        'pending',           -- جديد بانتظار التأكيد
        'confirmed',         -- تم التأكيد والمطابقة
        'preparing',         -- قيد التجهيز والتنسيق في الاستوديو
        'ready_for_pickup',  -- الباقة جاهزة بانتظار استلام السائق
        'out_for_delivery',  -- في الطريق مع السائق للمستلم
        'delivered',         -- تم التسليم بنجاح
        'cancelled'          -- ملغي
    )),
    
    -- إسناد المهام لطاقم العمل
    assigned_florist_id TEXT,                  -- المنسق المشرف على تجهيز الباقة
    assigned_driver_id TEXT,                   -- سائق التوصيل المسند إليه الطلب
    
    -- الحسابات المالية
    subtotal REAL NOT NULL,                    -- المجموع الفرعي للباقات
    discount_amount REAL DEFAULT 0.0,          -- قيمة الخصم
    delivery_fee REAL DEFAULT 10.0,            -- قيمة التوصيل
    total_amount REAL NOT NULL,                -- الإجمالي النهائي بالدينار
    coupon_id INTEGER,
    
    customer_notes TEXT,                       -- ملاحظات الزبون عند الطلب
    admin_notes TEXT,                          -- ملاحظات الإدارة الداخلية
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_florist_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_driver_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
);

-- 13. جدول عناصر الطلب (Order Items)
CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    item_type TEXT CHECK(item_type IN ('ready_bouquet', 'custom_studio')),
    bouquet_id INTEGER,                        -- للباقات الجاهزة
    item_title TEXT NOT NULL,                  -- اسم العنصر
    quantity INTEGER DEFAULT 1,
    unit_price REAL NOT NULL,
    total_price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (bouquet_id) REFERENCES bouquets(id) ON DELETE SET NULL
);

-- 14. تفاصيل الباقة المخصصة والكرت الشمعي (Custom Bouquet Atelier Details)
CREATE TABLE IF NOT EXISTS custom_bouquet_details (
    id TEXT PRIMARY KEY,
    order_item_id TEXT UNIQUE NOT NULL,
    wrap_type TEXT DEFAULT 'ورق كرافت',         -- 'ورق كرافت', 'ورق شفاف', 'قماش فاخر'
    ribbon_color TEXT DEFAULT 'وردي مذهب',     -- 'وردي', 'أبيض', 'زيتوني', 'عنابي'
    wax_seal_text TEXT,                        -- نص عبارة الإهداء المكتوبة بخط اليد
    seal_stamp TEXT DEFAULT 'MASKA 🌸',        -- نقش الختم الشمعي الملكي
    seal_color TEXT DEFAULT 'أحمر قرمزي',
    flower_composition_json TEXT NOT NULL,     -- تفاصيل الزهور وأعدادها بصيغة JSON
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
);

-- 15. جدول تقييمات وملاحظات الزبائن للطلبات (Customer Order Reviews & Ratings)
CREATE TABLE IF NOT EXISTS customer_reviews (
    id TEXT PRIMARY KEY,                       -- UUID
    order_id TEXT REFERENCES orders(id) ON DELETE SET NULL, -- التقييم مرتبط بطلب محدد (اختياري)
    customer_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- الزبون صاحب التقييم
    driver_id TEXT REFERENCES users(id) ON DELETE SET NULL,   -- السائق لتقييم أدائه
    
    -- التقييمات النجمية (من 1 إلى 5)
    rating_overall INTEGER NOT NULL CHECK(rating_overall BETWEEN 1 AND 5), -- تقييم شامل
    rating_flowers INTEGER CHECK(rating_flowers BETWEEN 1 AND 5),         -- نضارة وجمال الزهور
    rating_delivery INTEGER CHECK(rating_delivery BETWEEN 1 AND 5),       -- التوصيل والسرعة
    rating_packaging INTEGER CHECK(rating_packaging BETWEEN 1 AND 5),     -- التغليف والختم الشمعي
    
    -- الملاحظات النصية
    customer_comment TEXT NOT NULL,            -- تعليق ورأي الزبون
    customer_name_display TEXT,                -- اسم العميل الظاهر في التقييم
    city TEXT,                                 -- المدينة (طرابلس، بنغازي، مصراتة)
    
    -- موافقة الإدارة والظهور بالصفحة الرئيسية
    is_approved INTEGER DEFAULT 1,             -- معتمد من الإدارة للنشر
    is_featured INTEGER DEFAULT 0,             -- هل يظهر في قسم آراء وتجارب العملاء بالصفحة الرئيسية
    
    -- رد الإدارة على تقييم الزبون
    admin_reply TEXT,                          -- رد مسكة على العميل
    admin_reply_at DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 16. جدول الاقتراحات والملاحظات العامة والشكاوى (Customer Feedback & Suggestions)
CREATE TABLE IF NOT EXISTS customer_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    phone TEXT,
    feedback_type TEXT DEFAULT 'suggestion' CHECK(feedback_type IN ('suggestion', 'compliment', 'complaint', 'inquiry')),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'reviewed', 'resolved')),
    admin_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 17. سجل تغير الأسعار للرقابة والتدقيق (Price Change Audit Logs)
CREATE TABLE IF NOT EXISTS price_change_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type TEXT NOT NULL,                   -- 'flower', 'bouquet', 'delivery_zone', 'wrap'
    item_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    old_price REAL NOT NULL,
    new_price REAL NOT NULL,
    changed_by_user_id TEXT,
    reason TEXT,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 18. سجل تغير حالات الطلب وتتبعه (Order Status Lifecycle History)
CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL,
    changed_by_user_id TEXT,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 19. سجل مسار السائق بالـ GPS اللحظي (Live Driver GPS Tracking Logs)
CREATE TABLE IF NOT EXISTS delivery_tracking_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    driver_id TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    heading REAL,
    speed REAL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 20. جدول الدفع والفواتير (Payments & Transactions)
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    method TEXT CHECK(method IN ('cash_on_delivery', 'sadad', 'tadawul', 'bank_transfer')),
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'paid', 'failed', 'refunded')),
    transaction_ref TEXT,
    amount REAL NOT NULL,
    paid_at DATETIME,
    notes TEXT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- الفهارس لتحقيق السرعة القصوى
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver ON orders(assigned_driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON customer_reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_featured ON customer_reviews(is_featured, is_approved);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code, is_active);
CREATE INDEX IF NOT EXISTS idx_tracking_order ON delivery_tracking_logs(order_id);
