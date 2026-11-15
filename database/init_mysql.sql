-- =============================================================================
-- 🌸 تهيئة قاعدة بيانات متجر مسكة للزهور بالكامل (SCHEMA + INITIAL SEED DATA)
-- يتم تنفيذ هذا الملف تلقائياً عند إقلاع حاوية MySQL في Docker
-- =============================================================================

-- =============================================================================
-- 🌸 قاعدة بيانات متجر واستوديو مسكة للزهور الطبيعية | MASKA ATELIER MYSQL SCHEMA
-- =============================================================================
-- نظام قواعد البيانات: MySQL 8.0+ / MariaDB 10.5+
-- الترميز المعتمد: utf8mb4_unicode_ci (دعم كامل للعربية والرموز التعبيرية 🌸)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `maska_db` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `maska_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- 1. جدول المستخدمين (Users & Authentication)
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
    `id` VARCHAR(36) PRIMARY KEY,
    `full_name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) UNIQUE NOT NULL,
    `email` VARCHAR(150) UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `avatar_url` VARCHAR(255),
    `status` ENUM('active', 'banned', 'inactive') DEFAULT 'active',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. جدول الأدوار الرئيسية (Roles)
DROP TABLE IF EXISTS `roles`;
CREATE TABLE `roles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(50) UNIQUE NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `description` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. جدول تعيين أدوار المستخدمين (User Roles Mapping)
DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE `user_roles` (
    `user_id` VARCHAR(36) NOT NULL,
    `role_id` INT NOT NULL,
    `assigned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`user_id`, `role_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. ملفات السائقين وأسطول التوصيل (Driver Profiles & Fleet)
DROP TABLE IF EXISTS `driver_profiles`;
CREATE TABLE `driver_profiles` (
    `user_id` VARCHAR(36) PRIMARY KEY,
    `vehicle_type` VARCHAR(100) DEFAULT 'سيارة هيونداي تبريد',
    `plate_number` VARCHAR(50),
    `national_id` VARCHAR(50),
    `current_status` ENUM('available', 'busy', 'offline') DEFAULT 'available',
    `current_lat` DECIMAL(10, 8),
    `current_lng` DECIMAL(11, 8),
    `last_location_update` DATETIME,
    `total_deliveries` INT DEFAULT 0,
    `rating` DECIMAL(3, 2) DEFAULT 5.00,
    `current_custody_amount` DECIMAL(10, 2) DEFAULT 0.00,
    `total_collected_cash` DECIMAL(10, 2) DEFAULT 0.00,
    `total_earned_commission` DECIMAL(10, 2) DEFAULT 0.00,
    `pending_earnings` DECIMAL(10, 2) DEFAULT 0.00,
    `settled_amount_total` DECIMAL(10, 2) DEFAULT 0.00,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. ملفات الزبائن وتاريخ الولاء (Customer Profiles)
DROP TABLE IF EXISTS `customer_profiles`;
CREATE TABLE `customer_profiles` (
    `user_id` VARCHAR(36) PRIMARY KEY,
    `loyalty_points` INT DEFAULT 0,
    `total_spent` DECIMAL(10, 2) DEFAULT 0.00,
    `notes` TEXT,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. جدول العناوين والمواقع المحفوظة (Customer Addresses & GPS Locations)
DROP TABLE IF EXISTS `addresses`;
CREATE TABLE `addresses` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(100) DEFAULT 'العنوان الرئيسي',
    `recipient_name` VARCHAR(150) NOT NULL,
    `recipient_phone` VARCHAR(30) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `zone` VARCHAR(100) NOT NULL,
    `street` VARCHAR(150),
    `landmark` VARCHAR(150),
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `google_maps_url` TEXT,
    `is_default` TINYINT(1) DEFAULT 0,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. تسعير التوصيل حسب المناطق والمدن (Delivery Zones Pricing)
DROP TABLE IF EXISTS `delivery_zones_pricing`;
CREATE TABLE `delivery_zones_pricing` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `city` VARCHAR(100) NOT NULL,
    `zone_name` VARCHAR(100) NOT NULL,
    `delivery_fee` DECIMAL(10, 2) NOT NULL,
    `estimated_minutes` INT DEFAULT 60,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. مخزون الزهور الطبيعية للاستوديو وصور الزوايا (Flower Inventory & Multi-Angle Photos)
DROP TABLE IF EXISTS `flower_inventory`;
CREATE TABLE `flower_inventory` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name_ar` VARCHAR(100) NOT NULL,
    `color` VARCHAR(50) NOT NULL,
    `image_url` MEDIUMTEXT,
    `image_front` MEDIUMTEXT,
    `image_side` MEDIUMTEXT,
    `image_top` MEDIUMTEXT,
    `image_stem` MEDIUMTEXT,
    `images_angles_json` JSON,
    `description` TEXT,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `stock_quantity` INT DEFAULT 0,
    `alert_threshold` INT DEFAULT 15,
    `is_available` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. كتالوج الباقات الجاهزة (Ready Bouquets Catalog)
DROP TABLE IF EXISTS `bouquets`;
CREATE TABLE `bouquets` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(100) UNIQUE NOT NULL,
    `occasion_tag` VARCHAR(50) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `description` TEXT,
    `image_svg_path` VARCHAR(255) NOT NULL,
    `is_featured` TINYINT(1) DEFAULT 0,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9b. جدول تركيبة وتوليفة الورود في كل باقة (Bouquet Flowers Recipe)
-- القيد المرجعي يمنع إدراج أي وردة في الباقة ما لم تكن موجودة ومسجلة مسبقاً في flower_inventory
DROP TABLE IF EXISTS `bouquet_flowers`;
CREATE TABLE `bouquet_flowers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `bouquet_id` INT NOT NULL,
    `flower_id` INT NOT NULL,
    `quantity_stems` INT NOT NULL DEFAULT 1,
    `notes` VARCHAR(255),
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`bouquet_id`) REFERENCES `bouquets`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`flower_id`) REFERENCES `flower_inventory`(`id`) ON DELETE RESTRICT,
    UNIQUE KEY `unique_bouquet_flower` (`bouquet_id`, `flower_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. جدول الكوبونات والتخفيضات التي ينشئها الأدمن (Admin Managed Coupons)
DROP TABLE IF EXISTS `coupons`;
CREATE TABLE `coupons` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(50) UNIQUE NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `discount_type` ENUM('fixed', 'fixed_amount', 'percent') DEFAULT 'fixed_amount',
    `discount_value` DECIMAL(10, 2) NOT NULL,
    `min_order_amount` DECIMAL(10, 2) DEFAULT 0.00,
    `max_discount_cap` DECIMAL(10, 2),
    `valid_from` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `valid_until` DATETIME,
    `usage_limit` INT DEFAULT 100,
    `used_count` INT DEFAULT 0,
    `per_user_limit` INT DEFAULT 1,
    `created_by_admin_id` VARCHAR(36),
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`created_by_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. سجل استخدام الكوبونات (Coupon Usages)
DROP TABLE IF EXISTS `coupon_usages`;
CREATE TABLE `coupon_usages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `coupon_id` INT NOT NULL,
    `order_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36),
    `discount_applied` DECIMAL(10, 2) NOT NULL,
    `used_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. جدول الطلبات الرئيسي (Orders Management)
DROP TABLE IF EXISTS `orders`;
CREATE TABLE `orders` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_number` VARCHAR(50) UNIQUE NOT NULL,
    `customer_id` VARCHAR(36),
    `address_id` VARCHAR(36),
    `recipient_name` VARCHAR(150) NOT NULL,
    `recipient_phone` VARCHAR(30) NOT NULL,
    `delivery_city` VARCHAR(100) NOT NULL,
    `delivery_zone` VARCHAR(100) NOT NULL,
    `delivery_address_details` TEXT,
    `delivery_lat` DECIMAL(10, 8),
    `delivery_lng` DECIMAL(11, 8),
    `delivery_window` VARCHAR(150) NOT NULL,
    `status` ENUM('pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled') DEFAULT 'pending',
    `assigned_florist_id` VARCHAR(36),
    `assigned_driver_id` VARCHAR(36),
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `discount_amount` DECIMAL(10, 2) DEFAULT 0.00,
    `delivery_fee` DECIMAL(10, 2) DEFAULT 10.00,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `coupon_id` INT,
    `customer_notes` TEXT,
    `admin_notes` TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`assigned_florist_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`assigned_driver_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`coupon_id`) REFERENCES `coupons`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. عناصر الطلب (Order Items)
DROP TABLE IF EXISTS `order_items`;
CREATE TABLE `order_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL,
    `item_type` VARCHAR(50) DEFAULT 'ready_bouquet',
    `bouquet_id` INT,
    `item_title` VARCHAR(150) NOT NULL,
    `quantity` INT DEFAULT 1,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `total_price` DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`bouquet_id`) REFERENCES `bouquets`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. تفاصيل الباقة المخصصة والكرت الشمعي (Custom Bouquet Atelier Details)
