// =============================================================================
// خادم الباك إند الرئيسي لمشروع مسكة | MASKA BACKEND SERVER
// مبني بتقنية Node.js + Express.js 5 وقاعدة بيانات MySQL 8.0 مع دعم SQLite
// =============================================================================

// تحميل متغيرات البيئة من ملف .env تلقائياً (Native Node.js feature)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch (e) {}
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./database/db.js');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

// =============================================================================
// 1. البرمجيات الوسيطة الأساسية (Core Middlewares)
// =============================================================================

// تفعيل CORS للسماح بالطلبات من أي واجهة أمامية
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// تحليل حزم البيانات القادمة بصيغة JSON و URL-Encoded ودعم رفع الصور عالية الدقة
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// سجل خفيف للطلبات أثناء التطوير (Request Logger)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.originalUrl.startsWith('/api')) {
      const duration = Date.now() - start;
      console.log(`[API] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// =============================================================================
// 2. موجهات الواجهات البرمجية (API Routers)
// =============================================================================

const apiRouter = express.Router();

// فحص سلامة الخادم وقاعدة البيانات (Health Check Endpoint for Docker & Monitoring)
apiRouter.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  try {
    if (db.isMySQL && db.pool) {
      await db.pool.query('SELECT 1');
    }
  } catch (err) {
    dbStatus = 'degraded: ' + (err.message || 'connection issue');
  }

  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    service: 'maska-site',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      type: db.isMySQL ? 'MySQL 8.0' : 'SQLite',
      status: dbStatus
    },
    version: '1.0.0'
  });
});

// -----------------------------------------------------------------------------
// أ. المصادقة وتسجيل الدخول والحسابات (Authentication & Users)
// -----------------------------------------------------------------------------

// تسجيل دخول (زبون أو إدارة أو منسق أو سائق)
apiRouter.post('/auth/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'رقم الهاتف وكلمة المرور مطلوبان لتسجيل الدخول'
      });
    }

    const user = await db.authenticateUser(String(phone).trim(), String(password).trim());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'بيانات الدخول غير صحيحة أو الحساب غير مفعّل'
      });
    }

    res.json({
      success: true,
      message: `مرحباً بك مجدداً يا ${user.full_name} 🌸`,
      user
    });
  } catch (err) {
    next(err);
  }
});

// تسجيل حساب زبون جديد
apiRouter.post('/auth/register', async (req, res, next) => {
  try {
    const { fullName, phone, password } = req.body;
    if (!fullName || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'الاسم الكامل، رقم الهاتف، وكلمة المرور حقول إجبارية'
      });
    }

    const newUser = await db.registerCustomer(req.body);
    res.status(201).json({
      success: true,
      message: 'تم إنشاء حسابك بنجاح في مسكة 🌸',
      user: newUser
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// أ-2. إدارة المستخدمين والطاقم (Users & Staff Management)
// -----------------------------------------------------------------------------

// جلب قائمة المستخدمين والطاقم (فلترة حسب الدور أو البحث)
apiRouter.get('/users', async (req, res, next) => {
  try {
    const { role, search } = req.query;
    const users = await db.getAllUsersList({ role, search });
    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    next(err);
  }
});

// إنشاء مستخدم أو عضو طاقم جديد (سائق، منسق، مدير، زبون)
apiRouter.post('/users', async (req, res, next) => {
  try {
    const { fullName, phone, password, role } = req.body;
    if (!fullName || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'الاسم الكامل، رقم الهاتف، وكلمة المرور حقول إجبارية'
      });
    }

    const newUser = await db.createUserWithRole(req.body);
    res.status(201).json({
      success: true,
      message: `تمت إضافة ${newUser.role_display || 'المستخدم'} بنجاح 🌸`,
      data: newUser
    });
  } catch (err) {
    next(err);
  }
});

// تحديث حالة المستخدم (نشط / معطل)
apiRouter.patch('/users/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const result = await db.updateUserStatus(req.params.id, status);
    res.json({
      success: true,
      message: 'تم تحديث حالة الحساب بنجاح',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// حذف مستخدم
apiRouter.delete('/users/:id', async (req, res, next) => {
  try {
    await db.deleteUser(req.params.id);
    res.json({
      success: true,
      message: 'تم حذف المستخدم بنجاح'
    });
  } catch (err) {
    next(err);
  }
});

// إضافة سائق جديد كاختصار
apiRouter.post('/drivers', async (req, res, next) => {
  try {
    const data = { ...req.body, role: 'driver' };
    const newDriver = await db.createUserWithRole(data);
    res.status(201).json({
      success: true,
      message: 'تم تسجيل الكابتن بنجاح 🚗',
      data: newDriver
    });
  } catch (err) {
    next(err);
  }
});

// إضافة منسق ورد جديد كاختصار
apiRouter.post('/florists', async (req, res, next) => {
  try {
    const data = { ...req.body, role: 'florist' };
    const newFlorist = await db.createUserWithRole(data);
    res.status(201).json({
      success: true,
      message: 'تم تسجيل منسق الورد بنجاح 💐',
      data: newFlorist
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// ب. إحصائيات الداشبورد ولوحة التحكم (Admin & Coordinator Dashboard)
// -----------------------------------------------------------------------------

apiRouter.get('/dashboard/stats', async (req, res, next) => {
  try {
    const stats = await db.getDashboardStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// ج. إدارة الطلبات والتسليم (Orders Management)
// -----------------------------------------------------------------------------

// جلب قائمة كل الطلبات مع التصفية والعدد
apiRouter.get('/orders', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const orders = await db.getAllOrders(limit);
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (err) {
    next(err);
  }
});

// استعلام عن تفاصيل طلب محدد برقم الطلب (Order Details & Tracking)
apiRouter.get('/orders/:orderNumber', async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const details = await db.getOrderDetails(orderNumber);
    if (!details) {
      return res.status(404).json({
        success: false,
        message: `الطلب رقم #${orderNumber} غير موجود`
      });
    }
    res.json({
      success: true,
      data: details
    });
  } catch (err) {
    next(err);
  }
});

