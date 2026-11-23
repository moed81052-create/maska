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

// تخطي قيود شهادات TLS في بيئات التطوير لتسهيل الاتصال بواجهات الذكاء الاصطناعي الخارجية
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
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
      message: `مرحباً بك مجدداً يا ${user.full_name} `,
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
      message: 'تم إنشاء حسابك بنجاح في مسكة ',
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
      message: `تمت إضافة ${newUser.role_display || 'المستخدم'} بنجاح `,
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
      message: 'تم تسجيل الكابتن بنجاح ',
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
      message: 'تم تسجيل منسق الورد بنجاح ',
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
      message: 'تم تأكيد طلبك بنجاح وحفظه في مسكة ',
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
      message: `تم توجيه وإسناد الطلب #${orderNumber} بنجاح `,
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// جلب الطلبات الموجهة لمنسقة الزهور حصرياً مع تفاصيل الباقة وتوزيع السيقان
apiRouter.get('/florist/orders', async (req, res, next) => {
  try {
    const floristId = req.query.floristId || null;
    if (!floristId) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }
    const floristOrders = await db.getFloristOrders(floristId);
    res.json({
      success: true,
      count: floristOrders.length,
      data: floristOrders
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
      message: 'تم تحديث إحداثيات السائق بنجاح '
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
      message: `تمت تسوية العهدة بنجاح واستلام المبلغ برقم إيصال ${receipt.settlement_number} `,
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
      message: 'تم حفظ ورفع صورة الزاوية بنجاح ',
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
      message: 'تم رفع الصورة بنجاح من جهازك ',
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
      message: 'تم تحديث صورة الباقة بنجاح من جهازك ',
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
      message: `تم تحديث صورة الوردة بنجاح من جهازك `,
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
      message: `تم إضافة صنف الورد "${newFlower.name_ar}" بنجاح مع صور الزوايا `,
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
      message: 'تم تحديث بيانات الزهرة وصور زواياها بنجاح ',
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
        message: 'تم تحديث رصيد المخزون بنجاح ',
        data: updated
      });
    }

    // إذا تم إرسال حقول أخرى
    const updated = await db.updateFlower(flowerId, req.body);
    res.json({
      success: true,
      message: 'تم تحديث بيانات الزهرة بنجاح ',
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
// هـ1b. خيارات التغليف وأشرطة الساتان والختم الشمعي (Packaging & Materials)
// -----------------------------------------------------------------------------

// جلب خيارات التغليف والأشرطة والختم الشمعي
apiRouter.get('/packaging', async (req, res, next) => {
  try {
    const { category, all } = req.query;
    const items = all === 'true' 
      ? await db.getAllPackagingMaterials()
      : await db.getPackagingMaterials(category || null);

    const wraps = items.filter(i => i.category === 'wrap');
    const ribbons = items.filter(i => i.category === 'ribbon');
    const waxSeals = items.filter(i => i.category === 'wax_seal');

    res.json({
      success: true,
      count: items.length,
      data: items,
      wraps,
      ribbons,
      wax_seals: waxSeals
    });
  } catch (err) {
    next(err);
  }
});

// إضافة خيار تغليف / شريط / ختم شمعي جديد
apiRouter.post('/packaging', async (req, res, next) => {
  try {
    const { category, name_ar, color, dark_color, price, sort_order, code } = req.body;
    if (!category || !name_ar || !color) {
      return res.status(400).json({
        success: false,
        message: 'التصنيف، الاسم العربي، ولون العنصر مطلوبة'
      });
    }
    const created = await db.addPackagingMaterial({
      category,
      code,
      name_ar,
      color,
      dark_color,
      price,
      sort_order
    });
    res.status(201).json({
      success: true,
      message: 'تمت إضافة خيار التغليف بنجاح',
      data: created
    });
  } catch (err) {
    next(err);
  }
});

// تعديل خيار تغليف
apiRouter.put('/packaging/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await db.updatePackagingMaterial(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'العنصر غير موجود' });
    }
    res.json({
      success: true,
      message: 'تم تعديل خيار التغليف بنجاح',
      data: updated
    });
  } catch (err) {
    next(err);
  }
});

// حذف خيار تغليف
apiRouter.delete('/packaging/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await db.deletePackagingMaterial(id);
    res.json({
      success: true,
      message: 'تم حذف خيار التغليف بنجاح',
      data: result
    });
  } catch (err) {
    next(err);
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
      message: `تم إنشاء باقة "${created.title}" بتوليفة الورود المحددة بنجاح `,
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
      message: `تم تعديل باقة "${updated.title}" بنجاح `,
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
      message: 'تم إنشاء الكوبون بنجاح ️',
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
      message: 'شكراً لتقييمك وملاحظاتك القيمة ',
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
      message: 'تم استلام ملاحظتك واقتراحك وسيقوم فريق مسكة بمراجعته ',
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
      message: 'تم تحديث بيانات ومنطقة التوصيل بنجاح ',
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
      message: `تم إضافة منطقة التوصيل "${created.zone_name}" بنجاح `,
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

  // 1. القائمة السوداء للمواضيع الخارجة تماماً عن سياق المتجر والزهور (off-topic)
  const offTopicPatterns = [
    /كود|برمج|بايثون|جافاسكريبت|html|css|sql|function|react|svelte|php|c\+\+|linux|windows|bug|error|script/i,
    /سياس|حكوم|رئيس|وزير|انتخاب|برلمان|حرب|جيش|سفار|دولة|عسكر|معاهدة|قانون|أحزاب|مظاهر/i,
    /مبارا|كرة|كورة|دوري|ريال|برشلونة|ميسي|رونالدو|كأس|هدف|لاعب|نادي|كلاسيكو|منتخب|فريق|مدرب|تشكيلة منتخب/i,
    /طبخ|وصفة|بيتزا|شاورما|برجر|معكرونة|كيكة|أكلة|مقادير|طريقة عمل|طبخة/i,
    /رياضيات|معادلة|حساب التفاضل|تكامل|فيزياء|كيمياء|فلسفة|فلك|كواكب|مجرة/i,
    /طقس|أمطار|درجة حرارة|سعر الصرف|عملات|بيتكوين|تداول|أسهم/i,
    /سيارة|محرك|مركبة|تويوتا|هيونداي|ميكانيك|بنزين/i
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(t)) {
      return false;
    }
  }

  // 2. التحيات والمجاملات والترحيب العام اللطيف والكلام العام
  const pleasantriesAndGreetings = [
    /^(أهلا|اهلا|مرحبا|مرحباً|سلام|السلام عليكم|صباح الخير|صباح الورد|صباح النور|مساء الخير|مساء الورد|مساء النور|هاي|هلا|أهلين|اهلين|يا هلا|نهارك طيب|نهارك سعيد)\b/i,
    /كيف (حالك|الحال|صحتك|أمورك|امورك|الوضع)/i,
    /شخبارك|شلونك|شن جوك|شن اخبارك|شنو اخبارك|شن أمورك|شن امورك|كيفك/i,
    /من أنت|من انت|عرفني بنفسك|من تكون|ما عملك|ما دورك/i,
    /شكرا|شكراً|تسلم|يعطيك العافية|بارك الله فيك|مشكور|الله يبارك|يسلمو|مشكورة/i,
    /خدماتكم|شن تقدمو|شن ديرو|ماذا تقدم|وين مكانكم|وين موقعكم|وين المحل|مكانكم وين|أوقات العمل|ساعات العمل/i
  ];

  if (pleasantriesAndGreetings.some(regex => regex.test(t))) {
    return true;
  }

  // 3. الاستفسار عن الأسعار، الباقات، التوصيل، والتغليف
  const storeInquiries = [
    /سعر|أسعار|اسعار|بكم|تكلفة|قائمة الأسعار|قداش|كم تكلف|كم السعر|الأسعار|الاسعار|رخيص|غالي|تخفيض|عروض/i,
    /توصيل|شحن|مدن|مناطق|طرابلس|بنغازي|مصراتة|الزاوية|تاجوراء|سرت|البيضاء|طبرق|غريان|زليتن|الخمس/i,
    /باقة جاهزة|باقات جاهزة|كتالوج|قائمة/i,
    /تغليف|كرافت|شريط ساتان|ختم شمعي|كرت إهداء/i,
    /تنسيق هرمي|تنسيق دائري|تنسيق بوهيمي|تنسيق قلب/i
  ];

  if (storeInquiries.some(regex => regex.test(t))) {
    return true;
  }

  // 4. الكلمات الجوهرية للزهور والباقات والنباتات والعناية بها (جميع الأنواع العالمية والمحلية)
  const floralKeywords = [
    /ورد|زهر|باق|فلور|توليب|جوري|بيوني|فاوانيا|جيبسوفيلا|جبسوفيلا|طفل|أوكالبتوس|اوكالبتوس|أوركيد|اوركيد|شمس|عباد|ليلي|زنابق/i,
    /هيدرانجيا|قرنفل|لافندر|خزامى|ياسمين|فل|كاميليا|نرجس|داليا|أقحوان|اقحوان|انيموني|رانوكولس|فريزيا|سوسن|لوتس|غاردينيا|كالا|استوما|سيكلامين|بنفسج|ماغنوليا|شقائق النعمان/i,
    /مزهر|فازة|ساق|سيقان|بتل|عطر الورد|نضار|ذبول|سقي|ري|رائحة الورد|نبات|عناية|اعتني|أعتني|اهتم|قص|تقليم|ماء|تعفن|غذاء الورد|ثلج|سكر|ليمون|كلور/i,
    /مسكة|أتيليه/i
  ];

  return floralKeywords.some(regex => regex.test(t));
}