DROP TABLE IF EXISTS `custom_bouquet_details`;
CREATE TABLE `custom_bouquet_details` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_item_id` VARCHAR(36) UNIQUE NOT NULL,
    `wrap_type` VARCHAR(100) DEFAULT 'ورق كرافت فاخر',
    `ribbon_color` VARCHAR(100) DEFAULT 'شريط وردي مذهب',
    `wax_seal_text` TEXT,
    `seal_stamp` VARCHAR(100) DEFAULT 'MASKA 🌸',
    `seal_color` VARCHAR(100) DEFAULT 'أحمر قرمزي ملكي',
    `flower_composition_json` TEXT NOT NULL,
    FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. جدول تقييمات وملاحظات الزبائن (Customer Reviews & Ratings)
DROP TABLE IF EXISTS `customer_reviews`;
CREATE TABLE `customer_reviews` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36),
    `customer_id` VARCHAR(36),
    `driver_id` VARCHAR(36),
    `rating_overall` INT NOT NULL,
    `rating_flowers` INT DEFAULT 5,
    `rating_delivery` INT DEFAULT 5,
    `rating_packaging` INT DEFAULT 5,
    `customer_comment` TEXT NOT NULL,
    `customer_name_display` VARCHAR(150),
    `city` VARCHAR(100),
    `is_approved` TINYINT(1) DEFAULT 1,
    `is_featured` TINYINT(1) DEFAULT 0,
    `admin_reply` TEXT,
    `admin_reply_at` DATETIME,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. الاقتراحات والملاحظات العامة (Customer Feedback)
DROP TABLE IF EXISTS `customer_feedback`;
CREATE TABLE `customer_feedback` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `customer_name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30),
    `feedback_type` ENUM('suggestion', 'compliment', 'complaint', 'inquiry') DEFAULT 'suggestion',
    `subject` VARCHAR(200) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('new', 'reviewed', 'resolved') DEFAULT 'new',
    `admin_notes` TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. سجل تغير الأسعار للرقابة (Price Change Audit Logs)
DROP TABLE IF EXISTS `price_change_logs`;
CREATE TABLE `price_change_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `item_type` VARCHAR(50) NOT NULL,
    `item_id` INT NOT NULL,
    `item_name` VARCHAR(150) NOT NULL,
    `old_price` DECIMAL(10, 2) NOT NULL,
    `new_price` DECIMAL(10, 2) NOT NULL,
    `changed_by_user_id` VARCHAR(36),
    `reason` TEXT,
    `changed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. سجل حركات ومسار حالة الطلب (Order Status Lifecycle History)
