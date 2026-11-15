// =============================================================================
// عميل الـ API الخاص بمتجر واستوديو مسكة
// يتصل مباشرة بخادم Express.js عبر البادئة /api/
// =============================================================================

const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const res = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || `خطأ في الخادم (${res.status})`);
    }
    return data;
  } catch (err) {
    console.error(`API Error [${endpoint}]:`, err);
    throw err;
  }
}

export const api = {
  // 1. المصادقة والمستخدمين
  login: (phone, password) => request('/auth/login', { method: 'POST', body: { phone, password } }),
  register: (userData) => request('/auth/register', { method: 'POST', body: userData }),

  // 2. إحصائيات الداشبورد
  getStats: () => request('/dashboard/stats'),

  // 3. إدارة الطلبات
  getOrders: (limit = 50) => request(`/orders?limit=${limit}`),
  getOrderDetails: (orderNumber) => request(`/orders/${orderNumber}`),
  createOrder: (orderData) => request('/orders', { method: 'POST', body: orderData }),
  updateOrderStatus: (orderNumber, status, comment = '', userId = null) => 
    request(`/orders/${orderNumber}/status`, { method: 'PATCH', body: { status, comment, userId } }),
  assignStaff: (orderNumber, staffData) => 
    request(`/orders/${orderNumber}/assign`, { method: 'POST', body: staffData }),

  // 4. السائقين ومنسقي الورد والتتبع بالـ GPS
  getDrivers: () => request('/drivers'),
  getFlorists: () => request('/florists'),
  getDriverOrders: (driverId = null) => request(`/driver/orders${driverId ? `?driverId=${driverId}` : ''}`),
  updateDriverStatus: (driverId, status) => request('/driver/status', { method: 'PATCH', body: { driverId, status } }),
  updateDriverLocation: (data) => request('/drivers/location', { method: 'POST', body: data }),

  // 5. مخزون الزهور للاستوديو وصور الزوايا
  getInventory: () => request('/inventory'),
  addFlower: (flowerData) => request('/inventory', { method: 'POST', body: flowerData }),
  updateFlower: (id, flowerData) => request(`/inventory/${id}`, { method: 'PUT', body: flowerData }),
  deleteFlower: (id) => request(`/inventory/${id}`, { method: 'DELETE' }),
  uploadFlowerAngle: (angle, base64Data, fileName = '') => 
    request('/upload/flower-angle', { method: 'POST', body: { angle, base64Data, fileName } }),
  updateInventory: (flowerId, quantity, unitPrice = null) => 
    request(`/inventory/${flowerId}`, { method: 'PATCH', body: { quantity, unitPrice } }),

  // 5b. كتالوج الباقات وتركيبة الورود
  getBouquets: () => request('/bouquets'),
  getBouquetDetails: (id) => request(`/bouquets/${id}`),
  createBouquet: (bouquetData) => request('/bouquets', { method: 'POST', body: bouquetData }),
  updateBouquet: (id, bouquetData) => request(`/bouquets/${id}`, { method: 'PUT', body: bouquetData }),
  deleteBouquet: (id) => request(`/bouquets/${id}`, { method: 'DELETE' }),

  // 6. الكوبونات والخصومات
  getCoupons: () => request('/coupons'),
  createCoupon: (couponData) => request('/coupons', { method: 'POST', body: couponData }),
  validateCoupon: (code, subtotal) => request('/coupons/validate', { method: 'POST', body: { code, subtotal } }),
  toggleCouponStatus: (id, isActive) => request(`/coupons/${id}/status`, { method: 'PATCH', body: { isActive } }),
  deleteCoupon: (id) => request(`/coupons/${id}`, { method: 'DELETE' }),

  // 7. التقييمات وملاحظات الزبائن
  getReviews: (featured = false) => request(`/reviews${featured ? '?featured=true' : ''}`),
  addReview: (reviewData) => request('/reviews', { method: 'POST', body: reviewData }),
  replyReview: (id, replyText) => request(`/reviews/${id}/reply`, { method: 'POST', body: { replyText } }),
  toggleReviewFeatured: (id, isFeatured) => request(`/reviews/${id}/featured`, { method: 'PATCH', body: { isFeatured } }),

  // 8. الملاحظات العامة
  getFeedback: () => request('/feedback'),
  submitFeedback: (feedbackData) => request('/feedback', { method: 'POST', body: feedbackData }),

  // 9. الأسعار وسجل الرقابة
  getPricingZones: () => request('/pricing/zones'),
  updateZoneFee: (id, fee, reason = '', adminId = null) => 
    request(`/pricing/zones/${id}`, { method: 'PATCH', body: { fee, reason, adminId } }),
  updateFlowerPrice: (id, price, reason = '', adminId = null) => 
    request(`/pricing/flowers/${id}`, { method: 'PATCH', body: { price, reason, adminId } }),
  updateBouquetPrice: (id, price, reason = '', adminId = null) => 
    request(`/pricing/bouquets/${id}`, { method: 'PATCH', body: { price, reason, adminId } }),
  getPriceHistory: (limit = 50) => request(`/pricing/history?limit=${limit}`)
};

