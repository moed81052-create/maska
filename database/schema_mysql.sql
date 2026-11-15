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