DROP TABLE IF EXISTS `order_status_history`;
CREATE TABLE `order_status_history` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `changed_by_user_id` VARCHAR(36),
    `comment` TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`changed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. سجل مسار السائق اللحظي بالـ GPS (Delivery GPS Tracking Logs)
DROP TABLE IF EXISTS `delivery_tracking_logs`;
CREATE TABLE `delivery_tracking_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL,
    `driver_id` VARCHAR(36) NOT NULL,
    `lat` DECIMAL(10, 8) NOT NULL,
    `lng` DECIMAL(11, 8) NOT NULL,
    `heading` DECIMAL(5, 2),
    `speed` DECIMAL(5, 2),
    `recorded_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. جدول الدفع والفواتير (Payments & Transactions)
DROP TABLE IF EXISTS `payments`;
CREATE TABLE `payments` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) UNIQUE NOT NULL,
    `method` ENUM('cash_on_delivery', 'sadad', 'tadawul', 'bank_transfer') DEFAULT 'cash_on_delivery',
    `status` ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    `transaction_ref` VARCHAR(100),
    `amount` DECIMAL(10, 2) NOT NULL,
    `paid_at` DATETIME,
    `notes` TEXT,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. جدول تسويات واستلام العهدة المالية من السائقين (Driver Custody Settlements)
DROP TABLE IF EXISTS `driver_settlements`;
CREATE TABLE `driver_settlements` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `settlement_number` VARCHAR(50) UNIQUE NOT NULL,
    `driver_id` VARCHAR(36) NOT NULL,
    `admin_id` VARCHAR(36) NOT NULL,
    `custody_cleared` DECIMAL(10, 2) NOT NULL,
    `driver_earnings_deducted` DECIMAL(10, 2) DEFAULT 0.00,
    `net_cash_received` DECIMAL(10, 2) NOT NULL,
    `orders_count` INT DEFAULT 0,
    `notes` TEXT,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. سجل حركات العهدة النقدية والأرباح اللحظية (Driver Custody Ledger Transactions)
DROP TABLE IF EXISTS `driver_custody_transactions`;
CREATE TABLE `driver_custody_transactions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `driver_id` VARCHAR(36) NOT NULL,
    `order_id` VARCHAR(36) NULL,
    `settlement_id` INT NULL,
    `type` ENUM('order_collection', 'delivery_earning', 'admin_settlement', 'adjustment') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `delivery_fee` DECIMAL(10, 2) DEFAULT 0.00,
    `driver_profit` DECIMAL(10, 2) DEFAULT 0.00,
    `balance_after` DECIMAL(10, 2) NOT NULL,
    `description` VARCHAR(255),
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`driver_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- الفهارس المتقدمة للسرعة القصوى
CREATE INDEX `idx_users_phone` ON `users`(`phone`);
CREATE INDEX `idx_orders_status` ON `orders`(`status`);
CREATE INDEX `idx_orders_customer` ON `orders`(`customer_id`);
CREATE INDEX `idx_orders_driver` ON `orders`(`assigned_driver_id`);
CREATE INDEX `idx_orders_number` ON `orders`(`order_number`);
CREATE INDEX `idx_reviews_order` ON `customer_reviews`(`order_id`);
CREATE INDEX `idx_reviews_featured` ON `customer_reviews`(`is_featured`, `is_approved`);
CREATE INDEX `idx_coupons_code` ON `coupons`(`code`, `is_active`);
CREATE INDEX `idx_tracking_order` ON `delivery_tracking_logs`(`order_id`);




-- =============================================================================
-- 🌸 البيانات الأولية الأساسية لمشروع مسكة | SEED DATA FOR DOCKER & MYSQL
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- جدول addresses
TRUNCATE TABLE `addresses`;
INSERT INTO `addresses` (`id`, `user_id`, `title`, `recipient_name`, `recipient_phone`, `city`, `zone`, `street`, `landmark`, `latitude`, `longitude`, `google_maps_url`, `is_default`, `created_at`) VALUES ('051c680a-c46e-4623-84a1-7a2d907536e7', '1ab2c569-82bb-43be-a3f6-403199c8cbec', 'مقر العمل', 'أحمد الفيتوري', '0926666666', 'طرابلس', 'السياحية', 'شارع الفيلات', 'أمام مصرف الأمان السياحية', '32.86240000', '13.10920000', 'https://www.google.com/maps?q=32.862400,13.109200', 1, '2026-11-12 05:27:07');
INSERT INTO `addresses` (`id`, `user_id`, `title`, `recipient_name`, `recipient_phone`, `city`, `zone`, `street`, `landmark`, `latitude`, `longitude`, `google_maps_url`, `is_default`, `created_at`) VALUES ('538072b2-195d-455c-8434-e9b12a4f752d', '9fbdbae7-64d9-4e47-9cb6-4076a4786d2f', 'صالة المناسبات', 'نور الهدى الشريف', '0917777777', 'طرابلس', 'بن عاشور', 'شارع الظل', 'خلف مدرسة الفنون، صالة الفردوس', '32.88110000', '13.18950000', 'https://www.google.com/maps?q=32.881100,13.189500', 1, '2026-11-12 05:27:07');
INSERT INTO `addresses` (`id`, `user_id`, `title`, `recipient_name`, `recipient_phone`, `city`, `zone`, `street`, `landmark`, `latitude`, `longitude`, `google_maps_url`, `is_default`, `created_at`) VALUES ('945b1716-fdd2-403f-9045-f616c0d843b8', '60d4c14a-7bef-40c2-9843-219f3a9a87b1', 'المنزل', 'سارة المحمودي', '0915555555', 'طرابلس', 'النوفليين', 'شارع عمر المختار المتفرع', 'بجوار مسجد القدس، عمارة الأمل الدور 2', '32.88720000', '13.19130000', 'https://www.google.com/maps?q=32.887200,13.191300', 1, '2026-11-12 05:27:07');

-- جدول bouquet_flowers
TRUNCATE TABLE `bouquet_flowers`;
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (1, 1, 1, 10, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (2, 1, 2, 5, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (3, 1, 3, 3, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (4, 2, 2, 12, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (5, 2, 4, 6, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (6, 2, 6, 4, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (7, 3, 1, 8, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (8, 3, 2, 6, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (9, 3, 6, 6, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (10, 4, 5, 18, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (11, 4, 4, 8, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (12, 4, 3, 5, NULL, '2026-11-12 12:51:05');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (13, 5, 1, 12, NULL, '2026-11-12 12:55:02');
INSERT INTO `bouquet_flowers` (`id`, `bouquet_id`, `flower_id`, `quantity_stems`, `notes`, `created_at`) VALUES (14, 5, 3, 6, NULL, '2026-11-12 12:55:02');

-- جدول bouquets
TRUNCATE TABLE `bouquets`;
INSERT INTO `bouquets` (`id`, `title`, `slug`, `occasion_tag`, `price`, `description`, `image_svg_path`, `is_featured`, `is_active`, `created_at`) VALUES (1, 'ربيع وردي', 'pink-spring', 'عيد ميلاد', '64.00', 'باقة مفعمة بالبهجة والحيوية تجمع ورود الجوري الزاهية والتوليب النضر.', 'assets/bouquet-pink-spring.svg', 1, 1, '2026-11-12 05:27:07');
INSERT INTO `bouquets` (`id`, `title`, `slug`, `occasion_tag`, `price`, `description`, `image_svg_path`, `is_featured`, `is_active`, `created_at`) VALUES (2, 'أناقة العاج', 'ivory-elegance', 'زفاف', '78.00', 'تناغم ملكي يفيض بالنقاء والصفاء، مصمم لمناسبات الزفاف والخطوبة الفاخرة.', 'assets/bouquet-ivory-elegance.svg', 1, 1, '2026-11-12 05:27:07');
INSERT INTO `bouquets` (`id`, `title`, `slug`, `occasion_tag`, `price`, `description`, `image_svg_path`, `is_featured`, `is_active`, `created_at`) VALUES (3, 'همسة المريمي', 'sage-whisper', 'شكر', '92.00', 'مزيج هادئ وأنيق من درجات الخوخي والوردي العتيق مع أغصان المريمية العطرة.', 'assets/bouquet-sage-whisper.svg', 0, 1, '2026-11-12 05:27:07');
INSERT INTO `bouquets` (`id`, `title`, `slug`, `occasion_tag`, `price`, `description`, `image_svg_path`, `is_featured`, `is_active`, `created_at`) VALUES (4, 'الباقة الملكية', 'royal-bouquet', 'تخرج', '120.00', 'باقة ضخمة ومهيبة تليق بمناسبات التخرج والإنجازات الكبرى وتتويج النجاح.', 'assets/bouquet-royal.svg', 1, 1, '2026-11-12 05:27:07');
INSERT INTO `bouquets` (`id`, `title`, `slug`, `occasion_tag`, `price`, `description`, `image_svg_path`, `is_featured`, `is_active`, `created_at`) VALUES (5, 'باقة نسمات طرابلس', 'باقة-نسمات-طرابلس-1gfr', 'حب وغرام', '95.00', 'باقة متناسقة تجمع الجوري الوردي الناعم والجبسوفيلا البيضاء الحالمة.', '/assets/bouquet-pink-spring.svg', 0, 1, '2026-11-12 12:55:02');

-- جدول coupon_usages
TRUNCATE TABLE `coupon_usages`;
INSERT INTO `coupon_usages` (`id`, `coupon_id`, `order_id`, `user_id`, `discount_applied`, `used_at`) VALUES (1, 1, 'abfb3eb7-be82-4adc-8e9b-6f52a3c2968b', '60d4c14a-7bef-40c2-9843-219f3a9a87b1', '15.00', '2026-11-12 05:27:07');

-- جدول coupons
TRUNCATE TABLE `coupons`;
INSERT INTO `coupons` (`id`, `code`, `title`, `discount_type`, `discount_value`, `min_order_amount`, `max_discount_cap`, `valid_from`, `valid_until`, `usage_limit`, `used_count`, `per_user_limit`, `created_by_admin_id`, `is_active`, `created_at`) VALUES (1, 'MASKA15', 'كوبون الترحيب بمسكة', 'fixed', '15.00', '60.00', NULL, '2026-11-12 05:27:07', '2026-12-12 05:27:07', 200, 14, 1, '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 1, '2026-11-12 05:27:07');
INSERT INTO `coupons` (`id`, `code`, `title`, `discount_type`, `discount_value`, `min_order_amount`, `max_discount_cap`, `valid_from`, `valid_until`, `usage_limit`, `used_count`, `per_user_limit`, `created_by_admin_id`, `is_active`, `created_at`) VALUES (2, 'MASKA20', 'خصم الباقات الفاخرة', 'fixed', '20.00', '100.00', NULL, '2026-11-12 05:27:07', '2026-12-12 05:27:07', 100, 6, 1, '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 1, '2026-11-12 05:27:07');
INSERT INTO `coupons` (`id`, `code`, `title`, `discount_type`, `discount_value`, `min_order_amount`, `max_discount_cap`, `valid_from`, `valid_until`, `usage_limit`, `used_count`, `per_user_limit`, `created_by_admin_id`, `is_active`, `created_at`) VALUES (3, 'GRAD2026', 'عرض موسم التخرج والنجاح', 'percent', '20.00', '80.00', '40.00', '2026-11-12 05:27:07', '2026-12-12 05:27:07', 150, 8, 1, '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 0, '2026-11-12 05:27:07');
INSERT INTO `coupons` (`id`, `code`, `title`, `discount_type`, `discount_value`, `min_order_amount`, `max_discount_cap`, `valid_from`, `valid_until`, `usage_limit`, `used_count`, `per_user_limit`, `created_by_admin_id`, `is_active`, `created_at`) VALUES (4, 'SPRING10', 'تخفيض باقات الربيع', 'fixed', '10.00', '50.00', NULL, '2026-11-12 05:27:07', '2026-12-12 05:27:07', 100, 2, 1, '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 1, '2026-11-12 05:27:07');

-- جدول custom_bouquet_details
TRUNCATE TABLE `custom_bouquet_details`;
INSERT INTO `custom_bouquet_details` (`id`, `order_item_id`, `wrap_type`, `ribbon_color`, `wax_seal_text`, `seal_stamp`, `seal_color`, `flower_composition_json`) VALUES ('442aa8ce-726a-4349-a658-3f9cb064fd71', '391f6d45-125a-4c52-bee7-9bb69ead7a20', 'ورق كرافت فاخر', 'شريط وردي مذهب', 'أجمل اللحظات هي التي تبدأ بوردة صادقة… كل عام وأنتِ مصدر النور والبهجة في حياتنا.', 'MASKA 🌸', 'أحمر قرمزي ملكي', '[{"flower":"وردة جورية وردية","count":6,"unit_price":4,"total":24},{"flower":"توليب أبيض نقي","count":5,"unit_price":5,"total":25},{"flower":"فاوانيا ملكية فاخرة","count":3,"unit_price":9,"total":27},{"flower":"غلاف وشريط كرافت","count":1,"unit_price":14,"total":14}]');

-- جدول customer_feedback
TRUNCATE TABLE `customer_feedback`;
INSERT INTO `customer_feedback` (`id`, `customer_name`, `phone`, `feedback_type`, `subject`, `message`, `status`, `admin_notes`, `created_at`) VALUES (1, 'ريان الترهوني', '0913344556', 'suggestion', 'إضافة نباتات الظل والصباريات', 'نتمنى توفير قسم لنباتات الزينة الداخلية والصباريات في الموقع بجانب باقات الورد.', 'reviewed', 'فكرة ممتازة لإضافتها في التحديث القادم', '2026-11-12 05:27:07');
INSERT INTO `customer_feedback` (`id`, `customer_name`, `phone`, `feedback_type`, `subject`, `message`, `status`, `admin_notes`, `created_at`) VALUES (2, 'عمر المجبري', '0925566778', 'compliment', 'إشادة بتجربة الاستوديو', 'تجربة تصميم الباقة لحظياً وتغير السعر مباشرة في الاستوديو رهيبة وفريدة في ليبيا!', 'resolved', 'تم شكر العميل وتقديم كود خصم خاص له', '2026-11-12 05:27:07');

-- جدول customer_reviews
TRUNCATE TABLE `customer_reviews`;
INSERT INTO `customer_reviews` (`id`, `order_id`, `customer_id`, `driver_id`, `rating_overall`, `rating_flowers`, `rating_delivery`, `rating_packaging`, `customer_comment`, `customer_name_display`, `city`, `is_approved`, `is_featured`, `admin_reply`, `admin_reply_at`, `created_at`) VALUES ('4ae19ecd-3ed5-46f1-903d-3f59461f6784', '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', '1ab2c569-82bb-43be-a3f6-403199c8cbec', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 5, 5, 5, 5, 'فكرة المصمم الذكي اختصرت عليّ ساعات من التفكير. حددت ميزانيتي والمناسبة واقترحلي توليفة زهور وتنسيق أفخم مما تخيلت، والتوصيل كان في الموعد بالدقيقة.', 'م. أسامة التاجوري', 'بنغازي', 1, 1, 'شهادة نعتز بها يا بشمهندس أسامة، سرعة ودقة التوصيل عهدنا دائماً 🌿', '2026-11-10 05:27:07', '2026-11-12 05:27:07');
INSERT INTO `customer_reviews` (`id`, `order_id`, `customer_id`, `driver_id`, `rating_overall`, `rating_flowers`, `rating_delivery`, `rating_packaging`, `customer_comment`, `customer_name_display`, `city`, `is_approved`, `is_featured`, `admin_reply`, `admin_reply_at`, `created_at`) VALUES ('6d607d79-c7ea-423f-b64c-56604489be3f', 'ae705ffb-7a87-4e2e-bdcd-2a63e6d61267', '9fbdbae7-64d9-4e47-9cb6-4076a4786d2f', 'a1f349a5-163b-43da-b706-22b9e452cf03', 5, 5, 5, 5, 'باقة أناقة العاج في يوم عقد قراني كانت حديث كل الحاضرين في الصالة! لمسة زهور التوليب البيضاء مع شريط الساتان راقية جداً وذوق لا يوصف.', 'نور الهدى القماطي', 'مصراتة', 1, 1, 'ألف ألف مبارك يا نور، تتهنوا يا رب وربي يجعل أيامكم كلها أفراح وزهور 💍', '2026-11-10 05:27:07', '2026-11-12 05:27:07');
INSERT INTO `customer_reviews` (`id`, `order_id`, `customer_id`, `driver_id`, `rating_overall`, `rating_flowers`, `rating_delivery`, `rating_packaging`, `customer_comment`, `customer_name_display`, `city`, `is_approved`, `is_featured`, `admin_reply`, `admin_reply_at`, `created_at`) VALUES ('7ffed739-51f6-40cd-88c2-ec3f96b1dd45', NULL, NULL, NULL, 5, NULL, NULL, NULL, 'التعامل ممتاز والباقة جتني نفس الصورة شكرا على المصداقية', 'مسرة', 'طرابلس', 1, 0, NULL, NULL, '2026-11-12 09:25:16');
INSERT INTO `customer_reviews` (`id`, `order_id`, `customer_id`, `driver_id`, `rating_overall`, `rating_flowers`, `rating_delivery`, `rating_packaging`, `customer_comment`, `customer_name_display`, `city`, `is_approved`, `is_featured`, `admin_reply`, `admin_reply_at`, `created_at`) VALUES ('8289cb75-70c8-4fd2-9db3-e8513ce5dbdf', 'abfb3eb7-be82-4adc-8e9b-6f52a3c2968b', '60d4c14a-7bef-40c2-9843-219f3a9a87b1', NULL, 5, 5, 5, 5, 'طلبت باقة ربيع وردي لعيد ميلاد أختي، التغليف اليدوي والكرت المكتوب بخط أنيق مع الختم الشمعي خلى المفاجأة استثنائية! والورد قعد نضر ومفتح أكثر من 12 يوم.', 'سارة الورفلي', 'طرابلس', 1, 0, 'نسعد جداً برضاكِ يا سارة ونفخر بكوننا جزءاً من أفراحكم الغالية 🌸', '2026-11-10 05:27:07', '2026-11-12 05:27:07');
INSERT INTO `customer_reviews` (`id`, `order_id`, `customer_id`, `driver_id`, `rating_overall`, `rating_flowers`, `rating_delivery`, `rating_packaging`, `customer_comment`, `customer_name_display`, `city`, `is_approved`, `is_featured`, `admin_reply`, `admin_reply_at`, `created_at`) VALUES ('98eb94c1-20ee-4bea-967e-ebe0b68e5be1', 'ddb97b41-90de-4024-a30e-4db307857e7d', '60d4c14a-7bef-40c2-9843-219f3a9a87b1', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 5, 5, 5, 5, 'التوصيل كان سريع جداً والمندوب طارق كان في قمة الاحترام واللباقة، والتغليف الملكي فخم يشرف بجد.', 'طارق المنفي', 'طرابلس', 1, 1, 'أهلاً بك دائماً أخي طارق، نسعد بخدمتك في كل مناسبة ✨', '2026-11-10 05:27:07', '2026-11-12 05:27:07');

-- جدول delivery_tracking_logs
TRUNCATE TABLE `delivery_tracking_logs`;
INSERT INTO `delivery_tracking_logs` (`id`, `order_id`, `driver_id`, `lat`, `lng`, `heading`, `speed`, `recorded_at`) VALUES (1, '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', '32.89120000', '13.19560000', NULL, '35.00', '2026-11-12 05:02:07');
INSERT INTO `delivery_tracking_logs` (`id`, `order_id`, `driver_id`, `lat`, `lng`, `heading`, `speed`, `recorded_at`) VALUES (2, '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', '32.88210000', '13.16450000', NULL, '48.00', '2026-11-12 05:12:07');
INSERT INTO `delivery_tracking_logs` (`id`, `order_id`, `driver_id`, `lat`, `lng`, `heading`, `speed`, `recorded_at`) VALUES (3, '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', '32.87100000', '13.13200000', NULL, '42.00', '2026-11-12 05:22:07');
INSERT INTO `delivery_tracking_logs` (`id`, `order_id`, `driver_id`, `lat`, `lng`, `heading`, `speed`, `recorded_at`) VALUES (4, '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', '32.86240000', '13.10920000', NULL, '15.00', '2026-11-12 05:27:07');

-- جدول delivery_zones_pricing
TRUNCATE TABLE `delivery_zones_pricing`;
INSERT INTO `delivery_zones_pricing` (`id`, `city`, `zone_name`, `delivery_fee`, `estimated_minutes`, `is_active`, `created_at`) VALUES (1, 'طرابلس', 'طرابلس المركز', '10.00', 45, 1, '2026-11-12 05:27:07');
INSERT INTO `delivery_zones_pricing` (`id`, `city`, `zone_name`, `delivery_fee`, `estimated_minutes`, `is_active`, `created_at`) VALUES (2, 'طرابلس', 'النوفليين وبن عاشور', '10.00', 40, 1, '2026-11-12 05:27:07');
INSERT INTO `delivery_zones_pricing` (`id`, `city`, `zone_name`, `delivery_fee`, `estimated_minutes`, `is_active`, `created_at`) VALUES (3, 'طرابلس', 'السياحية وحي الأندلس', '10.00', 50, 1, '2026-11-12 05:27:07');
INSERT INTO `delivery_zones_pricing` (`id`, `city`, `zone_name`, `delivery_fee`, `estimated_minutes`, `is_active`, `created_at`) VALUES (4, 'طرابلس', 'تاجوراء', '15.00', 65, 1, '2026-11-12 05:27:07');
INSERT INTO `delivery_zones_pricing` (`id`, `city`, `zone_name`, `delivery_fee`, `estimated_minutes`, `is_active`, `created_at`) VALUES (5, 'طرابلس', 'جنزور', '15.00', 65, 1, '2026-11-12 05:27:07');
INSERT INTO `delivery_zones_pricing` (`id`, `city`, `zone_name`, `delivery_fee`, `estimated_minutes`, `is_active`, `created_at`) VALUES (6, 'بنغازي', 'كافة مناطق بنغازي', '15.00', 90, 1, '2026-11-12 05:27:07');
INSERT INTO `delivery_zones_pricing` (`id`, `city`, `zone_name`, `delivery_fee`, `estimated_minutes`, `is_active`, `created_at`) VALUES (7, 'مصراتة', 'كافة مناطق مصراتة', '16.00', 90, 1, '2026-11-12 05:27:07');

-- جدول driver_profiles
TRUNCATE TABLE `driver_profiles`;
INSERT INTO `driver_profiles` (`user_id`, `vehicle_type`, `plate_number`, `national_id`, `current_status`, `current_lat`, `current_lng`, `last_location_update`, `total_deliveries`, `rating`) VALUES ('a1f349a5-163b-43da-b706-22b9e452cf03', 'دراجة نارية سريعة', 'طرابلس 12-8831', '11996039281', 'available', '32.89120000', '13.19560000', '2026-11-12 05:27:07', 92, '4.89');
INSERT INTO `driver_profiles` (`user_id`, `vehicle_type`, `plate_number`, `national_id`, `current_status`, `current_lat`, `current_lng`, `last_location_update`, `total_deliveries`, `rating`) VALUES ('dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 'سيارة هيونداي تبريد', 'طرابلس 5-14820', '11994028374', 'busy', '32.87978900', '13.20081589', '2026-11-14 11:54:50', 186, '4.96');

-- جدول flower_inventory
TRUNCATE TABLE `flower_inventory`;
INSERT INTO `flower_inventory` (`id`, `name_ar`, `color`, `image_url`, `image_front`, `image_side`, `image_top`, `image_stem`, `images_angles_json`, `description`, `unit_price`, `stock_quantity`, `alert_threshold`, `is_available`, `created_at`) VALUES (1, 'وردة جورية وردية', 'وردي', '/assets/flowers/pink-rose-front.svg', '/assets/flowers/pink-rose-front.svg', '/assets/flowers/pink-rose-side.svg', '/assets/flowers/pink-rose-top.svg', '/assets/flowers/pink-rose-stem.svg', NULL, 'جوري وردي هولندي نضر بتدرجات باستيلية ناعمة، يرمز للمودة والرقة.', '4.00', 120, 20, 1, '2026-11-12 05:27:07');
INSERT INTO `flower_inventory` (`id`, `name_ar`, `color`, `image_url`, `image_front`, `image_side`, `image_top`, `image_stem`, `images_angles_json`, `description`, `unit_price`, `stock_quantity`, `alert_threshold`, `is_available`, `created_at`) VALUES (2, 'توليب أبيض نقي', 'أبيض', '/assets/flowers/white-tulip-front.svg', '/assets/flowers/white-tulip-front.svg', '/assets/flowers/white-tulip-side.svg', '/assets/flowers/white-tulip-top.svg', '/assets/flowers/white-tulip-stem.svg', NULL, 'توليب أبيض نقي مستورد طازج، مظهر انسيابي أنيق ونقاء فائق.', '5.00', 85, 15, 1, '2026-11-12 05:27:07');
INSERT INTO `flower_inventory` (`id`, `name_ar`, `color`, `image_url`, `image_front`, `image_side`, `image_top`, `image_stem`, `images_angles_json`, `description`, `unit_price`, `stock_quantity`, `alert_threshold`, `is_available`, `created_at`) VALUES (3, 'جبسوفيلا ناعمة', 'أبيض', '/assets/flowers/baby-breath-front.svg', '/assets/flowers/baby-breath-front.svg', '/assets/flowers/baby-breath-side.svg', '/assets/flowers/baby-breath-top.svg', '/assets/flowers/baby-breath-stem.svg', NULL, 'جبسوفيلا سحابية (نَفَس الطفل) بيضاء ناعمة تضفي لمسة حالمة على أي باقة.', '5.00', 60, 15, 1, '2026-11-12 05:27:07');
INSERT INTO `flower_inventory` (`id`, `name_ar`, `color`, `image_url`, `image_front`, `image_side`, `image_top`, `image_stem`, `images_angles_json`, `description`, `unit_price`, `stock_quantity`, `alert_threshold`, `is_available`, `created_at`) VALUES (4, 'فاوانيا ملكية فاخرة', 'وردي مذهب', '/assets/flowers/peony-front.svg', '/assets/flowers/peony-front.svg', '/assets/flowers/peony-side.svg', '/assets/flowers/peony-top.svg', '/assets/flowers/peony-stem.svg', NULL, 'فاوانيا ملكية وردية مذهبة بتلات كثيفة عطرية للمناسبات الاستثنائية.', '9.00', 25, 10, 1, '2026-11-12 05:27:07');
INSERT INTO `flower_inventory` (`id`, `name_ar`, `color`, `image_url`, `image_front`, `image_side`, `image_top`, `image_stem`, `images_angles_json`, `description`, `unit_price`, `stock_quantity`, `alert_threshold`, `is_available`, `created_at`) VALUES (5, 'وردة جورية حمراء', 'أحمر قرمزي', '/assets/flowers/red-rose-front.svg', '/assets/flowers/red-rose-front.svg', '/assets/flowers/red-rose-side.svg', '/assets/flowers/red-rose-top.svg', '/assets/flowers/red-rose-stem.svg', NULL, 'جوري إكوادوري أحمر قرمزي مخملي كلاسيكي للمشاعر الصادقة.', '5.00', 90, 20, 1, '2026-11-12 05:27:07');
INSERT INTO `flower_inventory` (`id`, `name_ar`, `color`, `image_url`, `image_front`, `image_side`, `image_top`, `image_stem`, `images_angles_json`, `description`, `unit_price`, `stock_quantity`, `alert_threshold`, `is_available`, `created_at`) VALUES (6, 'أغصان أوكالبتوس مريمية', 'أخضر مريمي', '/assets/flowers/eucalyptus-front.svg', '/assets/flowers/eucalyptus-front.svg', '/assets/flowers/eucalyptus-side.svg', '/assets/flowers/eucalyptus-top.svg', '/assets/flowers/eucalyptus-stem.svg', NULL, 'أغصان أوكالبتوس مريمية فضية ذات شذى عطري مهدئ وتناسق بصري ساحر.', '3.00', 75, 15, 1, '2026-11-12 05:27:07');

-- جدول order_items
TRUNCATE TABLE `order_items`;
INSERT INTO `order_items` (`id`, `order_id`, `item_type`, `bouquet_id`, `item_title`, `quantity`, `unit_price`, `total_price`) VALUES ('02240e43-4803-408a-b8ef-7f56650f8ee4', 'e710aba1-a57a-4455-b901-c3040901ba8e', 'ready_bouquet', NULL, 'باقة مخصصة (14 سيقان)', 1, '79.00', '79.00');
INSERT INTO `order_items` (`id`, `order_id`, `item_type`, `bouquet_id`, `item_title`, `quantity`, `unit_price`, `total_price`) VALUES ('0848ad1b-9baa-44b3-9bf6-1413b5db6c2c', 'ddb97b41-90de-4024-a30e-4db307857e7d', 'custom_studio', NULL, 'باقة استوديو فاخرة', 1, '96.00', '96.00');
INSERT INTO `order_items` (`id`, `order_id`, `item_type`, `bouquet_id`, `item_title`, `quantity`, `unit_price`, `total_price`) VALUES ('366d88aa-9ce9-4129-9093-3ae0edf743fc', 'e3429d8c-ec43-4aa2-aaa0-94050213d773', 'ready_bouquet', NULL, 'باقة مخصصة (14 سيقان)', 1, '79.00', '79.00');
INSERT INTO `order_items` (`id`, `order_id`, `item_type`, `bouquet_id`, `item_title`, `quantity`, `unit_price`, `total_price`) VALUES ('391f6d45-125a-4c52-bee7-9bb69ead7a20', 'abfb3eb7-be82-4adc-8e9b-6f52a3c2968b', 'custom_studio', NULL, 'باقة مخصصة (استوديو مسكة)', 1, '150.00', '150.00');
INSERT INTO `order_items` (`id`, `order_id`, `item_type`, `bouquet_id`, `item_title`, `quantity`, `unit_price`, `total_price`) VALUES ('74c3fe19-72d2-4ab0-bf82-4eade3c25910', 'e710aba1-a57a-4455-b901-c3040901ba8e', 'ready_bouquet', NULL, 'باقة مخصصة (14 سيقان)', 1, '79.00', '79.00');
INSERT INTO `order_items` (`id`, `order_id`, `item_type`, `bouquet_id`, `item_title`, `quantity`, `unit_price`, `total_price`) VALUES ('ba1e39ed-db8b-403b-a86a-96ad84c10493', '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'ready_bouquet', 1, 'ربيع وردي', 1, '64.00', '64.00');
INSERT INTO `order_items` (`id`, `order_id`, `item_type`, `bouquet_id`, `item_title`, `quantity`, `unit_price`, `total_price`) VALUES ('d3e84ce5-254f-481b-a4d5-7c40b1a575c9', 'ae705ffb-7a87-4e2e-bdcd-2a63e6d61267', 'ready_bouquet', 2, 'أناقة العاج', 1, '78.00', '78.00');

-- جدول order_status_history
TRUNCATE TABLE `order_status_history`;
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (1, 'abfb3eb7-be82-4adc-8e9b-6f52a3c2968b', 'confirmed', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'تم تأكيد الطلب وتطبيق كود الخصم MASKA15 بنجاح', '2026-11-12 05:27:07');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (2, 'abfb3eb7-be82-4adc-8e9b-6f52a3c2968b', 'preparing', '1db2388a-2162-4cc3-8511-bc167e8932cb', 'بدأت خبيرة الزهور فاطمة الورفلي بتنسيق الباقة وقص السيقان وتجهيز الكرت الشمعي', '2026-11-12 05:27:07');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (3, '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'confirmed', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'تم تأكيد الطلب ومطابقة الأصناف', '2026-11-12 05:27:07');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (4, '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'preparing', '1db2388a-2162-4cc3-8511-bc167e8932cb', 'تم تنسيق وتجهيز باقة ربيع وردي', '2026-11-12 05:27:07');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (5, '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'ready_for_pickup', '1db2388a-2162-4cc3-8511-bc167e8932cb', 'الباقة جاهزة بانتظار استلام المندوب', '2026-11-12 05:27:07');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (6, '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'out_for_delivery', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 'استلم السائق طارق الباقة وانطلق باتجاه السياحية', '2026-11-12 05:27:07');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (7, 'ae705ffb-7a87-4e2e-bdcd-2a63e6d61267', 'pending', '9fbdbae7-64d9-4e47-9cb6-4076a4786d2f', 'تم إنشاء الطلب بانتظار التأكيد', '2026-11-12 05:27:07');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (8, 'ddb97b41-90de-4024-a30e-4db307857e7d', 'delivered', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 'تم تسليم الباقة باليد للمستلم واستلام المبلغ نقداً بنجاح', '2026-11-12 05:27:07');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (9, '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'delivered', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 'تحديث من لوحة الإدارة', '2026-11-12 06:09:17');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (10, 'e3429d8c-ec43-4aa2-aaa0-94050213d773', 'confirmed', NULL, 'تم تأكيد الطلب وحفظه في النظام بنجاح', '2026-11-12 08:35:13');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (11, 'e3429d8c-ec43-4aa2-aaa0-94050213d773', 'preparing', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'تحديث من لوحة الإدارة', '2026-11-12 08:36:24');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (12, 'e3429d8c-ec43-4aa2-aaa0-94050213d773', 'out_for_delivery', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 'تحديث بواسطة السائق (طارق الزوي)', '2026-11-12 08:54:35');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (13, 'e3429d8c-ec43-4aa2-aaa0-94050213d773', 'delivered', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 'تحديث بواسطة السائق (طارق الزوي)', '2026-11-12 09:23:50');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (14, 'abfb3eb7-be82-4adc-8e9b-6f52a3c2968b', 'out_for_delivery', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 'تحديث بواسطة السائق (طارق الزوي)', '2026-11-12 09:40:03');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (15, 'abfb3eb7-be82-4adc-8e9b-6f52a3c2968b', 'preparing', NULL, 'توجيه لمنسقة الورد: آية الطرابلسي | توجيه لسائق التوصيل: طارق الزوي', '2026-11-12 09:50:37');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (16, '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'preparing', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'توجيه لمنسقة الورد: آية الطرابلسي', '2026-11-12 09:57:46');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (17, 'e3429d8c-ec43-4aa2-aaa0-94050213d773', 'delivered', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'توجيه لمنسقة الورد: فاطمة الورفلي | توجيه لسائق التوصيل: طارق الزوي', '2026-11-12 09:58:23');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (18, 'ae705ffb-7a87-4e2e-bdcd-2a63e6d61267', 'preparing', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'تحديث من لوحة الإدارة', '2026-11-12 09:59:13');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (19, 'e710aba1-a57a-4455-b901-c3040901ba8e', 'confirmed', NULL, 'تم تأكيد الطلب وحفظه في النظام بنجاح', '2026-11-14 11:59:09');
INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `changed_by_user_id`, `comment`, `created_at`) VALUES (20, 'e710aba1-a57a-4455-b901-c3040901ba8e', 'preparing', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'توجيه لمنسقة الورد: فاطمة الورفلي | توجيه لسائق التوصيل: معتز القماطي', '2026-11-14 12:00:09');

-- جدول orders
TRUNCATE TABLE `orders`;
INSERT INTO `orders` (`id`, `order_number`, `customer_id`, `address_id`, `recipient_name`, `recipient_phone`, `delivery_city`, `delivery_zone`, `delivery_address_details`, `delivery_lat`, `delivery_lng`, `delivery_window`, `status`, `assigned_florist_id`, `assigned_driver_id`, `subtotal`, `discount_amount`, `delivery_fee`, `total_amount`, `coupon_id`, `customer_notes`, `admin_notes`, `created_at`, `updated_at`) VALUES ('511dfa28-c168-40d5-b6c4-b0aaa39f75ca', '1049', '1ab2c569-82bb-43be-a3f6-403199c8cbec', '051c680a-c46e-4623-84a1-7a2d907536e7', 'أحمد الفيتوري', '0926666666', 'طرابلس', 'السياحية', 'شارع الفيلات، أمام مصرف الأمان', '32.86240000', '13.10920000', '2026-11-12 09:27:07', 'preparing', '6c4ec5ef-a031-48b2-8cc7-3d2595fe5209', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', '64.00', '0.00', '10.00', '74.00', NULL, 'التسليم للاستقبال في العمارة', NULL, '2026-11-12 05:27:07', '2026-11-12 09:57:46');
INSERT INTO `orders` (`id`, `order_number`, `customer_id`, `address_id`, `recipient_name`, `recipient_phone`, `delivery_city`, `delivery_zone`, `delivery_address_details`, `delivery_lat`, `delivery_lng`, `delivery_window`, `status`, `assigned_florist_id`, `assigned_driver_id`, `subtotal`, `discount_amount`, `delivery_fee`, `total_amount`, `coupon_id`, `customer_notes`, `admin_notes`, `created_at`, `updated_at`) VALUES ('abfb3eb7-be82-4adc-8e9b-6f52a3c2968b', '1048', '60d4c14a-7bef-40c2-9843-219f3a9a87b1', '945b1716-fdd2-403f-9045-f616c0d843b8', 'سارة المحمودي', '0915555555', 'طرابلس', 'النوفليين', 'بجوار مسجد القدس، عمارة الأمل الدور 2', '32.88720000', '13.19130000', '2026-11-12 09:27:07', 'preparing', '6c4ec5ef-a031-48b2-8cc7-3d2595fe5209', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', '150.00', '15.00', '10.00', '145.00', 1, 'يرجى كتابة الكرت بخط رقعة أنيق والعناية بختم الشمع الأحمر الملكي', NULL, '2026-11-12 05:27:07', '2026-11-12 09:50:37');
INSERT INTO `orders` (`id`, `order_number`, `customer_id`, `address_id`, `recipient_name`, `recipient_phone`, `delivery_city`, `delivery_zone`, `delivery_address_details`, `delivery_lat`, `delivery_lng`, `delivery_window`, `status`, `assigned_florist_id`, `assigned_driver_id`, `subtotal`, `discount_amount`, `delivery_fee`, `total_amount`, `coupon_id`, `customer_notes`, `admin_notes`, `created_at`, `updated_at`) VALUES ('ae705ffb-7a87-4e2e-bdcd-2a63e6d61267', '1050', '9fbdbae7-64d9-4e47-9cb6-4076a4786d2f', '538072b2-195d-455c-8434-e9b12a4f752d', 'نور الهدى الشريف', '0917777777', 'طرابلس', 'بن عاشور', 'صالة الفردوس للمناسبات', '32.88110000', '13.18950000', '2026-11-12 09:27:07', 'preparing', NULL, NULL, '78.00', '0.00', '10.00', '88.00', NULL, 'الباقة لعروس في الصالة يرجى الحذر الشديد', NULL, '2026-11-12 05:27:07', '2026-11-12 09:59:13');
INSERT INTO `orders` (`id`, `order_number`, `customer_id`, `address_id`, `recipient_name`, `recipient_phone`, `delivery_city`, `delivery_zone`, `delivery_address_details`, `delivery_lat`, `delivery_lng`, `delivery_window`, `status`, `assigned_florist_id`, `assigned_driver_id`, `subtotal`, `discount_amount`, `delivery_fee`, `total_amount`, `coupon_id`, `customer_notes`, `admin_notes`, `created_at`, `updated_at`) VALUES ('ddb97b41-90de-4024-a30e-4db307857e7d', '1051', '60d4c14a-7bef-40c2-9843-219f3a9a87b1', '945b1716-fdd2-403f-9045-f616c0d843b8', 'طارق المنفي', '0919998877', 'طرابلس', 'زاوية الدهماني', 'شارع النصر، فيلا رقم 14', '32.89800000', '13.19500000', '2026-11-12 09:27:07', 'delivered', '1db2388a-2162-4cc3-8511-bc167e8932cb', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', '96.00', '0.00', '10.00', '106.00', NULL, 'تم التسليم مع بطاقة إهداء فاخرة', NULL, '2026-11-12 05:27:07', '2026-11-12 10:07:36');
INSERT INTO `orders` (`id`, `order_number`, `customer_id`, `address_id`, `recipient_name`, `recipient_phone`, `delivery_city`, `delivery_zone`, `delivery_address_details`, `delivery_lat`, `delivery_lng`, `delivery_window`, `status`, `assigned_florist_id`, `assigned_driver_id`, `subtotal`, `discount_amount`, `delivery_fee`, `total_amount`, `coupon_id`, `customer_notes`, `admin_notes`, `created_at`, `updated_at`) VALUES ('e3429d8c-ec43-4aa2-aaa0-94050213d773', '1052', '60d4c14a-7bef-40c2-9843-219f3a9a87b1', NULL, 'سارة المحمودي', '0915555555', 'طرابلس', 'طرابلس المركز', '', '32.80285902', '13.28898806', 'غداً — مساءً (5 - 9 مساءً)', 'delivered', '1db2388a-2162-4cc3-8511-bc167e8932cb', 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', '79.00', '0.00', '10.00', '89.00', NULL, '', NULL, '2026-11-12 08:35:13', '2026-11-12 09:58:23');
INSERT INTO `orders` (`id`, `order_number`, `customer_id`, `address_id`, `recipient_name`, `recipient_phone`, `delivery_city`, `delivery_zone`, `delivery_address_details`, `delivery_lat`, `delivery_lng`, `delivery_window`, `status`, `assigned_florist_id`, `assigned_driver_id`, `subtotal`, `discount_amount`, `delivery_fee`, `total_amount`, `coupon_id`, `customer_notes`, `admin_notes`, `created_at`, `updated_at`) VALUES ('e710aba1-a57a-4455-b901-c3040901ba8e', '1053', '60d4c14a-7bef-40c2-9843-219f3a9a87b1', NULL, 'سارة المحمودي', '0915555555', 'طرابلس', 'كافة مناطق بنغازي', '', '32.87857166', '13.20077735', '0000-00-00 00:00:00', 'preparing', '1db2388a-2162-4cc3-8511-bc167e8932cb', 'a1f349a5-163b-43da-b706-22b9e452cf03', '158.00', '0.00', '15.00', '173.00', NULL, '', NULL, '2026-11-14 11:59:09', '2026-11-14 12:00:09');

-- جدول payments
TRUNCATE TABLE `payments`;
INSERT INTO `payments` (`id`, `order_id`, `method`, `status`, `transaction_ref`, `amount`, `paid_at`, `notes`) VALUES ('216acc6e-4902-4217-934c-bf9a228faf28', 'ddb97b41-90de-4024-a30e-4db307857e7d', 'cash_on_delivery', 'paid', 'COD-CASH-1051', '106.00', '2026-11-12 05:27:07', 'تم استلام المبلغ نقداً');
INSERT INTO `payments` (`id`, `order_id`, `method`, `status`, `transaction_ref`, `amount`, `paid_at`, `notes`) VALUES ('401f1f25-4bc5-4e13-8b35-84d656b3fd70', 'ae705ffb-7a87-4e2e-bdcd-2a63e6d61267', 'cash_on_delivery', 'pending', NULL, '88.00', '2026-11-12 05:27:07', 'الدفع عند الاستلام كاش');
INSERT INTO `payments` (`id`, `order_id`, `method`, `status`, `transaction_ref`, `amount`, `paid_at`, `notes`) VALUES ('53310471-94cb-4c02-9159-6479a7010a40', '511dfa28-c168-40d5-b6c4-b0aaa39f75ca', 'sadad', 'paid', 'SADAD-TX-994182', '74.00', '2026-11-12 06:09:17', 'تم السداد بنجاح عبر خدمة سداد المدار');
INSERT INTO `payments` (`id`, `order_id`, `method`, `status`, `transaction_ref`, `amount`, `paid_at`, `notes`) VALUES ('59fe80ee-d5e5-4179-9673-21817ae9b1c2', 'e3429d8c-ec43-4aa2-aaa0-94050213d773', 'cash_on_delivery', 'paid', NULL, '89.00', '2026-11-12 09:23:50', NULL);
INSERT INTO `payments` (`id`, `order_id`, `method`, `status`, `transaction_ref`, `amount`, `paid_at`, `notes`) VALUES ('667f4762-6665-407d-8efe-b7b25aac1816', 'abfb3eb7-be82-4adc-8e9b-6f52a3c2968b', 'cash_on_delivery', 'pending', NULL, '145.00', '2026-11-12 05:27:07', 'الدفع كاش عند الاستلام والمعاينة');
INSERT INTO `payments` (`id`, `order_id`, `method`, `status`, `transaction_ref`, `amount`, `paid_at`, `notes`) VALUES ('921e04da-4f85-45e0-8cfd-b7d466f05504', 'e710aba1-a57a-4455-b901-c3040901ba8e', 'bank_transfer', 'paid', NULL, '173.00', NULL, NULL);

-- جدول price_change_logs
TRUNCATE TABLE `price_change_logs`;
INSERT INTO `price_change_logs` (`id`, `item_type`, `item_id`, `item_name`, `old_price`, `new_price`, `changed_by_user_id`, `reason`, `changed_at`) VALUES (1, 'flower', 4, 'فاوانيا ملكية فاخرة', '8.00', '9.00', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'تعديل السعر بناءً على تكلفة الشحنة الهولندية الجديدة', '2026-11-12 05:27:07');
INSERT INTO `price_change_logs` (`id`, `item_type`, `item_id`, `item_name`, `old_price`, `new_price`, `changed_by_user_id`, `reason`, `changed_at`) VALUES (2, 'bouquet', 4, 'الباقة الملكية', '115.00', '120.00', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'إضافة لمسات شريط مخملي فاخر وعناصر إضافية للباقة', '2026-11-12 05:27:07');
INSERT INTO `price_change_logs` (`id`, `item_type`, `item_id`, `item_name`, `old_price`, `new_price`, `changed_by_user_id`, `reason`, `changed_at`) VALUES (3, 'delivery_zone', 7, 'مصراتة — كافة مناطق مصراتة', '15.00', '16.00', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'تعديل السعر من لوحة الإدارة', '2026-11-12 10:09:26');
INSERT INTO `price_change_logs` (`id`, `item_type`, `item_id`, `item_name`, `old_price`, `new_price`, `changed_by_user_id`, `reason`, `changed_at`) VALUES (4, 'delivery_zone', 7, 'مصراتة — كافة مناطق مصراتة', '16.00', '17.00', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'تعديل السعر من لوحة الإدارة', '2026-11-12 10:09:27');
INSERT INTO `price_change_logs` (`id`, `item_type`, `item_id`, `item_name`, `old_price`, `new_price`, `changed_by_user_id`, `reason`, `changed_at`) VALUES (5, 'delivery_zone', 7, 'مصراتة — كافة مناطق مصراتة', '17.00', '16.00', '0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'تعديل السعر من لوحة الإدارة', '2026-11-12 10:09:30');

-- جدول roles
TRUNCATE TABLE `roles`;
INSERT INTO `roles` (`id`, `name`, `display_name`, `description`) VALUES (1, 'admin', 'مدير النظام', 'صلاحية كاملة لإدارة المتجر والأسعار والكوبونات والتقارير');
INSERT INTO `roles` (`id`, `name`, `display_name`, `description`) VALUES (2, 'florist', 'منسّق زهور', 'استلام وتجهيز باقات الاستوديو وتخصيم المخزون ومراجعة ملاحظات الزبائن');
INSERT INTO `roles` (`id`, `name`, `display_name`, `description`) VALUES (3, 'driver', 'مندوب توصيل', 'استلام الطلبات، فتح الموقع على خرائط جوجل وتأكيد التسليم');
INSERT INTO `roles` (`id`, `name`, `display_name`, `description`) VALUES (4, 'customer', 'زبون المتجر', 'تصميم الباقات وتأكيد الطلبات وتتبعها وتقييم الخدمة');

-- جدول user_roles
TRUNCATE TABLE `user_roles`;
INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`) VALUES ('0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 1, '2026-11-12 05:27:07');
INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`) VALUES ('1ab2c569-82bb-43be-a3f6-403199c8cbec', 4, '2026-11-12 05:27:07');
INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`) VALUES ('1db2388a-2162-4cc3-8511-bc167e8932cb', 2, '2026-11-12 05:27:07');
INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`) VALUES ('60d4c14a-7bef-40c2-9843-219f3a9a87b1', 4, '2026-11-12 05:27:07');
INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`) VALUES ('6c4ec5ef-a031-48b2-8cc7-3d2595fe5209', 2, '2026-11-12 09:45:48');
INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`) VALUES ('9fbdbae7-64d9-4e47-9cb6-4076a4786d2f', 4, '2026-11-12 05:27:07');
INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`) VALUES ('a1f349a5-163b-43da-b706-22b9e452cf03', 3, '2026-11-12 05:27:07');
INSERT INTO `user_roles` (`user_id`, `role_id`, `assigned_at`) VALUES ('dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 3, '2026-11-12 05:27:07');

-- جدول users
TRUNCATE TABLE `users`;
INSERT INTO `users` (`id`, `full_name`, `phone`, `email`, `password_hash`, `avatar_url`, `status`, `created_at`, `updated_at`) VALUES ('0ec949d9-7704-43ea-b8ee-5f19e86d40d4', 'محمد المنفي', '0911111111', 'admin@maska.ly', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', NULL, 'active', '2026-11-12 05:27:07', '2026-11-12 05:27:07');
INSERT INTO `users` (`id`, `full_name`, `phone`, `email`, `password_hash`, `avatar_url`, `status`, `created_at`, `updated_at`) VALUES ('1ab2c569-82bb-43be-a3f6-403199c8cbec', 'أحمد الفيتوري', '0926666666', 'ahmed@gmail.com', 'b041c0aeb35bb0fa4aa668ca5a920b590196fdaf9a00eb852c9b7f4d123cc6d6', NULL, 'active', '2026-11-12 05:27:07', '2026-11-12 05:27:07');
INSERT INTO `users` (`id`, `full_name`, `phone`, `email`, `password_hash`, `avatar_url`, `status`, `created_at`, `updated_at`) VALUES ('1db2388a-2162-4cc3-8511-bc167e8932cb', 'فاطمة الورفلي', '0912222222', 'florist@maska.ly', '7e61e01042c46e62114fea770d3961cd725e5fe48edac446ed2644ea47d9c8fd', NULL, 'active', '2026-11-12 05:27:07', '2026-11-12 05:27:07');
INSERT INTO `users` (`id`, `full_name`, `phone`, `email`, `password_hash`, `avatar_url`, `status`, `created_at`, `updated_at`) VALUES ('60d4c14a-7bef-40c2-9843-219f3a9a87b1', 'سارة المحمودي', '0915555555', 'sara@gmail.com', 'b041c0aeb35bb0fa4aa668ca5a920b590196fdaf9a00eb852c9b7f4d123cc6d6', NULL, 'active', '2026-11-12 05:27:07', '2026-11-12 05:27:07');
INSERT INTO `users` (`id`, `full_name`, `phone`, `email`, `password_hash`, `avatar_url`, `status`, `created_at`, `updated_at`) VALUES ('6c4ec5ef-a031-48b2-8cc7-3d2595fe5209', 'آية الطرابلسي', '0913333333', 'aya@maska.ly', '7e61e01042c46e62114fea770d3961cd725e5fe48edac446ed2644ea47d9c8fd', NULL, 'active', '2026-11-12 09:45:48', '2026-11-12 09:45:48');
INSERT INTO `users` (`id`, `full_name`, `phone`, `email`, `password_hash`, `avatar_url`, `status`, `created_at`, `updated_at`) VALUES ('9fbdbae7-64d9-4e47-9cb6-4076a4786d2f', 'نور الهدى الشريف', '0917777777', 'nour@gmail.com', 'b041c0aeb35bb0fa4aa668ca5a920b590196fdaf9a00eb852c9b7f4d123cc6d6', NULL, 'active', '2026-11-12 05:27:07', '2026-11-12 05:27:07');
INSERT INTO `users` (`id`, `full_name`, `phone`, `email`, `password_hash`, `avatar_url`, `status`, `created_at`, `updated_at`) VALUES ('a1f349a5-163b-43da-b706-22b9e452cf03', 'معتز القماطي', '0924444444', 'driver2@maska.ly', '494d022492052a06f8f81949639a1d148c1051fa3d4e4688fbd96efe649cd382', NULL, 'active', '2026-11-12 05:27:07', '2026-11-12 05:27:07');
INSERT INTO `users` (`id`, `full_name`, `phone`, `email`, `password_hash`, `avatar_url`, `status`, `created_at`, `updated_at`) VALUES ('dc81ad09-3702-4ece-b7cb-bebe08cc3bd9', 'طارق الزوي', '0923333333', 'driver1@maska.ly', '494d022492052a06f8f81949639a1d148c1051fa3d4e4688fbd96efe649cd382', NULL, 'active', '2026-11-12 05:27:07', '2026-11-12 05:27:07');

SET FOREIGN_KEY_CHECKS = 1;