// التحقق مما إذا كان الطلب يتضمن طلباً لتصميم أو تشكيل باقة
function isDesignRequest(query) {
  const t = (query || '').toLowerCase();
  return /صمم|صمملي|تصميم|اخترلي|اختارلي|اقترحلي|توليفة|ركبلي|بوكيه|نسقلي|باقة جديدة|تنسيق باقة|شكل باقة|تشكيل باقة|اعملي باقة|جهزلي باقة|اقترح باقة/i.test(t);
}

// مفاتيح الزهور لتطابق الأصول المرئية الشفافة
function getFlowerKey(name, color = '') {
  const n = (name || '').toLowerCase();
  const c = (color || '').toLowerCase();
  if (n.includes('أحمر') || n.includes('حمراء') || c.includes('أحمر') || c.includes('قرمزي')) return 'red-rose';
  if (n.includes('توليب') || n.includes('tulip')) return 'white-tulip';
  if (n.includes('جيبسوفيلا') || n.includes('جبسوفيلا') || n.includes('طفل')) return 'baby-breath';
  if (n.includes('فاوانيا') || n.includes('بيوني') || n.includes('peony')) return 'peony';
  if (n.includes('أوكالبتوس') || n.includes('اوكالبتوس') || n.includes('مريمي') || n.includes('eucalyptus')) return 'eucalyptus';
  if (n.includes('أوركيد') || n.includes('اوركيد') || n.includes('orchid')) return 'orchid';
  if (n.includes('شمس') || n.includes('sunflower')) return 'sunflower';
  if (n.includes('ليلي') || n.includes('زنابق') || n.includes('lily')) return 'lily';
  if (n.includes('جوري') || n.includes('ورد') || c.includes('وردي')) return 'pink-rose';
  return 'red-rose';
}