// إنشاء وتثبيت طلب جديد (من السلة أو استوديو التصميم المخصص)
apiRouter.post('/orders', async (req, res, next) => {
  try {
    const { recipientName, recipientPhone } = req.body;
    if (!recipientName || !recipientPhone) {
      return res.status(400).json({
        success: false,
        message: 'بيانات المستلم (الاسم ورقم الهاتف) مطلوبة'
      });
    }

    const createdOrder = await db.createOrder(req.body);
    res.status(201).json({
      success: true,
      message: 'تم تأكيد طلبك بنجاح وحفظه في مسكة 🌸',
      data: createdOrder
    });
  } catch (err) {
    next(err);
  }
});

// تحديث مرحلة وحالة الطلب (pending -> preparing -> out_for_delivery -> delivered)
apiRouter.patch('/orders/:orderNumber/status', async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const { status, userId, comment } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'الحالة الجديدة للطلب مطلوبة'
      });
    }

    const updated = await db.updateOrderStatus(orderNumber, status, userId, comment);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `الطلب رقم #${orderNumber} غير موجود`
      });
    }

    res.json({
      success: true,
      message: `تم تحديث حالة الطلب #${orderNumber} بنجاح إلى: ${status}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// إسناد وتوجيه الطلب لطاقم العمل (منسق الورد أو سائق التوصيل)
apiRouter.post('/orders/:orderNumber/assign', async (req, res, next) => {
  try {
    const { orderNumber } = req.params;
    const { floristId, driverId, status, assignedByUserId } = req.body;

    const updated = await db.assignOrderStaff(
      orderNumber,
      { floristId, driverId, status },
      assignedByUserId
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `الطلب رقم #${orderNumber} غير موجود`
      });
    }

    res.json({
      success: true,
      message: `تم توجيه وإسناد الطلب #${orderNumber} بنجاح 🌸`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// د. السائقون والتتبع الجغرافي بالـ GPS (Drivers & Live Tracking)
// -----------------------------------------------------------------------------

// جلب الطلبات الموجهة لسائق معين
apiRouter.get('/driver/orders', async (req, res, next) => {
  try {
    const driverId = req.query.driverId || null;
    const driverOrders = await db.getDriverOrders(driverId);
    res.json({
      success: true,
      count: driverOrders.length,
      data: driverOrders
    });
  } catch (err) {
    next(err);
  }
});

// تحديث حالة السائق (متاح / مشغول / غير متصل)
apiRouter.patch('/driver/status', async (req, res, next) => {
  try {
    const { driverId, status } = req.body;
    if (!driverId || !status) {
      return res.status(400).json({
        success: false,
        message: 'معرف السائق والحالة الجديدة مطلوبان'
      });
    }

    const updated = await db.updateDriverProfileStatus(driverId, status);
    res.json({
      success: true,
      message: `تم تحديث حالة السائق إلى: ${status}`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// جلب قائمة السائقين النشطين ومواقعهم ومركباتهم
apiRouter.get('/drivers', async (req, res, next) => {
  try {
    const drivers = await db.getDriversList();
    res.json({
      success: true,
      count: drivers.length,
      data: drivers
    });
  } catch (err) {
    next(err);
  }
});

// جلب قائمة منسقي الورد المعتمدين في الأتيليه
apiRouter.get('/florists', async (req, res, next) => {
  try {
    const florists = await db.getFloristsList();
    res.json({
      success: true,
      count: florists.length,
      data: florists
    });
  } catch (err) {
    next(err);
  }
});

// تحديث الإحداثيات اللحظية للسائق عبر GPS
apiRouter.post('/drivers/location', async (req, res, next) => {
  try {
    const { driverId, lat, lng, orderId, speed } = req.body;

    if (!driverId || typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'معرف السائق وإحداثيات الموقع (lat, lng) مطلوبة كأرقام'
      });
    }

    await db.updateDriverLocation(driverId, lat, lng, orderId, speed || 0);
    res.json({
      success: true,
      message: 'تم تحديث إحداثيات السائق بنجاح 📍'
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// هـ-2. النظام المالي للعهد النقدية وأرباح التوصيل والتسويات (Driver Custody & Settlements)
// -----------------------------------------------------------------------------

// استرجاع النظرة المالية الشاملة لكافة السائقين للإدارة
apiRouter.get('/financials/drivers', async (req, res, next) => {
  try {
    const data = await db.getAllDriversFinancials();
    res.json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
});

// استرجاع الكشف المالي لسائق محدد (العهدة، الأرباح، وحركات الحساب)
apiRouter.get('/financials/drivers/:id', async (req, res, next) => {
  try {
    const driverId = req.params.id;
    const summary = await db.getDriverFinancialSummary(driverId);
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'السائق غير موجود'
      });
    }
    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    next(err);
  }
});

// تسوية العهدة النقدية واستلام المبالغ من السائق بواسطة الإدارة
apiRouter.post('/financials/settle', async (req, res, next) => {
  try {
    const { driverId, adminId, custodyCleared, driverEarningsDeducted, netCashReceived, notes } = req.body;
    if (!driverId || custodyCleared === undefined) {
      return res.status(400).json({
        success: false,
        message: 'معرف السائق ومبلغ العهدة المراد تسويته حقول مطلوبة'
      });
    }

    const receipt = await db.settleDriverCustody({
      driverId,
      adminId: adminId || '0ec949d9-7704-43ea-b8ee-5f19e86d40d4',
      custodyCleared,
      driverEarningsDeducted: driverEarningsDeducted || 0,
      netCashReceived,
      notes
    });

    res.status(201).json({
      success: true,
      message: `تمت تسوية العهدة بنجاح واستلام المبلغ برقم إيصال ${receipt.settlement_number} 💵`,
      receipt
    });
  } catch (err) {
    next(err);
  }
});

// سجل تاريخ التسويات المالية الشامل للإدارة
apiRouter.get('/financials/settlements', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = await db.getSettlementsHistory(limit);
    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// هـ. مخزون زهور الاستوديو وصور الزوايا (Studio Flower Inventory & Angles)
// -----------------------------------------------------------------------------

// عرض رصيد الزهور المتوفرة وأسعارها وصور زواياها
apiRouter.get('/inventory', async (req, res, next) => {
  try {
    const stock = await db.getFlowerStock();
    res.json({
      success: true,
      count: stock.length,
      data: stock
    });
  } catch (err) {
    next(err);
  }
});

// رفع وتخزين صورة لزاوية الوردة وحفظها محلياً على القرص
apiRouter.post('/upload/flower-angle', async (req, res, next) => {
  try {
    const { angle, fileName, base64Data } = req.body;
    if (!base64Data) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الصورة مفقودة'
      });
    }

    const matches = String(base64Data).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let ext = 'jpg';
    let dataBuffer;

    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('svg')) ext = 'svg';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else ext = 'png';
      dataBuffer = Buffer.from(matches[2], 'base64');
    } else {
      dataBuffer = Buffer.from(base64Data, 'base64');
    }

    const uploadDirPublic = path.join(__dirname, 'public', 'assets', 'flowers', 'uploads');
    const uploadDirAssets = path.join(__dirname, 'assets', 'flowers', 'uploads');
    const uploadDirDist = path.join(__dirname, 'dist', 'assets', 'flowers', 'uploads');

    if (!fs.existsSync(uploadDirPublic)) fs.mkdirSync(uploadDirPublic, { recursive: true });
    if (!fs.existsSync(uploadDirAssets)) fs.mkdirSync(uploadDirAssets, { recursive: true });
    if (fs.existsSync(path.join(__dirname, 'dist'))) {
      if (!fs.existsSync(uploadDirDist)) fs.mkdirSync(uploadDirDist, { recursive: true });
    }

    const safeAngle = (angle || 'angle').replace(/[^a-z0-9_-]/gi, '');
    const cleanFileName = `flower-${safeAngle}-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;

    fs.writeFileSync(path.join(uploadDirPublic, cleanFileName), dataBuffer);
    fs.writeFileSync(path.join(uploadDirAssets, cleanFileName), dataBuffer);
    if (fs.existsSync(path.join(__dirname, 'dist'))) {
      fs.writeFileSync(path.join(uploadDirDist, cleanFileName), dataBuffer);
    }

    const url = `/assets/flowers/uploads/${cleanFileName}`;

    res.json({
      success: true,
      message: 'تم حفظ ورفع صورة الزاوية بنجاح 🌸',
      url
    });
  } catch (err) {
    next(err);
  }
});

// رفع وتخزين أي صورة عامة من الجهاز (باقات، زهور، مناسبات، إلخ)
apiRouter.post('/upload/image', async (req, res, next) => {
  try {
    const { base64Data, category = 'bouquets', fileName = '' } = req.body;
    if (!base64Data) {
      return res.status(400).json({
        success: false,
        message: 'بيانات الصورة مفقودة'
      });
    }

    const matches = String(base64Data).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let ext = 'jpg';
    let dataBuffer;

    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('svg')) ext = 'svg';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
      else ext = 'jpg';
      dataBuffer = Buffer.from(matches[2], 'base64');
    } else {
      dataBuffer = Buffer.from(base64Data, 'base64');
    }

    const safeCat = String(category).toLowerCase().replace(/[^a-z0-9_-]/gi, '') || 'general';
    const uploadDirPublic = path.join(__dirname, 'public', 'assets', 'uploads', safeCat);
    const uploadDirAssets = path.join(__dirname, 'assets', 'uploads', safeCat);
    const uploadDirDist = path.join(__dirname, 'dist', 'assets', 'uploads', safeCat);

    if (!fs.existsSync(uploadDirPublic)) fs.mkdirSync(uploadDirPublic, { recursive: true });
    if (!fs.existsSync(uploadDirAssets)) fs.mkdirSync(uploadDirAssets, { recursive: true });
    if (fs.existsSync(path.join(__dirname, 'dist'))) {
      if (!fs.existsSync(uploadDirDist)) fs.mkdirSync(uploadDirDist, { recursive: true });
    }

    const cleanFileName = `${safeCat}-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;

    fs.writeFileSync(path.join(uploadDirPublic, cleanFileName), dataBuffer);
    fs.writeFileSync(path.join(uploadDirAssets, cleanFileName), dataBuffer);
    if (fs.existsSync(path.join(__dirname, 'dist'))) {
      fs.writeFileSync(path.join(uploadDirDist, cleanFileName), dataBuffer);
    }

    const url = `/assets/uploads/${safeCat}/${cleanFileName}`;

    res.json({
      success: true,
      message: 'تم رفع الصورة بنجاح من جهازك 🌸',
      url
    });
  } catch (err) {
    next(err);
  }
});

// تحديث صورة باقة مباشرة من الجهاز
apiRouter.post('/bouquets/:id/image', async (req, res, next) => {
  try {
    const { base64Data, fileName } = req.body;
    const bouquetId = parseInt(req.params.id, 10);
    if (!base64Data) {
      return res.status(400).json({ success: false, message: 'بيانات الصورة مفقودة' });
    }

    const matches = String(base64Data).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let ext = 'jpg';
    let dataBuffer;
    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('svg')) ext = 'svg';
      else ext = 'jpg';
      dataBuffer = Buffer.from(matches[2], 'base64');
    } else {
      dataBuffer = Buffer.from(base64Data, 'base64');
    }

    const uploadDirPublic = path.join(__dirname, 'public', 'assets', 'uploads', 'bouquets');
    const uploadDirAssets = path.join(__dirname, 'assets', 'uploads', 'bouquets');
    const uploadDirDist = path.join(__dirname, 'dist', 'assets', 'uploads', 'bouquets');

    if (!fs.existsSync(uploadDirPublic)) fs.mkdirSync(uploadDirPublic, { recursive: true });
    if (!fs.existsSync(uploadDirAssets)) fs.mkdirSync(uploadDirAssets, { recursive: true });
    if (fs.existsSync(path.join(__dirname, 'dist'))) {
      if (!fs.existsSync(uploadDirDist)) fs.mkdirSync(uploadDirDist, { recursive: true });
    }

    const cleanFileName = `bouquet-${bouquetId}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(uploadDirPublic, cleanFileName), dataBuffer);
    fs.writeFileSync(path.join(uploadDirAssets, cleanFileName), dataBuffer);
    if (fs.existsSync(path.join(__dirname, 'dist'))) {
      fs.writeFileSync(path.join(uploadDirDist, cleanFileName), dataBuffer);
    }

    const url = `/assets/uploads/bouquets/${cleanFileName}`;
    const updated = await db.updateBouquetImage(bouquetId, url);

    res.json({
      success: true,
      message: 'تم تحديث صورة الباقة بنجاح من جهازك 🌸',
      url,
      bouquet: updated
    });
  } catch (err) {
    next(err);
  }
});

// تحديث صورة زاوية معينة للوردة مباشرة من الجهاز (front, side, top, stem)
apiRouter.post('/flowers/:id/angle', async (req, res, next) => {
  try {
    const flowerId = parseInt(req.params.id, 10);
    const { angle = 'front', base64Data, fileName = '' } = req.body;

    if (!base64Data) {
      return res.status(400).json({ success: false, message: 'بيانات الصورة مفقودة' });
    }

    const matches = String(base64Data).match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let ext = 'jpg';
    let dataBuffer;
    if (matches && matches.length === 3) {
      const mime = matches[1].toLowerCase();
      if (mime.includes('png')) ext = 'png';
      else if (mime.includes('webp')) ext = 'webp';
      else if (mime.includes('svg')) ext = 'svg';
      else ext = 'jpg';
      dataBuffer = Buffer.from(matches[2], 'base64');
    } else {
      dataBuffer = Buffer.from(base64Data, 'base64');
    }

    const uploadDirPublic = path.join(__dirname, 'public', 'assets', 'flowers', 'uploads');
    const uploadDirAssets = path.join(__dirname, 'assets', 'flowers', 'uploads');
    const uploadDirDist = path.join(__dirname, 'dist', 'assets', 'flowers', 'uploads');

    if (!fs.existsSync(uploadDirPublic)) fs.mkdirSync(uploadDirPublic, { recursive: true });
    if (!fs.existsSync(uploadDirAssets)) fs.mkdirSync(uploadDirAssets, { recursive: true });
    if (fs.existsSync(path.join(__dirname, 'dist'))) {
      if (!fs.existsSync(uploadDirDist)) fs.mkdirSync(uploadDirDist, { recursive: true });
    }

    const safeAngle = (angle || 'front').replace(/[^a-z0-9_-]/gi, '');
    const cleanFileName = `flower-${flowerId}-${safeAngle}-${Date.now()}.${ext}`;

    fs.writeFileSync(path.join(uploadDirPublic, cleanFileName), dataBuffer);
    fs.writeFileSync(path.join(uploadDirAssets, cleanFileName), dataBuffer);
    if (fs.existsSync(path.join(__dirname, 'dist'))) {
      fs.writeFileSync(path.join(uploadDirDist, cleanFileName), dataBuffer);
    }

    const url = `/assets/flowers/uploads/${cleanFileName}`;
    const updated = await db.updateFlowerAngleImage(flowerId, safeAngle, url);

    res.json({
      success: true,
      message: `تم تحديث صورة الوردة بنجاح من جهازك 🌸`,
      url,
      angle: safeAngle,
      flower: updated
    });
  } catch (err) {
    next(err);
  }
});

// إضافة صنف ورد جديد مع صوره من كافة الزوايا (أمامي، جانبي، علوي، تفاصيل الساق)
apiRouter.post('/inventory', async (req, res, next) => {
  try {
    const { name_ar, name, unit_price, unitPrice } = req.body;
    const flowerName = name_ar || name;
    if (!flowerName) {
      return res.status(400).json({
        success: false,
        message: 'اسم الزهرة مطلوب'
      });
    }

    const newFlower = await db.addFlower(req.body);
    res.status(201).json({
      success: true,
      message: `تم إضافة صنف الورد "${newFlower.name_ar}" بنجاح مع صور الزوايا 🌸`,
      data: newFlower
    });
  } catch (err) {
    next(err);
  }
});

// تعديل بيانات زهرة بالكامل بما فيها صور الزوايا والمخزون
apiRouter.put('/inventory/:id', async (req, res, next) => {
  try {
    const flowerId = parseInt(req.params.id, 10);
    const updated = await db.updateFlower(flowerId, req.body);
    res.json({
      success: true,
      message: 'تم تحديث بيانات الزهرة وصور زواياها بنجاح 🌸',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// تعديل رصيد مخزون الورد أو سعر الساق
apiRouter.patch('/inventory/:id', async (req, res, next) => {
  try {
    const flowerId = parseInt(req.params.id, 10);
    const { quantity, unitPrice } = req.body;

    if (quantity !== undefined && typeof quantity === 'number') {
      const updated = await db.updateFlowerStock(flowerId, quantity, unitPrice);
      return res.json({
        success: true,
        message: 'تم تحديث رصيد المخزون بنجاح 🌸',
        data: updated
      });
    }

    // إذا تم إرسال حقول أخرى
    const updated = await db.updateFlower(flowerId, req.body);
    res.json({
      success: true,
      message: 'تم تحديث بيانات الزهرة بنجاح 🌸',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// حذف صنف ورد (محمي من الحذف إذا كان مرتبطاً بباقة)
apiRouter.delete('/inventory/:id', async (req, res, next) => {
  try {
    const flowerId = parseInt(req.params.id, 10);
    const result = await db.deleteFlower(flowerId);
    res.json(result);
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

// -----------------------------------------------------------------------------
// هـ2. كتالوج الباقات وتركيبات وتوليفات الورود (Bouquets & Recipes)
// -----------------------------------------------------------------------------

// جلب جميع الباقات مع وصفة وتوليفة الورود الخاصة بها
apiRouter.get('/bouquets', async (req, res, next) => {
  try {
    const bouquets = await db.getAllBouquets();
    res.json({
      success: true,
      count: bouquets.length,
      data: bouquets
    });
  } catch (err) {
    next(err);
  }
});

// جلب تفاصيل باقة محددة مع توليفة ورودها
apiRouter.get('/bouquets/:id', async (req, res, next) => {
  try {
    const bouquetId = parseInt(req.params.id, 10);
    const details = await db.getBouquetDetails(bouquetId);
    if (!details) {
      return res.status(404).json({
        success: false,
        message: 'الباقة غير موجودة'
      });
    }
    res.json({
      success: true,
      data: details
    });
  } catch (err) {
    next(err);
  }
});

// إنشاء باقة جديدة مع تحديد كم وردة من كل نوع مع شرط صارم بأن تكون من المخزون المسجل
apiRouter.post('/bouquets', async (req, res, next) => {
  try {
    const { title, price, flowers } = req.body;
    if (!title || !price) {
      return res.status(400).json({
        success: false,
        message: 'عنوان وسعر الباقة حقول إجبارية'
      });
    }
    if (!Array.isArray(flowers) || flowers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب اختيار وتحديد الورود المكونة للباقة من قائمة الورود المعتمدة في المخزون'
      });
    }

    const created = await db.createBouquet(req.body);
    res.status(201).json({
      success: true,
      message: `تم إنشاء باقة "${created.title}" بتوليفة الورود المحددة بنجاح 💐`,
      data: created
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

// تعديل باقة وتحديث توليفة ورودها
apiRouter.put('/bouquets/:id', async (req, res, next) => {
  try {
    const bouquetId = parseInt(req.params.id, 10);
    const updated = await db.updateBouquet(bouquetId, req.body);
    res.json({
      success: true,
      message: `تم تعديل باقة "${updated.title}" بنجاح 💐`,
      data: updated
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
});

// حذف باقة
apiRouter.delete('/bouquets/:id', async (req, res, next) => {
  try {
    const bouquetId = parseInt(req.params.id, 10);
    const result = await db.deleteBouquet(bouquetId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// و. كوبونات التخفيض والعروض الخاصة للأدمن (Discount Coupons)
// -----------------------------------------------------------------------------

// جلب كافة الكوبونات
apiRouter.get('/coupons', async (req, res, next) => {
  try {
    const coupons = await db.getAllCoupons();
    res.json({
      success: true,
      count: coupons.length,
      data: coupons
    });
  } catch (err) {
    next(err);
  }
});

// إنشاء كوبون جديد بواسطة الإدارة
apiRouter.post('/coupons', async (req, res, next) => {
  try {
    const { code, discountValue, adminId } = req.body;
    if (!code || !discountValue) {
      return res.status(400).json({
        success: false,
        message: 'كود الكوبون وقيمة الخصم حقول إجبارية'
      });
    }

    const newCoupon = await db.createCoupon(adminId || null, req.body);
    res.status(201).json({
      success: true,
      message: 'تم إنشاء الكوبون بنجاح 🏷️',
      data: newCoupon
    });
  } catch (err) {
    next(err);
  }
});

// تفعيل أو تعطيل كوبون
apiRouter.patch('/coupons/:id/status', async (req, res, next) => {
  try {
    const couponId = parseInt(req.params.id, 10);
    const { isActive } = req.body;

    const updated = await db.toggleCouponStatus(couponId, isActive);
    res.json({
      success: true,
      message: 'تم تحديث حالة تفعيل الكوبون بنجاح',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// حذف كوبون
apiRouter.delete('/coupons/:id', async (req, res, next) => {
  try {
    const couponId = parseInt(req.params.id, 10);
    const result = await db.deleteCoupon(couponId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// التحقق من صحة الكوبون وتطبيق الخصم عند الدفع
apiRouter.post('/coupons/validate', async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'كود الخصم مطلوب للتحقق'
      });
    }

    const result = await db.validateCoupon(code, subtotal || 0);
    if (!result.valid) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// ز. تقييمات وملاحظات الزبائن وتفاعل الإدارة (Customer Reviews & Ratings)
// -----------------------------------------------------------------------------

// جلب التقييمات المعتمدة (مع إمكانية تصفية المميزة لصفحة الهوم)
apiRouter.get('/reviews', async (req, res, next) => {
  try {
    const onlyFeatured = req.query.featured === 'true';
    const reviews = await db.getCustomerReviews({ onlyApproved: true, onlyFeatured });
    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (err) {
    next(err);
  }
});

// إضافة زبون لتقييمه وملاحظاته مع النجوم (1-5)
apiRouter.post('/reviews', async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment) {
      return res.status(400).json({
        success: false,
        message: 'نص التقييم والملاحظة مطلوب'
      });
    }

    const review = await db.addCustomerReview(req.body);
    res.status(201).json({
      success: true,
      message: 'شكراً لتقييمك وملاحظاتك القيمة 🌸',
      data: review
    });
  } catch (err) {
    next(err);
  }
});

// رد الإدارة الرسمي على تقييم الزبون
apiRouter.post('/reviews/:id/reply', async (req, res, next) => {
  try {
    const reviewId = req.params.id;
    const { replyText } = req.body;

    if (!replyText) {
      return res.status(400).json({
        success: false,
        message: 'نص الرد مطلوب'
      });
    }

    const updated = await db.replyToReview(reviewId, replyText);
    res.json({
      success: true,
      message: 'تم إرسال رد الإدارة بنجاح',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// تمييز التقييم في الصفحة الرئيسية (Featured Review)
apiRouter.patch('/reviews/:id/featured', async (req, res, next) => {
  try {
    const reviewId = req.params.id;
    const { isFeatured } = req.body;

    const updated = await db.toggleReviewFeatured(reviewId, isFeatured);
    res.json({
      success: true,
      message: 'تم تعديل تمييز التقييم في الواجهة الرئيسية',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// ح. الملاحظات والاقتراحات العامة (Customer Feedback Box)
// -----------------------------------------------------------------------------

apiRouter.get('/feedback', async (req, res, next) => {
  try {
    const feedbackList = await db.getAllCustomerFeedback();
    res.json({
      success: true,
      count: feedbackList.length,
      data: feedbackList
    });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/feedback', async (req, res, next) => {
  try {
    const { name, subject, message } = req.body;
    if (!name || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'الاسم والموضوع والرسالة حقول إجبارية'
      });
    }

    const result = await db.submitCustomerFeedback(req.body);
    res.status(201).json({
      success: true,
      message: 'تم استلام ملاحظتك واقتراحك وسيقوم فريق مسكة بمراجعته 🌸',
      data: result
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------------------------
// ط. إدارة تسعير المناطق والزهور وسجل الرقابة (Pricing Management & Audit)
// -----------------------------------------------------------------------------

// أسعار التوصيل حسب المناطق والمدن
apiRouter.get('/pricing/zones', async (req, res, next) => {
  try {
    const zones = await db.getDeliveryZonesPricing();
    res.json({
      success: true,
      data: zones
    });
  } catch (err) {
    next(err);
  }
});

// تعديل بيانات منطقة توصيل (الاسم، المدينة، السعر، النطاق الجغرافي والدائرة)
apiRouter.patch('/pricing/zones/:id', async (req, res, next) => {
  try {
    const zoneId = parseInt(req.params.id, 10);
    const { adminId, reason } = req.body;

    const updated = await db.updateDeliveryZone(zoneId, req.body, adminId, reason);
    res.json({
      success: true,
      message: 'تم تحديث بيانات ومنطقة التوصيل بنجاح 📍',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// إضافة منطقة توصيل جغرافية جديدة (دائرة أو مربع أو نطاق محدد)
apiRouter.post('/pricing/zones', async (req, res, next) => {
  try {
    const { zone_name } = req.body;
    if (!zone_name) {
      return res.status(400).json({ success: false, message: 'اسم المنطقة مطلوب' });
    }

    const created = await db.createDeliveryZone(req.body, req.body.adminId);
    res.status(201).json({
      success: true,
      message: `تم إضافة منطقة التوصيل "${created.zone_name}" بنجاح 📍`,
      data: created
    });
  } catch (err) {
    next(err);
  }
});

// حذف / إلغاء تفعيل منطقة توصيل
apiRouter.delete('/pricing/zones/:id', async (req, res, next) => {
  try {
    const zoneId = parseInt(req.params.id, 10);
    await db.deleteDeliveryZone(zoneId);
    res.json({
      success: true,
      message: 'تم حذف منطقة التوصيل بنجاح'
    });
  } catch (err) {
    next(err);
  }
});

// تعديل سعر ساق ورد مع تسجيل سجل التغيير
apiRouter.patch('/pricing/flowers/:id', async (req, res, next) => {
  try {
    const flowerId = parseInt(req.params.id, 10);
    const { price, adminId, reason } = req.body;

    if (typeof price !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'السعر الجديد للساق مطلوب كرقم'
      });
    }

    const updated = await db.updateFlowerPrice(flowerId, price, adminId, reason);
    res.json({
      success: true,
      message: 'تم تعديل سعر ساق الورد بنجاح',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// تعديل سعر باقة جاهزة مع تسجيل سجل التغيير
apiRouter.patch('/pricing/bouquets/:id', async (req, res, next) => {
  try {
    const bouquetId = parseInt(req.params.id, 10);
    const { price, adminId, reason } = req.body;

    if (typeof price !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'السعر الجديد للباقة مطلوب كرقم'
      });
    }

    const updated = await db.updateBouquetPrice(bouquetId, price, adminId, reason);
    res.json({
      success: true,
      message: 'تم تعديل سعر الباقة بنجاح',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// استعراض سجل رقابة الأسعار وتاريخ التغييرات
apiRouter.get('/pricing/history', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const history = await db.getPriceChangeHistory(limit);
    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// 10. محادثة خبير مسكة للذكاء الاصطناعي (AI Florist Chat & Consultation)
// =============================================================================

// دالة فحص وتقييد النطاق حصرياً بمجال الزهور والباقات
function isStrictlyFlowerRelated(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase().trim();

  // 1. القائمة السوداء للمواضيع الخارجة تماماً عن السياق
  const offTopicPatterns = [
    /كود|برمج|بايثون|جافاسكريبت|html|css|sql|function|react|svelte|php|c\+\+|linux|windows|bug|error|script/i,
    /سياس|حكوم|رئيس|وزير|انتخاب|برلمان|حرب|جيش|سفار|دولة|عسكر|معاهدة|قانون|أحزاب|مظاهر/i,
    /مبارا|كرة|كورة|دوري|ريال|برشلونة|ميسي|رونالدو|كأس|هدف|لاعب|نادي|كلاسيكو|منتخب|فريق|مدرب|تشكيلة منتخب/i,
    /طبخ|وصفة|بيتزا|شاورما|برجر|معكرونة|كيكة|أكلة|مقادير|طريقة عمل|طبخة/i,
    /رياضيات|معادلة|حساب التفاضل|تكامل|فيزياء|كيمياء|فلسفة|فلك|كواكب|مجرة/i,
    /طقس|أمطار|درجة حرارة|دولار|يورو|سعر الصرف|عملات|بيتكوين|تداول|أسهم/i,
    /سيارة|محرك|مركبة|تويوتا|هيونداي|ميكانيك|بنزين/i
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(t)) {
      return false;
    }
  }

  // 2. الكلمات الجوهرية للزهور والباقات والنباتات
  const floralKeywords = [
    /ورد|زهر|باق|فلور|توليب|جوري|بيوني|فاوانيا|جيبسوفيلا|جبسوفيلا|طفل|أوكالبتوس|اوكالبتوس|أوركيد|اوركيد|شمس|ليلي|زنابق/i,
    /مزهر|فازة|ساق|سيقان|بتل|عطر الورد|نضار|ذبول|سقي|رائحة الورد|نبات/i,
    /مسكة|أتيليه/i
  ];

  const hasDirectFlowerMention = floralKeywords.some(regex => regex.test(t));
  if (hasDirectFlowerMention) return true;

  // 3. كلمات التغليف والمناسبات إذا اقترنت بسياق الهدية أو التنسيق للباقة
  const secondaryKeywords = [
    /تغليف|كرافت|شريط ساتان|ختم شمعي|كرت إهداء/i,
    /تنسيق هرمي|تنسيق دائري|تنسيق بوهيمي|تنسيق قلب/i
  ];

  return secondaryKeywords.some(regex => regex.test(t));
}

// محرك خبير مسكة للزهور الذكي للإجابات المتخصصة
function generateLocalFloralResponse(query) {
  const q = query.toLowerCase();

  // 1. معاني الورود ودلالات الألوان
  if (q.includes('معنى') || q.includes('دلالة') || q.includes('يرمز') || q.includes('رمز')) {
    if (q.includes('أحمر') || q.includes('حمراء') || q.includes('جوري')) {
      return '🌹 **الورد الجوري الأحمر المخملي:** رمز الخلود للحب العميق، الشغف، والتقدير الصادق. اختياره في الباقة يعبر عن مشاعر صادقة وقوية تليق بالمناسبات الرومانسية الكبرى وأعياد الحب والزواج.';
    }
    if (q.includes('أبيض') || q.includes('بيضاء') || q.includes('توليب')) {
      return '🤍 **التوليب والورد الأبيض النقي:** يرمز إلى الصفاء، البراءة، النقاء، وبداية عهد جديد مشرق. يُعد الخيار الملكي الأول لمناسبات الزفاف، الخطوبة، وحفلات الاستقبال الفاخرة.';
    }
    if (q.includes('وردي') || q.includes('بيوني') || q.includes('فاوانيا')) {
      return '🌸 **البيوني والورد الوردي الناعم:** تُلقب الفاوانيا بـ "ملكة الزهور"، وترمز إلى الرقي، السعادة الزوجية، الحظ الوفير، والامتنان الرقيق. مثالية للتعبير عن المودة والتقدير الراقي.';
    }
    if (q.includes('أصفر') || q.includes('شمس') || q.includes('ذهبي')) {
      return '🌻 **عباد الشمس الذهبي والورد الأصفر:** رمز البهجة، الطاقة الإيجابية، الصداقة المتينة، والوفاء المشرق. اختيار مبهج ومميز لحفلات التخرج وتهنئة النجاح والتألق!';
    }
    if (q.includes('أوركيد')) {
      return '🪷 **زهرة الأوركيد العاجية:** ترمز إلى الفخامة الاستثنائية، الجمال النادر، والأناقة الملكية التي تدوم طويلاً.';
    }
    return '🌸 **دلالات ألوان الزهور في مسكة:**\n- 🔴 **الأحمر:** حب عميق وتقدير مهيب.\n- ⚪ **الأبيض:** نقاء، سلام، وبدايات جديدة.\n- 🌸 **الوردي:** امتنان، مودة، ورقة متناهية.\n- 🟡 **الأصفر والذهبي:** بهجة، نجاح، وصداقة مخلصة.\n- 🌿 **الأخضر المريمي:** أصالة ونضارة مستمرة.';
  }

  // 2. نصائح العناية وإطالة عمر الباقة
  if (q.includes('عناية') || q.includes('أعتني') || q.includes('نضارة') || q.includes('ماء') || q.includes('مزهرية') || q.includes('تدوم') || q.includes('يعيش')) {
    return '💧 **نصائح خبير مسكة للعناية بالزهور وإطالة نضارتها حتى 14 يوماً:**\n\n1. **القص المائل 45°:** اقطع 2 سم من أسفل كل ساق بمقص حاد وبزاوية مائلة تحت ماء فاتر كل يومين لمضاعفة امتصاص الماء.\n2. **تنظيف السيقان:** تخلص من أي أوراق تقع تحت خط الماء في المزهرية لمنع تكاثر البكتيريا وتعفن الماء.\n3. **الموقع المثالي:** ضع الباقة في مكان بارد معتدل، بعيداً عن أشعة الشمس المباشرة، وتيارات التكييف، وأطباق الفاكهة (غاز الإيثيلين المنبعث من الموز والتفاح يسرع ذبول الورد).\n4. **تغيير الماء:** استبدل ماء المزهرية بماء نقي كل 48 ساعة، ويمكنك إضافة نصف ملعقة صغيرة من السكر مع قطرتين من الليمون للحفاظ على تغذية البتلات!';
  }

  // 3. اختيار الباقة المناسبة حسب المناسبة
  if (q.includes('مناسبة') || q.includes('زفاف') || q.includes('عرس') || q.includes('تخرج') || q.includes('عيد ميلاد') || q.includes('اعتذار')) {
    if (q.includes('تخرج') || q.includes('نجاح')) {
      return '🎓 **باقة التخرج والنجاح المقترحة:** ننصح بتنسيق هرمي ملكي يدمج عباد الشمس الذهبي المشرق مع ورود الجوري الحمراء وأغصان الأوكالبتوس، مع ورق تغليف أسود سهرة ملوكي أو كرافت فاخر وشريط ساتان ذهبي ليناسب فخامة الإنجاز!';
    }
    if (q.includes('زفاف') || q.includes('عرس') || q.includes('خطوب')) {
      return '💍 **باقة الزفاف والخطوبة الملكية:** الخيار الأمثل هو مزيج التوليب الأبيض النقي مع الفاوانيا (البيوني) والزهور العاجية، محاطة بسحاب الجيبسوفيلا وورق تغليف عاجي ناعم بختم شمعي أحمر مذهب.';
    }
    if (q.includes('اعتذار') || q.includes('مودة')) {
      return '🕊️ **باقة الاعتذار والتصافي:** ننصح بباقة دائرية متناسقة تجمع الجوري الوردي الفاتح والزنابق العطرة وورق الكرافت الإيطالي، مصحوبة بكرت إهداء مكتوب بكلمات دافئة تلامس القلب.';
    }
    return '🎁 **اقتراحات مسكة لمختلف المناسبات:** لكل مناسبة تركيبة خاصة في استوديونا: أعياد الميلاد (ألوان ربيعية زاهية)، التخرج (ألوان ملكية جريئة)، والزفاف (أبيض وعاجي ناصع). يمكنك اختيار المناسبة وسننسقها لك فوراً!';
  }

  // 4. التغليف والأشرطة والأختام
  if (q.includes('تغليف') || q.includes('ورق') || q.includes('شريط') || q.includes('ختم') || q.includes('شمع')) {
    return '🎀 **دليل التغليف الملكي في مسكة:**\n- **ورق الكرافت الإيطالي:** يمنح إحساساً كلاسيكياً بالطبيعة والأصالة، ويتناغم مع جميع ألوان الزهور.\n- **أسود سهرة فاحم:** يُبرز تباين الورود الحمراء والوردية بتأثير سينمائي عصري فائق الفخامة.\n- **وردي مخملي وزيتي مسكة:** مثالي للمناسبات الراقية والهادئة.\n- **الختم الشمعي الملوكي:** يوثق رسالتك بطابع أرستقراطي ويُسكب يدوياً بأختام مسكة الرسمية (تاج المحبة، غصن الزيتون، أو زهرة اللوتس).';
  }

  // 5. إجابة استشارية عامة في نطاق الزهور
  return '🌸 **مرحباً بك في استوديو مسكة للزهور الطبيعية!**\nيسعدني مساعدتك في اختيار أرقى الزهور، شرح دلالاتها، اقتراح أفضل تنسيقات الألوان والأغلفة المناسبة، أو إرشادك لأفضل طرق العناية بالباقة لتدوم نضرة ومزهرة في منزلك. كيف تحب أن نبدأ باقتك اليوم؟';
}

// نقطة الاتصال لمحادثة الذكاء الاصطناعي مع القيود الصارمة
apiRouter.post('/ai/chat', async (req, res, next) => {
  try {
    const { message, history, context } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'نص الرسالة مطلوب'
      });
    }

    const trimmedMsg = message.trim();

    // 1. التحقق الصارم من القيد: هل السؤال ضمن اختصاص الزهور والباقات فقط؟
    const isFlowerTopic = isStrictlyFlowerRelated(trimmedMsg);

    if (!isFlowerTopic) {
      return res.json({
        success: true,
        reply: 'عذراً، لا يمكنني الإجابة على هذا السؤال لأنه خارج سياق اختصاصي في الزهور والباقات 🌸. يسعدني جداً مساعدتك في كل ما يتعلق بأنواع الورد، معانيه، تنسيق الباقات، وطرق العناية بالزهور!',
        isOffTopic: true,
        source: 'guardrail'
      });
    }

    // 2. إذا كان السؤال ضمن اختصاص الزهور، التحقق من توفر مفتاح Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.length > 20 && !apiKey.includes('DEMO')) {
      try {
        const systemPrompt = `أنت "منسق مسكة الذكي" - خبير استشاري بالزهور والباقات في أتيليه مسكة للزهور بليبيا.
أجب بأسلوب فاخر وودود وموجز ومفيد مع إيموجيات لطيفة.
قيد إلزامي وحاسم: إذا كان سؤال الزبون خارج نطاق الزهور والورود والباقات (مثل السياسة، البرمجة، الرياضة، الطبخ، الأخبار العامة)، يجب الرد حصراً بهذه الجملة فقط:
"عذراً، لا يمكنني الإجابة على هذا السؤال لأنه خارج سياق اختصاصي في الزهور والباقات 🌸. يسعدني جداً مساعدتك في كل ما يتعلق بأنواع الورد، معانيه، تنسيق الباقات، وطرق العناية بالزهور!"

سؤال الزبون: ${trimmedMsg}`;

        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: systemPrompt }]
              }
            ]
          }),
          signal: AbortSignal.timeout(7000)
        });

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText && candidateText.trim()) {
            return res.json({
              success: true,
              reply: candidateText.trim(),
              isOffTopic: false,
              source: 'gemini'
            });
          }
        }
      } catch (geminiErr) {
        console.log('[AI Chat] Gemini API unavailable or timed out, using floral knowledge engine:', geminiErr.message);
      }
    }

    // 3. المحرك المحلي الذكي للزهور (Local Floral Intelligence Engine)
    const localReply = generateLocalFloralResponse(trimmedMsg);
    return res.json({
      success: true,
      reply: localReply,
      isOffTopic: false,
      source: 'local_brain'
    });

  } catch (err) {
    next(err);
  }
});

// معالجة أي رابط API غير معروف داخل apiRouter
apiRouter.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'واجهة برمجية غير معروفة (API Endpoint Not Found)'
  });
});

// ربط الموجه العام للـ API بالبادئة `/api`
app.use('/api', apiRouter);

// =============================================================================
// 3. خدمة الملفات الثابتة والواجهة الأمامية (Svelte Build & Static Files)
// =============================================================================

// خدمة مجلد الأصول والوسائط والصور
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'assets', 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'assets', 'uploads')));

const DIST_DIR = path.join(__dirname, 'dist');

// التحقق مما إذا كان تطبيق Svelte مبنياً في مجلد dist
if (fs.existsSync(DIST_DIR)) {
  // خدمة ملفات Svelte المجمعة عبر Vite
  app.use(express.static(DIST_DIR, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));

  // توجيه كافة مسارات SPA إلى dist/index.html لدعم التوجيه الداخلي لـ Svelte
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(DIST_DIR, 'index.html'));
    }
    next();
  });
} else {
  // وضع احتياطي: خدمة الملفات الثابتة التقليدية
  app.use(express.static(PUBLIC_DIR, {
    extensions: ['html'],
    index: 'index.html',
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
}

// صفحة 404 مخصصة متناسقة مع هوية "مسكة" لأي رابط غير موجود
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>404 — الصفحة غير موجودة | مسكة</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background: #fbf7ee;
          color: #2b2b28;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          text-align: center;
        }
        .container {
          background: #ffffff;
          border: 1px solid #e7ded0;
          border-radius: 24px;
          padding: 48px 36px;
          max-width: 480px;
          margin: 20px;
          box-shadow: 0 16px 36px rgba(43, 43, 40, 0.06);
        }
        h1 {
          font-size: 3rem;
          color: #5e6b2c;
          margin: 0 0 12px;
        }
        p {
          font-size: 1.1rem;
          color: #6d6b63;
          line-height: 1.6;
          margin-bottom: 28px;
        }
        a.btn {
          display: inline-block;
          background: #5e6b2c;
          color: #ffffff;
          padding: 12px 28px;
          border-radius: 999px;
          text-decoration: none;
          font-weight: bold;
          transition: background 0.2s ease;
        }
        a.btn:hover {
          background: #4a5522;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>404 🌸</h1>
        <h2>الصفحة غير موجودة</h2>
        <p>عذراً، لم نعثر على الصفحة التي تبحث عنها في متجر واستوديو مسكة للزهور الطبيعية.</p>
        <a href="/" class="btn">العودة إلى الصفحة الرئيسية ←</a>
      </div>
    </body>
    </html>
  `);
});

// =============================================================================
// 4. معالج الأخطاء المركزي (Central Error Handling Middleware)
// =============================================================================

app.use((err, req, res, next) => {
  console.error('❌ Express Server Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'حدث خطأ داخلي في الخادم',
    code: err.code || 'INTERNAL_ERROR'
  });
});

// =============================================================================
// 5. بدء تشغيل الخادم (Server Initialization)
// =============================================================================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('=============================================================================');
    console.log(`🌸 خادم Express.js لمتجر واستوديو "مسكة" يعمل الآن بنجاح!`);
    console.log(`🌐 تصفح الموقع مباشرة في المتصفح: http://localhost:${PORT}`);
    console.log(`📡 واجهات الـ REST API متاحة على:  http://localhost:${PORT}/api/`);
    console.log(`📦 قاعدة البيانات المتصلة:      ${db.isMySQL ? (process.env.DB_DATABASE || 'maska_db') + ' (MySQL 8.0)' : db.DB_PATH + ' (SQLite)'}`);
    console.log(`🔗 رابط الاتصال (DATABASE_URL): ${process.env.DATABASE_URL || 'mysql://root:1234@127.0.0.1:3306/maska_db'}`);
    console.log('=============================================================================');
  });
}

module.exports = app;
