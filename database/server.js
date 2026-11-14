// =========================================================
// خادم واجهة برمجية خفيف لمشروع مسكة (Maska Backend API Server)
// يعمل بدون الحاجة لتثبيت أي مكتبات خارجية (Built-in Node.js HTTP)
// =========================================================

const http = require('http');
const url = require('url');
const dbClient = require('./db.js');

const PORT = process.env.PORT || 3000;

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data, null, 2));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // التعامل مع طلبات CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;

  try {
    // 1. إحصائيات لوحة التحكم
    if (method === 'GET' && path === '/api/stats') {
      return sendJSON(res, 200, { success: true, data: dbClient.getDashboardStats() });
    }

    // 2. قائمة الطلبات للداشبورد
    if (method === 'GET' && path === '/api/orders') {
      return sendJSON(res, 200, { success: true, data: dbClient.getAllOrders() });
    }

    // 3. تفاصيل طلب برقم الطلب (مثال: /api/orders/1048)
    if (method === 'GET' && path.startsWith('/api/orders/')) {
      const orderNo = path.split('/')[3];
      const details = dbClient.getOrderDetails(orderNo);
      if (!details) {
        return sendJSON(res, 404, { success: false, message: 'الطلب غير موجود' });
      }
      return sendJSON(res, 200, { success: true, data: details });
    }

    // 4. مخزون زهور الاستوديو
    if (method === 'GET' && path === '/api/inventory') {
      return sendJSON(res, 200, { success: true, data: dbClient.getFlowerStock() });
    }

    // 5. قائمة السائقين ومواقعهم
    if (method === 'GET' && path === '/api/drivers') {
      return sendJSON(res, 200, { success: true, data: dbClient.getDriversList() });
    }

    // 6. تسجيل الدخول بالهاتف وكلمة المرور
    if (method === 'POST' && path === '/api/auth/login') {
      const body = await parseBody(req);
      const user = dbClient.authenticateUser(body.phone, body.password);
      if (!user) {
        return sendJSON(res, 401, { success: false, message: 'بيانات الدخول غير صحيحة' });
      }
      return sendJSON(res, 200, { success: true, user });
    }

    // 7. تحديث موقع السائق بالـ GPS
    if (method === 'POST' && path === '/api/drivers/location') {
      const body = await parseBody(req);
      if (!body.driverId || typeof body.lat !== 'number' || typeof body.lng !== 'number') {
        return sendJSON(res, 400, { success: false, message: 'بيانات الموقع غير مكتملة' });
      }
      dbClient.updateDriverLocation(body.driverId, body.lat, body.lng, body.orderId, body.speed || 0);
      return sendJSON(res, 200, { success: true, message: 'تم تحديث موقع السائق بنجاح 📍' });
    }

    // غير معرّف
    sendJSON(res, 404, {
      success: false,
      message: 'الواجهة البرمجية غير موجودة',
      availableEndpoints: [
        'GET  /api/stats',
        'GET  /api/orders',
        'GET  /api/orders/:orderNumber',
        'GET  /api/inventory',
        'GET  /api/drivers',
        'POST /api/auth/login',
        'POST /api/drivers/location'
      ]
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🌸 خادم واجهة مسكة يعمل الآن على: http://localhost:${PORT}`);
    console.log(`📦 قاعدة البيانات المتصلة: ${path.join(__dirname, 'maska.db')}`);
  });
}

module.exports = server;