// محرك تصميم الباقات الذكي بناءً على المخزون الحي لزهور مسكة
function generateSmartFloralDesign(query, availableFlowers) {
  const q = (query || '').toLowerCase();
  
  const findFlower = (terms) => {
    return availableFlowers.find(f => {
      const name = (f.name_ar || '').toLowerCase();
      const color = (f.color || '').toLowerCase();
      return terms.some(term => name.includes(term) || color.includes(term));
    });
  };

  let theme = 'spring';
  if (/حب|رومانس|عاطف|زوج|زوجة|حبيب|أحمر|عشق/i.test(q)) theme = 'romantic';
  else if (/زفاف|عرس|خطوب|ملكة|عاج|عروس/i.test(q)) theme = 'wedding';
  else if (/تخرج|نجاح|تفوق|شهادة/i.test(q)) theme = 'graduation';
  else if (/فخم|ملكي|نادر|أوركيد|فاخر|هيبة/i.test(q)) theme = 'luxury';
  else if (/اعتذار|صلح|أسف/i.test(q)) theme = 'apology';

  let selectedStems = [];
  let bouquetName = 'باقة مسكة المتناسقة';
  let style = 'dome'; // 'dome' | 'royal' | 'boho' | 'heart'
  let wrap = 'kraft';
  let wrapName = 'ورق كرافت فاخر';
  let ribbon = 'gold_rose';
  let ribbonName = 'وردي مذهب';
  let story = '';

  const redRose = findFlower(['حمراء', 'أحمر', 'جوري أحمر']);
  const pinkRose = findFlower(['وردية', 'وردي', 'جوري وردي']);
  const whiteTulip = findFlower(['توليب', 'أبيض نقي']);
  const babyBreath = findFlower(['جبسوفيلا', 'جيبسوفيلا', 'نَفَس الطفل']);
  const peony = findFlower(['فاوانيا', 'بيوني']);
  const eucalyptus = findFlower(['أوكالبتوس', 'اوكالبتوس', 'مريمية']);
  const orchid = findFlower(['أوركيد', 'اوركيد']);
  const sunflower = findFlower(['شمس', 'عباد']);
  const lily = findFlower(['ليلي', 'زنابق']);

  if (theme === 'romantic') {
    bouquetName = 'باقة نبض العاطفة الملكية';
    style = 'heart';
    wrap = 'olive';
    wrapName = 'زيتي مسكة ملكي';
    ribbon = 'crimson';
    ribbonName = 'أحمر قرمزي';
    story = 'توليفة مصممة خصيصاً للمشاعر الصادقة والرومانسية، تعتمد على ورد الجوري الأحمر كقلب للباقة، مع لمسات حالمة من الجبسوفيلا والأوكالبتوس.';

    if (redRose && redRose.stock_quantity > 0) {
      selectedStems.push({ flower: redRose, qty: Math.min(7, redRose.stock_quantity), section: 'center' });
    }
    if (babyBreath && babyBreath.stock_quantity > 0) {
      selectedStems.push({ flower: babyBreath, qty: Math.min(4, babyBreath.stock_quantity), section: 'right' });
    }
    if (eucalyptus && eucalyptus.stock_quantity > 0) {
      selectedStems.push({ flower: eucalyptus, qty: Math.min(3, eucalyptus.stock_quantity), section: 'bottom' });
    }
  } else if (theme === 'wedding') {
    bouquetName = 'باقة النقاء والصفاء الملكي';
    style = 'dome';
    wrap = 'white';
    wrapName = 'أبيض عاجي نقي';
    ribbon = 'silk_white';
    ribbonName = 'حرير عاجي';
    story = 'تصميم ناصع وراقٍ يليق بمناسبات الزفاف والخطوبة، يجمع التوليب الأبيض النقي مع الفاوانيا الفاخرة وسحاب الجبسوفيلا لطلّة ساحرة متزنة.';

    if (whiteTulip && whiteTulip.stock_quantity > 0) {
      selectedStems.push({ flower: whiteTulip, qty: Math.min(6, whiteTulip.stock_quantity), section: 'center' });
    }
    if (peony && peony.stock_quantity > 0) {
      selectedStems.push({ flower: peony, qty: Math.min(3, peony.stock_quantity), section: 'top' });
    } else if (lily && lily.stock_quantity > 0) {
      selectedStems.push({ flower: lily, qty: Math.min(3, lily.stock_quantity), section: 'top' });
    }
    if (babyBreath && babyBreath.stock_quantity > 0) {
      selectedStems.push({ flower: babyBreath, qty: Math.min(4, babyBreath.stock_quantity), section: 'left' });
    }
  } else if (theme === 'graduation') {
    bouquetName = 'باقة إشراقة النجاح والتفوق';
    style = 'royal';
    wrap = 'black';
    wrapName = 'أسود سهرة فاحم';
    ribbon = 'royal_gold';
    ribbonName = 'ذهب ملكي';
    story = 'تنسيق هرمي جريء ومبهر يعكس الفخر والإنجاز، يتألق بعباد الشمس الذهبي مع الجوري والأغصان الخضراء العطرة.';

    if (sunflower && sunflower.stock_quantity > 0) {
      selectedStems.push({ flower: sunflower, qty: Math.min(4, sunflower.stock_quantity), section: 'center' });
    }
    if (redRose && redRose.stock_quantity > 0) {
      selectedStems.push({ flower: redRose, qty: Math.min(5, redRose.stock_quantity), section: 'top' });
    } else if (pinkRose && pinkRose.stock_quantity > 0) {
      selectedStems.push({ flower: pinkRose, qty: Math.min(5, pinkRose.stock_quantity), section: 'top' });
    }
    if (eucalyptus && eucalyptus.stock_quantity > 0) {
      selectedStems.push({ flower: eucalyptus, qty: Math.min(3, eucalyptus.stock_quantity), section: 'bottom' });
    }
  } else if (theme === 'luxury') {
    bouquetName = 'باقة الهيبة الأرستقراطية';
    style = 'royal';
    wrap = 'gold';
    wrapName = 'ذهبي شامبين عتيق';
    ribbon = 'royal_gold';
    ribbonName = 'ذهب ملكي';
    story = 'باقة ملكية باذخة تجمع الأوركيد النادر والفاوانيا الإمبراطورية بانسجام بصري لا يُضاهى للمناسبات شديدة الخصوصية.';

    if (orchid && orchid.stock_quantity > 0) {
      selectedStems.push({ flower: orchid, qty: Math.min(3, orchid.stock_quantity), section: 'center' });
    }
    if (peony && peony.stock_quantity > 0) {
      selectedStems.push({ flower: peony, qty: Math.min(4, peony.stock_quantity), section: 'top' });
    }
    if (eucalyptus && eucalyptus.stock_quantity > 0) {
      selectedStems.push({ flower: eucalyptus, qty: Math.min(3, eucalyptus.stock_quantity), section: 'bottom' });
    }
  } else {
    bouquetName = 'باقة الربيع المخملية';
    style = 'dome';
    wrap = 'kraft';
    wrapName = 'ورق كرافت فاخر';
    ribbon = 'gold_rose';
    ribbonName = 'وردي مذهب';
    story = 'تناغم ربيعي دافئ من ورود الجوري الوردي والتوليب الأبيض، ملفوفة بورق كرافت إيطالي كلاسيكي يبرز نضارة وجمال الزهور الطبيعية.';

    if (pinkRose && pinkRose.stock_quantity > 0) {
      selectedStems.push({ flower: pinkRose, qty: Math.min(6, pinkRose.stock_quantity), section: 'center' });
    } else if (redRose && redRose.stock_quantity > 0) {
      selectedStems.push({ flower: redRose, qty: Math.min(6, redRose.stock_quantity), section: 'center' });
    }
    if (whiteTulip && whiteTulip.stock_quantity > 0) {
      selectedStems.push({ flower: whiteTulip, qty: Math.min(4, whiteTulip.stock_quantity), section: 'left' });
    }
    if (babyBreath && babyBreath.stock_quantity > 0) {
      selectedStems.push({ flower: babyBreath, qty: Math.min(3, babyBreath.stock_quantity), section: 'right' });
    }
    if (eucalyptus && eucalyptus.stock_quantity > 0) {
      selectedStems.push({ flower: eucalyptus, qty: Math.min(2, eucalyptus.stock_quantity), section: 'bottom' });
    }
  }

  if (selectedStems.length === 0) {
    const valid = availableFlowers.slice(0, 3);
    selectedStems = valid.map((f, idx) => ({
      flower: f,
      qty: Math.min(4, f.stock_quantity),
      section: idx === 0 ? 'center' : (idx === 1 ? 'top' : 'bottom')
    }));
  }

  const wrapPrice = 12.0;
  const flowersPrice = selectedStems.reduce((acc, item) => acc + (item.qty * parseFloat(item.flower.unit_price)), 0);
  const totalPrice = flowersPrice + wrapPrice;

  const stemsDetailLines = selectedStems.map(s => 
    `• **${s.qty} سيقان من ${s.flower.name_ar}** (${s.flower.color}) - السعر: ${(s.qty * s.flower.unit_price).toFixed(1)} د.ل [توزيع: في ${s.section === 'center' ? 'وسط الباقة' : s.section === 'top' ? 'أعلى الباقة' : s.section === 'bottom' ? 'قاعدة الباقة' : 'الجوانب'}]`
  ).join('\n');

  const reply = ` **صممت لك هذه الباقة بناءً على الزهور المتوفرة لدينا في المخزن حالياً:**\n\n###  ${bouquetName}\n${story}\n\n**الزهور المختارة من المخزون المتوفر:**\n${stemsDetailLines}\n\n**تفاصيل التغليف والشريط:**\n-  **التغليف:** ${wrapName}\n- ️ **شريط الساتان:** ${ribbonName}\n-  **نمط التنسيق:** ${style === 'dome' ? 'دائري كلاسيكي متناسق' : style === 'royal' ? 'ملكي متدرج فاخر' : style === 'heart' ? 'رومانسي مدمج فاخر' : 'بوهيمي عصري'}\n-  **السعر الإجمالي للباقة والتغليف:** ${totalPrice.toFixed(0)} دينار ليبي\n\n **اضغط على الزر أدناه لتطبيق هذا التصميم فوراً داخل استوديو مسكة ومعاينته بالكامل!**`;

  const designAction = {
    type: 'apply_bouquet_design',
    name: bouquetName,
    style: style,
    wrap: wrap,
    wrapName: wrapName,
    ribbon: ribbon,
    ribbonName: ribbonName,
    totalPrice: Math.round(totalPrice),
    story: story,
    stems: selectedStems.map(s => ({
      flower_id: s.flower.id,
      name: s.flower.name_ar,
      key: s.flower.key || getFlowerKey(s.flower.name_ar, s.flower.color),
      qty: s.qty,
      section: s.section,
      price: parseFloat(s.flower.unit_price),
      color: s.flower.color
    }))
  };

  return { reply, designAction };
}

// محرك خبير مسكة للزهور الذكي للإجابات المتخصصة
function generateLocalFloralResponse(query, availableFlowers = [], readyBouquets = [], deliveryZones = []) {
  const q = (query || '').toLowerCase().trim();

  // 1. التحيات والمجاملات والكلام العام
  if (/^(أهلا|اهلا|مرحبا|مرحباً|سلام|السلام عليكم|صباح الخير|صباح الورد|صباح النور|مساء الخير|مساء الورد|مساء النور|هاي|هلا|أهلين|اهلين|يا هلا|نهارك طيب)\b/i.test(q) ||
      /كيف (حالك|الحال|صحتك|أمورك|امورك|الوضع)|شخبارك|شلونك|شن جوك|شن اخبارك|شن أمورك|كيفك/i.test(q) ||
      /من أنت|من انت|عرفني بنفسك|من تكون|ما عملك|ما دورك/i.test(q)) {
    return ' **أهلاً وسهلاً بك في أتيليه مسكة للزهور الطبيعية!**\n\nيومك معطر بشذى الياسمين والورد! أنا **مستشارك وخبير الزهور الذكي**، ويسعدني جداً مرافقتك ومساعدتك في:\n-  **استعراض أسعار الورود والباقات والتوصيل** المحدثة مباشرة من قاعدة بيانات المتجر.\n-  **تصميم باقة مخصصة** تختار فيها ورودك المتوفرة في المخزن والتغليف وتطبيقها فوراً في استوديو التصميم.\n-  **نصائح علمية للعناية بالزهور** وتفاصيل كل نوع لإطالة نضارتها لأكثر من أسبوعين في المزهرية.\n-  **معاني ودلالات ألوان الزهور** لمساعدتك في اختيار الهدية المثالية لمناسبتك.\n\nكيف يمكنني أن أساعدك اليوم؟ ';
  }

  // 2. الشكر والثناء
  if (/شكرا|شكراً|تسلم|يعطيك العافية|بارك الله فيك|مشكور|الله يبارك|يسلمو|مشكورة/i.test(q)) {
    return ' **على الرحب والسعة دائماً!** سعدت جداً بمساعدتك، وفي مسكة نسعد دائماً بإضفاء البهجة والجمال على أيامكم ومناسباتكم الخاصة. إذا كان لديك أي استفسار آخر عن الورود، أسعارها، أو العناية بها فأنا في خدمتك دائماً! ';
  }

  // 3. الاستفسار عن الأسعار وقوائم المتجر المأخوذة مباشرة من قاعدة البيانات
  if (/سعر|أسعار|اسعار|بكم|تكلفة|قائمة الأسعار|قداش|كم تكلف|كم السعر|الأسعار|الاسعار/i.test(q)) {
    // فحص ما إذا كان السؤال عن نوع ورد معين
    if (q.includes('جوري') || q.includes('ورد')) {
      const roses = availableFlowers.filter(f => f.name_ar.includes('جوري') || f.name_ar.includes('ورد'));
      if (roses.length > 0) {
        let roseReply = ' **أسعار الورد الجوري المتوفر حالياً في مخزن مسكة (مباشرة من قاعدة البيانات):**\n\n';
        roses.forEach(r => {
          roseReply += `• **${r.name_ar}** (${r.color}): **${parseFloat(r.unit_price).toFixed(0)} دينار ليبي للساق** [المتوفر بالمخزن: ${r.stock_quantity} ساق]\n`;
        });
        roseReply += '\n *جميع الورود طبيعية وطازجة ويتم قطفها وحفظها في غرف تبريد هولندية خاصة.*';
        return roseReply;
      }
    }

    if (q.includes('توليب')) {
      const tulip = availableFlowers.find(f => f.name_ar.includes('توليب'));
      if (tulip) {
        return ` **سعر زهور التوليب في مسكة:**\n• **${tulip.name_ar}** (${tulip.color}): **${parseFloat(tulip.unit_price).toFixed(0)} دينار ليبي للساق** [المتوفر: ${tulip.stock_quantity} ساق].\n\nنصيحة مسكة: يُفضل حفظ التوليب في ماء بارد جداً مع مكعب ثلج ليبقى منتصباً ومشرقاً!`;
      }
    }

    if (q.includes('أوركيد') || q.includes('اوركيد')) {
      const orchid = availableFlowers.find(f => f.name_ar.includes('أوركيد') || f.name_ar.includes('اوركيد'));
      if (orchid) {
        return ` **سعر زهور الأوركيد الملكية في مسكة:**\n• **${orchid.name_ar}** (${orchid.color}): **${parseFloat(orchid.unit_price).toFixed(0)} دينار ليبي للساق** [المتوفر: ${orchid.stock_quantity} ساق].\n\nتعتبر زهرة الأوركيد رمز الفخامة والجمال النادر وتدوم لفترات طويلة بنضارتها الساحرة.`;
      }
    }

    if (q.includes('شمس') || q.includes('عباد')) {
      const sun = availableFlowers.find(f => f.name_ar.includes('شمس') || f.name_ar.includes('عباد'));
      if (sun) {
        return ` **سعر عباد الشمس الذهبي في مسكة:**\n• **${sun.name_ar}**: **${parseFloat(sun.unit_price).toFixed(0)} دينار ليبي للساق** [المتوفر: ${sun.stock_quantity} ساق].\n\nمثالي لإضفاء البهجة والطاقة الإيجابية في حفلات التخرج والتفوق!`;
      }
    }

    if (q.includes('بيوني') || q.includes('فاوانيا')) {
      const peony = availableFlowers.find(f => f.name_ar.includes('فاوانيا') || f.name_ar.includes('بيوني'));
      if (peony) {
        return ` **سعر الفاوانيا (البيوني) الملكية في مسكة:**\n• **${peony.name_ar}**: **${parseFloat(peony.unit_price).toFixed(0)} دينار ليبي للساق** [المتوفر: ${peony.stock_quantity} ساق].\n\nملكة الزهور الأكثر طلباً لمناسبات الأعراس والخطوبة الراقية.`;
      }
    }

    if (q.includes('باقة') || q.includes('باقات') || q.includes('جاهزة')) {
      if (readyBouquets && readyBouquets.length > 0) {
        let bReply = ' **قائمة أسعار الباقات الجاهزة المعتمدة في متجر مسكة:**\n\n';
        readyBouquets.forEach(b => {
          bReply += `• **${b.title}**: **${parseFloat(b.price).toFixed(0)} د.ل**\n`;
        });
        bReply += '\n يمكنك أيضاً طلب "صمملي باقة" وسأختار لك تركيبة مخصصة من المخزن المتوفر فوراً!';
        return bReply;
      }
    }

    if (q.includes('توصيل') || q.includes('شحن') || q.includes('طرابلس') || q.includes('بنغازي') || q.includes('مصراتة')) {
      if (deliveryZones && deliveryZones.length > 0) {
        let dReply = ' **أسعار ورسوم التوصيل حسب المدن والمناطق في مسكة:**\n\n';
        const activeZones = deliveryZones.filter(z => z.is_active);
        activeZones.forEach(z => {
          dReply += `• **${z.city}** (${z.zone_name}): **${parseFloat(z.delivery_fee).toFixed(0)} دينار ليبي**\n`;
        });
        dReply += '\n *توصيل آمن بسيارات مجهزة ومكيفة لضمان وصول الزهور في قمة نضارتها.*';
        return dReply;
      }
    }

    // القائمة الشاملة لجميع الأسعار من قاعدة البيانات
    let priceReply = ' **قائمة الأسعار المحدثة مباشرة من قاعدة بيانات متجر مسكة:**\n\n';

    if (availableFlowers && availableFlowers.length > 0) {
      priceReply += ' **أسعار سيقان الزهور المتوفرة بالمخزن (للساق الواحدة):**\n';
      availableFlowers.forEach(f => {
        priceReply += `• **${f.name_ar}** (${f.color}): **${parseFloat(f.unit_price).toFixed(0)} د.ل** [المتوفر: ${f.stock_quantity} ساق]\n`;
      });
      priceReply += '\n';
    }

    if (readyBouquets && readyBouquets.length > 0) {
      priceReply += ' **أسعار الباقات الجاهزة بالمتجر:**\n';
      readyBouquets.forEach(b => {
        priceReply += `• **باقة ${b.title}**: **${parseFloat(b.price).toFixed(0)} د.ل**\n`;
      });
      priceReply += '\n';
    }

    if (deliveryZones && deliveryZones.length > 0) {
      priceReply += ' **رسوم التوصيل المعتمدة:**\n';
      const activeZones = deliveryZones.filter(z => z.is_active).slice(0, 5);
      activeZones.forEach(z => {
        priceReply += `• **${z.city}** (${z.zone_name}): **${parseFloat(z.delivery_fee).toFixed(0)} د.ل**\n`;
      });
      priceReply += '\n';
    }

    priceReply += ' *ملاحظة: كرت الإهداء المكتوب بخط اليد مع الختم الشمعي الملكي وشريط الساتان مجاني مع كل باقة!*';
    return priceReply;
  }

  // 4. دليل أنواع الزهور العالمي (Encyclopedic Knowledge of Flowers)
  if (q.includes('أنواع') || q.includes('انواع') || q.includes('نوع') || q.includes('أشهر الزهور') || q.includes('اشهر الزهور')) {
    return ' **موسوعة أنواع الزهور في مسكة:**\n\n' +
      '1. **الورد الجوري (Rose):** سيد الزهور وأعرقها، متوفر بألوان كلاسيكية كالوردي والأحمر والأبيض، رمز الحب والشغف والجمال الأزلي.\n' +
      '2. **الفاوانيا / البيوني (Peony):** تُلقب بـ "ملكة الزهور الربيعية"، بتلاتها كروية مخملية غنية بالعطر، ترمز للرقي والحظ السعيد.\n' +
      '3. **التوليب (Tulip):** الزهرة الهندسية الأنيقة رمز البدايات الجديدة والصفاء، تتفتح بلطف مع الضوء وتتأثر ببرودة الماء.\n' +
      '4. **الأوركيد (Orchid):** أيقونة الفخامة الأرستقراطية، أزهارها غريبة ونادرة ترمز إلى الأناقة المتفردة والجمال الخالد.\n' +
      '5. **الزنابق والليلي (Lily):** زهور فواحة ذات بتلات نجمية مهيبة ترمز للنقاء والسمو.\n' +
      '6. **عباد الشمس (Sunflower):** زهرة الشمس المشرقة التي تتبع مسار النور، رمز الوفاء، الصداقة، والبهجة الدائمة.\n' +
      '7. **الهيدرانجيا (Hydrangea):** كتل زهرية سحابية غنية، شديدة الحساسية للرطوبة وتُشرب عبر بتلاتها وسيقانها.\n' +
      '8. **الجبسوفيلا (Baby\'s Breath):** سحاب ناعم من البتلات البيضاء الصغيرة يضفي خفة ونعومة ساحرة على أي باقة.\n' +
      '9. **اللافندر والقرنفل والرانوكولس والكاميليا:** زهور كلاسيكية تكمل التناغم البصري والعطري.\n\n' +
      ' هل تود معرفة تفاصيل العناية بنوع معين أو ترغب في تصميم باقة تجمع هذه الأنواع؟';
  }

  // 5. نصائح العناية وإطالة عمر الباقة (Flower Care Guide)
  if (q.includes('عناية') || q.includes('أعتني') || q.includes('اعتني') || q.includes('نضارة') || q.includes('ماء') || q.includes('مزهرية') || q.includes('تدوم') || q.includes('يعيش') || q.includes('اهتم') || q.includes('سقي')) {
    if (q.includes('هيدرانجيا')) {
      return ' **العناية بزهرة الهيدرانجيا (Hydrangea):**\n1. زهرة الهيدرانجيا محبة جداً للماء، اقطع ساقها بزاوية حادة 45° مع شق طولي صغير في أسفل الساق بمقدار 1 سم لمساعدة القنوات الخشبية على سحب الماء.\n2. رش البتلات برذاذ ماء نقي بارد يومياً، لأن الهيدرانجيا تمتص الرطوبة مباشرة عبر بتلاتها أيضاً!\n3. إذا بدأت بالذبول، اغمر رأس الزهرة بالكامل في وعاء ماء بارد لمدة 30 دقيقة وستستعيد نضارتها كالسحر!';
    }
    if (q.includes('توليب')) {
      return ' **أسرار العناية بزهور التوليب (Tulip):**\n1. التوليب ينمو حتى بعد قطفه في المزهرية! اقطع 1-2 سم من الساق باستمرار كل يومين.\n2. استخدم ماء بارداً جداً، وضع مكعب ثلج صغير يومياً في ماء المزهرية للحفاظ على الساق منتصبة وقوية.\n3. ضعها بعيداً عن ضوء الشمس المباشر والدفء حتى لا تتفتح البتلات سريعاً وتسقط.';
    }
    if (q.includes('أوركيد') || q.includes('اوركيد')) {
      return ' **طريقة العناية بزهرة الأوركيد (Orchid):**\n1. زهور الأوركيد المقطوفة تحب الماء النظيف بدرجة حرارة الغرفة دون إغراق الأوراق.\n2. اقطع طرف الساق بمقص معقم كل 3 أيام.\n3. أبعدها تماماً عن تيارات المكيف الباردة أو الساخنة وأشعة الشمس المباشرة، مع رذاذ خفيف جداً على محيط الزهرة دون إغراق قلبها.';
    }
    if (q.includes('ليلي') || q.includes('زنابق')) {
      return ' **العناية بزنابق الليلي (Lilies):**\n1. السر الذهبي: بمجرد أن تتفتح الزهرة، قم بإزالة حبوب اللقاح (الأسدية البرتقالية) برفق بمنديل، هذا يضاعف عمر الزهرة بمقدار الضعف ويمنع تصبغ البتلات وثيابك!\n2. اقطع الساق 45° وغيّر الماء كل يومين.\n3. تعتبر زهور الليلي ذات رائحة قوية فواحة وتعيش لأكثر من 10 أيام في مكان جيد التهوية.';
    }

    return ' **دليل خبير مسكة العلمي الشامل للعناية بالزهور وإطالة نضارتها حتى 14 يوماً:**\n\n' +
      '1. **القص المائل 45°:** اقطع 2 سم من أسفل كل ساق بمقص حاد وبزاوية مائلة 45 درجة تحت ماء فاتر كل يومين لمضاعفة امتصاص الماء ومنع تكوّن فقاعات الهواء داخل القنوات الناقلة.\n' +
      '2. **تنظيف السيقان:** تخلص من أي أوراق تقع تحت خط الماء في المزهرية لمنع تكاثر البكتيريا وتعفن الماء.\n' +
      '3. **الموقع المثالي:** ضع الباقة في مكان بارد معتدل بعيداً عن أشعة الشمس المباشرة، وتيارات التكييف، وأطباق الفاكهة (غاز الإيثيلين المنبعث من الموز والتفاح يسرع ذبول الورد).\n' +
      '4. **تغيير الماء وتغذيته:** استبدل ماء المزهرية بماء نقي كل 48 ساعة، وأضف نصف ملعقة صغيرة من السكر مع قطرتين من الليمون أو قطرة خل أبيض لتغذية البتلات ومنع البكتيريا!\n' +
      '5. **أسرار إضافية:** للتوليب ضع مكعب ثلج صغير في الماء ليبقى منتصباً، وللهيدرانجيا رش البتلات برذاذ ماء خفيف لأنها تشرب الماء من بتلاتها أيضاً!';
  }

  // 6. معاني الورود ودلالات الألوان
  if (q.includes('معنى') || q.includes('دلالة') || q.includes('يرمز') || q.includes('رمز')) {
    if (q.includes('أحمر') || q.includes('حمراء') || q.includes('جوري')) {
      return ' **الورد الجوري الأحمر المخملي:** رمز الخلود للحب العميق، الشغف، والتقدير الصادق. اختياره في الباقة يعبر عن مشاعر صادقة وقوية تليق بالمناسبات الرومانسية الكبرى وأعياد الحب والزواج.';
    }
    if (q.includes('أبيض') || q.includes('بيضاء') || q.includes('توليب')) {
      return ' **التوليب والورد الأبيض النقي:** يرمز إلى الصفاء، البراءة، النقاء، وبداية عهد جديد مشرق. يُعد الخيار الملكي الأول لمناسبات الزفاف، الخطوبة، وحفلات الاستقبال الفاخرة.';
    }
    if (q.includes('وردي') || q.includes('بيوني') || q.includes('فاوانيا')) {
      return ' **البيوني والورد الوردي الناعم:** تُلقب الفاوانيا بـ "ملكة الزهور"، وترمز إلى الرقي، السعادة الزوجية، الحظ الوفير، والامتنان الرقيق. مثالية للتعبير عن المودة والتقدير الراقي.';
    }
    if (q.includes('أصفر') || q.includes('شمس') || q.includes('ذهبي')) {
      return ' **عباد الشمس الذهبي والورد الأصفر:** رمز البهجة، الطاقة الإيجابية، الصداقة المتينة، والوفاء المشرق. اختيار مبهج ومميز لحفلات التخرج وتهنئة النجاح والتألق!';
    }
    if (q.includes('أوركيد')) {
      return ' **زهرة الأوركيد الملكية:** ترمز إلى الفخامة الاستثنائية، الجمال النادر، والأناقة الملكية التي تدوم طويلاً.';
    }
    return ' **دلالات ألوان الزهور في مسكة:**\n-  **الأحمر:** حب عميق وتقدير مهيب.\n-  **الأبيض:** نقاء، سلام، وبدايات جديدة.\n-  **الوردي:** امتنان، مودة، ورقة متناهية.\n-  **الأصفر والذهبي:** بهجة، نجاح، وصداقة مخلصة.\n-  **الأخضر المريمي:** أصالة ونضارة مستمرة.';
  }

  // 7. اختيار الباقة المناسبة حسب المناسبة
  if (q.includes('مناسبة') || q.includes('زفاف') || q.includes('عرس') || q.includes('تخرج') || q.includes('عيد ميلاد') || q.includes('اعتذار')) {
    if (q.includes('تخرج') || q.includes('نجاح')) {
      return ' **باقة التخرج والنجاح المقترحة:** ننصح بتنسيق هرمي ملكي يدمج عباد الشمس الذهبي المشرق مع ورود الجوري وأغصان الأوكالبتوس، مع ورق تغليف أسود سهرة ملوكي أو كرافت فاخر وشريط ساتان ذهبي ليناسب فخامة الإنجاز!';
    }
    if (q.includes('زفاف') || q.includes('عرس') || q.includes('خطوب')) {
      return ' **باقة الزفاف والخطوبة الملكية:** الخيار الأمثل هو مزيج التوليب الأبيض النقي مع الفاوانيا (البيوني) والزهور العاجية، محاطة بسحاب الجيبسوفيلا وورق تغليف عاجي ناعم بختم شمعي أحمر مذهب.';
    }
    if (q.includes('اعتذار') || q.includes('مودة')) {
      return '️ **باقة الاعتذار والتصافي:** ننصح بباقة دائرية متناسقة تجمع الجوري الوردي الفاتح والزنابق العطرة وورق الكرافت الإيطالي، مصحوبة بكرت إهداء مكتوب بكلمات دافئة تلامس القلب.';
    }
    return ' **اقتراحات مسكة لمختلف المناسبات:** لكل مناسبة تركيبة خاصة في استوديونا: أعياد الميلاد (ألوان ربيعية زاهية)، التخرج (ألوان ملكية جريئة)، والزفاف (أبيض وعاجي ناصع). يمكنك طلب: "صمملي باقة" وسنصممها لك فوراً!';
  }

  // 8. التغليف والأشرطة والأختام
  if (q.includes('تغليف') || q.includes('ورق') || q.includes('شريط') || q.includes('ختم') || q.includes('شمع')) {
    return ' **دليل التغليف الملكي في مسكة:**\n- **ورق الكرافت الإيطالي (10 د.ل):** يمنح إحساساً كلاسيكياً بالطبيعة والأصالة.\n- **أسود سهرة فاحم (15 د.ل):** يُبرز تباين الورود بتأثير سينمائي عصري فائق الفخامة.\n- **وردي مخملي وزيتي مسكة (12 د.ل):** مثالي للمناسبات الراقية والهادئة.\n- **الختم الشمعي الملوكي:** يوثق رسالتك بطابع أرستقراطي ويُسكب يدوياً بأختام مسكة الرسمية مجاناً مع كل باقة.';
  }

  // 9. إجابة عامة
  return ' **مرحباً بك في استوديو مسكة للزهور الطبيعية!**\nيسعدني مساعدتك في استعراض أسعار الورود، شرح دلالات أي نوع زهور في العالم، إرشادك لأفضل طرق العناية بالباقات، أو تصميم باقة أحلامك وتطبيقها على اللوحة الحية فوراً. كيف تحب أن نبدأ؟';
}

// فحص حالة مفتاح الذكاء الاصطناعي
apiRouter.get('/ai/status', (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const isConfigured = apiKey.length > 20 && !apiKey.includes('DEMO');
  res.json({
    success: true,
    configured: isConfigured,
    model: 'gemini-3-flash-preview',
    keyPreview: isConfigured ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}` : null
  });
});

// حفظ مفتاح Google Gemini API الجديد وتحديثه في البيئة وملف .env
apiRouter.post('/ai/key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 15) {
    return res.status(400).json({
      success: false,
      message: 'مفتاح API غير صالح. يرجى إدخال مفتاح Gemini API صحيح يبدأ بـ AIzaSy...'
    });
  }

  const cleanKey = apiKey.trim();
  process.env.GEMINI_API_KEY = cleanKey;

  try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      if (envContent.includes('GEMINI_API_KEY=')) {
        envContent = envContent.replace(/GEMINI_API_KEY=.*/g, `GEMINI_API_KEY=${cleanKey}`);
      } else {
        envContent += `\nGEMINI_API_KEY=${cleanKey}\n`;
      }
      fs.writeFileSync(envPath, envContent, 'utf8');
    }
  } catch (err) {
    console.warn('[AI] Could not persist key to .env:', err.message);
  }

  res.json({
    success: true,
    message: 'تم تفعيل وحفظ مفتاح Google Gemini API بنجاح !',
    configured: true
  });
});

// نقطة الاتصال لمحادثة الذكاء الاصطناعي مع القيود الصارمة ودعم اختيار الورد من المخزون
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
        reply: 'عذراً، لا يمكنني الإجابة على هذا السؤال لأنه خارج سياق اختصاصي في الزهور والباقات . يسعدني جداً مساعدتك في كل ما يتعلق بأنواع الورد، معانيه، تنسيق الباقات، وطرق العناية بالزهور!',
        isOffTopic: true,
        source: 'guardrail'
      });
    }

    // 2. جلب رصيد المخزون الفعلي الحالي لزهور مسكة والباقات والتوصيل من قاعدة البيانات
    let availableFlowers = [];
    let readyBouquets = [];
    let deliveryZones = [];
    try {
      const stock = await db.getFlowerStock();
      availableFlowers = (stock || []).filter(f => f.is_available && f.stock_quantity > 0);
      readyBouquets = (await db.getAllBouquets()) || [];
      deliveryZones = (await db.getDeliveryZonesPricing()) || [];
    } catch (e) {
      console.warn('[AI Chat] Could not fetch catalog data from database:', e.message);
    }

    const wantsDesign = isDesignRequest(trimmedMsg);

    // 3. التحقق من مفتاح Gemini API الحقيقي
    const apiKey = process.env.GEMINI_API_KEY;
    const hasValidKey = apiKey && apiKey.length > 20 && !apiKey.includes('DEMO');

    if (hasValidKey) {
      try {
        const flowersPriceTable = (availableFlowers || []).map(f => 
          `- ${f.name_ar} (اللون: ${f.color}, السعر: ${parseFloat(f.unit_price).toFixed(0)} دينار ليبي للساق, المتوفر: ${f.stock_quantity} ساق, id: ${f.id})`
        ).join('\n');

        const bouquetsPriceTable = (readyBouquets || []).map(b => 
          `- باقة "${b.title}": بسعر ${parseFloat(b.price).toFixed(0)} دينار ليبي`
        ).join('\n');

        const deliveryPriceTable = (deliveryZones || []).filter(z => z.is_active).map(z => 
          `- ${z.city} (${z.zone_name}): ${parseFloat(z.delivery_fee).toFixed(0)} دينار ليبي`
        ).join('\n');

        const systemPrompt = `أنت "مستشار وخبير مسكة الذكي" - المصمم الاستشاري الأول للزهور والباقات وخبير النباتات في أتيليه مسكة للزهور الفاخرة بليبيا.
تتميز باللباقة، الذوق الرفيع، الشاعرية، والخبرة العلمية الموسوعية في عالم الزهور. اكتب بلغة عربية فخمة وراقية وأنيقة خالية تماماً من أي إيموجيات أو رموز تعبيرية.

معلوماتك الموسوعية عن الزهور:
لديك معرفة شاملة بجميع أنواع الزهور في العالم (الجوري، التوليب، البيوني/الفاوانيا، الأوركيد، الزنابق/الليلي، عباد الشمس، الجبسوفيلا، الهيدرانجيا، القرنفل، اللافندر، الياسمين، الغاردينيا، الكاميليا، النرجس، الداليا، الأقحوان، شقائق النعمان، الرانوكولس، الكالا ليلي، وغيرها):
- معانيها ودلالاتها العاطفية والثقافية ومناسباتها المثالية.
- أدق أسرار العناية العلمية بالزهور المقطوفة في المزهرية (قطع الساق 45° تحت الماء، إزالة الأوراق السفلية لمنع البكتيريا، تغيير الماء كل 48 ساعة، إبعادها عن الفواكه وأشعة الشمس والحرارة، وضع مكعبات ثلج للتوليب، رش رذاذ ماء خفيف للهيدرانجيا، وإزالة حبوب اللقاح من الزنابق لحفظ البتلات).

بيانات الأسعار والمخزون الحية والمحدثة مباشرة من قاعدة بيانات متجر مسكة الآن (اقرأ الأسعار حصراً منها):
══════════════════════════════════════════════════════════════
 أسعار سيقان الورد المتوفرة في المخزن:
${flowersPriceTable}

 أسعار الباقات الجاهزة في المتجر:
${bouquetsPriceTable}

 رسوم التوصيل المعتمدة حسب المدن والمناطق:
${deliveryPriceTable}

 خيارات التغليف والأشرطة:
- ورق كرافت إيطالي فاخر (kraft)
- زيتي مسكة ملكي (olive)
- أسود سهرة فاحم (black)
- وردي مخملي (blush)
- أبيض عاجي (white)
- ذهبي شامبين (gold)
- أشرطة الساتان: وردي مذهب (gold_rose)، زيتي مسكة (sage)، أحمر قرمزي (crimson)، حرير عاجي (silk_white)، ذهب ملكي (royal_gold).
- أنماط التنسيق: دائري كلاسيكي (dome)، ملكي متدرج فاخر (royal)، بوهيمي عصري (boho)، رومانسي مدمج فاخر (heart).
══════════════════════════════════════════════════════════════

تعليمات السلوك والرد:
1. الترحيب والكلام العام:
إذا وجه لك الزبون تحية (مثل "أهلاً"، "مرحباً"، "السلام عليكم"، "صباح الخير"، "مساء الورد") أو سأل عن حالك ("كيف حالك"، "شن جوك"، "أخبارك") أو شكرك، رد عليه بترحيب ليبي أنيق وفاخر، وعرفه بنفسك كمستشار مسكة للزهور وأخبره كيف تسعد بمساعدته في استعراض الأسعار، العناية بالزهور، أو تنسيق باقة أحلامه.

2. قراءة الأسعار من قاعدة البيانات:
عندما يسألك الزبون عن سعر أي نوع ورد أو باقة أو رسوم التوصيل، اقرأ الأسعار الدقيقة كما هي مذكورة تماماً في الجداول الحية أعلاه بدون أي تحريف أو تخمين، واذكر أن الأسعار بالدينار الليبي (د.ل).

3. العناية بالزهور وأنواعها:
قدم نصائح علمية وعملية مفصلة وثرية جداً لأي نوع ورد يسأل عنه الزبون، وكيف يجعل باقته تدوم لأكثر من أسبوعين نضرة وعطرة في منزله.

4. تصميم باقة مخصصة (عندما يطلب الزبون "صمملي باقة" أو اختيار ورد):
- اختر حصراً من الزهور المتوفرة أعلاه في جدول المخزن بحيث لا تتجاوز الكميات المتوفرة.
- اشرح للزبون اختيارك للورد ومعانيه بأسلوب شاعري وراقي.
- في نهاية ردك، أرفق كود JSON نقي محاط بـ \`\`\`json و \`\`\` يحتوي على بنية التصميم:
\`\`\`json
{
  "action": "design_bouquet",
  "name": "اسم الباقة الشاعري",
  "style": "dome",
  "wrap": "kraft",
  "ribbon": "gold_rose",
  "stems": [
    { "flower_id": 1, "name": "وردة جورية وردية", "qty": 6, "section": "center" },
    { "flower_id": 3, "name": "جبسوفيلا ناعمة", "qty": 3, "section": "right" }
  ]
}
\`\`\`
(sections المتاحة: "center", "top", "left", "right", "bottom").

5. القيد الصارم (Guardrail):
إذا كان سؤال الزبون خارج نطاق الزهور والورود والباقات والهدايا والتغليف والعناية بالزهور أو التحيات والمتجر (مثل السياسة، كرة القدم، البرمجة، السيارات، الطبخ، العملات، الأمور غير الزهرية)، يجب الرد حصراً بهذه العبارة فقط دون زيادة أو نقصان:
"عذراً، لا يمكنني الإجابة على هذا السؤال لأنه خارج سياق اختصاصي في الزهور والباقات . يسعدني جداً مساعدتك في كل ما يتعلق بأنواع الورد، معانيه، تنسيق الباقات، وطرق العناية بالزهور!"`;

        let geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemPrompt}\n\nطلب الزبون: ${trimmedMsg}` }]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1024
            }
          }),
          signal: AbortSignal.timeout(9000)
        });

        if (!geminiRes.ok) {
          geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nطلب الزبون: ${trimmedMsg}` }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
            }),
            signal: AbortSignal.timeout(9000)
          });
        }

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText && candidateText.trim()) {
            let replyText = candidateText.trim().replace(/[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '').replace(/ {2,}/g, ' ');
            let designAction = null;

            // استخراج كود الـ JSON إذا وجد
            const jsonMatch = replyText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) {
              try {
                const parsed = JSON.parse(jsonMatch[1]);
                if (parsed.stems && Array.isArray(parsed.stems)) {
                  // تنظيف نص الرد من كود الـ JSON ليظهر أنيقاً للقارئ
                  replyText = replyText.replace(/```(?:json)?\s*\{[\s\S]*?\}\s*```/, '').trim();
                  
                  // مطابقة السيقان وتجهيز كائن الإجراء
                  const stems = parsed.stems.map(s => {
                    const matched = availableFlowers.find(f => f.id === s.flower_id || f.name_ar.includes(s.name));
                    const price = matched ? parseFloat(matched.unit_price) : 5.0;
                    return {
                      flower_id: s.flower_id || (matched ? matched.id : 1),
                      name: s.name,
                      key: getFlowerKey(s.name),
                      qty: Math.min(s.qty || 1, matched ? matched.stock_quantity : s.qty || 1),
                      section: s.section || 'center',
                      price: price,
                      color: matched ? matched.color : '#dc2626'
                    };
                  });

                  const wrapFee = 12.0;
                  const flowersFee = stems.reduce((sum, item) => sum + (item.qty * item.price), 0);

                  designAction = {
                    type: 'apply_bouquet_design',
                    name: parsed.name || 'باقة الذكاء الاصطناعي الفاخرة',
                    style: parsed.style || 'dome',
                    wrap: parsed.wrap || 'kraft',
                    wrapName: parsed.wrap === 'olive' ? 'زيتي مسكة ملكي' : parsed.wrap === 'black' ? 'أسود سهرة فاحم' : 'ورق كرافت فاخر',
                    ribbon: parsed.ribbon || 'gold_rose',
                    ribbonName: parsed.ribbon === 'royal_gold' ? 'ذهب ملكي' : 'وردي مذهب',
                    totalPrice: Math.round(flowersFee + wrapFee),
                    stems: stems
                  };
                }
              } catch (e) {
                console.warn('[AI] Could not parse JSON from Gemini candidate:', e.message);
              }
            }

            // إذا كان طلب تصميم ولكن Gemini لم ينتج JSON صالحاً، ندمجه مع محرك التصميم المعتمد على المخزون
            if (wantsDesign && !designAction) {
              const fallbackDesign = generateSmartFloralDesign(trimmedMsg, availableFlowers);
              designAction = fallbackDesign.designAction;
            }

            return res.json({
              success: true,
              reply: replyText,
              designAction: designAction,
              isOffTopic: false,
              source: 'gemini'
            });
          }
        }
      } catch (geminiErr) {
        console.log('[AI Chat] Gemini API error, using smart inventory floral engine:', geminiErr.message);
      }
    }

    // 4. المحرك الذكي المعتمد على المخزون الحي (Smart Floral Inventory Engine)
    if (wantsDesign) {
      const designResult = generateSmartFloralDesign(trimmedMsg, availableFlowers);
      return res.json({
        success: true,
        reply: designResult.reply,
        designAction: designResult.designAction,
        isOffTopic: false,
        source: 'smart_inventory_brain'
      });
    }

    const localReply = generateLocalFloralResponse(trimmedMsg, availableFlowers, readyBouquets, deliveryZones);
    return res.json({
      success: true,
      reply: localReply,
      designAction: null,
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
        <h1>404 - الصفحة غير موجودة</h1>
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
  console.error(' Express Server Error:', err);
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
    console.log(` خادم Express.js لمتجر واستوديو "مسكة" يعمل الآن بنجاح!`);
    console.log(` تصفح الموقع مباشرة في المتصفح: http://localhost:${PORT}`);
    console.log(` واجهات الـ REST API متاحة على:  http://localhost:${PORT}/api/`);
    console.log(` قاعدة البيانات المتصلة:      ${db.isMySQL ? (process.env.DB_DATABASE || 'maska_db') + ' (MySQL 8.0)' : db.DB_PATH + ' (SQLite)'}`);
    console.log(` رابط الاتصال (DATABASE_URL): ${process.env.DATABASE_URL || 'mysql://root:1234@127.0.0.1:3306/maska_db'}`);
    console.log('=============================================================================');
  });
}

module.exports = app;
