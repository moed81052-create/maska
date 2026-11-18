<script>
  import { onMount, onDestroy, tick } from 'svelte';
  import 'leaflet/dist/leaflet.css';
  import L from 'leaflet';
  import { auth, isStaff, isAdmin } from '../stores/auth.js';
  import { router } from '../stores/router.js';
  import { api } from '../lib/api.js';
  import {
    calculateDistanceMeters,
    generateEllipsePoints,
    generateInitialBoxPoints,
    extractZonePoints,
    calculatePolygonCenter,
    calculateApproxArea
  } from '../lib/geoUtils.js';

  let currentTab = 'orders'; // 'orders' | 'drivers' | 'financials' | 'users' | 'inventory' | 'bouquets' | 'coupons' | 'reviews' | 'pricing'
  let mobileSidebarOpen = false;

  function getActiveTabLabel(tab) {
    switch (tab) {
      case 'orders': return 'الطلبات والتسليم';
      case 'drivers': return 'السائقون والتتبع';
      case 'financials': return 'العهد والمالية';
      case 'users': return 'الطاقم والمستخدمون';
      case 'inventory': return 'مخزون الورود والزوايا';
      case 'bouquets': return 'كتالوج الباقات';
      case 'coupons': return 'الكوبونات والخصومات';
      case 'reviews': return 'التقييمات والملاحظات ⭐';
      case 'pricing': return 'أسعار التوصيل والرقابة';
      default: return 'لوحة التحكم';
    }
  }

  let loading = true;
  let stats = null;

  // الطلبات ومسار المراحل
  let orders = [];
  let filterStatus = 'all'; // 'all' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered'
  let orderSearchQuery = '';
  let ordersViewMode = 'pipeline'; // 'pipeline' | 'table'

  const orderStages = [
    { key: 'confirmed', label: 'طلبات جديدة ومؤكدة', shortLabel: 'جديدة', step: 1, icon: '🌸', color: '#e11d48' },
    { key: 'preparing', label: 'جاري التنسيق في الأتيليه', shortLabel: 'تنسيق', step: 2, icon: '🌿', color: '#d97706' },
    { key: 'out_for_delivery', label: 'قيد التوصيل مع الكابتن', shortLabel: 'توصيل', step: 3, icon: '🚗', color: '#2563eb' },
    { key: 'delivered', label: 'مكتملة ومسلّمة بنجاح', shortLabel: 'مكتملة', step: 4, icon: '✨', color: '#16a34a' }
  ];

  function getStageIndex(status) {
    switch (status) {
      case 'confirmed': return 0;
      case 'preparing': return 1;
      case 'out_for_delivery': return 2;
      case 'delivered': return 3;
      default: return 0;
    }
  }

  function getStageLabel(status) {
    const s = orderStages.find(x => x.key === status);
    return s ? s.label : 'مؤكد';
  }

  function getNextStage(status) {
    switch (status) {
      case 'confirmed': return 'preparing';
      case 'preparing': return 'out_for_delivery';
      case 'out_for_delivery': return 'delivered';
      default: return null;
    }
  }

  function getNextStageLabel(status) {
    switch (status) {
      case 'confirmed': return 'بدء التنسيق 🌿';
      case 'preparing': return 'تسليم للسائق 🚗';
      case 'out_for_delivery': return 'تأكيد التسليم ✨';
      default: return null;
    }
  }

  async function handleAdvanceStage(order) {
    const next = getNextStage(order.status);
    if (!next) return;
    await handleStatusChange(order.order_number, next);
    if (orderTrackingModal.open && orderTrackingModal.order?.order_number === order.order_number) {
      orderTrackingModal.order.status = next;
    }
  }

  $: countAll = orders.length;
  $: countNew = orders.filter(o => o.status === 'confirmed').length;
  $: countPreparing = orders.filter(o => o.status === 'preparing').length;
  $: countDelivery = orders.filter(o => o.status === 'out_for_delivery').length;
  $: countDelivered = orders.filter(o => o.status === 'delivered').length;

  // السائقون ومنسقو الورد
  let drivers = [];
  let florists = [];

  // النظام المالي للعهد والتسويات للسائقين
  let driversFinancials = { drivers: [], totals: {} };
  let settlementsHistory = [];
  let settleModal = {
    open: false,
    driver: null,
    custodyCleared: 0,
    driverEarningsDeducted: 0,
    netCashReceived: 0,
    notes: '',
    saving: false,
    errorMsg: '',
    successMsg: ''
  };
  let driverStatementModal = {
    open: false,
    loading: false,
    data: null
  };

  function openSettleModal(driver) {
    const custody = Number(driver.current_custody_amount) || 0;
    const earnings = Number(driver.pending_earnings) || 0;
    const net = Math.max(0, custody - earnings);

    settleModal = {
      open: true,
      driver,
      custodyCleared: custody,
      driverEarningsDeducted: earnings,
      netCashReceived: net,
      notes: `تسوية عهدة وتوريد كاش لحساب الكابتن ${driver.full_name}`,
      saving: false,
      errorMsg: '',
      successMsg: ''
    };
  }

  async function handleConfirmSettlement() {
    if (!settleModal.driver) return;
    settleModal.saving = true;
    settleModal.errorMsg = '';
    settleModal.successMsg = '';

    try {
      const res = await api.settleDriverCustody({
        driverId: settleModal.driver.id,
        adminId: $auth?.id,
        custodyCleared: Number(settleModal.custodyCleared) || 0,
        driverEarningsDeducted: Number(settleModal.driverEarningsDeducted) || 0,
        netCashReceived: Number(settleModal.netCashReceived) || 0,
        notes: settleModal.notes
      });

      settleModal.successMsg = `تمت التسوية بنجاح واستلام المبلغ برقم إيصال ${res.receipt?.settlement_number || ''}`;
      await reloadFinancials();
      const dRes = await api.getDrivers();
      if (dRes && dRes.data) drivers = dRes.data;

      setTimeout(() => {
        settleModal.open = false;
      }, 1200);
    } catch (err) {
      settleModal.errorMsg = err.message || 'حدث خطأ أثناء إجراء التسوية';
    } finally {
      settleModal.saving = false;
    }
  }

  async function openDriverStatement(driverId) {
    driverStatementModal = { open: true, loading: true, data: null };
    try {
      const res = await api.getDriverFinancialSummary(driverId);
      if (res && res.data) {
        driverStatementModal.data = res.data;
      }
    } catch (err) {
      console.error(err);
    } finally {
      driverStatementModal.loading = false;
    }
  }

  async function reloadFinancials() {
    try {
      const [fRes, hRes] = await Promise.allSettled([
        api.getDriversFinancials(),
        api.getSettlementsHistory(50)
      ]);
      if (fRes.status === 'fulfilled' && fRes.value.data) driversFinancials = fRes.value.data;
      if (hRes.status === 'fulfilled' && hRes.value.data) settlementsHistory = hRes.value.data;
    } catch (e) {
      console.error(e);
    }
  }

  // ================= إدارة الطاقم والمستخدمين =================
  let allUsers = [];
  let userFilterRole = 'all';
  let userSearchQuery = '';
  let userModal = {
    open: false,
    fullName: '',
    phone: '',
    email: '',
    password: '',
    role: 'driver',
    vehicleType: 'سيارة هيونداي تبريد',
    plateNumber: '',
    nationalId: '',
    saving: false,
    errorMsg: '',
    successMsg: ''
  };

  function openCreateUserModal(defaultRole = 'driver') {
    userModal = {
      open: true,
      fullName: '',
      phone: '',
      email: '',
      password: '',
      role: defaultRole,
      vehicleType: 'سيارة هيونداي تبريد',
      plateNumber: '',
      nationalId: '',
      saving: false,
      errorMsg: '',
      successMsg: ''
    };
  }

  function generateRandomPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    userModal.password = pass;
  }

  async function handleSaveUser() {
    if (!userModal.fullName || !userModal.phone || !userModal.password) {
      userModal.errorMsg = 'يرجى كتابة الاسم الكامل، رقم الهاتف، وكلمة المرور';
      return;
    }
    userModal.saving = true;
    userModal.errorMsg = '';
    userModal.successMsg = '';

    try {
      await api.createUser({
        fullName: userModal.fullName,
        phone: userModal.phone,
        email: userModal.email,
        password: userModal.password,
        role: userModal.role,
        vehicleType: userModal.vehicleType,
        plateNumber: userModal.plateNumber,
        nationalId: userModal.nationalId
      });

      const roleLabels = {
        driver: 'كابتن توصيل',
        florist: 'منسق زهور',
        admin: 'مدير نظام',
        customer: 'زبون'
      };

      userModal.successMsg = `تمت إضافة ${userModal.fullName} بنجاح كـ ${roleLabels[userModal.role] || 'مستخدم'}`;
      
      await reloadUsers();
      const [dRes, flRes] = await Promise.allSettled([api.getDrivers(), api.getFlorists()]);
      if (dRes.status === 'fulfilled' && dRes.value.data) drivers = dRes.value.data;
      if (flRes.status === 'fulfilled' && flRes.value.data) florists = flRes.value.data;
      if (userModal.role === 'driver') await reloadFinancials();

      setTimeout(() => {
        userModal.open = false;
      }, 1200);
    } catch (err) {
      userModal.errorMsg = err.message || 'حدث خطأ أثناء حفظ المستخدم';
    } finally {
      userModal.saving = false;
    }
  }

  async function handleToggleUserStatus(u) {
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      await api.updateUserStatus(u.id, newStatus);
      u.status = newStatus;
      allUsers = [...allUsers];
      const [dRes, flRes] = await Promise.allSettled([api.getDrivers(), api.getFlorists()]);
      if (dRes.status === 'fulfilled' && dRes.value.data) drivers = dRes.value.data;
      if (flRes.status === 'fulfilled' && flRes.value.data) florists = flRes.value.data;
    } catch (err) {
      alert(err.message || 'فشل تحديث حالة المستخدم');
    }
  }

  async function handleDeleteUser(u) {
    if (!confirm(`هل أنت متأكد من حذف الحساب (${u.full_name})؟`)) return;
    try {
      await api.deleteUser(u.id);
      allUsers = allUsers.filter(x => x.id !== u.id);
      const [dRes, flRes] = await Promise.allSettled([api.getDrivers(), api.getFlorists()]);
      if (dRes.status === 'fulfilled' && dRes.value.data) drivers = dRes.value.data;
      if (flRes.status === 'fulfilled' && flRes.value.data) florists = flRes.value.data;
      await reloadFinancials();
    } catch (err) {
      alert(err.message || 'فشل حذف المستخدم');
    }
  }

  async function reloadUsers() {
    try {
      const res = await api.getUsers();
      if (res && res.data) allUsers = res.data;
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  }

  $: filteredUsers = allUsers.filter(u => {
    const matchRole = userFilterRole === 'all' || u.role_name === userFilterRole;
    if (!matchRole) return false;
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  });

  // مودال توجيه وإسناد الطلب للمنسقة والسائق
  let assignModal = {
    open: false,
    order: null,
    floristId: '',
    driverId: '',
    targetStatus: 'confirmed',
    saving: false,
    successMsg: '',
    errorMsg: ''
  };

  function openAssignModal(order) {
    assignModal = {
      open: true,
      order: { ...order },
      floristId: order.assigned_florist_id || '',
      driverId: order.assigned_driver_id || '',
      targetStatus: order.status || 'confirmed',
      saving: false,
      successMsg: '',
      errorMsg: ''
    };
  }

  function closeAssignModal() {
    assignModal.open = false;
    assignModal.order = null;
    assignModal.errorMsg = '';
    assignModal.successMsg = '';
  }

  async function handleSaveAssignment() {
    if (!assignModal.order) return;
    assignModal.saving = true;
    assignModal.errorMsg = '';
    assignModal.successMsg = '';

    try {
      const res = await api.assignStaff(assignModal.order.order_number, {
        floristId: assignModal.floristId || null,
        driverId: assignModal.driverId || null,
        status: assignModal.targetStatus,
        assignedByUserId: $auth?.id
      });

      if (res && res.success) {
        const floristObj = florists.find(f => f.id === assignModal.floristId);
        const driverObj = drivers.find(d => d.id === assignModal.driverId);

        orders = orders.map(o => {
          if (o.order_number === assignModal.order.order_number) {
            return {
              ...o,
              assigned_florist_id: assignModal.floristId || null,
              assigned_driver_id: assignModal.driverId || null,
              florist_name: floristObj ? floristObj.full_name : (assignModal.floristId ? o.florist_name : null),
              driver_name: driverObj ? driverObj.full_name : (assignModal.driverId ? o.driver_name : null),
              status: assignModal.targetStatus || o.status
            };
          }
          return o;
        });

        assignModal.successMsg = `تم توجيه وإسناد الطلب #${assignModal.order.order_number} بنجاح!`;
        setTimeout(() => {
          closeAssignModal();
        }, 1200);

        // تحديث الإحصائيات
        const s = await api.getStats();
        if (s && s.data) stats = s.data;
      }
    } catch (err) {
      assignModal.errorMsg = err.message || 'حدث خطأ أثناء حفظ التوجيه والإسناد';
    } finally {
      assignModal.saving = false;
    }
  }

  // مودال التتبع المباشر للطلب بالخريطة ومسار المراحل
  let orderTrackingModal = {
    open: false,
    orderNumber: null,
    loading: false,
    order: null,
    items: [],
    history: [],
    mapInstance: null,
    errorMsg: ''
  };

  async function openOrderTracking(orderOrNum) {
    const num = typeof orderOrNum === 'object' ? orderOrNum.order_number : orderOrNum;
    orderTrackingModal.open = true;
    orderTrackingModal.orderNumber = num;
    orderTrackingModal.loading = true;
    orderTrackingModal.errorMsg = '';
    orderTrackingModal.order = typeof orderOrNum === 'object' ? { ...orderOrNum } : null;
    orderTrackingModal.items = [];
    orderTrackingModal.history = [];

    await tick();

    try {
      const res = await api.getOrderDetails(num);
      if (res && res.success && res.data) {
        orderTrackingModal.order = res.data.order;
        orderTrackingModal.items = res.data.items || [];
        orderTrackingModal.history = res.data.history || [];
      }
    } catch (err) {
      console.error('Error fetching order details:', err);
      orderTrackingModal.errorMsg = 'تعذر تحميل بيانات التتبع الكاملة للطلب';
    } finally {
      orderTrackingModal.loading = false;
      await tick();
      initOrderTrackingMap();
    }
  }

  function closeOrderTracking() {
    if (orderTrackingModal.mapInstance) {
      try {
        orderTrackingModal.mapInstance.remove();
      } catch (e) {}
      orderTrackingModal.mapInstance = null;
    }
    orderTrackingModal.open = false;
    orderTrackingModal.order = null;
  }

  function initOrderTrackingMap() {
    if (!orderTrackingModal.open || !orderTrackingModal.order) return;
    const mapContainer = document.getElementById('order-tracking-live-map');
    if (!mapContainer) return;

    if (orderTrackingModal.mapInstance) {
      try {
        orderTrackingModal.mapInstance.remove();
      } catch (e) {}
      orderTrackingModal.mapInstance = null;
    }

    const ord = orderTrackingModal.order;

    // موقع الأتيليه الرئيسي
    let atelierCoord = [32.8872, 13.1913]; // طرابلس المركز
    if (ord.delivery_city === 'بنغازي') atelierCoord = [32.1167, 20.0667];
    else if (ord.delivery_city === 'مصراتة') atelierCoord = [32.3754, 15.0925];

    // موقع المستلم / الوجهة
    let destCoord = [
      Number(ord.delivery_lat) || (atelierCoord[0] + 0.025),
      Number(ord.delivery_lng) || (atelierCoord[1] + 0.035)
    ];

    // موقع السائق
    let driverCoord = null;
    if (ord.driver_lat && ord.driver_lng) {
      driverCoord = [Number(ord.driver_lat), Number(ord.driver_lng)];
    } else {
      driverCoord = [
        atelierCoord[0] + (destCoord[0] - atelierCoord[0]) * 0.65,
        atelierCoord[1] + (destCoord[1] - atelierCoord[1]) * 0.65
      ];
    }

    try {
      const map = L.map('order-tracking-live-map', {
        attributionControl: false
      }).setView(driverCoord || atelierCoord, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // ماركر الأتيليه
      const atelierIcon = L.divIcon({
        className: 'custom-map-marker-atelier',
        html: '<div style="background:#2e4432;color:#d4af37;padding:5px 9px;border-radius:18px;font-size:11px;font-weight:700;box-shadow:0 3px 8px rgba(0,0,0,0.3);white-space:nowrap;border:1px solid #d4af37;">🌿 أتيليه مسكة</div>',
        iconSize: [100, 28],
        iconAnchor: [50, 14]
      });
      L.marker(atelierCoord, { icon: atelierIcon }).addTo(map)
        .bindPopup(`<b>أتيليه مسكة للزهور</b><br>${ord.delivery_city || 'طرابلس'}`);

      // ماركر المستلم
      const destIcon = L.divIcon({
        className: 'custom-map-marker-dest',
        html: `<div style="background:#b91c1c;color:#fff;padding:5px 9px;border-radius:18px;font-size:11px;font-weight:700;box-shadow:0 3px 8px rgba(0,0,0,0.3);white-space:nowrap;">📍 ${ord.recipient_name || 'وجهة التسليم'}</div>`,
        iconSize: [110, 28],
        iconAnchor: [55, 14]
      });
      L.marker(destCoord, { icon: destIcon }).addTo(map)
        .bindPopup(`<b>وجهة الاستلام:</b><br>${ord.recipient_name} (${ord.recipient_phone})<br>${ord.delivery_city} - ${ord.delivery_zone || ''}`);

      // ماركر السائق
      if (ord.driver_name || ord.status === 'out_for_delivery') {
        const driverIcon = L.divIcon({
          className: 'custom-map-marker-driver',
          html: `<div style="background:#1d4ed8;color:#fff;padding:5px 9px;border-radius:18px;font-size:11px;font-weight:700;box-shadow:0 3px 8px rgba(0,0,0,0.3);white-space:nowrap;border:2px solid #93c5fd;">🚗 ${ord.driver_name || 'الكابتن'}</div>`,
          iconSize: [110, 28],
          iconAnchor: [55, 14]
        });
        L.marker(driverCoord, { icon: driverIcon }).addTo(map)
          .bindPopup(`<b>كابتن التوصيل:</b> ${ord.driver_name || 'مسند'}<br>هاتف: ${ord.driver_phone || '—'}<br>مركبة: ${ord.vehicle_type || 'سيارة مبردة'}`);
      }

      // رسم مسار التوصيل
      const routePoints = [atelierCoord];
      if (driverCoord) routePoints.push(driverCoord);
      routePoints.push(destCoord);

      L.polyline(routePoints, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 8'
      }).addTo(map);

      map.fitBounds(L.latLngBounds(routePoints).pad(0.2));

      orderTrackingModal.mapInstance = map;
    } catch (e) {
      console.error('Error rendering tracking map:', e);
    }
  }

  // المخزون والورود متعددة الزوايا
  let inventory = [];

  let flowerModal = {
    open: false,
    isEdit: false,
    id: null,
    name_ar: '',
    color: 'وردي',
    unit_price: 5,
    stock_quantity: 80,
    alert_threshold: 15,
    image_front: '/assets/flowers/pink-rose-front.svg',
    image_side: '/assets/flowers/pink-rose-side.svg',
    image_top: '/assets/flowers/pink-rose-top.svg',
    image_stem: '/assets/flowers/pink-rose-stem.svg',
    description: '',
    activeAnglePreview: 'front',
    uploadingAngle: '',
    saving: false,
    errorMsg: '',
    successMsg: ''
  };

  let flowerAnglesViewer = {
    open: false,
    flower: null,
    activeAngle: 'front'
  };

  function getAngleLabel(angle) {
    switch (angle) {
      case 'front': return 'الزاوية الأمامية';
      case 'side': return 'الزاوية الجانبية';
      case 'top': return 'الزاوية العلوية والبتلات';
      case 'stem': return 'تفاصيل الساق والأوراق';
      default: return angle;
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  async function handleAngleFileUpload(event, angle) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    flowerModal.uploadingAngle = angle;
    flowerModal.errorMsg = '';
    flowerModal.successMsg = '';

    try {
      const base64 = await fileToBase64(file);
      const res = await api.uploadFlowerAngle(angle, base64, file.name);
      const fileUrl = res.url || base64;

      flowerModal['image_' + angle] = fileUrl;
      flowerModal.activeAnglePreview = angle;
      flowerModal.successMsg = `تم رفع وتعيين صورة (${getAngleLabel(angle)}) بنجاح`;
    } catch (err) {
      console.error('Upload error:', err);
      try {
        const base64 = await fileToBase64(file);
        flowerModal['image_' + angle] = base64;
        flowerModal.activeAnglePreview = angle;
        flowerModal.successMsg = `تم اعتماد صورة (${getAngleLabel(angle)}) بنجاح`;
      } catch (e) {
        flowerModal.errorMsg = 'تعذر قراءة ملف الصورة: ' + (err.message || 'خطأ');
      }
    } finally {
      flowerModal.uploadingAngle = '';
      if (event.target) event.target.value = '';
    }
  }

  async function handleBulkAngleUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    flowerModal.uploadingAngle = 'bulk';
    flowerModal.errorMsg = '';
    flowerModal.successMsg = `جاري معالجة ورفع ${Math.min(files.length, 4)} صور للزوايا...`;

    const angleKeys = ['front', 'side', 'top', 'stem'];
    let count = 0;

    for (let i = 0; i < Math.min(files.length, 4); i++) {
      const file = files[i];
      const angle = angleKeys[i];
      try {
        const base64 = await fileToBase64(file);
        const res = await api.uploadFlowerAngle(angle, base64, file.name);
        flowerModal['image_' + angle] = res.url || base64;
        count++;
      } catch (err) {
        const base64 = await fileToBase64(file);
        flowerModal['image_' + angle] = base64;
        count++;
      }
    }

    flowerModal.uploadingAngle = '';
    flowerModal.successMsg = `تم بنجاح رفع وتعيين ${count} صور لزوايا الوردة`;
    flowerModal.activeAnglePreview = 'front';
    if (event.target) event.target.value = '';
  }

  function downloadImageFile(url, fileName) {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'flower-angle.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadAllFlowerAngles(flower) {
    if (!flower) return;
    const cleanName = (flower.name_ar || 'flower').replace(/\s+/g, '_');
    const angles = [
      { key: 'front', label: '1_front', url: flower.image_front || flower.image_url },
      { key: 'side', label: '2_side', url: flower.image_side },
      { key: 'top', label: '3_top', url: flower.image_top },
      { key: 'stem', label: '4_stem', url: flower.image_stem }
    ];

    angles.forEach((item, index) => {
      if (item.url) {
        setTimeout(() => {
          const ext = item.url.includes('.svg') ? 'svg' : (item.url.includes('.webp') ? 'webp' : 'jpg');
          downloadImageFile(item.url, `${cleanName}_${item.label}.${ext}`);
        }, index * 250);
      }
    });
  }

  function getCurrentViewerUrl() {
    if (!flowerAnglesViewer.flower) return '';
    const f = flowerAnglesViewer.flower;
    switch (flowerAnglesViewer.activeAngle) {
      case 'front': return f.image_front || f.image_url || '/assets/flowers/pink-rose-front.svg';
      case 'side': return f.image_side || '/assets/flowers/pink-rose-side.svg';
      case 'top': return f.image_top || '/assets/flowers/pink-rose-top.svg';
      case 'stem': return f.image_stem || '/assets/flowers/pink-rose-stem.svg';
      default: return f.image_front || f.image_url;
    }
  }

  let quickFlowerAngleUploading = false;
  let quickFlowerAngleMsg = '';

  async function handleQuickFlowerAngleUpload(event, flower, angle) {
    const file = event.target.files && event.target.files[0];
    if (!file || !flower) return;

    quickFlowerAngleUploading = true;
    quickFlowerAngleMsg = '';

    try {
      const base64 = await fileToBase64(file);
      const res = await api.uploadFlowerAngleDirect(flower.id, angle, base64, file.name);
      const fileUrl = res.url || base64;

      const colMap = { front: 'image_front', side: 'image_side', top: 'image_top', stem: 'image_stem' };
      const col = colMap[angle] || 'image_front';

      flower[col] = fileUrl;
      if (angle === 'front') {
        flower.image_url = fileUrl;
      }
      inventory = inventory.map(f => f.id === flower.id ? { ...f, [col]: fileUrl, ...(angle === 'front' ? { image_url: fileUrl } : {}) } : f);
      flowerAnglesViewer.flower = { ...flower, [col]: fileUrl, ...(angle === 'front' ? { image_url: fileUrl } : {}) };
      quickFlowerAngleMsg = `تم رفع وتحديث صورة (${getAngleLabel(angle)}) بنجاح`;
    } catch (err) {
      console.error('Quick flower angle upload failed:', err);
      alert('تعذر رفع صورة الزاوية: ' + (err.message || 'خطأ'));
    } finally {
      quickFlowerAngleUploading = false;
      if (event.target) event.target.value = '';
    }
  }

  const flowerPresets = [
    { name: 'جوري وردي نضر', color: 'وردي', price: 4, front: '/assets/flowers/pink-rose-front.svg', side: '/assets/flowers/pink-rose-side.svg', top: '/assets/flowers/pink-rose-top.svg', stem: '/assets/flowers/pink-rose-stem.svg' },
    { name: 'جوري أحمر مخملي', color: 'أحمر قرمزي', price: 5, front: '/assets/flowers/red-rose-front.svg', side: '/assets/flowers/red-rose-side.svg', top: '/assets/flowers/red-rose-top.svg', stem: '/assets/flowers/red-rose-stem.svg' },
    { name: 'توليب أبيض نقي', color: 'أبيض', price: 5, front: '/assets/flowers/white-tulip-front.svg', side: '/assets/flowers/white-tulip-side.svg', top: '/assets/flowers/white-tulip-top.svg', stem: '/assets/flowers/white-tulip-stem.svg' },
    { name: 'جبسوفيلا ناعمة', color: 'أبيض حليبي', price: 4.5, front: '/assets/flowers/baby-breath-front.svg', side: '/assets/flowers/baby-breath-side.svg', top: '/assets/flowers/baby-breath-top.svg', stem: '/assets/flowers/baby-breath-stem.svg' },
    { name: 'فاوانيا ملكية', color: 'وردي مذهب', price: 9, front: '/assets/flowers/peony-front.svg', side: '/assets/flowers/peony-side.svg', top: '/assets/flowers/peony-top.svg', stem: '/assets/flowers/peony-stem.svg' },
    { name: 'أوكالبتوس مريمي', color: 'أخضر مريمي', price: 3, front: '/assets/flowers/eucalyptus-front.svg', side: '/assets/flowers/eucalyptus-side.svg', top: '/assets/flowers/eucalyptus-top.svg', stem: '/assets/flowers/eucalyptus-stem.svg' }
  ];

  function applyFlowerPreset(p) {
    flowerModal.name_ar = p.name;
    flowerModal.color = p.color;
    flowerModal.unit_price = p.price;
    flowerModal.image_front = p.front;
    flowerModal.image_side = p.side;
    flowerModal.image_top = p.top;
    flowerModal.image_stem = p.stem;
  }

  function openAddFlowerModal() {
    flowerModal = {
      open: true,
      isEdit: false,
      id: null,
      name_ar: '',
      color: 'وردي',
      unit_price: 5,
      stock_quantity: 80,
      alert_threshold: 15,
      image_front: '/assets/flowers/pink-rose-front.svg',
      image_side: '/assets/flowers/pink-rose-side.svg',
      image_top: '/assets/flowers/pink-rose-top.svg',
      image_stem: '/assets/flowers/pink-rose-stem.svg',
      description: '',
      activeAnglePreview: 'front',
      uploadingAngle: '',
      saving: false,
      errorMsg: '',
      successMsg: ''
    };
  }

  function openEditFlowerModal(f) {
    flowerModal = {
      open: true,
      isEdit: true,
      id: f.id,
      name_ar: f.name_ar,
      color: f.color,
      unit_price: f.unit_price,
      stock_quantity: f.stock_quantity,
      alert_threshold: f.alert_threshold,
      image_front: f.image_front || f.image_url || '/assets/flowers/pink-rose-front.svg',
      image_side: f.image_side || '/assets/flowers/pink-rose-side.svg',
      image_top: f.image_top || '/assets/flowers/pink-rose-top.svg',
      image_stem: f.image_stem || '/assets/flowers/pink-rose-stem.svg',
      description: f.description || '',
      activeAnglePreview: 'front',
      uploadingAngle: '',
      saving: false,
      errorMsg: '',
      successMsg: ''
    };
  }

  async function handleSaveFlower() {
    if (!flowerModal.name_ar) {
      flowerModal.errorMsg = 'يرجى كتابة اسم الزهرة';
      return;
    }
    flowerModal.saving = true;
    flowerModal.errorMsg = '';
    flowerModal.successMsg = '';

    try {
      const payload = {
        name_ar: flowerModal.name_ar,
        color: flowerModal.color,
        unit_price: Number(flowerModal.unit_price),
        stock_quantity: Number(flowerModal.stock_quantity),
        alert_threshold: Number(flowerModal.alert_threshold),
        image_front: flowerModal.image_front,
        image_side: flowerModal.image_side,
        image_top: flowerModal.image_top,
        image_stem: flowerModal.image_stem,
        image_url: flowerModal.image_front,
        description: flowerModal.description
      };

      if (flowerModal.isEdit) {
        await api.updateFlower(flowerModal.id, payload);
      } else {
        await api.addFlower(payload);
      }

      flowerModal.successMsg = 'تم حفظ صنف الورد وصور زواياه بنجاح';
      const invRes = await api.getInventory();
      if (invRes && invRes.data) inventory = invRes.data;

      setTimeout(() => {
        flowerModal.open = false;
      }, 900);
    } catch (err) {
      flowerModal.errorMsg = err.message || 'حدث خطأ أثناء الحفظ';
    } finally {
      flowerModal.saving = false;
    }
  }

  async function handleDeleteFlower(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الوردة من المخزون؟')) return;
    try {
      await api.deleteFlower(id);
      inventory = inventory.filter(f => f.id !== id);
    } catch (err) {
      alert(err.message || 'تعذر حذف الوردة');
    }
  }

  function viewFlowerAngles(flower, initialAngle = 'front') {
    flowerAnglesViewer = {
      open: true,
      flower,
      activeAngle: initialAngle
    };
  }

  // كتالوج الباقات وتوليفات الورود الدقيقة
  let bouquets = [];
  let uploadingBouquetImage = false;
  let quickBouquetUploadingId = null;

  let bouquetModal = {
    open: false,
    isEdit: false,
    id: null,
    title: '',
    occasion_tag: 'عيد ميلاد',
    price: 85,
    image_svg_path: '/assets/bouquet-pink-spring.svg',
    description: '',
    is_featured: 1,
    is_active: 1,
    flowers: [],
    saving: false,
    errorMsg: '',
    successMsg: ''
  };

  const bouquetImagePresets = [
    { name: 'ربيع وردي', path: '/assets/bouquet-pink-spring.svg' },
    { name: 'أناقة العاج', path: '/assets/bouquet-ivory-elegance.svg' },
    { name: 'همسة المريمي', path: '/assets/bouquet-sage-whisper.svg' },
    { name: 'الباقة الملكية', path: '/assets/bouquet-royal.svg' },
    { name: 'أزهار مسكة العامة', path: '/assets/bouquet.svg' }
  ];

  function openAddBouquetModal() {
    const initialFlowers = [];
    if (inventory.length > 0) {
      initialFlowers.push({ flower_id: inventory[0].id, quantity_stems: 10 });
    }
    if (inventory.length > 1) {
      initialFlowers.push({ flower_id: inventory[1].id, quantity_stems: 5 });
    }

    bouquetModal = {
      open: true,
      isEdit: false,
      id: null,
      title: '',
      occasion_tag: 'عيد ميلاد',
      price: 85,
      image_svg_path: '/assets/bouquet-pink-spring.svg',
      description: '',
      is_featured: 1,
      is_active: 1,
      flowers: initialFlowers,
      saving: false,
      errorMsg: '',
      successMsg: ''
    };
  }

  function openEditBouquetModal(b) {
    bouquetModal = {
      open: true,
      isEdit: true,
      id: b.id,
      title: b.title,
      occasion_tag: b.occasion_tag,
      price: b.price,
      image_svg_path: b.image_svg_path,
      description: b.description || '',
      is_featured: b.is_featured ? 1 : 0,
      is_active: b.is_active ? 1 : 0,
      flowers: (b.flowers || []).map(f => ({
        flower_id: f.flower_id,
        quantity_stems: f.quantity_stems || 1
      })),
      saving: false,
      errorMsg: '',
      successMsg: ''
    };
  }

  function addBouquetFlowerRow() {
    if (inventory.length === 0) {
      alert('لا توجد ورود مسجلة في المخزون. يرجى إضافة ورود أولاً.');
      return;
    }
    const existingIds = new Set((bouquetModal.flowers || []).map(f => Number(f.flower_id)));
    const candidate = inventory.find(f => !existingIds.has(Number(f.id))) || inventory[0];

    bouquetModal.flowers = [
      ...bouquetModal.flowers,
      { flower_id: candidate.id, quantity_stems: 5 }
    ];
  }

  function removeBouquetFlowerRow(index) {
    bouquetModal.flowers = bouquetModal.flowers.filter((_, idx) => idx !== index);
  }

  $: bouquetTotalStems = (bouquetModal.flowers || []).reduce((acc, row) => acc + (Number(row.quantity_stems) || 0), 0);
  $: bouquetEstimatedCost = (bouquetModal.flowers || []).reduce((acc, row) => {
    const flower = inventory.find(f => f.id === Number(row.flower_id));
    const stemPrice = flower ? Number(flower.unit_price) : 0;
    return acc + ((Number(row.quantity_stems) || 0) * stemPrice);
  }, 0);

  async function handleSaveBouquet() {
    if (!bouquetModal.title) {
      bouquetModal.errorMsg = 'يرجى كتابة عنوان الباقة';
      return;
    }
    if (!bouquetModal.price || Number(bouquetModal.price) <= 0) {
      bouquetModal.errorMsg = 'سعر الباقة يجب أن يكون أكبر من صفر';
      return;
    }
    if (!bouquetModal.flowers || bouquetModal.flowers.length === 0) {
      bouquetModal.errorMsg = 'يجب اختيار وتحديد وردة واحدة على الأقل من قائمة الورود المسجلة بالمخزون';
      return;
    }

    // تحقق من أن كل وردة تنتمي لمخزون الورود
    for (const row of bouquetModal.flowers) {
      const match = inventory.find(f => f.id === Number(row.flower_id));
      if (!match) {
        bouquetModal.errorMsg = `الوردة برقم [${row.flower_id}] غير مسجلة في قائمة الورود. لا يمكن إدخال وردة خارج القائمة حتى تضاف أولاً في مخزون الورود.`;
        return;
      }
      if (Number(row.quantity_stems) <= 0) {
        bouquetModal.errorMsg = `عدد سيقان وردة "${match.name_ar}" يجب أن يكون 1 على الأقل`;
        return;
      }
    }

    bouquetModal.saving = true;
    bouquetModal.errorMsg = '';
    bouquetModal.successMsg = '';

    try {
      const payload = {
        title: bouquetModal.title,
        price: Number(bouquetModal.price),
        occasion_tag: bouquetModal.occasion_tag,
        description: bouquetModal.description,
        image_svg_path: bouquetModal.image_svg_path,
        is_featured: bouquetModal.is_featured,
        is_active: bouquetModal.is_active,
        flowers: bouquetModal.flowers.map(f => ({
          flower_id: Number(f.flower_id),
          quantity_stems: Number(f.quantity_stems)
        }))
      };

      if (bouquetModal.isEdit) {
        await api.updateBouquet(bouquetModal.id, payload);
      } else {
        await api.createBouquet(payload);
      }

      bouquetModal.successMsg = 'تم حفظ الباقة وتركيبة الورود بنجاح';
      const bRes = await api.getBouquets();
      if (bRes && bRes.data) bouquets = bRes.data;

      setTimeout(() => {
        bouquetModal.open = false;
      }, 900);
    } catch (err) {
      bouquetModal.errorMsg = err.message || 'حدث خطأ أثناء حفظ الباقة';
    } finally {
      bouquetModal.saving = false;
    }
  }

  async function handleDeleteBouquet(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الباقة نهائياً؟')) return;
    try {
      await api.deleteBouquet(id);
      bouquets = bouquets.filter(b => b.id !== id);
    } catch (err) {
      alert(err.message || 'تعذر حذف الباقة');
    }
  }

  async function handleBouquetImageUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    uploadingBouquetImage = true;
    bouquetModal.errorMsg = '';
    bouquetModal.successMsg = '';

    try {
      const base64 = await fileToBase64(file);
      const res = await api.uploadImage(base64, 'bouquets', file.name);
      bouquetModal.image_svg_path = res.url || base64;
      bouquetModal.successMsg = 'تم رفع واختيار صورة الباقة بنجاح من جهازك';
    } catch (err) {
      console.error('Bouquet upload error:', err);
      try {
        const base64 = await fileToBase64(file);
        bouquetModal.image_svg_path = base64;
        bouquetModal.successMsg = 'تم اعتماد صورة الباقة محلياً بنجاح';
      } catch (e) {
        bouquetModal.errorMsg = 'تعذر قراءة ملف الصورة: ' + (err.message || 'خطأ');
      }
    } finally {
      uploadingBouquetImage = false;
      if (event.target) event.target.value = '';
    }
  }

  async function handleQuickBouquetPhotoUpload(event, bouquet) {
    const file = event.target.files && event.target.files[0];
    if (!file || !bouquet) return;

    quickBouquetUploadingId = bouquet.id;
    try {
      const base64 = await fileToBase64(file);
      const res = await api.uploadBouquetImage(bouquet.id, base64, file.name);
      const newUrl = res.url || base64;

      bouquet.image_svg_path = newUrl;
      bouquets = bouquets.map(b => b.id === bouquet.id ? { ...b, image_svg_path: newUrl } : b);
      alert(`تم بنجاح رفع وتحديث صورة باقة "${bouquet.title}" من جهازك`);
    } catch (err) {
      console.error('Quick bouquet upload failed:', err);
      alert('تعذر تحديث صورة الباقة: ' + (err.message || 'خطأ'));
    } finally {
      quickBouquetUploadingId = null;
      if (event.target) event.target.value = '';
    }
  }

  // الكوبونات
  let coupons = [];
  let showNewCouponModal = false;
  let newCoupon = {
    code: '',
    discountType: 'fixed_amount',
    discountValue: 15,
    minOrderAmount: 60
  };

  // التقييمات والملاحظات
  let reviews = [];
  let feedback = [];
  let replyModal = { open: false, reviewId: null, text: '' };

  // الأسعار وسجل التغييرات
  let zones = [];
  let priceHistory = [];

  onMount(async () => {
    // التحقق من صلاحيات الدخول
    if (!$isStaff) {
      // توجيه لصفحة تسجيل الدخول
    }

    await loadAllAdminData();
  });

  async function loadAllAdminData() {
    loading = true;
    try {
      const [sRes, oRes, dRes, flRes, invRes, bRes, cRes, rRes, fbRes, zRes, hRes, finRes, setRes, uRes] = await Promise.allSettled([
        api.getStats(),
        api.getOrders(100),
        api.getDrivers(),
        api.getFlorists(),
        api.getInventory(),
        api.getBouquets(),
        api.getCoupons(),
        api.getReviews(false),
        api.getFeedback(),
        api.getPricingZones(),
        api.getPriceHistory(20),
        api.getDriversFinancials(),
        api.getSettlementsHistory(50),
        api.getUsers()
      ]);

      if (sRes.status === 'fulfilled' && sRes.value.data) stats = sRes.value.data;
      if (oRes.status === 'fulfilled' && oRes.value.data) orders = oRes.value.data;
      if (dRes.status === 'fulfilled' && dRes.value.data) drivers = dRes.value.data;
      if (flRes.status === 'fulfilled' && flRes.value.data) florists = flRes.value.data;
      if (invRes.status === 'fulfilled' && invRes.value.data) inventory = invRes.value.data;
      if (bRes.status === 'fulfilled' && bRes.value.data) bouquets = bRes.value.data;
      if (cRes.status === 'fulfilled' && cRes.value.data) coupons = cRes.value.data;
      if (rRes.status === 'fulfilled' && rRes.value.data) reviews = rRes.value.data;
      if (fbRes.status === 'fulfilled' && fbRes.value.data) feedback = fbRes.value.data;
      if (zRes.status === 'fulfilled' && zRes.value.data) zones = zRes.value.data;
      if (hRes.status === 'fulfilled' && hRes.value.data) priceHistory = hRes.value.data;
      if (finRes.status === 'fulfilled' && finRes.value.data) driversFinancials = finRes.value.data;
      if (setRes.status === 'fulfilled' && setRes.value.data) settlementsHistory = setRes.value.data;
      if (uRes.status === 'fulfilled' && uRes.value.data) allUsers = uRes.value.data;
    } catch (e) {
      console.error('Error loading admin data:', e);
    } finally {
      loading = false;
    }
  }

  // تحديث حالة الطلب
  async function handleStatusChange(orderNumber, newStatus) {
    try {
      await api.updateOrderStatus(orderNumber, newStatus, 'تحديث من لوحة الإدارة', $auth?.id);
      orders = orders.map(o => o.order_number === orderNumber ? { ...o, status: newStatus } : o);
      // تحديث الإحصائيات
      const s = await api.getStats();
      if (s && s.data) stats = s.data;
    } catch (err) {
      alert('فشل تحديث الحالة: ' + err.message);
    }
  }

  // تحديث مخزون ساق ورد
  async function handleStockUpdate(id, newQty) {
    try {
      await api.updateInventory(id, Number(newQty));
      inventory = inventory.map(item => item.id === id ? { ...item, stock_quantity: Number(newQty) } : item);
    } catch (err) {
      alert('فشل تحديث المخزون: ' + err.message);
    }
  }

  // إنشاء كوبون جديد
  async function handleCreateCoupon() {
    if (!newCoupon.code || !newCoupon.discountValue) return;
    try {
      await api.createCoupon({
        ...newCoupon,
        adminId: $auth?.id
      });
      showNewCouponModal = false;
      newCoupon = { code: '', discountType: 'fixed_amount', discountValue: 15, minOrderAmount: 60 };
      const res = await api.getCoupons();
      if (res && res.data) coupons = res.data;
    } catch (err) {
      alert('فشل إنشاء الكوبون: ' + err.message);
    }
  }

  // تبديل تفعيل كوبون
  async function handleToggleCoupon(id, currentActive) {
    try {
      await api.toggleCouponStatus(id, !currentActive);
      coupons = coupons.map(c => c.id === id ? { ...c, is_active: !currentActive ? 1 : 0 } : c);
    } catch (err) {
      alert('تعذر تعديل الكوبون: ' + err.message);
    }
  }

  // حذف كوبون
  async function handleDeleteCoupon(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الكوبون نهائياً؟')) return;
    try {
      await api.deleteCoupon(id);
      coupons = coupons.filter(c => c.id !== id);
    } catch (err) {
      alert('تعذر حذف الكوبون: ' + err.message);
    }
  }

  // رد الإدارة على التقييم
  async function handleReplyReview() {
    if (!replyModal.text || !replyModal.reviewId) return;
    try {
      await api.replyReview(replyModal.reviewId, replyModal.text);
      reviews = reviews.map(r => r.id === replyModal.reviewId ? { ...r, admin_reply: replyModal.text } : r);
      replyModal = { open: false, reviewId: null, text: '' };
    } catch (err) {
      alert('تعذر إرسال الرد: ' + err.message);
    }
  }

  // تمييز التقييم في الرئيسية
  async function handleToggleFeatured(id, currentFeatured) {
    try {
      await api.toggleReviewFeatured(id, !currentFeatured);
      reviews = reviews.map(r => r.id === id ? { ...r, is_featured: !currentFeatured ? 1 : 0 } : r);
    } catch (err) {
      alert('تعذر التعديل: ' + err.message);
    }
  }

  // 6. إدارة أسعار التوصيل والدوائر والمربعات والمضلعات الجغرافية
  let selectedCityFilter = 'طرابلس';
  let adminGeoMapInstance = null;
  let adminMapLayers = [];
  let modalPreviewCircle = null;
  let modalHandleMarkers = [];

  let editingZoneModal = {
    open: false,
    dockedToMap: false, // وضع التعديل والتشكيل المباشر على الخريطة
    isEdit: false,
    id: null,
    city: 'طرابلس',
    zone_name: '',
    delivery_fee: 10,
    center_lat: 32.8872,
    center_lng: 13.1913,
    radius_meters: 3500, // نصف القطر العرضي (شرق-غرب)
    radius_meters_y: 2500, // نصف القطر الطولي (شمال-جنوب)
    rotation_deg: 0, // زاوية الميلان / الدوران
    shape_type: 'circle', // 'circle' | 'ellipse' | 'box' | 'polygon'
    points: [], // نقاط المضلع أو الأركان الأربعة الحرة [[lat, lng], ...]
    zone_color: '#5e6b2c',
    estimated_minutes: 60,
    interaction_mode: 'handles', // 'handles' | 'add_point'
    coordsConfirmed: false,
    coordsConfirmedMsg: '',
    saving: false,
    errorMsg: ''
  };

  $: filteredZonesForCity = selectedCityFilter === 'all'
    ? zones
    : zones.filter(z => (z.city || z.city_name) === selectedCityFilter);

  $: if (currentTab === 'pricing') {
    initAdminGeoMap();
  }

  onDestroy(() => {
    if (adminGeoMapInstance) {
      adminGeoMapInstance.remove();
      adminGeoMapInstance = null;
    }
    if (orderTrackingModal.mapInstance) {
      try {
        orderTrackingModal.mapInstance.remove();
      } catch (e) {}
      orderTrackingModal.mapInstance = null;
    }
  });

  // الانتقال إلى وضع التشكيل والتأكيد المباشر على الخريطة
  function switchToMapEditing() {
    editingZoneModal.dockedToMap = true;
    tick().then(() => {
      const mapEl = document.getElementById('admin-geo-map');
      if (mapEl) {
        mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (adminGeoMapInstance && editingZoneModal.center_lat && editingZoneModal.center_lng) {
        adminGeoMapInstance.setView([editingZoneModal.center_lat, editingZoneModal.center_lng], 13);
        adminGeoMapInstance.invalidateSize();
      }
      updateModalPreviewLayer(true);
    });
  }

  // العودة إلى المودال الكامل
  function switchToFullModal() {
    editingZoneModal.dockedToMap = false;
  }

  // أيقونة مقابض التحكم الفاخرة القابلة للسحب
  function createHandleIcon(label, color = '#5e6b2c', size = 26) {
    return L.divIcon({
      className: 'geo-vertex-handle-icon',
      html: `<div class="geo-vertex-handle-inner" style="
        border-color: ${color};
        color: ${color};
        width: ${size}px;
        height: ${size}px;
      ">${label}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }

  // تهيئة خريطة نطاقات التوصيل للإدارة
  async function initAdminGeoMap() {
    await tick();
    const mapEl = document.getElementById('admin-geo-map');
    if (!mapEl) return;

    if (adminGeoMapInstance) {
      adminGeoMapInstance.remove();
      adminGeoMapInstance = null;
    }

    let defaultCenter = [32.8872, 13.1913];
    let defaultZoom = 12;

    if (selectedCityFilter === 'بنغازي') {
      defaultCenter = [32.1167, 20.0667];
      defaultZoom = 11;
    } else if (selectedCityFilter === 'مصراتة') {
      defaultCenter = [32.3754, 15.0925];
      defaultZoom = 11;
    }

    adminGeoMapInstance = L.map('admin-geo-map').setView(defaultCenter, defaultZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap - أتيليه مسكة'
    }).addTo(adminGeoMapInstance);

    // النقر على الخريطة أثناء التعديل اليدوي
    adminGeoMapInstance.on('click', (e) => {
      if (!editingZoneModal.open) return;

      const clickLat = Number(e.latlng.lat.toFixed(6));
      const clickLng = Number(e.latlng.lng.toFixed(6));

      if (editingZoneModal.interaction_mode === 'add_point') {
        // إضافة زاوية جديدة للمضلع
        editingZoneModal.points = [...(editingZoneModal.points || []), [clickLat, clickLng]];
        if (editingZoneModal.shape_type !== 'polygon') {
          editingZoneModal.shape_type = 'polygon';
        }
        editingZoneModal.coordsConfirmed = true;
        editingZoneModal.coordsConfirmedMsg = `✓ تم إضافة زاوية جديدة عند (${clickLat.toFixed(4)}, ${clickLng.toFixed(4)})`;
        updateModalPreviewLayer(true);
      } else {
        // تأكيد واعتماد الإحداثيات والمركز يدوياً بالنقر على الخريطة
        const dLat = clickLat - editingZoneModal.center_lat;
        const dLng = clickLng - editingZoneModal.center_lng;

        editingZoneModal.center_lat = clickLat;
        editingZoneModal.center_lng = clickLng;

        // إذا كان الشكل مضلعاً أو مربعاً، نقل كامل الشكل ليتمركز حول الإحداثيات الجديدة
        if (Array.isArray(editingZoneModal.points) && editingZoneModal.points.length > 0 && editingZoneModal.shape_type !== 'ellipse') {
          editingZoneModal.points = editingZoneModal.points.map(p => [
            Number((p[0] + dLat).toFixed(6)),
            Number((p[1] + dLng).toFixed(6))
          ]);
        }

        editingZoneModal.coordsConfirmed = true;
        editingZoneModal.coordsConfirmedMsg = `✓ تم تأكيد واعتماد الإحداثيات يدوياً: (${clickLat.toFixed(4)}°, ${clickLng.toFixed(4)}°)`;
        updateModalPreviewLayer(true);
      }
    });

    // تسجيل دالة التعديل العامة لـ Popup الخريطة
    window.editZoneFromMap = (zoneId) => {
      const target = zones.find(z => z.id === zoneId);
      if (target) {
        openEditZoneModal(target);
        switchToMapEditing();
      }
    };

    renderAdminZoneLayers();
  }

  // رسم كافة الدوائر والمربعات والمضلعات الجغرافية على خريطة الإدارة
  function renderAdminZoneLayers() {
    if (!adminGeoMapInstance) return;

    adminMapLayers.forEach(l => adminGeoMapInstance.removeLayer(l));
    adminMapLayers = [];

    filteredZonesForCity.forEach(z => {
      const points = extractZonePoints(z);
      const lat = Number(z.center_lat);
      const lng = Number(z.center_lng);
      const radius = Number(z.radius_meters) || 3000;
      const color = z.zone_color || '#5e6b2c';
      const shape = z.shape_type || 'circle';

      let shapeLayer = null;

      if (points && points.length >= 3) {
        shapeLayer = L.polygon(points, {
          color: color,
          weight: 2.5,
          fillColor: color,
          fillOpacity: 0.22,
          dashArray: shape === 'box' ? '5, 5' : null
        });
      } else if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        if (shape === 'box') {
          const latDelta = radius / 111000;
          const lngDelta = radius / (111000 * Math.cos(lat * Math.PI / 180));
          const bounds = [
            [lat - latDelta, lng - lngDelta],
            [lat + latDelta, lng + lngDelta]
          ];
          shapeLayer = L.rectangle(bounds, {
            color: color,
            weight: 2.5,
            fillColor: color,
            fillOpacity: 0.22,
            dashArray: '5, 5'
          });
        } else {
          shapeLayer = L.circle([lat, lng], {
            radius: radius,
            color: color,
            weight: 2.5,
            fillColor: color,
            fillOpacity: 0.22
          });
        }
      }

      if (shapeLayer) {
        shapeLayer.addTo(adminGeoMapInstance);

        const shapeText = (points && shape === 'polygon')
          ? `مضلع حر (${points.length} زاوية)`
          : (shape === 'ellipse' ? 'دائرة بيضاوية غير متناسقة' : (shape === 'box' ? 'مربع/مستطيل حر' : 'دائرة جغرافية'));

        shapeLayer.bindTooltip(`
          <div style="direction: rtl; text-align: right; font-family: Cairo, sans-serif;">
            <b>${z.zone_name}</b><br>
            <span style="color:${color}; font-weight:800;">سعر التوصيل: ${z.delivery_fee} د.ل</span> (${shapeText})
          </div>
        `, {
          permanent: false,
          direction: 'center',
          className: 'zone-tooltip-custom'
        });

        shapeLayer.on('click', () => {
          openEditZoneModal(z);
        });

        const centerLatVal = (!isNaN(lat) && lat !== 0) ? lat : (points ? calculatePolygonCenter(points)[0] : 32.8872);
        const centerLngVal = (!isNaN(lng) && lng !== 0) ? lng : (points ? calculatePolygonCenter(points)[1] : 13.1913);

        const centerPin = L.circleMarker([centerLatVal, centerLngVal], {
          radius: 7,
          color: '#ffffff',
          weight: 2.5,
          fillColor: color,
          fillOpacity: 1
        }).addTo(adminGeoMapInstance);

        centerPin.bindPopup(`
          <div style="direction: rtl; text-align: right; font-family: Cairo, sans-serif; min-width: 175px;">
            <b style="font-size: 14px; color: ${color};">${z.zone_name}</b><br>
            <span>المدينة: <b>${z.city || z.city_name}</b></span><br>
            <span>الشكل: <b>${shapeText}</b></span><br>
            <span>رسوم التوصيل: <b style="color: #5e6b2c;">${z.delivery_fee} د.ل</b></span><br>
            <small style="color: #888;">(Lat: ${centerLatVal.toFixed(4)}, Lng: ${centerLngVal.toFixed(4)})</small><br>
            <button style="margin-top: 8px; width: 100%; padding: 5px 10px; background: #5e6b2c; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 700;" onclick="window.editZoneFromMap(${z.id})">تعديل وتشكيل النطاق</button>
          </div>
        `);

        adminMapLayers.push(shapeLayer, centerPin);
      }
    });
  }

  function handleCityFilterChange(cityName) {
    selectedCityFilter = cityName;
    if (adminGeoMapInstance) {
      if (cityName === 'طرابلس') adminGeoMapInstance.setView([32.8872, 13.1913], 12);
      else if (cityName === 'بنغازي') adminGeoMapInstance.setView([32.1167, 20.0667], 11);
      else if (cityName === 'مصراتة') adminGeoMapInstance.setView([32.3754, 15.0925], 11);
      else if (cityName === 'all') adminGeoMapInstance.setView([31.5, 17.5], 7);
      renderAdminZoneLayers();
    }
  }

  function openCreateZoneModal() {
    let defaultCenter = [32.8872, 13.1913];
    if (selectedCityFilter === 'بنغازي') defaultCenter = [32.1167, 20.0667];
    else if (selectedCityFilter === 'مصراتة') defaultCenter = [32.3754, 15.0925];

    editingZoneModal = {
      open: true,
      dockedToMap: false,
      isEdit: false,
      id: null,
      city: selectedCityFilter !== 'all' ? selectedCityFilter : 'طرابلس',
      zone_name: '',
      delivery_fee: 10,
      center_lat: defaultCenter[0],
      center_lng: defaultCenter[1],
      radius_meters: 3500,
      radius_meters_y: 2500,
      rotation_deg: 0,
      shape_type: 'circle',
      points: [],
      zone_color: '#5e6b2c',
      estimated_minutes: 60,
      interaction_mode: 'handles',
      coordsConfirmed: false,
      coordsConfirmedMsg: '',
      saving: false,
      errorMsg: ''
    };
    updateModalPreviewLayer(true);
  }

  function openEditZoneModal(z) {
    const points = extractZonePoints(z);
    let shape = z.shape_type || 'circle';

    if (points && points.length > 4 && shape !== 'ellipse') {
      shape = 'polygon';
    } else if (points && points.length === 4 && shape === 'box') {
      shape = 'box';
    }

    const cLat = Number(z.center_lat) || (points ? calculatePolygonCenter(points)[0] : 32.8872);
    const cLng = Number(z.center_lng) || (points ? calculatePolygonCenter(points)[1] : 13.1913);
    const rX = Number(z.radius_meters) || 3500;

    editingZoneModal = {
      open: true,
      dockedToMap: false,
      isEdit: true,
      id: z.id,
      city: z.city || z.city_name || 'طرابلس',
      zone_name: z.zone_name || '',
      delivery_fee: Number(z.delivery_fee) || 10,
      center_lat: cLat,
      center_lng: cLng,
      radius_meters: rX,
      radius_meters_y: Math.round(rX * 0.7),
      rotation_deg: 0,
      shape_type: shape,
      points: points || [],
      zone_color: z.zone_color || '#5e6b2c',
      estimated_minutes: Number(z.estimated_minutes) || 60,
      interaction_mode: 'handles',
      coordsConfirmed: false,
      coordsConfirmedMsg: '',
      saving: false,
      errorMsg: ''
    };

    if (adminGeoMapInstance && editingZoneModal.center_lat && editingZoneModal.center_lng) {
      adminGeoMapInstance.setView([editingZoneModal.center_lat, editingZoneModal.center_lng], 13);
    }
    updateModalPreviewLayer(true);
  }

  // تحديث طبقة المعاينة ونقاط التحكم القابلة للسحب على الخريطة
  function updateModalPreviewLayer(rebuildHandles = true) {
    if (!adminGeoMapInstance || !editingZoneModal.open) return;

    if (modalPreviewCircle) {
      adminGeoMapInstance.removeLayer(modalPreviewCircle);
      modalPreviewCircle = null;
    }

    if (rebuildHandles) {
      modalHandleMarkers.forEach(m => adminGeoMapInstance.removeLayer(m));
      modalHandleMarkers = [];
    }

    const color = editingZoneModal.zone_color || '#5e6b2c';
    const cLat = Number(editingZoneModal.center_lat) || 32.8872;
    const cLng = Number(editingZoneModal.center_lng) || 13.1913;
    const rx = Number(editingZoneModal.radius_meters) || 3500;
    const ry = Number(editingZoneModal.radius_meters_y) || 2500;
    const rot = Number(editingZoneModal.rotation_deg) || 0;

    // 1. معالجة الشكل الهندسي ورسمه
    if (editingZoneModal.shape_type === 'polygon') {
      if (!Array.isArray(editingZoneModal.points) || editingZoneModal.points.length < 3) {
        editingZoneModal.points = generateInitialBoxPoints(cLat, cLng, rx * 1.4, ry * 1.2);
      }
      modalPreviewCircle = L.polygon(editingZoneModal.points, {
        color: color,
        weight: 3,
        fillColor: color,
        fillOpacity: 0.32
      }).addTo(adminGeoMapInstance);
    } else if (editingZoneModal.shape_type === 'box') {
      if (!Array.isArray(editingZoneModal.points) || editingZoneModal.points.length !== 4) {
        editingZoneModal.points = generateInitialBoxPoints(cLat, cLng, rx * 1.5, ry * 1.2);
      }
      modalPreviewCircle = L.polygon(editingZoneModal.points, {
        color: color,
        weight: 3,
        fillColor: color,
        fillOpacity: 0.32,
        dashArray: '6, 6'
      }).addTo(adminGeoMapInstance);
    } else if (editingZoneModal.shape_type === 'ellipse') {
      const ellipsePts = generateEllipsePoints(cLat, cLng, rx, ry, rot, 36);
      editingZoneModal.points = ellipsePts;
      modalPreviewCircle = L.polygon(ellipsePts, {
        color: color,
        weight: 3,
        fillColor: color,
        fillOpacity: 0.32
      }).addTo(adminGeoMapInstance);
    } else {
      // دائرة عادية
      modalPreviewCircle = L.circle([cLat, cLng], {
        radius: rx,
        color: color,
        weight: 3,
        fillColor: color,
        fillOpacity: 0.32
      }).addTo(adminGeoMapInstance);
    }

    // 2. بناء مقابض السحب والتحكم التفاعلي إذا طُلب ذلك
    if (rebuildHandles) {
      // مقبض المركز الذهبي (سحب كامل الشكل)
      const centerMarker = L.marker([cLat, cLng], {
        draggable: true,
        icon: createHandleIcon('●', '#b45309', 24)
      }).addTo(adminGeoMapInstance);

      centerMarker.bindTooltip('المركز: اسحب لنقل كامل النطاق الجغرافي', { permanent: false, direction: 'top' });

      centerMarker.on('drag', (e) => {
        const newLat = Number(e.latlng.lat.toFixed(6));
        const newLng = Number(e.latlng.lng.toFixed(6));
        const dLat = newLat - editingZoneModal.center_lat;
        const dLng = newLng - editingZoneModal.center_lng;

        editingZoneModal.center_lat = newLat;
        editingZoneModal.center_lng = newLng;

        if (Array.isArray(editingZoneModal.points) && editingZoneModal.points.length > 0 && editingZoneModal.shape_type !== 'ellipse') {
          editingZoneModal.points = editingZoneModal.points.map(p => [
            Number((p[0] + dLat).toFixed(6)),
            Number((p[1] + dLng).toFixed(6))
          ]);
        }
        updateModalPreviewLayer(false);
      });

      centerMarker.on('dragend', () => {
        updateModalPreviewLayer(true);
      });

      modalHandleMarkers.push(centerMarker);

      // مقابض زوايا المربع والمضلع الحر
      if (editingZoneModal.shape_type === 'box' || editingZoneModal.shape_type === 'polygon') {
        editingZoneModal.points.forEach((pt, idx) => {
          const cornerMarker = L.marker([pt[0], pt[1]], {
            draggable: true,
            icon: createHandleIcon(String(idx + 1), color, 26)
          }).addTo(adminGeoMapInstance);

          cornerMarker.bindTooltip(`زاوية ${idx + 1}: اسحب لتغيير طرف الشكل بحرية`, { permanent: false, direction: 'top' });

          cornerMarker.on('drag', (e) => {
            editingZoneModal.points[idx] = [
              Number(e.latlng.lat.toFixed(6)),
              Number(e.latlng.lng.toFixed(6))
            ];
            updateModalPreviewLayer(false);
          });

          cornerMarker.on('dragend', () => {
            const centroid = calculatePolygonCenter(editingZoneModal.points);
            editingZoneModal.center_lat = centroid[0];
            editingZoneModal.center_lng = centroid[1];
            updateModalPreviewLayer(true);
          });

          modalHandleMarkers.push(cornerMarker);
        });
      } else if (editingZoneModal.shape_type === 'ellipse') {
        // مقابض الدائرة البيضاوية غير المتناسقة (مقبض العرض ومقبض الارتفاع)
        const latCos = Math.cos((cLat * Math.PI) / 180);
        const eastLng = cLng + (rx / (111000 * latCos));
        const eastHandle = L.marker([cLat, eastLng], {
          draggable: true,
          icon: createHandleIcon('↔️', '#2563eb', 26)
        }).addTo(adminGeoMapInstance);
        eastHandle.bindTooltip('اسحب لتوسيع/تضييق العرض (شرق-غرب)', { permanent: false, direction: 'top' });
        eastHandle.on('drag', (e) => {
          const dist = calculateDistanceMeters(cLat, cLng, cLat, e.latlng.lng);
          editingZoneModal.radius_meters = Math.max(500, Math.round(dist));
          updateModalPreviewLayer(false);
        });
        eastHandle.on('dragend', () => updateModalPreviewLayer(true));
        modalHandleMarkers.push(eastHandle);

        const northLat = cLat + (ry / 111000);
        const northHandle = L.marker([northLat, cLng], {
          draggable: true,
          icon: createHandleIcon('↕️', '#10b981', 26)
        }).addTo(adminGeoMapInstance);
        northHandle.bindTooltip('اسحب لتوسيع/تضييق الارتفاع (شمال-جنوب)', { permanent: false, direction: 'top' });
        northHandle.on('drag', (e) => {
          const dist = calculateDistanceMeters(cLat, cLng, e.latlng.lat, cLng);
          editingZoneModal.radius_meters_y = Math.max(500, Math.round(dist));
          updateModalPreviewLayer(false);
        });
        northHandle.on('dragend', () => updateModalPreviewLayer(true));
        modalHandleMarkers.push(northHandle);
      } else {
        // مقبض محيط الدائرة العادية
        const latCos = Math.cos((cLat * Math.PI) / 180);
        const edgeLng = cLng + (rx / (111000 * latCos));
        const edgeHandle = L.marker([cLat, edgeLng], {
          draggable: true,
          icon: createHandleIcon('⭕', '#5e6b2c', 26)
        }).addTo(adminGeoMapInstance);
        edgeHandle.bindTooltip('اسحب لتكبير/تصغير نصف القطر', { permanent: false, direction: 'top' });
        edgeHandle.on('drag', (e) => {
          const dist = calculateDistanceMeters(cLat, cLng, e.latlng.lat, e.latlng.lng);
          editingZoneModal.radius_meters = Math.max(500, Math.round(dist));
          updateModalPreviewLayer(false);
        });
        edgeHandle.on('dragend', () => updateModalPreviewLayer(true));
        modalHandleMarkers.push(edgeHandle);
      }
    }
  }

  // تبديل نوع الشكل وإعادة توليد النقاط المناسبة
  function handleShapeTypeChange() {
    const cLat = Number(editingZoneModal.center_lat) || 32.8872;
    const cLng = Number(editingZoneModal.center_lng) || 13.1913;
    const rx = Number(editingZoneModal.radius_meters) || 3500;
    const ry = Number(editingZoneModal.radius_meters_y) || 2500;

    if (editingZoneModal.shape_type === 'box') {
      editingZoneModal.points = generateInitialBoxPoints(cLat, cLng, rx * 1.5, ry * 1.2);
    } else if (editingZoneModal.shape_type === 'polygon') {
      if (!editingZoneModal.points || editingZoneModal.points.length < 3) {
        editingZoneModal.points = generateInitialBoxPoints(cLat, cLng, rx * 1.4, ry * 1.2);
      }
    } else if (editingZoneModal.shape_type === 'ellipse') {
      editingZoneModal.points = generateEllipsePoints(cLat, cLng, rx, ry, editingZoneModal.rotation_deg || 0);
    } else {
      editingZoneModal.points = [];
    }
    updateModalPreviewLayer(true);
  }

  // تحويل الشكل إلى مضلع حر لتعديل كافة أطرافه وزواياه بحرية
  function convertShapeToFreeformPolygon() {
    const cLat = Number(editingZoneModal.center_lat) || 32.8872;
    const cLng = Number(editingZoneModal.center_lng) || 13.1913;
    const rx = Number(editingZoneModal.radius_meters) || 3500;
    const ry = Number(editingZoneModal.radius_meters_y) || 2500;

    if (editingZoneModal.shape_type === 'ellipse' || editingZoneModal.shape_type === 'circle') {
      // إنشاء مضلع دائري بـ 8 نقاط تحكم سهلة التعديل والسحب
      editingZoneModal.points = generateEllipsePoints(cLat, cLng, rx, ry, editingZoneModal.rotation_deg || 0, 8);
    } else if (editingZoneModal.shape_type === 'box' && (!editingZoneModal.points || editingZoneModal.points.length !== 4)) {
      editingZoneModal.points = generateInitialBoxPoints(cLat, cLng, rx * 1.5, ry * 1.2);
    }
    editingZoneModal.shape_type = 'polygon';
    editingZoneModal.interaction_mode = 'handles';
    updateModalPreviewLayer(true);
  }

  // حذف آخر زاوية من المضلع
  function removeLastVertex() {
    if (editingZoneModal.points && editingZoneModal.points.length > 3) {
      editingZoneModal.points.pop();
      editingZoneModal.points = [...editingZoneModal.points];
      updateModalPreviewLayer(true);
    } else {
      alert('الحد الأدنى للمضلع هو 3 زوايا على الأقل.');
    }
  }

  // إعادة ضبط أركان الشكل حول المركز
  function resetShapeVertices() {
    const cLat = Number(editingZoneModal.center_lat) || 32.8872;
    const cLng = Number(editingZoneModal.center_lng) || 13.1913;
    const rx = Number(editingZoneModal.radius_meters) || 3500;
    const ry = Number(editingZoneModal.radius_meters_y) || 2500;

    if (editingZoneModal.shape_type === 'box') {
      editingZoneModal.points = generateInitialBoxPoints(cLat, cLng, rx * 1.5, ry * 1.2);
    } else if (editingZoneModal.shape_type === 'ellipse') {
      editingZoneModal.points = generateEllipsePoints(cLat, cLng, rx, ry, editingZoneModal.rotation_deg || 0);
    } else if (editingZoneModal.shape_type === 'polygon') {
      editingZoneModal.points = generateInitialBoxPoints(cLat, cLng, rx * 1.4, ry * 1.2);
    }
    updateModalPreviewLayer(true);
  }

  async function handleSaveZone() {
    if (!editingZoneModal.zone_name.trim()) {
      editingZoneModal.errorMsg = 'يرجى كتابة اسم المنطقة والنطاق الجغرافي';
      return;
    }
    if (editingZoneModal.delivery_fee === undefined || Number(editingZoneModal.delivery_fee) < 0) {
      editingZoneModal.errorMsg = 'يرجى تحديد رسوم توصيل صحيحة';
      return;
    }

    editingZoneModal.saving = true;
    editingZoneModal.errorMsg = '';

    try {
      // تجهيز بيانات النقاط والمضلع
      let geojsonString = null;
      if (Array.isArray(editingZoneModal.points) && editingZoneModal.points.length >= 3 && editingZoneModal.shape_type !== 'circle') {
        geojsonString = JSON.stringify(editingZoneModal.points);
      }

      const payload = {
        city: editingZoneModal.city,
        zone_name: editingZoneModal.zone_name.trim(),
        delivery_fee: Number(editingZoneModal.delivery_fee),
        center_lat: Number(editingZoneModal.center_lat),
        center_lng: Number(editingZoneModal.center_lng),
        radius_meters: Number(editingZoneModal.radius_meters),
        shape_type: editingZoneModal.shape_type,
        zone_color: editingZoneModal.zone_color,
        polygon_geojson: geojsonString,
        estimated_minutes: Number(editingZoneModal.estimated_minutes),
        adminId: $auth?.id,
        reason: editingZoneModal.isEdit ? 'تعديل النطاق الجغرافي والاسم والسعر والأبعاد الحرة' : 'إضافة نطاق جغرافي مخصص جديد'
      };

      if (editingZoneModal.isEdit) {
        await api.updatePricingZone(editingZoneModal.id, payload);
      } else {
        await api.createPricingZone(payload);
      }

      const res = await api.getPricingZones();
      if (res && res.data) zones = res.data;
      const h = await api.getPriceHistory(20);
      if (h && h.data) priceHistory = h.data;

      if (modalPreviewCircle && adminGeoMapInstance) {
        adminGeoMapInstance.removeLayer(modalPreviewCircle);
        modalPreviewCircle = null;
      }
      modalHandleMarkers.forEach(m => adminGeoMapInstance.removeLayer(m));
      modalHandleMarkers = [];

      editingZoneModal.open = false;
      editingZoneModal.dockedToMap = false;
      editingZoneModal.coordsConfirmed = false;
      editingZoneModal.coordsConfirmedMsg = '';
      renderAdminZoneLayers();
      alert(`تم بنجاح حفظ وتحديث نطاق "${payload.zone_name}" وتشكيل حدوده الجغرافية`);
    } catch (err) {
      editingZoneModal.errorMsg = err.message || 'فشل حفظ المنطقة';
    } finally {
      editingZoneModal.saving = false;
    }
  }

  function closeEditingZoneModal() {
    if (modalPreviewCircle && adminGeoMapInstance) {
      adminGeoMapInstance.removeLayer(modalPreviewCircle);
      modalPreviewCircle = null;
    }
    modalHandleMarkers.forEach(m => adminGeoMapInstance.removeLayer(m));
    modalHandleMarkers = [];
    editingZoneModal.open = false;
    editingZoneModal.dockedToMap = false;
    editingZoneModal.coordsConfirmed = false;
    editingZoneModal.coordsConfirmedMsg = '';
  }

  async function handleDeleteZone(zoneId) {
    if (!confirm('هل أنت متأكد من حذف هذا النطاق الجغرافي؟')) return;
    try {
      await api.deletePricingZone(zoneId);
      zones = zones.filter(z => z.id !== zoneId);
      renderAdminZoneLayers();
    } catch (err) {
      alert('فشل حذف النطاق: ' + (err.message || 'خطأ'));
    }
  }

  // تعديل سعر توصيل منطقة
  async function handleUpdateZoneFee(id, newFee) {
    try {
      await api.updateZoneFee(id, Number(newFee), 'تعديل السعر من لوحة الإدارة', $auth?.id);
      zones = zones.map(z => z.id === id ? { ...z, delivery_fee: Number(newFee) } : z);
      const h = await api.getPriceHistory(20);
      if (h && h.data) priceHistory = h.data;
      renderAdminZoneLayers();
    } catch (err) {
      alert('فشل تعديل السعر: ' + err.message);
    }
  }

  $: filteredOrders = orders.filter(o => {
    const matchStatus = (filterStatus === 'all') || (o.status === filterStatus);
    if (!matchStatus) return false;
    if (!orderSearchQuery.trim()) return true;
    const q = orderSearchQuery.trim().toLowerCase();
    return (
      (o.order_number && String(o.order_number).toLowerCase().includes(q)) ||
      (o.recipient_name && o.recipient_name.toLowerCase().includes(q)) ||
      (o.recipient_phone && o.recipient_phone.toLowerCase().includes(q)) ||
      (o.delivery_city && o.delivery_city.toLowerCase().includes(q)) ||
      (o.delivery_zone && o.delivery_zone.toLowerCase().includes(q)) ||
      (o.driver_name && o.driver_name.toLowerCase().includes(q)) ||
      (o.florist_name && o.florist_name.toLowerCase().includes(q))
    );
  });
</script>

<div class="admin-dashboard-page">
  <div class="admin-shell-container">
    <div class="admin-dashboard-layout">

      <!-- =========================================================================
           الشريط الجانبي للوحة التحكم (Admin Sidebar)
           ========================================================================= -->
      <aside class="admin-sidebar" class:mobile-open={mobileSidebarOpen}>
        <div class="sidebar-brand-box">
          <div class="brand-top-row">
            <span class="sidebar-brand-badge">لوحة الإدارة</span>
            <button type="button" class="btn-close-sidebar-mobile" on:click={() => mobileSidebarOpen = false}>✕</button>
          </div>
          <h2 class="sidebar-title">أتيليه مسكة</h2>
          <p class="sidebar-subtitle">نظام الإدارة والتشغيل الموحد</p>
        </div>

        <!-- بطاقة المسؤول المسجل -->
        <div class="sidebar-admin-profile">
          <div class="admin-avatar-circle">
            {($auth?.full_name || 'م')[0]}
          </div>
          <div class="admin-profile-text">
            <strong class="admin-profile-name">{$auth?.full_name || 'مدير النظام'}</strong>
            <span class="admin-profile-role">
              <span class="online-indicator"></span>
              مدير الأتيليه والمتجر
            </span>
          </div>
        </div>

        <!-- قائمة التبويبات العمودية (Sidebar Navigation Menu) -->
        <nav class="sidebar-nav-menu">
          <div class="nav-group-header">العمليات والمالية</div>

          <button 
            type="button" 
            class="sidebar-nav-btn" 
            class:active={currentTab === 'orders'}
            on:click={() => { currentTab = 'orders'; mobileSidebarOpen = false; }}
          >
            <span class="nav-btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></span>
            <span class="nav-btn-title">الطلبات والتسليم</span>
            <span class="nav-btn-badge">{orders.length}</span>
          </button>

          <button 
            type="button" 
            class="sidebar-nav-btn" 
            class:active={currentTab === 'drivers'}
            on:click={() => { currentTab = 'drivers'; mobileSidebarOpen = false; }}
          >
            <span class="nav-btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></span>
            <span class="nav-btn-title">السائقون والتتبع</span>
            <span class="nav-btn-badge">{drivers.length}</span>
          </button>

          <button 
            type="button" 
            class="sidebar-nav-btn nav-btn-financials" 
            class:active={currentTab === 'financials'}
            on:click={() => { currentTab = 'financials'; reloadFinancials(); mobileSidebarOpen = false; }}
          >
            <span class="nav-btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
            <span class="nav-btn-title">العهد والمالية</span>
            <span class="nav-btn-badge badge-gold">{driversFinancials.drivers?.length || 0}</span>
          </button>

          <button 
            type="button" 
            class="sidebar-nav-btn nav-btn-users" 
            class:active={currentTab === 'users'}
            on:click={() => { currentTab = 'users'; reloadUsers(); mobileSidebarOpen = false; }}
          >
            <span class="nav-btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
            <span class="nav-btn-title">الطاقم والمستخدمون</span>
            <span class="nav-btn-badge badge-teal">{allUsers.length}</span>
          </button>

          <div class="nav-group-header">المخزون والمنتجات</div>

          <button 
            type="button" 
            class="sidebar-nav-btn" 
            class:active={currentTab === 'inventory'}
            on:click={() => { currentTab = 'inventory'; mobileSidebarOpen = false; }}
          >
            <span class="nav-btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L3 9l9 13 9-13-9-7z"/><path d="M2.5 9h19"/><path d="M12 22V9"/></svg></span>
            <span class="nav-btn-title">مخزون الورود والزوايا</span>
            <span class="nav-btn-badge">{inventory.length}</span>
          </button>

          <button 
            type="button" 
            class="sidebar-nav-btn" 
            class:active={currentTab === 'bouquets'}
            on:click={() => { currentTab = 'bouquets'; mobileSidebarOpen = false; }}
          >
            <span class="nav-btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L3 9l9 13 9-13-9-7z"/></svg></span>
            <span class="nav-btn-title">كتالوج الباقات والتركيبات</span>
            <span class="nav-btn-badge">{bouquets.length}</span>
          </button>

          <div class="nav-group-header">التسويق والإعدادات</div>

          <button 
            type="button" 
            class="sidebar-nav-btn" 
            class:active={currentTab === 'coupons'}
            on:click={() => { currentTab = 'coupons'; mobileSidebarOpen = false; }}
          >
            <span class="nav-btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg></span>
            <span class="nav-btn-title">الكوبونات والخصومات</span>
            <span class="nav-btn-badge">{coupons.length}</span>
          </button>

          <button 
            type="button" 
            class="sidebar-nav-btn" 
            class:active={currentTab === 'reviews'}
            on:click={() => { currentTab = 'reviews'; mobileSidebarOpen = false; }}
          >
            <span class="nav-btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>
            <span class="nav-btn-title">التقييمات والملاحظات</span>
            <span class="nav-btn-badge">{reviews.length}</span>
          </button>

          <button 
            type="button" 
            class="sidebar-nav-btn" 
            class:active={currentTab === 'pricing'}
            on:click={() => { currentTab = 'pricing'; mobileSidebarOpen = false; }}
          >
            <span class="nav-btn-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
            <span class="nav-btn-title">أسعار التوصيل والرقابة</span>
            <span class="nav-btn-badge">{zones.length}</span>
          </button>
        </nav>

        <!-- أسفل القائمة الجانبية -->
        <div class="sidebar-bottom-actions">
          <button type="button" class="btn-sidebar-sync" on:click={loadAllAdminData}>
            <span></span>
            <span>تحديث البيانات الحية</span>
          </button>
        </div>
      </aside>

      <!-- طبقة عتامة لشاشات الموبايل عند فتح القائمة -->
      {#if mobileSidebarOpen}
        <div class="mobile-sidebar-backdrop" on:click={() => mobileSidebarOpen = false}></div>
      {/if}

      <!-- =========================================================================
           منطقة المحتوى الرئيسية للوحة الإدارة (Main Content Area)
           ========================================================================= -->
      <main class="admin-main-viewport">
        <!-- شريط علوي للهاتف والقوائم المنسدلة -->
        <div class="mobile-top-bar-admin">
          <button type="button" class="btn-open-sidebar-mobile" on:click={() => mobileSidebarOpen = true}>
            <span class="burger-icon">☰</span>
            <span>القائمة: {getActiveTabLabel(currentTab)}</span>
          </button>
          <button type="button" class="btn-mobile-sync-icon" title="تحديث البيانات" on:click={loadAllAdminData}>
            
          </button>
        </div>

        <!-- ترويسة الصفحة وبطاقات الإحصائيات -->
        <div class="dash-top-bar">
          <div>
            <div class="dash-current-tab-pill">
              {getActiveTabLabel(currentTab)}
            </div>
            <h1 class="dash-title">نظام إدارة مسكة الموحد</h1>
            <p class="dash-sub">
              مرحباً بك {$auth?.full_name || 'يا مدير النظام'} — متابعة الطلبات، السائقين، المخزون الحي، والكوبونات
            </p>
          </div>

          <button type="button" class="btn btn-outline desk-sync-btn" on:click={loadAllAdminData}>
            تحديث البيانات
          </button>
        </div>

        <!-- بطاقات الإحصائيات (KPI Cards) -->
        {#if stats}
          <div class="kpi-grid">
            <div class="kpi-card">
              <span class="kpi-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></span>
              <div>
                <span class="kpi-label">طلبات اليوم</span>
                <b class="kpi-value">{stats.todayOrders} طلب</b>
              </div>
            </div>

            <div class="kpi-card">
              <span class="kpi-icon"></span>
              <div>
                <span class="kpi-label">مبيعات اليوم</span>
                <b class="kpi-value">{stats.todaySales} د.ل</b>
              </div>
            </div>

            <div class="kpi-card highlight-profit-card">
              <span class="kpi-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></span>
              <div>
                <span class="kpi-label">أرباح المتجر اليومية</span>
                <b class="kpi-value profit-color">{stats.todayStoreProfit !== undefined ? stats.todayStoreProfit : stats.todaySales} د.ل</b>
              </div>
            </div>

            <div class="kpi-card">
              <span class="kpi-icon"></span>
              <div>
                <span class="kpi-label">قيد التنسيق</span>
                <b class="kpi-value">{stats.preparingCount} باقة</b>
              </div>
            </div>

            <div class="kpi-card">
              <span class="kpi-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg></span>
              <div>
                <span class="kpi-label">السائقون النشطون</span>
                <b class="kpi-value">{stats.activeDrivers} سائقين</b>
              </div>
            </div>
          </div>
        {/if}

        <!-- محتوى التبويبات -->
        <div class="tab-content-area">
      <!-- 1. تبويب الطلبات ومسار المراحل -->
      {#if currentTab === 'orders'}
        <div class="orders-section-wrap">

          <!-- أ. شريط مسار المراحل التفاعلي الرئيسي -->
          <div class="card pipeline-summary-bar">
            <div class="pipeline-summary-header">
              <div class="p-head-titles">
                <span class="p-pre-badge">دورة حياة الطلبات واللوجستيات</span>
                <h3 class="pipeline-main-title">مسار مراحل الطلبات والتسليم</h3>
                <p class="pipeline-subtitle">متابعة فورية للباقات من لحظة التثبيت، التنسيق في الأتيليه، خروج السائق، حتى التسليم الموثق للزبون</p>
              </div>

              <!-- أزرار التبديل بين نمط مسار المراحل وجدول البيانات -->
              <div class="view-switch-group">
                <button 
                  type="button" 
                  class="view-switch-btn" 
                  class:active={ordersViewMode === 'pipeline'} 
                  on:click={() => ordersViewMode = 'pipeline'}
                  title="عرض مسار المراحل وأعمدة التدفق"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="10" rx="1"/></svg>
                  مسار المراحل
                </button>
                <button 
                  type="button" 
                  class="view-switch-btn" 
                  class:active={ordersViewMode === 'table'} 
                  on:click={() => ordersViewMode = 'table'}
                  title="عرض جدول البيانات التفصيلي"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                  جدول تفصيلي
                </button>
              </div>
            </div>

            <!-- خط التدفق التفاعلي للمراحل الأربعة -->
            <div class="pipeline-flow-track">
              <!-- مرحلة 1: جديدة -->
              <button 
                type="button" 
                class="pipeline-flow-step" 
                class:active={filterStatus === 'confirmed'}
                on:click={() => filterStatus = filterStatus === 'confirmed' ? 'all' : 'confirmed'}
              >
                <div class="step-num-badge stage-confirmed">1</div>
                <div class="step-content-box">
                  <span class="step-name">طلبات جديدة</span>
                  <b class="step-count">{countNew} طلب</b>
                </div>
              </button>

              <div class="pipeline-flow-connector">
                <span class="connector-arrow">←</span>
              </div>

              <!-- مرحلة 2: جاري التنسيق -->
              <button 
                type="button" 
                class="pipeline-flow-step" 
                class:active={filterStatus === 'preparing'}
                on:click={() => filterStatus = filterStatus === 'preparing' ? 'all' : 'preparing'}
              >
                <div class="step-num-badge stage-preparing">2</div>
                <div class="step-content-box">
                  <span class="step-name">جاري التنسيق</span>
                  <b class="step-count">{countPreparing} طلب</b>
                </div>
              </button>

              <div class="pipeline-flow-connector">
                <span class="connector-arrow">←</span>
              </div>

              <!-- مرحلة 3: قيد التوصيل -->
              <button 
                type="button" 
                class="pipeline-flow-step" 
                class:active={filterStatus === 'out_for_delivery'}
                on:click={() => filterStatus = filterStatus === 'out_for_delivery' ? 'all' : 'out_for_delivery'}
              >
                <div class="step-num-badge stage-delivery">3</div>
                <div class="step-content-box">
                  <span class="step-name">قيد التوصيل</span>
                  <b class="step-count">{countDelivery} طلب</b>
                </div>
              </button>

              <div class="pipeline-flow-connector">
                <span class="connector-arrow">←</span>
              </div>

              <!-- مرحلة 4: مكتملة -->
              <button 
                type="button" 
                class="pipeline-flow-step" 
                class:active={filterStatus === 'delivered'}
                on:click={() => filterStatus = filterStatus === 'delivered' ? 'all' : 'delivered'}
              >
                <div class="step-num-badge stage-delivered">4</div>
                <div class="step-content-box">
                  <span class="step-name">المكتملة والمسلّمة</span>
                  <b class="step-count">{countDelivered} طلب</b>
                </div>
              </button>
            </div>
          </div>

          <!-- ب. شريط أزرار الفلاتر السريعة والبحث -->
          <div class="card orders-controls-bar">
            <div class="filter-pills-row">
              <button 
                type="button" 
                class="filter-pill-btn" 
                class:active={filterStatus === 'all'}
                on:click={() => filterStatus = 'all'}
              >
                كل الطلبات ({countAll})
              </button>
              <button 
                type="button" 
                class="filter-pill-btn pill-new" 
                class:active={filterStatus === 'confirmed'}
                on:click={() => filterStatus = 'confirmed'}
              >
                الطلبات الجديدة ({countNew})
              </button>
              <button 
                type="button" 
                class="filter-pill-btn pill-prep" 
                class:active={filterStatus === 'preparing'}
                on:click={() => filterStatus = 'preparing'}
              >
                قيد التنسيق ({countPreparing})
              </button>
              <button 
                type="button" 
                class="filter-pill-btn pill-deliv" 
                class:active={filterStatus === 'out_for_delivery'}
                on:click={() => filterStatus = 'out_for_delivery'}
              >
                قيد التوصيل ({countDelivery})
              </button>
              <button 
                type="button" 
                class="filter-pill-btn pill-done" 
                class:active={filterStatus === 'delivered'}
                on:click={() => filterStatus = 'delivered'}
              >
                المكتملة ({countDelivered})
              </button>
            </div>

            <div class="orders-search-box">
              <span class="search-icon">🔍</span>
              <input 
                type="text" 
                class="orders-search-input" 
                placeholder="بحث برقم الطلب، اسم المستلم، الهاتف، المدينة أو السائق..." 
                bind:value={orderSearchQuery}
              />
              {#if orderSearchQuery}
                <button type="button" class="btn-clear-search" on:click={() => orderSearchQuery = ''}>✕</button>
              {/if}
            </div>
          </div>

          <!-- ج. المحتوى حسب نمط العرض المحدد -->
          {#if ordersViewMode === 'pipeline'}
            <!-- عرض أعمدة مسار المراحل (Pipeline Kanban Board) -->
            <div class="pipeline-columns-grid">
              {#each orderStages as stage}
                {@const stageOrders = filteredOrders.filter(o => o.status === stage.key)}
                <div class="pipeline-stage-col stage-col-{stage.key}">
                  <div class="pipeline-col-header">
                    <div class="col-title-wrap">
                      <span class="stage-dot" style="background: {stage.color}"></span>
                      <h4 class="col-stage-title">{stage.label}</h4>
                    </div>
                    <span class="col-count-badge">{stageOrders.length}</span>
                  </div>

                  <div class="pipeline-cards-list">
                    {#if stageOrders.length === 0}
                      <div class="pipeline-empty-col">
                        <p>لا توجد طلبات في هذه المرحلة حالياً</p>
                      </div>
                    {:else}
                      {#each stageOrders as o (o.id || o.order_number)}
                        {@const currentStageIdx = getStageIndex(o.status)}
                        <div class="pipeline-order-card fade-in">
                          <div class="p-card-header">
                            <span class="p-order-num">#{o.order_number}</span>
                            <span class="p-order-price">{o.total_amount} د.ل</span>
                          </div>

                          <div class="p-card-body">
                            <div class="p-recipient-name">{o.recipient_name}</div>
                            <div class="p-recipient-meta">
                              <span>📞 {o.recipient_phone}</span>
                              <span>•</span>
                              <span>📍 {o.delivery_city} ({o.delivery_zone || 'المركز'})</span>
                            </div>

                            {#if o.delivery_window}
                              <div class="p-window-pill">
                                <span>🕒 {o.delivery_window}</span>
                              </div>
                            {/if}

                            <!-- طاقم العمل المسند -->
                            <div class="p-staff-chips">
                              <span class="p-chip" class:assigned={o.florist_name}>
                                🌿 منسقة: {o.florist_name || 'غير مسندة'}
                              </span>
                              <span class="p-chip" class:assigned={o.driver_name}>
                                🚗 سائق: {o.driver_name || 'غير مسند'}
                              </span>
                            </div>

                            <!-- مسار المراحل المصغر التفاعلي للطلب -->
                            <div class="p-card-stepper">
                              {#each orderStages as s, sIdx}
                                <div 
                                  class="p-stepper-dot" 
                                  class:completed={sIdx < currentStageIdx} 
                                  class:active={sIdx === currentStageIdx}
                                  title="{s.shortLabel}"
                                >
                                  <span class="dot-inner"></span>
                                </div>
                                {#if sIdx < orderStages.length - 1}
                                  <div class="p-stepper-line" class:completed={sIdx < currentStageIdx}></div>
                                {/if}
                              {/each}
                            </div>
                          </div>

                          <!-- أزرار الإجراءات داخل بطاقة مسار المرحلة -->
                          <div class="p-card-actions">
                            <button 
                              type="button" 
                              class="btn-p-track"
                              on:click={() => openOrderTracking(o)}
                              title="تتبع مسار الطلب لحظة بلحظة على الخريطة"
                            >
                              📍 تتبع المسار
                            </button>
                            <button 
                              type="button" 
                              class="btn-p-assign"
                              on:click={() => openAssignModal(o)}
                              title="إسناد وتوجيه الطلب للمنسقة أو السائق"
                            >
                              👤 إسناد
                            </button>

                            {#if getNextStage(o.status)}
                              <button 
                                type="button" 
                                class="btn-p-advance"
                                on:click={() => handleAdvanceStage(o)}
                                title="تقديم الطلب للمرحلة التالية في المسار"
                              >
                                {getNextStageLabel(o.status)}
                              </button>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    {/if}
                  </div>
                </div>
              {/each}
            </div>

          {:else}
            <!-- عرض الجدول المطور مع مسار المراحل (Detailed Table View) -->
            <div class="card table-card">
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>رقم الطلب</th>
                      <th>المستلم والهاتف</th>
                      <th>الوجهة والمدينة</th>
                      <th>المبلغ</th>
                      <th>توجيه الطاقم (المنسقة والسائق)</th>
                      <th>مسار مرحلة الطلب</th>
                      <th>إجراءات والتتبع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#if filteredOrders.length === 0}
                      <tr>
                        <td colspan="7" class="text-center py-6">لا توجد طلبات تطابق الفلتر أو البحث الحالي</td>
                      </tr>
                    {:else}
                      {#each filteredOrders as o (o.id || o.order_number)}
                        {@const currentStageIdx = getStageIndex(o.status)}
                        <tr>
                          <td><b class="order-id-badge">#{o.order_number}</b></td>
                          <td>
                            <strong>{o.recipient_name}</strong>
                            <small class="cell-sub">📞 {o.recipient_phone}</small>
                          </td>
                          <td>
                            <span>{o.delivery_city}</span>
                            <small class="cell-sub">{o.delivery_zone || 'المركز'}</small>
                          </td>
                          <td><b class="cell-price">{o.total_amount} د.ل</b></td>
                          <td>
                            <div class="staff-cell">
                              <div class="staff-line">
                                <span class="staff-badge florist">منسقة:</span>
                                <span class="staff-name" class:unassigned={!o.florist_name}>
                                  {o.florist_name || 'غير مسندة'}
                                </span>
                              </div>
                              <div class="staff-line">
                                <span class="staff-badge driver">سائق:</span>
                                <span class="staff-name" class:unassigned={!o.driver_name}>
                                  {o.driver_name || 'غير مسند'}
                                </span>
                              </div>
                              <button 
                                type="button" 
                                class="btn-assign-trigger"
                                on:click={() => openAssignModal(o)}
                                title="توجيه الطلب لمنسقة الزهور أو سائق التوصيل"
                              >
                                👤 توجيه الطاقم
                              </button>
                            </div>
                          </td>
                          <td>
                            <!-- مسار المرحلة التفاعلي في الجدول -->
                            <div class="table-stage-stepper-cell">
                              <div class="t-stepper-track">
                                {#each orderStages as s, sIdx}
                                  <button 
                                    type="button" 
                                    class="t-step-chip" 
                                    class:completed={sIdx < currentStageIdx}
                                    class:active={sIdx === currentStageIdx}
                                    on:click={() => handleStatusChange(o.order_number, s.key)}
                                    title="تغيير المرحلة مباشرة إلى: {s.label}"
                                  >
                                    {#if sIdx < currentStageIdx}✓{:else}{sIdx + 1}{/if} {s.shortLabel}
                                  </button>
                                  {#if sIdx < orderStages.length - 1}
                                    <span class="t-step-arrow">←</span>
                                  {/if}
                                {/each}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div class="actions-cell">
                              <button 
                                type="button" 
                                class="btn-table-track" 
                                on:click={() => openOrderTracking(o)}
                                title="فتح نافذة التتبع المباشر بالخريطة"
                              >
                                📍 تتبع
                              </button>
                              <button 
                                type="button" 
                                class="btn-icon-assign" 
                                on:click={() => openAssignModal(o)}
                                title="توجيه وإسناد الطلب"
                              >
                                👤 إسناد
                              </button>
                              {#if getNextStage(o.status)}
                                <button 
                                  type="button" 
                                  class="btn-table-advance" 
                                  on:click={() => handleAdvanceStage(o)}
                                  title="تقديم الطلب للمرحلة التالية: {getNextStageLabel(o.status)}"
                                >
                                  ⏩
                                </button>
                              {/if}
                            </div>
                          </td>
                        </tr>
                      {/each}
                    {/if}
                  </tbody>
                </table>
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- 2. تبويب السائقين -->
      {#if currentTab === 'drivers'}
        <div class="card table-card">
          <div class="table-head-flex">
            <div>
              <h3>أسطول السائقين والتتبع اللحظي</h3>
              <p class="tab-subtext">متابعة موقع وحالة كباتن التوصيل مع إمكانية إضافة كابتن جديد للأسطول</p>
            </div>
            <button type="button" class="btn btn-primary" on:click={() => openCreateUserModal('driver')}>
              + إضافة كابتن توصيل جديد
            </button>
          </div>
          <div class="drivers-cards-grid">
            {#each drivers as d (d.id || d.user_id)}
              <div class="driver-profile-card">
                <div class="driver-top">
                  <div class="driver-avatar"></div>
                  <div>
                    <h4>{d.full_name}</h4>
                    <span class="driver-phone">{d.phone}</span>
                  </div>
                  <span class="driver-status-badge status-{d.current_status}">{d.current_status === 'available' ? 'متاح' : 'في مهمة'}</span>
                </div>
                <div class="driver-details">
                  <p>المركبة: <b>{d.vehicle_type}</b></p>
                  <p>رقم اللوحة: <b>{d.plate_number}</b></p>
                  <p>التوصيلات المنجزة: <b>{d.total_deliveries} باقة</b></p>
                  <p>التقييم: <b>{d.rating} </b></p>
                  <p>الإحداثيات الحالية: <b>{Number(d.current_lat).toFixed(4)}, {Number(d.current_lng).toFixed(4)}</b></p>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 3. تبويب مخزون الزهور وصور الزوايا المتعددة -->
      {#if currentTab === 'inventory'}
        <div class="card table-card">
          <div class="table-head-flex">
            <div>
              <h3>مخزون الزهور الطبيعية الحية وصور الزوايا</h3>
              <p class="tab-subtext">عرض وإدارة أصناف الزهور مع صورها من زوايا متعددة (أمامية، جانبية، علوية، وتفاصيل الساق)</p>
            </div>
            <button type="button" class="btn btn-primary" on:click={openAddFlowerModal}>
              + إضافة صنف ورد جديد بزواياه
            </button>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>صنف الزهرة</th>
                  <th>اللون</th>
                  <th>صور الزوايا (أمامي / جانبي / علوي / ساق)</th>
                  <th>الرصيد المتوفر</th>
                  <th>سعر الساق</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {#each inventory as item (item.id)}
                  <tr>
                    <td>
                      <div class="flower-name-cell">
                        <strong>{item.name_ar}</strong>
                        {#if item.description}
                          <small class="flower-desc-cell">{item.description}</small>
                        {/if}
                      </div>
                    </td>
                    <td>
                      <span class="swatch-mini" style="background: {item.color};"></span>
                      {item.color}
                    </td>
                    <td>
                      <div class="angle-thumbnails-flex">
                        <button 
                          type="button" 
                          class="angle-thumb-btn" 
                          title="زاوية أمامية"
                          on:click={() => viewFlowerAngles(item, 'front')}
                        >
                          <img src={item.image_front || item.image_url || '/assets/flowers/pink-rose-front.svg'} alt="أمامي" />
                          <span>أمامي</span>
                        </button>
                        <button 
                          type="button" 
                          class="angle-thumb-btn" 
                          title="زاوية جانبية"
                          on:click={() => viewFlowerAngles(item, 'side')}
                        >
                          <img src={item.image_side || '/assets/flowers/pink-rose-side.svg'} alt="جانبي" />
                          <span>جانبي</span>
                        </button>
                        <button 
                          type="button" 
                          class="angle-thumb-btn" 
                          title="زاوية علوية"
                          on:click={() => viewFlowerAngles(item, 'top')}
                        >
                          <img src={item.image_top || '/assets/flowers/pink-rose-top.svg'} alt="علوي" />
                          <span>علوي</span>
                        </button>
                        <button 
                          type="button" 
                          class="angle-thumb-btn" 
                          title="تفاصيل الساق"
                          on:click={() => viewFlowerAngles(item, 'stem')}
                        >
                          <img src={item.image_stem || '/assets/flowers/pink-rose-stem.svg'} alt="ساق" />
                          <span>ساق</span>
                        </button>
                      </div>
                    </td>
                    <td>
                      <b class:low-stock={item.stock_quantity <= item.alert_threshold}>
                        {item.stock_quantity} ساق
                      </b>
                      {#if item.stock_quantity <= item.alert_threshold}
                        <span class="badge-danger-xs">منخفض</span>
                      {/if}
                    </td>
                    <td><b>{item.unit_price} د.ل</b></td>
                    <td>
                      <div class="actions-cell-flex">
                        <button type="button" class="btn-sm-action" on:click={() => openEditFlowerModal(item)}>
                          تعديل
                        </button>
                        <button type="button" class="btn-sm-action danger" on:click={() => handleDeleteFlower(item.id)}>
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}

      <!-- 3b. تبويب كتالوج الباقات وتركيبات الورود -->
      {#if currentTab === 'bouquets'}
        <div class="card table-card">
          <div class="table-head-flex">
            <div>
              <h3>كتالوج الباقات وتوليفات الورود الدقيقة</h3>
              <p class="tab-subtext">تحديد مكونات كل باقة بعدد الورود من كل نوع بناءً على قائمة مخزون الورود المعتمدة</p>
            </div>
            <button type="button" class="btn btn-primary" on:click={openAddBouquetModal}>
              + إضافة باقة جديدة بتوليفة مخصصة
            </button>
          </div>

          <div class="bouquets-admin-grid">
            {#each bouquets as b (b.id)}
              <div class="bouquet-admin-card">
                <div class="bouquet-card-head">
                  <div class="bouquet-thumb-box">
                    <img src={b.image_svg_path || '/assets/bouquet-pink-spring.svg'} alt={b.title} />
                    {#if b.image_svg_path && (b.image_svg_path.includes('/uploads/') || b.image_svg_path.startsWith('data:'))}
                      <span class="custom-photo-badge" title="صورة خاصة تم رفعها من جهازك">✓ خاصة</span>
                    {/if}
                    <label class="thumb-upload-overlay" title="انقر لتغيير صورة الباقة من جهازك مباشرة">
                      <span>{quickBouquetUploadingId === b.id ? '...' : 'تغيير'}</span>
                      <input type="file" accept="image/*" on:change={(e) => handleQuickBouquetPhotoUpload(e, b)} hidden />
                    </label>
                  </div>
                  <div class="bouquet-info-box">
                    <h4>{b.title}</h4>
                    <span class="occasion-chip">{b.occasion_tag}</span>
                    <b class="bouquet-price-tag">{b.price} د.ل</b>
                  </div>
                </div>

                <div class="bouquet-recipe-section">
                  <div class="recipe-header-row">
                    <span class="recipe-label"> تركيبة وعدد الورود:</span>
                    <span class="recipe-total-stems">إجمالي {b.total_stems || 0} زهرة</span>
                  </div>
                  <div class="recipe-chips-list">
                    {#if b.flowers && b.flowers.length > 0}
                      {#each b.flowers as f}
                        <div class="recipe-flower-chip">
                          {#if f.image_front || f.image_url}
                            <img src={f.image_front || f.image_url} alt={f.flower_name} class="chip-flower-img" />
                          {/if}
                          <span class="chip-qty"><b>{f.quantity_stems}×</b></span>
                          <span class="chip-name">{f.flower_name}</span>
                        </div>
                      {/each}
                    {:else}
                      <span class="recipe-empty">لم تحدد تركيبة الورود بعد</span>
                    {/if}
                  </div>
                </div>

                {#if b.description}
                  <p class="bouquet-card-desc">{b.description}</p>
                {/if}

                <div class="bouquet-card-actions">
                  <label class="btn-sm-action upload-btn-card" title="تحميل صورة من جهازك لهذه الباقة">
                    {#if quickBouquetUploadingId === b.id}
                      <span>جاري الرفع...</span>
                    {:else}
                      <span>تغيير الصورة من جهازك</span>
                    {/if}
                    <input type="file" accept="image/*" on:change={(e) => handleQuickBouquetPhotoUpload(e, b)} hidden />
                  </label>
                  <label class="btn-sm-action cam-btn-card" title="التقاط صورة بالكاميرا">
                    كاميرا
                    <input type="file" accept="image/*" capture="environment" on:change={(e) => handleQuickBouquetPhotoUpload(e, b)} hidden />
                  </label>
                  <button type="button" class="btn-sm-action" on:click={() => openEditBouquetModal(b)}>
                    تعديل
                  </button>
                  <button type="button" class="btn-sm-action danger" on:click={() => handleDeleteBouquet(b.id)}>
                    حذف
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 4. تبويب الكوبونات -->
      {#if currentTab === 'coupons'}
        <div class="card table-card">
          <div class="table-head-flex">
            <h3>كوبونات التخفيض والعروض الترويجية</h3>
            <button type="button" class="btn btn-primary btn-sm" on:click={() => showNewCouponModal = true}>
              + إنشاء كوبون جديد ️
            </button>
          </div>

          <div class="coupons-grid">
            {#each coupons as c (c.id)}
              <div class="coupon-card-tile">
                <div class="coupon-tile-header">
                  <b class="coupon-code-text">{c.code}</b>
                  <span class="active-badge" class:inactive={!c.is_active}>
                    {c.is_active ? 'مفعّل' : 'معطّل'}
                  </span>
                </div>
                <div class="coupon-tile-body">
                  <p>الخصم: <b>{c.discount_value} {c.discount_type === 'percent' ? '%' : 'د.ل'}</b></p>
                  <p>الحد الأدنى للطلب: <b>{c.min_order_amount} د.ل</b></p>
                  <p>عدد مرات الاستخدام: <b>{c.used_count || 0} مرة</b></p>
                </div>
                <div class="coupon-tile-actions">
                  <button type="button" class="btn-sm-action" on:click={() => handleToggleCoupon(c.id, c.is_active)}>
                    {c.is_active ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button type="button" class="btn-sm-action danger" on:click={() => handleDeleteCoupon(c.id)}>
                    حذف
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 5. تبويب التقييمات والملاحظات -->
      {#if currentTab === 'reviews'}
        <div class="card table-card">
          <h3>تقييمات وملاحظات الزبائن وتفاعل الإدارة</h3>
          <div class="reviews-admin-list">
            {#each reviews as r (r.id)}
              <div class="review-admin-item">
                <div class="rev-header">
                  <div>
                    <strong>{r.customer_name}</strong> ({r.bouquet_type || 'باقة مسكة'})
                    <span class="stars">{''.repeat(r.rating || 5)}</span>
                  </div>
                  <button 
                    type="button" 
                    class="btn-badge" 
                    class:featured={r.is_featured}
                    on:click={() => handleToggleFeatured(r.id, r.is_featured)}
                  >
                    {r.is_featured ? '⭐ مميز في الهوم' : 'تمييز في الهوم'}
                  </button>
                </div>
                <p class="rev-comment">"{r.comment}"</p>
                
                {#if r.admin_reply}
                  <div class="reply-box-done">
                    <span>رد الإدارة المعتمد:</span> {r.admin_reply}
                  </div>
                {:else}
                  <button 
                    type="button" 
                    class="btn btn-outline btn-sm"
                    on:click={() => replyModal = { open: true, reviewId: r.id, text: '' }}
                  >
                    إرسال رد رسمي من الإدارة
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 6. تبويب أسعار التوصيل والخريطة والدوائر الجغرافية -->
      {#if currentTab === 'pricing'}
        <div class="card table-card geo-zones-management-card">
          <!-- ترويسة إدارة النطاقات الجغرافية -->
          <div class="table-head-flex">
            <div>
              <h3>خريطة وتقسيم نطاقات التوصيل والدوائر الجغرافية</h3>
              <p class="tab-subtext">تقسيم المدن والمناطق إلى دوائر ومربعات جغرافية (Lat / Lng) وتعديل الأسماء ورسوم التوصيل لكل نطاق</p>
            </div>
            <button type="button" class="btn btn-primary" on:click={openCreateZoneModal}>
              إضافة نطاق جغرافي جديد
            </button>
          </div>

          <!-- شريط تصفية المدن وأزرار التنقل السريع للخريطة -->
          <div class="geo-city-filter-bar">
            <span class="geo-filter-label">اختر المدينة لتركيز الخريطة ونطاقاتها:</span>
            <div class="city-chips-row">
              <button 
                type="button" 
                class="city-chip" 
                class:active={selectedCityFilter === 'طرابلس'}
                on:click={() => handleCityFilterChange('طرابلس')}
              >
                 طرابلس ({zones.filter(z => (z.city || z.city_name) === 'طرابلس').length})
              </button>
              <button 
                type="button" 
                class="city-chip" 
                class:active={selectedCityFilter === 'بنغازي'}
                on:click={() => handleCityFilterChange('بنغازي')}
              >
                 بنغازي ({zones.filter(z => (z.city || z.city_name) === 'بنغازي').length})
              </button>
              <button 
                type="button" 
                class="city-chip" 
                class:active={selectedCityFilter === 'مصراتة'}
                on:click={() => handleCityFilterChange('مصراتة')}
              >
                 مصراتة ({zones.filter(z => (z.city || z.city_name) === 'مصراتة').length})
              </button>
              <button 
                type="button" 
                class="city-chip" 
                class:active={selectedCityFilter === 'all'}
                on:click={() => handleCityFilterChange('all')}
              >
                كافة المناطق ({zones.length})
              </button>
            </div>
          </div>

          <!-- خريطة النطاقات والدوائر الجغرافية التفاعلية -->
          <div class="geo-map-container-box">
            {#if editingZoneModal.open && editingZoneModal.dockedToMap}
              <div class="geo-map-floating-dock fade-in">
                <div class="dock-header-row">
                  <div class="dock-title-flex">
                    <span class="dock-badge-icon"></span>
                    <div>
                      <b class="dock-title">
                        {editingZoneModal.isEdit ? `تعديل نطاق: ${editingZoneModal.zone_name || 'بدون اسم'}` : 'تشكيل نطاق توصيل جديد'}
                      </b>
                      <span class="dock-subtext">المدينة: <b>{editingZoneModal.city}</b> | رسوم التوصيل: <b>{editingZoneModal.delivery_fee} د.ل</b></span>
                    </div>
                  </div>
                  <div class="dock-actions-flex">
                    <button type="button" class="btn btn-sm btn-primary" on:click={handleSaveZone} disabled={editingZoneModal.saving}>
                      {editingZoneModal.saving ? 'جاري الحفظ...' : 'حفظ وتثبيت النطاق'}
                    </button>
                    <button type="button" class="btn btn-sm btn-secondary" on:click={switchToFullModal}>
                      تفاصيل المنطقة (النافذة الكاملة)
                    </button>
                    <button type="button" class="btn btn-sm btn-outline danger" on:click={closeEditingZoneModal}>
                      ✕ إلغاء
                    </button>
                  </div>
                </div>

                <!-- شريط الإحداثيات والتأكيد اليدوي -->
                <div class="dock-coords-bar">
                  <div class="dock-coords-text">
                    <span> المركز المعتمد:</span>
                    <b class="dock-coord-val">{Number(editingZoneModal.center_lat).toFixed(4)}°, {Number(editingZoneModal.center_lng).toFixed(4)}°</b>
                    <span class="dock-shape-val">الشكل: {editingZoneModal.shape_type === 'box' ? 'مربع حر' : (editingZoneModal.shape_type === 'ellipse' ? 'بيضاوية' : (editingZoneModal.shape_type === 'polygon' ? 'مضلع حر' : 'دائرة'))}</span>
                  </div>
                  {#if editingZoneModal.coordsConfirmed}
                    <span class="dock-confirmed-pill">{editingZoneModal.coordsConfirmedMsg}</span>
                  {:else}
                    <span class="dock-click-hint"> بعد ضبط أو سحب الدائرة / المربع، انقر في أي مكان على الخريطة لتأكيد واعتماد الإحداثيات يدوياً!</span>
                  {/if}
                </div>

                <!-- أزرار تبديل الشكل السريعة أثناء المشاهدة على الخريطة -->
                <div class="dock-quick-tools">
                  <div class="dock-shape-pills">
                    <button type="button" class="dock-pill" class:active={editingZoneModal.shape_type === 'circle'} on:click={() => { editingZoneModal.shape_type = 'circle'; handleShapeTypeChange(); }}>دائرة</button>
                    <button type="button" class="dock-pill" class:active={editingZoneModal.shape_type === 'ellipse'} on:click={() => { editingZoneModal.shape_type = 'ellipse'; handleShapeTypeChange(); }}>بيضاوية</button>
                    <button type="button" class="dock-pill" class:active={editingZoneModal.shape_type === 'box'} on:click={() => { editingZoneModal.shape_type = 'box'; handleShapeTypeChange(); }}>مربع حر</button>
                    <button type="button" class="dock-pill" class:active={editingZoneModal.shape_type === 'polygon'} on:click={() => { editingZoneModal.shape_type = 'polygon'; handleShapeTypeChange(); }}>مضلع حر</button>
                  </div>
                  {#if editingZoneModal.shape_type === 'box' || editingZoneModal.shape_type === 'polygon'}
                    <div class="dock-poly-tools">
                      <button type="button" class="dock-btn-xs" on:click={removeLastVertex}>↩️ حذف آخر زاوية</button>
                      <button type="button" class="dock-btn-xs" on:click={resetShapeVertices}> إعادة ضبط الأركان</button>
                    </div>
                  {/if}
                </div>
              </div>
            {/if}

            <div id="admin-geo-map" class="admin-geo-map-canvas"></div>
            <div class="geo-map-legend-bar">
              <span class="legend-bar-title"> النطاقات المعروضة على الخريطة:</span>
              <div class="legend-pills-wrap">
                {#each filteredZonesForCity as z}
                  <span class="legend-badge-item" style="border-right-color: {z.zone_color || '#5e6b2c'};">
                    <span class="legend-swatch-dot" style="background: {z.zone_color || '#5e6b2c'};"></span>
                    <b>{z.zone_name}</b>: {z.delivery_fee} د.ل
                  </span>
                {/each}
              </div>
            </div>
          </div>

          <!-- جدول إدارة النطاقات مع تعديل الاسم والسعر والإحداثيات -->
          <div class="table-responsive" style="margin-top: 24px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>اللون</th>
                  <th>المدينة</th>
                  <th>اسم المنطقة والنطاق</th>
                  <th>الشكل الجغرافي</th>
                  <th>مركز الإحداثيات (Lat, Lng)</th>
                  <th>نطاق التغطية</th>
                  <th>رسوم التوصيل</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredZonesForCity as z (z.id)}
                  <tr>
                    <td>
                      <span class="color-swatch-circle" style="background: {z.zone_color || '#5e6b2c'};"></span>
                    </td>
                    <td><strong>{z.city || z.city_name}</strong></td>
                    <td>
                      <div class="zone-name-cell">
                        <b>{z.zone_name}</b>
                        {#if z.estimated_minutes}
                          <small class="zone-time-sub">متوقع {z.estimated_minutes} دقيقة</small>
                        {/if}
                      </div>
                    </td>
                    <td>
                      <span class="badge-shape-type">
                        {#if z.shape_type === 'polygon' || (z.polygon_geojson && z.shape_type !== 'box' && z.shape_type !== 'ellipse')}
                          مضلع حر مخصص
                        {:else if z.shape_type === 'ellipse'}
                           دائرة غير متناسقة (بيضاوية)
                        {:else if z.shape_type === 'box'}
                           مربع / مستطيل حر
                        {:else}
                          دائرة جغرافية
                        {/if}
                      </span>
                    </td>
                    <td>
                      <small class="coords-tag">
                        {#if z.center_lat && z.center_lng}
                          {Number(z.center_lat).toFixed(4)}°, {Number(z.center_lng).toFixed(4)}°
                        {:else}
                          غير محدد
                        {/if}
                      </small>
                    </td>
                    <td>
                      <b class="radius-tag">{((z.radius_meters || 3000) / 1000).toFixed(1)} كم</b>
                    </td>
                    <td>
                      <b class="cell-price">{z.delivery_fee} د.ل</b>
                    </td>
                    <td>
                      <div class="actions-cell-flex">
                        <button type="button" class="btn-sm-action" on:click={() => openEditZoneModal(z)}>
                          تعديل البيانات ️
                        </button>
                        <button type="button" class="btn-sm-action map-btn-highlight" on:click={() => { openEditZoneModal(z); switchToMapEditing(); }}>
                          تشكيل عالخريطة
                        </button>
                        <button type="button" class="btn-sm-action danger" on:click={() => handleDeleteZone(z.id)}>
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- سجل تدقيق وتغييرات الأسعار الأخيرة -->
          <h4 style="margin-top: 32px; color: var(--olive);">سجل تدقيق وتغييرات الأسعار الأخيرة:</h4>
          <div class="history-list">
            {#each priceHistory as h (h.id)}
              <div class="history-item">
                <span>تم تعديل سعر <b>{h.item_title}</b> من {h.old_price} إلى <b>{h.new_price} د.ل</b></span>
                <small>{h.reason || 'تعديل إداري'} — {h.admin_name || 'مدير النظام'}</small>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- ================= 9. تبويب العهد والمالية ================= -->
      {#if currentTab === 'financials'}
        <div class="financials-management-container fade-in">
          <div class="section-top-header">
            <div>
              <h3> الإدارة المالية للعهد النقدية وأرباح التوصيل</h3>
              <p class="subtitle">متابعة المبالغ النقدية المحصلة في عهدة الكباتن، أرباح التوصيل المستحقة، وتوريد واستلام صافي المبالغ إلى خزينة الإدارة.</p>
            </div>
            <button type="button" class="btn btn-outline btn-refresh-fin" on:click={reloadFinancials}>
               تحديث البيانات المالية
            </button>
          </div>

          <!-- شريط الأرباح والتدفق المالي اليومي -->
          <div class="today-profit-banner">
            <div class="today-banner-header">
              <div class="today-title-row">
                <span class="live-pulse-dot"></span>
                
                <div>
                  <h4>ملخص الأرباح والتدفق المالي لليوم</h4>
                  <p class="today-subtitle">متابعة فورية للأرباح الصافية اليومية للمتجر، عوائد التوصيل للكباتن، والنقدية المحصلة في الميدان.</p>
                </div>
              </div>
              <span class="badge-today-orders"> {driversFinancials.totals?.today?.todayDeliveredOrders || stats.todayOrders || 0} طلبات مسلمة اليوم</span>
            </div>

            <div class="today-metrics-row">
              <div class="today-metric-box store-profit-box">
                <span class="tm-label"> أرباح المتجر الصافية اليوم</span>
                <strong class="tm-value text-emerald">{(driversFinancials.totals?.today?.todayStoreProfit !== undefined ? driversFinancials.totals.today.todayStoreProfit : (stats.todayStoreProfit || 0)).toLocaleString()} د.ل</strong>
                <span class="tm-hint">صافي مبيعات الباقات بدون التوصيل</span>
              </div>

              <div class="today-metric-box driver-profit-box">
                <span class="tm-label"> أرباح التوصيل للكباتن اليوم</span>
                <strong class="tm-value text-amber">{(driversFinancials.totals?.today?.todayDriverEarnings !== undefined ? driversFinancials.totals.today.todayDriverEarnings : (stats.todayDriverEarnings || 0)).toLocaleString()} د.ل</strong>
                <span class="tm-hint">عمولات التوصيل المكتسبة للكباتن اليوم</span>
              </div>

              <div class="today-metric-box cash-collected-box">
                <span class="tm-label">كاش العهدة المحصل اليوم</span>
                <strong class="tm-value text-gold">{(driversFinancials.totals?.today?.todayCashCollected !== undefined ? driversFinancials.totals.today.todayCashCollected : (stats.todayCashCollected || 0)).toLocaleString()} د.ل</strong>
                <span class="tm-hint">كاش الطلبات المسلمة نقداً اليوم</span>
              </div>

              <div class="today-metric-box cash-settled-box">
                <span class="tm-label">التوريدات المستلمة بالخزينة اليوم</span>
                <strong class="tm-value text-blue">{(driversFinancials.totals?.today?.todayCashSettled !== undefined ? driversFinancials.totals.today.todayCashSettled : (stats.todayCashSettled || 0)).toLocaleString()} د.ل</strong>
                <span class="tm-hint">التسويات المودعة بالخزينة اليوم</span>
              </div>
            </div>
          </div>

          <!-- بطاقات المؤشرات المالية العامة -->
          <div class="fin-kpi-grid">
            <div class="fin-kpi-card fin-card-custody">
              <div class="fin-kpi-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></div>
              <div class="fin-kpi-info">
                <span class="fin-kpi-label">إجمالي العهد في الميدان (كاش بحوزة الكباتن)</span>
                <strong class="fin-kpi-value custody-val">{(driversFinancials.totals?.totalCustody || 0).toLocaleString()} د.ل</strong>
                <span class="fin-kpi-hint">مبالغ الطلبات المسلمة نقداً وبانتظار التوريد</span>
              </div>
            </div>

            <div class="fin-kpi-card fin-card-earnings">
              <div class="fin-kpi-icon"></div>
              <div class="fin-kpi-info">
                <span class="fin-kpi-label">أرباح التوصيل المستحقة للكباتن</span>
                <strong class="fin-kpi-value profit-val">{(driversFinancials.totals?.totalDriverEarnings || 0).toLocaleString()} د.ل</strong>
                <span class="fin-kpi-hint">أجور التوصيل المكتسبة وغير المصفاة بعد</span>
              </div>
            </div>

            <div class="fin-kpi-card fin-card-net">
              <div class="fin-kpi-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
              <div class="fin-kpi-info">
                <span class="fin-kpi-label">صافي المبالغ المستحقة لخزينة الإدارة</span>
                <strong class="fin-kpi-value net-val">{(driversFinancials.totals?.totalNetDue || 0).toLocaleString()} د.ل</strong>
                <span class="fin-kpi-hint">العهدة الإجمالية مطروحاً منها أرباح التوصيل</span>
              </div>
            </div>

            <div class="fin-kpi-card fin-card-settled">
              <div class="fin-kpi-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
              <div class="fin-kpi-info">
                <span class="fin-kpi-label">إجمالي ما تم استلامه وتوريده سابقاً</span>
                <strong class="fin-kpi-value settled-val">{(driversFinancials.totals?.totalSettled || 0).toLocaleString()} د.ل</strong>
                <span class="fin-kpi-hint">المبالغ النقدية المودعة في الخزينة رسمياً</span>
              </div>
            </div>
          </div>

          <!-- جدول عهد وأرباح السائقين -->
          <div class="table-card" style="margin-top: 30px;">
            <div class="table-card-header">
              <div class="card-header-title">
                <span class="header-icon"></span>
                <h4>كشف عهد الكباتن وأرباحهم الحالية</h4>
              </div>
              <span class="badge-count">{driversFinancials.drivers?.length || 0} كابتن مسجل</span>
            </div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>الكابتن</th>
                    <th>حالة العمل</th>
                    <th>أرباح اليوم </th>
                    <th>الطلبات المسلمة</th>
                    <th>العهدة الحالية (كاش)</th>
                    <th>أرباح التوصيل المستحقة</th>
                    <th>صافي المطلوب توريده للإدارة</th>
                    <th>إجمالي المورّد سابقاً</th>
                    <th>إجراءات مالية</th>
                  </tr>
                </thead>
                <tbody>
                  {#each driversFinancials.drivers || [] as d (d.id)}
                    <tr class:has-pending-custody={Number(d.current_custody_amount) > 0}>
                      <td>
                        <div class="driver-cell-box">
                          <span class="driver-avatar-icon"></span>
                          <div>
                            <strong>{d.full_name}</strong>
                            <div class="driver-sub-meta">
                              <span>هاتف: {d.phone || 'بدون هاتف'}</span>
                              <span>مركبة: {d.vehicle_type || 'سيارة'} {d.vehicle_plate ? `(${d.vehicle_plate})` : ''}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {#if d.current_status === 'available'}
                          <span class="badge badge-success">متاح للطلبات</span>
                        {:else if d.current_status === 'busy'}
                          <span class="badge badge-warning">في مهمة توصيل</span>
                        {:else}
                          <span class="badge badge-secondary">غير متصل</span>
                        {/if}
                      </td>
                      <td>
                        <div class="today-earning-pill" class:has-earning={Number(d.today_earnings) > 0}>
                          <span class="te-num">+{Number(d.today_earnings || 0).toLocaleString()} د.ل</span>
                          <small class="te-orders">{d.today_delivered_count || 0} طلب اليوم</small>
                        </div>
                      </td>
                      <td>
                        <span class="orders-count-badge"> {d.delivered_count || 0} طلب</span>
                      </td>
                      <td>
                        <span class="financial-val-badge custody-badge">
                          {Number(d.current_custody_amount || 0).toLocaleString()} د.ل
                        </span>
                      </td>
                      <td>
                        <span class="financial-val-badge profit-badge">
                          +{Number(d.pending_earnings || 0).toLocaleString()} د.ل
                        </span>
                      </td>
                      <td>
                        <span class="financial-val-badge net-badge" class:has-debt={Number(d.net_due) > 0}>
                          {Number(d.net_due || 0).toLocaleString()} د.ل
                        </span>
                      </td>
                      <td>
                        <span class="settled-sub-text">{Number(d.settled_amount_total || 0).toLocaleString()} د.ل</span>
                      </td>
                      <td>
                        <div class="action-buttons-group">
                          <button 
                            type="button" 
                            class="btn-fin-action btn-settle-trigger"
                            title="استلام النقدية وتصفية العهدة"
                            on:click={() => openSettleModal(d)}
                          >
                            استلام وتسوية
                          </button>
                          <button 
                            type="button" 
                            class="btn-fin-action btn-statement-trigger"
                            title="عرض كشف الحساب والحركات"
                            on:click={() => openDriverStatement(d.id)}
                          >
                            كشف الحساب
                          </button>
                        </div>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td colspan="9" class="empty-table-cell">
                        لا يوجد سائقون مسجلون حالياً
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>

          <!-- جدول سجل إيصالات التوريد والتسويات المعتمدة -->
          <div class="table-card" style="margin-top: 36px;">
            <div class="table-card-header">
              <div class="card-header-title">
                
                <h4>سجل إيصالات استلام العهد والتسويات المعتمدة</h4>
              </div>
              <span class="badge-count">{settlementsHistory.length} تسوية مسجلة</span>
            </div>

            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>رقم الإيصال</th>
                    <th>التاريخ والوقت</th>
                    <th>الكابتن</th>
                    <th>مستلم المبلغ (الإدارة)</th>
                    <th>العهدة المصفاة</th>
                    <th>أرباح التوصيل المستوفاة</th>
                    <th>صافي المبلغ المودع بالخزينة</th>
                    <th>البيان والملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {#each settlementsHistory as s (s.id)}
                    <tr>
                      <td>
                        <span class="receipt-tag">#{s.settlement_number}</span>
                      </td>
                      <td>
                        <div class="date-time-box">
                          <strong>{new Date(s.created_at).toLocaleDateString('ar-LY')}</strong>
                          <small>{new Date(s.created_at).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}</small>
                        </div>
                      </td>
                      <td>
                        <strong>{s.driver_name || 'سائق'}</strong>
                        {#if s.driver_phone}<div class="driver-sub-meta">{s.driver_phone}</div>{/if}
                      </td>
                      <td>
                        <span class="admin-badge">{s.admin_name || 'مدير النظام'}</span>
                      </td>
                      <td>
                        <span class="text-custody-cleared">{Number(s.custody_cleared || 0).toLocaleString()} د.ل</span>
                      </td>
                      <td>
                        <span class="text-profit-deducted">-{Number(s.driver_earnings_deducted || 0).toLocaleString()} د.ل</span>
                      </td>
                      <td>
                        <span class="text-net-received">{Number(s.net_cash_received || 0).toLocaleString()} د.ل</span>
                      </td>
                      <td>
                        <span class="settle-notes-text">{s.notes || 'تسوية نقدية معتمدة'}</span>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td colspan="8" class="empty-table-cell">
                        لا توجد تسويات نقدية مسجلة حتى الآن. عندما تقوم الإدارة باستلام عهدة أي كابتن ستظهر الإيصالات هنا فوراً.
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/if}

      <!-- ================= 10. تبويب إدارة الطاقم والمستخدمين ================= -->
      {#if currentTab === 'users'}
        <div class="users-management-container fade-in">
          <div class="section-top-header">
            <div>
              <h3> إدارة الطاقم والمستخدمين</h3>
              <p class="subtitle">إضافة وإدارة حسابات كباتن التوصيل، منسقي الزهور، مدراء النظام، وزبائن المتجر.</p>
            </div>
            <div class="header-btns-row">
              <button type="button" class="btn btn-outline" on:click={reloadUsers}>
                 تحديث القائمة
              </button>
              <button type="button" class="btn btn-primary" on:click={() => openCreateUserModal('driver')}>
                + إضافة عضو طاقم / مستخدم جديد
              </button>
            </div>
          </div>

          <!-- شريط الفلاتر والبحث السريع -->
          <div class="users-filter-bar card">
            <div class="user-role-chips">
              <button 
                type="button" 
                class="role-chip" 
                class:active={userFilterRole === 'all'} 
                on:click={() => userFilterRole = 'all'}
              >
                الكل ({allUsers.length})
              </button>
              <button 
                type="button" 
                class="role-chip chip-driver" 
                class:active={userFilterRole === 'driver'} 
                on:click={() => userFilterRole = 'driver'}
              >
                 كباتن التوصيل ({allUsers.filter(u => u.role_name === 'driver').length})
              </button>
              <button 
                type="button" 
                class="role-chip chip-florist" 
                class:active={userFilterRole === 'florist'} 
                on:click={() => userFilterRole = 'florist'}
              >
                 منسقو الورد ({allUsers.filter(u => u.role_name === 'florist').length})
              </button>
              <button 
                type="button" 
                class="role-chip chip-admin" 
                class:active={userFilterRole === 'admin'} 
                on:click={() => userFilterRole = 'admin'}
              >
                 إدارة النظام ({allUsers.filter(u => u.role_name === 'admin').length})
              </button>
              <button 
                type="button" 
                class="role-chip chip-customer" 
                class:active={userFilterRole === 'customer'} 
                on:click={() => userFilterRole = 'customer'}
              >
                 الزبائن ({allUsers.filter(u => u.role_name === 'customer').length})
              </button>
            </div>

            <div class="user-search-box">
              <input 
                type="text" 
                class="input-field" 
                placeholder="بحث بالاسم، رقم الهاتف، أو البريد..." 
                bind:value={userSearchQuery} 
              />
              {#if userSearchQuery}
                <button type="button" class="btn-clear-search" on:click={() => userSearchQuery = ''}>✕</button>
              {/if}
            </div>
          </div>

          <!-- جدول المستخدمين -->
          <div class="table-card" style="margin-top: 20px;">
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>الدور والصلاحية</th>
                    <th>بيانات العمل / الأسطول</th>
                    <th>الحالة</th>
                    <th>تاريخ التسجيل</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredUsers as u (u.id)}
                    <tr>
                      <td>
                        <div class="user-row-box">
                          <span class="user-avatar-tag">
                            {#if u.role_name === 'driver'}
                            {:else if u.role_name === 'florist'}
                            {:else if u.role_name === 'admin'}
                            {:else}{/if}
                          </span>
                          <div>
                            <strong>{u.full_name}</strong>
                            <div class="user-sub-info">
                              <span>هاتف: {u.phone}</span>
                              {#if u.email}<span>بريد: {u.email}</span>{/if}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {#if u.role_name === 'driver'}
                          <span class="user-role-badge role-badge-driver"> كابتن توصيل</span>
                        {:else if u.role_name === 'florist'}
                          <span class="user-role-badge role-badge-florist"> منسق زهور</span>
                        {:else if u.role_name === 'admin'}
                          <span class="user-role-badge role-badge-admin"> مدير نظام</span>
                        {:else}
                          <span class="user-role-badge role-badge-customer"> زبون متجر</span>
                        {/if}
                      </td>
                      <td>
                        {#if u.role_name === 'driver'}
                          <div class="work-meta-box">
                            <span>مركبة: {u.vehicle_type || 'سيارة'} {u.plate_number ? `(${u.plate_number})` : ''}</span>
                            <small> {u.driver_delivered_orders || 0} طلب مسلم | تقييم {u.driver_rating || 5}</small>
                          </div>
                        {:else if u.role_name === 'florist'}
                          <div class="work-meta-box">
                            <span> الأتيليه واستوديو التنسيق</span>
                            <small> {u.florist_active_tasks || 0} مهام نشطة حالياً</small>
                          </div>
                        {:else if u.role_name === 'admin'}
                          <span class="text-muted-meta">صلاحيات إدارة شاملة</span>
                        {:else}
                          <span class="text-muted-meta"> {u.customer_orders_count || 0} طلبات مؤكدة</span>
                        {/if}
                      </td>
                      <td>
                        <button 
                          type="button" 
                          class="status-toggle-pill" 
                          class:active={u.status === 'active'}
                          title="انقر لتغيير حالة الحساب (تفعيل / إيقاف)"
                          on:click={() => handleToggleUserStatus(u)}
                        >
                          {u.status === 'active' ? 'نشط' : 'موقوف'}
                        </button>
                      </td>
                      <td>
                        <span class="date-text">{new Date(u.created_at).toLocaleDateString('ar-LY')}</span>
                      </td>
                      <td>
                        <div class="action-buttons-group">
                          {#if u.role_name === 'driver'}
                            <button 
                              type="button" 
                              class="btn-sm-action btn-sm-fin" 
                              title="عرض العهدة وكشف الحساب المالي"
                              on:click={() => openDriverStatement(u.id)}
                            >
                               العهدة
                            </button>
                          {/if}
                          <button 
                            type="button" 
                            class="btn-sm-action btn-sm-del" 
                            title="حذف الحساب"
                            on:click={() => handleDeleteUser(u)}
                          >
                            ️
                          </button>
                        </div>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td colspan="6" class="empty-table-cell">
                        لا يوجد مستخدمون مطابقون لمعايير البحث
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      {/if}
        </div>
      </main>
    </div>
  </div>

  <!-- مودال إضافة / تعديل نطاق توصيل وتشكيل الخريطة بحرية -->
  {#if editingZoneModal.open && !editingZoneModal.dockedToMap}
    <div class="modal-backdrop fade-in" on:click|self={closeEditingZoneModal}>
      <div class="modal-card geo-zone-modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge"></span>
            <div>
              <h3>{editingZoneModal.isEdit ? 'تعديل وتشكيل النطاق الجغرافي والاسم والسعر' : 'إضافة وتشكيل نطاق توصيل جغرافي جديد'}</h3>
              <p class="modal-subtitle">تشكيل أطراف المربع أو الدائرة أو المضلع بحرية تامة وبدون قيود تناسق</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={closeEditingZoneModal}>✕</button>
        </div>

        {#if editingZoneModal.errorMsg}
          <div class="alert-error">{editingZoneModal.errorMsg}</div>
        {/if}

        <div class="modal-body-scroll">
          <!-- بنر الانتقال السريع للتشكيل والتأكيد المباشر على الخريطة -->
          <div class="map-direct-switch-banner">
            <div class="banner-text-box">
              <span class="banner-pin-icon">️</span>
              <div>
                <b>التشكيل اليدوي المباشر على الخريطة:</b>
                <p>يمكنك التشكيل بالماوس على الخريطة وسحب الأركان والدوائر، ثم النقر على أي مكان في الخريطة لتأكيد واعتماد الإحداثيات يدوياً.</p>
              </div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" on:click={switchToMapEditing}>
              انتقل للخريطة لتأكيد الإحداثيات
            </button>
          </div>

          <div class="flower-fields-grid">
            <div class="form-group">
              <label>المدينة: *</label>
              <select class="input-field styled-select" bind:value={editingZoneModal.city}>
                <option value="طرابلس">طرابلس</option>
                <option value="بنغازي">بنغازي</option>
                <option value="مصراتة">مصراتة</option>
                <option value="الزاوية">الزاوية</option>
                <option value="الخمس">الخمس</option>
                <option value="زليتن">زليتن</option>
                <option value="أخرى">مدينة أخرى</option>
              </select>
            </div>

            <div class="form-group">
              <label>اسم المنطقة / النطاق الجغرافي: *</label>
              <input type="text" class="input-field" placeholder="مثال: النوفليين وبن عاشور، جنزور، طرابلس المركز..." bind:value={editingZoneModal.zone_name} />
            </div>

            <div class="form-group">
              <label>سعر التوصيل لهذا النطاق (د.ل): *</label>
              <input type="number" step="1" class="input-field" bind:value={editingZoneModal.delivery_fee} />
            </div>

            <div class="form-group">
              <label>نوع وتشكيل الشكل على الخريطة: *</label>
              <select class="input-field styled-select" bind:value={editingZoneModal.shape_type} on:change={handleShapeTypeChange}>
                <option value="circle">دائرة جغرافية متناسقة (منتظمة)</option>
                <option value="ellipse"> دائرة غير متناسقة / بيضاوية (أبعاد حرة وميلان)</option>
                <option value="box"> مربع / مستطيل حر بأطراف وزوايا قابلة للسحب</option>
                <option value="polygon">مضلع حر مخصص بأي عدد من الزوايا</option>
              </select>
            </div>

            <div class="form-group">
              <label>خط العرض لمركز النطاق (Latitude):</label>
              <input type="number" step="0.0001" class="input-field" bind:value={editingZoneModal.center_lat} on:change={() => updateModalPreviewLayer(true)} />
            </div>

            <div class="form-group">
              <label>خط الطول لمركز النطاق (Longitude):</label>
              <input type="number" step="0.0001" class="input-field" bind:value={editingZoneModal.center_lng} on:change={() => updateModalPreviewLayer(true)} />
            </div>

            <!-- خيارات الدائرة العادية -->
            {#if editingZoneModal.shape_type === 'circle'}
              <div class="form-group full-width">
                <div class="range-header-row">
                  <label>نصف قطر الدائرة: <b>{((editingZoneModal.radius_meters || 3000) / 1000).toFixed(1)} كم</b> ({editingZoneModal.radius_meters} متر)</label>
                </div>
                <input 
                  type="range" 
                  min="500" 
                  max="25000" 
                  step="250" 
                  class="radius-range-slider"
                  bind:value={editingZoneModal.radius_meters}
                  on:input={() => updateModalPreviewLayer(true)}
                />
                <div class="shape-actions-bar" style="margin-top: 8px;">
                  <button type="button" class="btn-sub-tool" on:click={convertShapeToFreeformPolygon}>
                    تحويل الدائرة إلى مضلع حر لتعديل أطرافها
                  </button>
                </div>
              </div>
            {/if}

            <!-- خيارات الدائرة البيضاوية غير المتناسقة -->
            {#if editingZoneModal.shape_type === 'ellipse'}
              <div class="form-group full-width">
                <div class="range-header-row">
                  <label>↔️ العرض (نصف القطر الأفقي شرق-غرب): <b>{((editingZoneModal.radius_meters || 3500) / 1000).toFixed(1)} كم</b> ({editingZoneModal.radius_meters} متر)</label>
                </div>
                <input 
                  type="range" 
                  min="500" 
                  max="25000" 
                  step="250" 
                  class="radius-range-slider"
                  bind:value={editingZoneModal.radius_meters}
                  on:input={() => updateModalPreviewLayer(true)}
                />
              </div>

              <div class="form-group full-width">
                <div class="range-header-row">
                  <label>↕️ الارتفاع (نصف القطر الرأسي شمال-جنوب): <b>{((editingZoneModal.radius_meters_y || 2500) / 1000).toFixed(1)} كم</b> ({editingZoneModal.radius_meters_y} متر)</label>
                </div>
                <input 
                  type="range" 
                  min="500" 
                  max="25000" 
                  step="250" 
                  class="radius-range-slider"
                  bind:value={editingZoneModal.radius_meters_y}
                  on:input={() => updateModalPreviewLayer(true)}
                />
              </div>

              <div class="form-group full-width">
                <div class="range-header-row">
                  <label> زاوية الميلان / الدوران: <b>{editingZoneModal.rotation_deg || 0}°</b></label>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="180" 
                  step="5" 
                  class="radius-range-slider"
                  bind:value={editingZoneModal.rotation_deg}
                  on:input={() => updateModalPreviewLayer(true)}
                />
                <div class="shape-actions-bar" style="margin-top: 8px;">
                  <button type="button" class="btn-sub-tool" on:click={convertShapeToFreeformPolygon}>
                    تحويل إلى مضلع حر لتعديل أطرافها
                  </button>
                </div>
              </div>
            {/if}

            <!-- خيارات المربع الحر أو المضلع متعدد الزوايا -->
            {#if editingZoneModal.shape_type === 'box' || editingZoneModal.shape_type === 'polygon'}
              <div class="form-group full-width">
                <div class="polygon-toolbar-box">
                  <div class="polygon-toolbar-head">
                    <span class="polygon-pts-badge">
                       عدد الزوايا والأركان: <b>{editingZoneModal.points ? editingZoneModal.points.length : 0}</b>
                    </span>
                    <div class="polygon-mode-pills">
                      <button 
                        type="button" 
                        class="pill-mode-btn" 
                        class:active={editingZoneModal.interaction_mode === 'handles'}
                        on:click={() => { editingZoneModal.interaction_mode = 'handles'; }}
                      >
                         سحب الزوايا بالماوس
                      </button>
                      <button 
                        type="button" 
                        class="pill-mode-btn" 
                        class:active={editingZoneModal.interaction_mode === 'add_point'}
                        on:click={() => { editingZoneModal.interaction_mode = 'add_point'; }}
                      >
                        إضافة زاوية بالنقر على الخريطة
                      </button>
                    </div>
                  </div>

                  <div class="polygon-actions-row">
                    <button type="button" class="btn-sub-tool" on:click={removeLastVertex}>
                      ↩️ تراجع عن آخر زاوية
                    </button>
                    <button type="button" class="btn-sub-tool" on:click={resetShapeVertices}>
                       إعادة ضبط الأركان حول المركز
                    </button>
                    {#if editingZoneModal.shape_type === 'box'}
                      <button type="button" class="btn-sub-tool" on:click={convertShapeToFreeformPolygon}>
                         تحويل إلى مضلع حر غير مقيد بـ 4 أركان
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}

            <div class="form-group">
              <label>لون النطاق على الخريطة:</label>
              <div class="color-picker-row">
                <input type="color" class="native-color-picker" bind:value={editingZoneModal.zone_color} on:change={() => updateModalPreviewLayer(true)} />
                <span class="color-hex-tag">{editingZoneModal.zone_color}</span>
              </div>
            </div>

            <div class="form-group">
              <label>الوقت المتوقع للتوصيل (دقيقة):</label>
              <input type="number" step="5" class="input-field" bind:value={editingZoneModal.estimated_minutes} />
            </div>
          </div>

          <div class="map-helper-banner">
            <span><b>حرية التشكيل:</b> اسحب أي مقبض أو زاوية مرقمة (1، 2، 3، 4...) على الخريطة بالماوس لتشكيل حدود المنطقة كما تشاء تماماً بدون أي قيود تناسق، واسحب مقبض المركز لتحريك النطاق بالكامل!</span>
          </div>
        </div>

        <div class="modal-actions-styled">
          <button 
            type="button" 
            class="btn btn-primary" 
            disabled={editingZoneModal.saving}
            on:click={handleSaveZone}
          >
            {editingZoneModal.saving ? 'جاري الحفظ...' : 'حفظ النطاق الجغرافي والأسعار'}
          </button>
          <button type="button" class="btn btn-outline" on:click={closeEditingZoneModal}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- مودال إنشاء كوبون جديد -->
  {#if showNewCouponModal}
    <div class="modal-backdrop fade-in" on:click|self={() => showNewCouponModal = false}>
      <div class="modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge">️</span>
            <div>
              <h3>إنشاء كود تخفيض جديد</h3>
              <p class="modal-subtitle">إضافة كوبون ترويجي لخصومات زبائن مسكة</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={() => showNewCouponModal = false}>✕</button>
        </div>

        <div class="modal-form">
          <div class="form-group">
            <label>كود الكوبون (بالأحرف الكبيرة):</label>
            <input type="text" class="input-field" placeholder="مثال: MASKA2026" bind:value={newCoupon.code} />
          </div>
          <div class="form-group">
            <label>نوع الخصم:</label>
            <select class="input-field styled-select" bind:value={newCoupon.discountType}>
              <option value="fixed_amount">مبلغ ثابت بالدينار الليبي (د.ل)</option>
              <option value="percent">نسبة مئوية مئوية (%)</option>
            </select>
          </div>
          <div class="form-group">
            <label>قيمة الخصم ({newCoupon.discountType === 'percent' ? '%' : 'د.ل'}):</label>
            <input type="number" class="input-field" bind:value={newCoupon.discountValue} />
          </div>
          <div class="form-group">
            <label>الحد الأدنى لقيمة الطلب (د.ل):</label>
            <input type="number" class="input-field" bind:value={newCoupon.minOrderAmount} />
          </div>
          <div class="modal-actions-styled">
            <button type="button" class="btn btn-primary" on:click={handleCreateCoupon}>إنشاء وتفعيل الكوبون </button>
            <button type="button" class="btn btn-outline" on:click={() => showNewCouponModal = false}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- مودال الرد على التقييم -->
  {#if replyModal.open}
    <div class="modal-backdrop fade-in" on:click|self={() => replyModal.open = false}>
      <div class="modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            
            <div>
              <h3>رد الإدارة على تقييم الزبون</h3>
              <p class="modal-subtitle">سيظهر الرد المعتمد علناً في المتجر والصفحة الرئيسية</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={() => replyModal.open = false}>✕</button>
        </div>

        <textarea 
          rows="4" 
          class="textarea-field" 
          bind:value={replyModal.text} 
          placeholder="اكتب ردك اللطيف والمشجع للزبون..."
        ></textarea>
        <div class="modal-actions-styled">
          <button type="button" class="btn btn-primary" on:click={handleReplyReview}>إرسال الرد المعتمد</button>
          <button type="button" class="btn btn-outline" on:click={() => replyModal.open = false}>إلغاء</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- مودال التتبع المباشر للطلب بالخريطة ومسار المراحل -->
  {#if orderTrackingModal.open && orderTrackingModal.order}
    {@const ord = orderTrackingModal.order}
    {@const curIdx = getStageIndex(ord.status)}
    <div class="modal-backdrop fade-in" on:click|self={closeOrderTracking}>
      <div class="modal-card tracking-modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge">📍</span>
            <div>
              <h3>تتبع مسار الطلب #{ord.order_number}</h3>
              <p class="modal-subtitle">المستلم: {ord.recipient_name} | {ord.delivery_city} - {ord.delivery_zone || 'المركز'}</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={closeOrderTracking}>✕</button>
        </div>

        {#if orderTrackingModal.loading}
          <div class="tracking-loading-state">
            <div class="tracking-spinner"></div>
            <p>جاري استرجاع إحداثيات السائق ومسار التوصيل المباشر...</p>
          </div>
        {:else}
          <!-- شريط مسار المراحل داخل مودال التتبع -->
          <div class="modal-timeline-stepper">
            {#each orderStages as stg, idx}
              <div class="m-step-node" class:completed={idx <= curIdx} class:active={idx === curIdx}>
                <div class="m-marker">
                  {#if idx < curIdx}✓{:else}{idx + 1}{/if}
                </div>
                <div class="m-meta">
                  <b class="m-label">{stg.label}</b>
                </div>
              </div>
              {#if idx < orderStages.length - 1}
                <div class="m-stepper-line" class:completed={idx < curIdx}></div>
              {/if}
            {/each}
          </div>

          <div class="tracking-modal-grid">
            <!-- الخريطة التفاعلية الحية -->
            <div class="tracking-map-col">
              <div class="map-card-container">
                <div id="order-tracking-live-map" class="order-live-map-canvas"></div>
                <div class="map-badges-overlay">
                  <span class="map-stat-badge">🚗 {ord.status === 'out_for_delivery' ? 'في الطريق للمستلم' : ord.status === 'delivered' ? 'تم التسليم بنجاح' : 'قيد التجهيز بالأوركيد'}</span>
                  <span class="map-stat-badge">🕒 {ord.delivery_window || 'توصيل فوري'}</span>
                </div>
              </div>

              <!-- بطاقة السائق المباشرة -->
              <div class="tracking-driver-card">
                <div class="d-avatar-box">🚗</div>
                <div class="d-info-box">
                  <h4 class="d-name">{ord.driver_name || 'الكابتن غير مسند حالياً'}</h4>
                  <p class="d-sub">{ord.vehicle_type || 'سيارة مسكة المبردة'} {ord.plate_number ? `(${ord.plate_number})` : ''}</p>
                </div>
                <div class="d-actions">
                  {#if ord.driver_phone}
                    <a href="tel:{ord.driver_phone}" class="btn-call-driver">
                      📞 اتصال ({ord.driver_phone})
                    </a>
                  {/if}
                </div>
              </div>
            </div>

            <!-- العمود الجانبي: سجل التحركات وتفاصيل الباقة -->
            <div class="tracking-details-col">
              <!-- معلومات المستلم والعنوان -->
              <div class="track-info-section">
                <h4 class="t-sec-title">بيانات التسليم والمستلم</h4>
                <div class="t-info-row">
                  <span>المستلم:</span>
                  <b>{ord.recipient_name} ({ord.recipient_phone})</b>
                </div>
                <div class="t-info-row">
                  <span>الوجهة:</span>
                  <span>{ord.delivery_city} - {ord.delivery_zone || ''} {ord.delivery_address_details || ''}</span>
                </div>
                {#if ord.delivery_lat && ord.delivery_lng}
                  <div class="t-info-row">
                    <span>الملاحة:</span>
                    <a 
                      href="https://www.google.com/maps?q={ord.delivery_lat},{ord.delivery_lng}" 
                      target="_blank" 
                      rel="noopener"
                      class="link-maps-nav"
                    >
                      فتح في خرائط Google Maps ↗
                    </a>
                  </div>
                {/if}
                {#if ord.customer_notes}
                  <div class="t-notes-box">
                    <small>ملاحظات الزبون: "{ord.customer_notes}"</small>
                  </div>
                {/if}
              </div>

              <!-- تفاصيل عناصر الطلب -->
              {#if orderTrackingModal.items && orderTrackingModal.items.length > 0}
                <div class="track-info-section">
                  <h4 class="t-sec-title">محتويات الباقة ({orderTrackingModal.items.length})</h4>
                  <div class="t-items-mini-list">
                    {#each orderTrackingModal.items as itm}
                      <div class="t-item-mini-row">
                        <span>{itm.item_name || itm.name || 'باقة مسكة'}</span>
                        <b>× {itm.quantity}</b>
                        <span>{(Number(itm.unit_price) * itm.quantity).toFixed(0)} د.ل</span>
                      </div>
                    {/each}
                    <div class="t-total-row">
                      <span>المجموع الكلي:</span>
                      <b class="t-total-price">{ord.total_amount} دينار ليبي</b>
                    </div>
                  </div>
                </div>
              {/if}

              <!-- سجل مراحل وتحديثات الطلب -->
              {#if orderTrackingModal.history && orderTrackingModal.history.length > 0}
                <div class="track-info-section">
                  <h4 class="t-sec-title">سجل مراحل وتحديثات الطلب</h4>
                  <div class="t-history-timeline">
                    {#each orderTrackingModal.history as h}
                      <div class="h-step-item">
                        <span class="h-step-dot"></span>
                        <div class="h-step-content">
                          <b>{getStageLabel(h.status)}</b>
                          <small class="h-step-time">{new Date(h.created_at).toLocaleString('ar-LY')}</small>
                          {#if h.comment}
                            <p class="h-step-comment">{h.comment}</p>
                          {/if}
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- إجراءات التحكم الفوري للمدير -->
              <div class="track-actions-bar">
                <button 
                  type="button" 
                  class="btn-track-action-assign"
                  on:click={() => {
                    const o = ord;
                    closeOrderTracking();
                    openAssignModal(o);
                  }}
                >
                  👤 توجيه / تغيير الطاقم
                </button>
                <button 
                  type="button" 
                  class="btn-track-action-public"
                  on:click={() => router.navigate('/track', { order: ord.order_number })}
                >
                  🌐 فتح شاشة التتبع العامة ↗
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- مودال توجيه وإسناد الطلب للمنسقة والسائق -->
  {#if assignModal.open && assignModal.order}
    <div class="modal-backdrop fade-in" on:click|self={closeAssignModal}>
      <div class="modal-card assign-modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge"></span>
            <div>
              <h3>توجيه الطلب #{assignModal.order.order_number} للطاقم</h3>
              <p class="modal-subtitle">إسناد وتوجيه لمسؤول التنسيق وسائق التوصيل الميداني</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={closeAssignModal}>✕</button>
        </div>

        {#if assignModal.errorMsg}
          <div class="alert-error">{assignModal.errorMsg}</div>
        {/if}
        {#if assignModal.successMsg}
          <div class="alert-success">{assignModal.successMsg}</div>
        {/if}

        <!-- بطاقة ملخص بيانات الطلب -->
        <div class="order-summary-box">
          <div class="summary-col">
            <span class="summary-label">المستلم:</span>
            <b>{assignModal.order.recipient_name} ({assignModal.order.recipient_phone})</b>
          </div>
          <div class="summary-col">
            <span class="summary-label">العنوان والمدينة:</span>
            <span>{assignModal.order.delivery_city} — {assignModal.order.delivery_zone || 'المركز'}</span>
          </div>
          <div class="summary-col">
            <span class="summary-label">المبلغ والنافذة:</span>
            <b>{assignModal.order.total_amount} د.ل</b> ({assignModal.order.delivery_window || 'توصيل فوري'})
          </div>
          {#if assignModal.order.customer_notes}
            <div class="summary-col full-width">
              <span class="summary-label">ملاحظات العميل:</span>
              <span class="customer-note-tag">"{assignModal.order.customer_notes}"</span>
            </div>
          {/if}
        </div>

        <!-- حقول التوجيه -->
        <div class="assign-form-grid">
          <!-- 1. توجيه منسقة الورد -->
          <div class="assign-field-group">
            <label class="assign-label">
              <span class="label-icon"></span>
              <b>توجيه إلى منسقة الورد:</b>
            </label>
            <p class="assign-help">تتولى قص وتنسيق الورود وإعداد كرت الإهداء وختم الشمع الملكي</p>
            <select class="input-field styled-select" bind:value={assignModal.floristId}>
              <option value="">-- بدون إسناد (بانتظار التنسيق) --</option>
              {#each florists as f (f.id)}
                <option value={f.id}>
                   {f.full_name} ({f.phone}) — {f.active_tasks_count ? `مهام نشطة: ${f.active_tasks_count}` : 'متفرغة للعمل'}
                </option>
              {/each}
            </select>
          </div>

          <!-- 2. توجيه سائق التوصيل -->
          <div class="assign-field-group">
            <label class="assign-label">
              <span class="label-icon"></span>
              <b>توجيه إلى سائق التوصيل:</b>
            </label>
            <p class="assign-help">يستلم الباقة ويبدأ رحلة التوصيل مع فتح الموقع عبر GPS في Google Maps</p>
            <select class="input-field styled-select" bind:value={assignModal.driverId}>
              <option value="">-- بدون سائق (متاح للسائقين) --</option>
              {#each drivers as d (d.id || d.user_id)}
                <option value={d.id || d.user_id}>
                  {d.full_name} ({d.vehicle_type || 'سيارة تبريد'}) — {d.current_status === 'available' ? 'متاح' : (d.current_status === 'busy' ? 'في مهمة' : 'غير متصل')} (تقييم {d.rating || 4.9})
                </option>
              {/each}
            </select>
          </div>

          <!-- 3. مسار حالة الطلب -->
          <div class="assign-field-group full-width">
            <label class="assign-label">
              <span class="label-icon"></span>
              <b>تحديث حالة مسار الطلب:</b>
            </label>
            <div class="status-radio-group">
              <label class="status-radio-card" class:selected={assignModal.targetStatus === 'confirmed'}>
                <input type="radio" bind:group={assignModal.targetStatus} value="confirmed" />
                <span>مؤكد (بانتظار البدء)</span>
              </label>
              <label class="status-radio-card" class:selected={assignModal.targetStatus === 'preparing'}>
                <input type="radio" bind:group={assignModal.targetStatus} value="preparing" />
                <span>جاري التنسيق (عند المنسقة) </span>
              </label>
              <label class="status-radio-card" class:selected={assignModal.targetStatus === 'out_for_delivery'}>
                <input type="radio" bind:group={assignModal.targetStatus} value="out_for_delivery" />
                <span>في الطريق (مع السائق) </span>
              </label>
              <label class="status-radio-card" class:selected={assignModal.targetStatus === 'delivered'}>
                <input type="radio" bind:group={assignModal.targetStatus} value="delivered" />
                <span>تم التسليم بنجاح </span>
              </label>
            </div>
          </div>
        </div>

        <!-- أزرار الحفظ والإغلاق -->
        <div class="modal-actions-styled">
          <button 
            type="button" 
            class="btn btn-primary btn-save-assign" 
            disabled={assignModal.saving}
            on:click={handleSaveAssignment}
          >
            {assignModal.saving ? 'جاري توجيه الطلب...' : 'تأكيد التوجيه والإسناد '}
          </button>
          <button type="button" class="btn btn-outline" on:click={closeAssignModal}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- مودال إضافة / تعديل صنف ورد مع صور الزوايا المتعددة -->
  {#if flowerModal.open}
    <div class="modal-backdrop fade-in" on:click|self={() => flowerModal.open = false}>
      <div class="modal-card flower-modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge"></span>
            <div>
              <h3>{flowerModal.isEdit ? 'تعديل صنف الورد وصور زواياه' : 'إضافة صنف ورد جديد مع صوره من كل الزوايا'}</h3>
              <p class="modal-subtitle">إدخال الزهرة مع توثيق شكلها من الزاوية الأمامية والجانبية والعلوية وتفاصيل الساق</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={() => flowerModal.open = false}>✕</button>
        </div>

        {#if flowerModal.errorMsg}
          <div class="alert-error">{flowerModal.errorMsg}</div>
        {/if}
        {#if flowerModal.successMsg}
          <div class="alert-success">{flowerModal.successMsg}</div>
        {/if}

        <div class="modal-body-scroll">
          <!-- نماذج سريعة للورود -->
          <div class="presets-box">
            <label class="presets-label"> نماذج جاهزة من ورود الأتيليه (انقر لتعبئة الزوايا والصور تلقائياً):</label>
            <div class="presets-chips-row">
              {#each flowerPresets as p}
                <button type="button" class="preset-chip" on:click={() => applyFlowerPreset(p)}>
                  {p.name} ({p.color})
                </button>
              {/each}
            </div>
          </div>

          <!-- تفاصيل الزهرة الأساسية -->
          <div class="flower-fields-grid">
            <div class="form-group">
              <label>اسم صنف الزهرة بالعربي: *</label>
              <input type="text" class="input-field" placeholder="مثال: جوري هولندي فاخر" bind:value={flowerModal.name_ar} />
            </div>

            <div class="form-group">
              <label>لون الزهرة الرئيسي: *</label>
              <input type="text" class="input-field" placeholder="مثال: وردي باستيل، أحمر قرمزي" bind:value={flowerModal.color} />
            </div>

            <div class="form-group">
              <label>سعر الساق الفردي (د.ل): *</label>
              <input type="number" step="0.5" class="input-field" bind:value={flowerModal.unit_price} />
            </div>

            <div class="form-group">
              <label>الرصيد الافتتاحي في المخزون (عدد السيقان):</label>
              <input type="number" class="input-field" bind:value={flowerModal.stock_quantity} />
            </div>

            <div class="form-group">
              <label>حد التنبيه لانخفاض المخزون:</label>
              <input type="number" class="input-field" bind:value={flowerModal.alert_threshold} />
            </div>

            <div class="form-group full-width">
              <label>وصف الزهرة ونضارتها وموسمها:</label>
              <input type="text" class="input-field" placeholder="مثال: مستورد طازج، بتلات مخملية تدوم حتى 10 أيام..." bind:value={flowerModal.description} />
            </div>
          </div>

          <!-- قسم صور الزوايا المتعددة ورفع الصور -->
          <div class="angles-config-section">
            <div class="angles-header-flex">
              <div>
                <h4 class="angles-section-title"> صور الزهرة من كافة الزوايا الأربعة (Front / Side / Top / Stem)</h4>
                <p class="angles-section-desc">يمكنك رفع صور حقيقية من جهازك أو التقاطها بالكاميرا لكل زاوية، أو اختيار توليفة جاهزة أدناه</p>
              </div>

              <!-- زر الرفع الجماعي للأربع زوايا معاً -->
              <div class="bulk-upload-wrapper">
                <label class="btn-bulk-upload">
                  <span> رفع الـ 4 زوايا دفعة واحدة</span>
                  <input type="file" accept="image/*" multiple on:change={handleBulkAngleUpload} hidden />
                </label>
              </div>
            </div>

            <!-- محاكي معاينة الزاوية الحية مع شريط أدوات سريع -->
            <div class="angle-preview-container">
              <div class="angle-nav-tabs">
                <button 
                  type="button" 
                  class="angle-tab" 
                  class:active={flowerModal.activeAnglePreview === 'front'} 
                  on:click={() => flowerModal.activeAnglePreview = 'front'}
                >
                   1. أمامية
                </button>
                <button 
                  type="button" 
                  class="angle-tab" 
                  class:active={flowerModal.activeAnglePreview === 'side'} 
                  on:click={() => flowerModal.activeAnglePreview = 'side'}
                >
                   2. جانبية
                </button>
                <button 
                  type="button" 
                  class="angle-tab" 
                  class:active={flowerModal.activeAnglePreview === 'top'} 
                  on:click={() => flowerModal.activeAnglePreview = 'top'}
                >
                  3. علوية (ماكرو)
                </button>
                <button 
                  type="button" 
                  class="angle-tab" 
                  class:active={flowerModal.activeAnglePreview === 'stem'} 
                  on:click={() => flowerModal.activeAnglePreview = 'stem'}
                >
                  4. الساق
                </button>
              </div>

              <div class="angle-live-display">
                <div class="preview-stage">
                  {#if flowerModal.uploadingAngle === flowerModal.activeAnglePreview || flowerModal.uploadingAngle === 'bulk'}
                    <div class="upload-spinner-box">
                      <div class="spinner-mini"></div>
                      <span>جاري معالجة ورفع الصورة...</span>
                    </div>
                  {:else}
                    <img 
                      src={flowerModal['image_' + flowerModal.activeAnglePreview] || '/assets/flowers/pink-rose-front.svg'} 
                      alt="معاينة الزاوية" 
                      class="preview-img" 
                    />
                  {/if}
                  
                  <span class="preview-tag">{getAngleLabel(flowerModal.activeAnglePreview)}</span>

                  <!-- أزرار العمليات السريعة فوق المعاينة المباشرة -->
                  <div class="stage-actions-bar">
                    <label class="btn-stage-action" title="تحميل صورة من جهازك">
                      رفع من الجهاز
                      <input 
                        type="file" 
                        accept="image/*" 
                        on:change={(e) => handleAngleFileUpload(e, flowerModal.activeAnglePreview)} 
                        hidden 
                      />
                    </label>

                    <label class="btn-stage-action" title="التقاط صورة بالكاميرا">
                       كاميرا
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        on:change={(e) => handleAngleFileUpload(e, flowerModal.activeAnglePreview)} 
                        hidden 
                      />
                    </label>

                    {#if flowerModal['image_' + flowerModal.activeAnglePreview]}
                      <button 
                        type="button" 
                        class="btn-stage-action btn-stage-dl" 
                        title="تنزيل وحفظ هذه الصورة"
                        on:click={() => downloadImageFile(flowerModal['image_' + flowerModal.activeAnglePreview], `${flowerModal.name_ar || 'flower'}_${flowerModal.activeAnglePreview}.png`)}
                      >
                        ⬇ تنزيل
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            </div>

            <!-- بطاقات رفع وإدخال صور الزوايا الأربعة بالتفصيل -->
            <div class="angle-inputs-grid">
              <!-- 1. الزاوية الأمامية -->
              <div class="angle-input-card" class:active-card={flowerModal.activeAnglePreview === 'front'}>
                <div class="card-angle-top">
                  <div class="card-angle-title">
                    <span class="angle-badge-num">1</span>
                    <b>الزاوية الأمامية (Front)</b>
                  </div>
                  {#if flowerModal.image_front && (flowerModal.image_front.startsWith('data:') || flowerModal.image_front.includes('/uploads/'))}
                    <span class="badge-uploaded">✓ صورة مرفوعة</span>
                  {/if}
                </div>
                
                <div class="card-angle-body">
                  <img src={flowerModal.image_front || '/assets/flowers/pink-rose-front.svg'} alt="أمامي" class="angle-card-thumb" />
                  <div class="card-angle-controls">
                    <div class="angle-btn-row">
                      <label class="btn-angle-upload" title="تحميل صورة من الملفات">
                        اختر صورة
                        <input type="file" accept="image/*" on:change={(e) => handleAngleFileUpload(e, 'front')} hidden />
                      </label>
                      <label class="btn-angle-cam" title="التقاط بالكاميرا">
                        
                        <input type="file" accept="image/*" capture="environment" on:change={(e) => handleAngleFileUpload(e, 'front')} hidden />
                      </label>
                      {#if flowerModal.image_front}
                        <button type="button" class="btn-angle-dl" title="تنزيل الصورة" on:click={() => downloadImageFile(flowerModal.image_front, `${flowerModal.name_ar || 'flower'}_front.png`)}>
                          ⬇
                        </button>
                      {/if}
                    </div>
                    <input type="text" class="input-field input-field-sm" bind:value={flowerModal.image_front} placeholder="رابط أو مسار الصورة" />
                  </div>
                </div>
              </div>

              <!-- 2. الزاوية الجانبية -->
              <div class="angle-input-card" class:active-card={flowerModal.activeAnglePreview === 'side'}>
                <div class="card-angle-top">
                  <div class="card-angle-title">
                    <span class="angle-badge-num">2</span>
                    <b>الزاوية الجانبية (Side)</b>
                  </div>
                  {#if flowerModal.image_side && (flowerModal.image_side.startsWith('data:') || flowerModal.image_side.includes('/uploads/'))}
                    <span class="badge-uploaded">✓ صورة مرفوعة</span>
                  {/if}
                </div>
                
                <div class="card-angle-body">
                  <img src={flowerModal.image_side || '/assets/flowers/pink-rose-side.svg'} alt="جانبي" class="angle-card-thumb" />
                  <div class="card-angle-controls">
                    <div class="angle-btn-row">
                      <label class="btn-angle-upload" title="تحميل صورة من الملفات">
                        اختر صورة
                        <input type="file" accept="image/*" on:change={(e) => handleAngleFileUpload(e, 'side')} hidden />
                      </label>
                      <label class="btn-angle-cam" title="التقاط بالكاميرا">
                        
                        <input type="file" accept="image/*" capture="environment" on:change={(e) => handleAngleFileUpload(e, 'side')} hidden />
                      </label>
                      {#if flowerModal.image_side}
                        <button type="button" class="btn-angle-dl" title="تنزيل الصورة" on:click={() => downloadImageFile(flowerModal.image_side, `${flowerModal.name_ar || 'flower'}_side.png`)}>
                          ⬇
                        </button>
                      {/if}
                    </div>
                    <input type="text" class="input-field input-field-sm" bind:value={flowerModal.image_side} placeholder="رابط أو مسار الصورة" />
                  </div>
                </div>
              </div>

              <!-- 3. الزاوية العلوية -->
              <div class="angle-input-card" class:active-card={flowerModal.activeAnglePreview === 'top'}>
                <div class="card-angle-top">
                  <div class="card-angle-title">
                    <span class="angle-badge-num">3</span>
                    <b>الزاوية العلوية (Top Macro)</b>
                  </div>
                  {#if flowerModal.image_top && (flowerModal.image_top.startsWith('data:') || flowerModal.image_top.includes('/uploads/'))}
                    <span class="badge-uploaded">✓ صورة مرفوعة</span>
                  {/if}
                </div>
                
                <div class="card-angle-body">
                  <img src={flowerModal.image_top || '/assets/flowers/pink-rose-top.svg'} alt="علوي" class="angle-card-thumb" />
                  <div class="card-angle-controls">
                    <div class="angle-btn-row">
                      <label class="btn-angle-upload" title="تحميل صورة من الملفات">
                        اختر صورة
                        <input type="file" accept="image/*" on:change={(e) => handleAngleFileUpload(e, 'top')} hidden />
                      </label>
                      <label class="btn-angle-cam" title="التقاط بالكاميرا">
                        
                        <input type="file" accept="image/*" capture="environment" on:change={(e) => handleAngleFileUpload(e, 'top')} hidden />
                      </label>
                      {#if flowerModal.image_top}
                        <button type="button" class="btn-angle-dl" title="تنزيل الصورة" on:click={() => downloadImageFile(flowerModal.image_top, `${flowerModal.name_ar || 'flower'}_top.png`)}>
                          ⬇
                        </button>
                      {/if}
                    </div>
                    <input type="text" class="input-field input-field-sm" bind:value={flowerModal.image_top} placeholder="رابط أو مسار الصورة" />
                  </div>
                </div>
              </div>

              <!-- 4. تفاصيل الساق -->
              <div class="angle-input-card" class:active-card={flowerModal.activeAnglePreview === 'stem'}>
                <div class="card-angle-top">
                  <div class="card-angle-title">
                    <span class="angle-badge-num">4</span>
                    <b>تفاصيل الساق والأوراق (Stem)</b>
                  </div>
                  {#if flowerModal.image_stem && (flowerModal.image_stem.startsWith('data:') || flowerModal.image_stem.includes('/uploads/'))}
                    <span class="badge-uploaded">✓ صورة مرفوعة</span>
                  {/if}
                </div>
                
                <div class="card-angle-body">
                  <img src={flowerModal.image_stem || '/assets/flowers/pink-rose-stem.svg'} alt="ساق" class="angle-card-thumb" />
                  <div class="card-angle-controls">
                    <div class="angle-btn-row">
                      <label class="btn-angle-upload" title="تحميل صورة من الملفات">
                        اختر صورة
                        <input type="file" accept="image/*" on:change={(e) => handleAngleFileUpload(e, 'stem')} hidden />
                      </label>
                      <label class="btn-angle-cam" title="التقاط بالكاميرا">
                        
                        <input type="file" accept="image/*" capture="environment" on:change={(e) => handleAngleFileUpload(e, 'stem')} hidden />
                      </label>
                      {#if flowerModal.image_stem}
                        <button type="button" class="btn-angle-dl" title="تنزيل الصورة" on:click={() => downloadImageFile(flowerModal.image_stem, `${flowerModal.name_ar || 'flower'}_stem.png`)}>
                          ⬇
                        </button>
                      {/if}
                    </div>
                    <input type="text" class="input-field input-field-sm" bind:value={flowerModal.image_stem} placeholder="رابط أو مسار الصورة" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions-styled">
          <button type="button" class="btn btn-primary" disabled={flowerModal.saving} on:click={handleSaveFlower}>
            {flowerModal.saving ? 'جاري الحفظ...' : (flowerModal.isEdit ? 'حفظ التعديلات ' : 'إضافة الوردة واعتماد الزوايا ')}
          </button>
          <button type="button" class="btn btn-outline" on:click={() => flowerModal.open = false}>إلغاء</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- مودال إضافة / تعديل باقة مع توليفة الورود الدقيقة -->
  {#if bouquetModal.open}
    <div class="modal-backdrop fade-in" on:click|self={() => bouquetModal.open = false}>
      <div class="modal-card bouquet-modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge"></span>
            <div>
              <h3>{bouquetModal.isEdit ? 'تعديل الباقة وتركيبة الورود' : 'إضافة باقة جديدة بتوليفة ورود محددة'}</h3>
              <p class="modal-subtitle">حدد عدد الورود من كل نوع حصراً من قائمة الورود المسجلة بالمخزون</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={() => bouquetModal.open = false}>✕</button>
        </div>

        {#if bouquetModal.errorMsg}
          <div class="alert-error">{bouquetModal.errorMsg}</div>
        {/if}
        {#if bouquetModal.successMsg}
          <div class="alert-success">{bouquetModal.successMsg}</div>
        {/if}

        <div class="modal-body-scroll">
          <!-- البيانات العامة للباقة -->
          <div class="flower-fields-grid">
            <div class="form-group">
              <label>عنوان / اسم الباقة: *</label>
              <input type="text" class="input-field" placeholder="مثال: ربيع وردي فاخر" bind:value={bouquetModal.title} />
            </div>

            <div class="form-group">
              <label>المناسبة الموصى بها: *</label>
              <select class="input-field styled-select" bind:value={bouquetModal.occasion_tag}>
                <option value="عيد ميلاد">عيد ميلاد</option>
                <option value="زفاف">زفاف وخطوبة</option>
                <option value="تخرج">تخرج ونجاح</option>
                <option value="حب وغرام">حب ورومانسية</option>
                <option value="شكر">شكر وامتنان</option>
                <option value="اعتذار">اعتذار ومودة</option>
                <option value="عام"> مناسبات عامة</option>
              </select>
            </div>

            <div class="form-group">
              <label>سعر بيع الباقة للزبون (د.ل): *</label>
              <input type="number" step="1" class="input-field" bind:value={bouquetModal.price} />
            </div>

            <div class="form-group full-width bouquet-image-selector-wrap">
              <label>صورة الغلاف الرسمية للباقة: *</label>
              <div class="bouquet-img-upload-card">
                <div class="bouquet-img-preview-box">
                  <img src={bouquetModal.image_svg_path || '/assets/bouquet-pink-spring.svg'} alt="صورة الباقة" class="bouquet-modal-preview-img" />
                  {#if uploadingBouquetImage}
                    <div class="bouquet-upload-overlay">
                      <div class="spinner-mini"></div>
                      <span>جاري الرفع والمعالجة...</span>
                    </div>
                  {/if}
                  {#if bouquetModal.image_svg_path && (bouquetModal.image_svg_path.includes('/uploads/') || bouquetModal.image_svg_path.startsWith('data:'))}
                    <span class="badge-uploaded-tag">✓ صورة خاصة تم رفعها من جهازك</span>
                  {:else}
                    <span class="badge-preset-tag">نموذج فني معتمد</span>
                  {/if}
                </div>

                <div class="bouquet-img-controls">
                  <div class="bouquet-upload-btns-row">
                    <label class="btn btn-primary btn-sm btn-upload-device">
                       رفع صورة من جهازك (كمبيوتر / هاتف)
                      <input type="file" accept="image/*" on:change={handleBouquetImageUpload} hidden />
                    </label>

                    <label class="btn btn-outline btn-sm btn-cam-device">
                       التقاط بالكاميرا
                      <input type="file" accept="image/*" capture="environment" on:change={handleBouquetImageUpload} hidden />
                    </label>
                  </div>

                  <div class="preset-fallback-row">
                    <span class="fallback-label">أو اختر نموذجاً جاهزاً من الأتيليه:</span>
                    <select class="input-field styled-select select-sm" bind:value={bouquetModal.image_svg_path}>
                      {#each bouquetImagePresets as bip}
                        <option value={bip.path}>{bip.name}</option>
                      {/each}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-group full-width">
              <label>وصف وتنسيق الباقة:</label>
              <input type="text" class="input-field" placeholder="مثال: توليفة ربيعية مبهجة ملفوفة بورق كرافت ملكي وختم شمعي..." bind:value={bouquetModal.description} />
            </div>
          </div>

          <!-- قسم منشئ توليفة الورود الدقيقة (Flower Recipe Builder) -->
          <div class="recipe-builder-section">
            <div class="recipe-builder-header">
              <div>
                <h4 class="recipe-builder-title"> تركيبة وعدد الورود من قائمة الورود المسجلة</h4>
                <p class="recipe-builder-desc">حدد كم وردة من كل نوع تدخل في تكوين هذه الباقة (لا يمكن إدخال وردة خارج القائمة)</p>
              </div>
              <button type="button" class="btn btn-outline btn-sm" on:click={openAddFlowerModal}>
                 الوردة غير موجودة؟ أضفها أولاً للمخزون
              </button>
            </div>

            <!-- تنبيه قيود الورد المعتمد -->
            <div class="strict-rule-banner">
              
              <p>
                <strong>قاعدة النظام المعتمدة:</strong> لا يمكن إدراج أي وردة في الباقة إلا إذا كانت مسجلة مسبقاً في قائمة مخزون الورود بزواياها. إذا لم تجد الصنف المطلوب في القائمة أدناه، اضغط على زر الإضافة أعلاه لإدراجها أولاً.
              </p>
            </div>

            <!-- قائمة أسطر توليفة الورود -->
            <div class="recipe-rows-list">
              {#each bouquetModal.flowers as row, idx}
                {@const matchedFlower = inventory.find(f => f.id === Number(row.flower_id))}
                <div class="recipe-row-item">
                  <div class="row-num-badge">#{idx + 1}</div>

                  <!-- القائمة المنسدلة للزهور المعتمدة حصراً -->
                  <div class="row-flower-select">
                    <label class="row-sublabel">صنف الوردة (من القائمة المعتمدة):</label>
                    <select class="input-field styled-select" bind:value={row.flower_id}>
                      {#each inventory as f}
                        <option value={f.id}>
                           {f.name_ar} ({f.color}) — سعر الساق: {f.unit_price} د.ل (المتوفر: {f.stock_quantity})
                        </option>
                      {/each}
                    </select>
                  </div>

                  <!-- حقل عدد الورود / السيقان -->
                  <div class="row-qty-box">
                    <label class="row-sublabel">عدد الورود (السيقان):</label>
                    <div class="qty-stepper">
                      <button 
                        type="button" 
                        class="stepper-btn" 
                        on:click={() => row.quantity_stems = Math.max(1, (Number(row.quantity_stems) || 1) - 1)}
                      >-</button>
                      <input type="number" min="1" class="stepper-input" bind:value={row.quantity_stems} />
                      <button 
                        type="button" 
                        class="stepper-btn" 
                        on:click={() => row.quantity_stems = (Number(row.quantity_stems) || 1) + 1}
                      >+</button>
                    </div>
                  </div>

                  <!-- التكلفة الفرعية للصنف -->
                  <div class="row-subtotal-box">
                    <label class="row-sublabel">التكلفة الفرعية:</label>
                    <b class="subtotal-val">{((Number(row.quantity_stems) || 0) * (matchedFlower ? Number(matchedFlower.unit_price) : 0)).toFixed(1)} د.ل</b>
                  </div>

                  <!-- زر حذف السطر -->
                  <div class="row-remove-box">
                    <button type="button" class="btn-remove-row" title="إزالة هذا الصنف من الباقة" on:click={() => removeBouquetFlowerRow(idx)}>
                      ️
                    </button>
                  </div>
                </div>
              {/each}
            </div>

            <div class="add-recipe-row-btn-box">
              <button type="button" class="btn btn-outline btn-sm" on:click={addBouquetFlowerRow}>
                 إضافة صنف ورد آخر للباقة
              </button>
            </div>

            <!-- شريط ملخص تركيبة الباقة -->
            <div class="recipe-summary-bar">
              <div class="summary-metric">
                <span class="metric-title"> إجمالي عدد الورود بالباقة:</span>
                <b class="metric-val highlight">{bouquetTotalStems} زهرة</b>
              </div>
              <div class="summary-metric">
                <span class="metric-title"> تكلفة الورود الأصلية من المخزون:</span>
                <b class="metric-val">{bouquetEstimatedCost.toFixed(1)} د.ل</b>
              </div>
              <div class="summary-metric">
                <span class="metric-title">️ سعر بيع الباقة المقترح:</span>
                <b class="metric-val price">{bouquetModal.price} د.ل</b>
              </div>
              <div class="summary-metric">
                <span class="metric-title">هامش الربح التقديري:</span>
                <b class="metric-val profit">{(Number(bouquetModal.price) - bouquetEstimatedCost).toFixed(1)} د.ل</b>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions-styled">
          <button type="button" class="btn btn-primary" disabled={bouquetModal.saving} on:click={handleSaveBouquet}>
            {bouquetModal.saving ? 'جاري الحفظ...' : (bouquetModal.isEdit ? 'تحديث الباقة والتركيبة ' : 'اعتماد وإنشاء الباقة ')}
          </button>
          <button type="button" class="btn btn-outline" on:click={() => bouquetModal.open = false}>إلغاء</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- مستعرض زوايا الوردة التفاعلي 360° -->
  {#if flowerAnglesViewer.open && flowerAnglesViewer.flower}
    <div class="modal-backdrop fade-in" on:click|self={() => flowerAnglesViewer.open = false}>
      <div class="modal-card viewer-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge"></span>
            <div>
              <h3>استعراض زوايا {flowerAnglesViewer.flower.name_ar}</h3>
              <p class="modal-subtitle">عرض بصري شامل للأصناف المعتمدة بجميع الزوايا الأربعة</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={() => flowerAnglesViewer.open = false}>✕</button>
        </div>

        <!-- أزرار التبديل بين الزوايا -->
        <div class="viewer-tabs-row">
          <button 
            type="button" 
            class="viewer-angle-btn" 
            class:active={flowerAnglesViewer.activeAngle === 'front'}
            on:click={() => flowerAnglesViewer.activeAngle = 'front'}
          >
             زاوية أمامية
          </button>
          <button 
            type="button" 
            class="viewer-angle-btn" 
            class:active={flowerAnglesViewer.activeAngle === 'side'}
            on:click={() => flowerAnglesViewer.activeAngle = 'side'}
          >
             زاوية جانبية
          </button>
          <button 
            type="button" 
            class="viewer-angle-btn" 
            class:active={flowerAnglesViewer.activeAngle === 'top'}
            on:click={() => flowerAnglesViewer.activeAngle = 'top'}
          >
             زاوية علوية (ماكرو)
          </button>
          <button 
            type="button" 
            class="viewer-angle-btn" 
            class:active={flowerAnglesViewer.activeAngle === 'stem'}
            on:click={() => flowerAnglesViewer.activeAngle = 'stem'}
          >
             تفاصيل الساق
          </button>
        </div>

        <div class="viewer-img-container">
          {#if flowerAnglesViewer.activeAngle === 'front'}
            <img src={flowerAnglesViewer.flower.image_front || flowerAnglesViewer.flower.image_url || '/assets/flowers/pink-rose-front.svg'} alt="أمامي" class="viewer-main-img" />
            <span class="viewer-angle-badge">الزاوية الأمامية الرسمية (Front Angle)</span>
          {:else if flowerAnglesViewer.activeAngle === 'side'}
            <img src={flowerAnglesViewer.flower.image_side || '/assets/flowers/pink-rose-side.svg'} alt="جانبي" class="viewer-main-img" />
            <span class="viewer-angle-badge">الزاوية الجانبية الانسيابية (Side Profile)</span>
          {:else if flowerAnglesViewer.activeAngle === 'top'}
            <img src={flowerAnglesViewer.flower.image_top || '/assets/flowers/pink-rose-top.svg'} alt="علوي" class="viewer-main-img" />
            <span class="viewer-angle-badge">الزاوية العلوية وماكرو البتلات (Petals Macro)</span>
          {:else if flowerAnglesViewer.activeAngle === 'stem'}
            <img src={flowerAnglesViewer.flower.image_stem || '/assets/flowers/pink-rose-stem.svg'} alt="ساق" class="viewer-main-img" />
            <span class="viewer-angle-badge">تفاصيل الساق والأوراق الخضراء (Stem & Foliage)</span>
          {/if}
        </div>

        {#if quickFlowerAngleMsg}
          <div class="alert-success" style="margin: 10px 16px;">{quickFlowerAngleMsg}</div>
        {/if}

        <!-- شريط رفع واستبدال الصورة مباشرة من الجهاز -->
        <div class="viewer-upload-toolbar">
          <label class="btn btn-primary btn-sm btn-upload-angle" title="رفع صورة جديدة لهذه الزاوية من جهازك">
            {#if quickFlowerAngleUploading}
              <span>جاري الرفع والتحديث...</span>
            {:else}
              <span> رفع وتعيين صورة من جهازك ({getAngleLabel(flowerAnglesViewer.activeAngle)})</span>
            {/if}
            <input 
              type="file" 
              accept="image/*" 
              on:change={(e) => handleQuickFlowerAngleUpload(e, flowerAnglesViewer.flower, flowerAnglesViewer.activeAngle)} 
              hidden 
            />
          </label>

          <label class="btn btn-outline btn-sm btn-cam-angle" title="التقاط صورة بالكاميرا لهذه الزاوية">
            <span> التقاط بالكاميرا</span>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              on:change={(e) => handleQuickFlowerAngleUpload(e, flowerAnglesViewer.flower, flowerAnglesViewer.activeAngle)} 
              hidden 
            />
          </label>
        </div>

        <!-- شريط تحميل وتنزيل صور الزوايا للجهاز -->
        <div class="viewer-download-toolbar">
          <button 
            type="button" 
            class="btn btn-outline btn-sm" 
            title="تنزيل هذه الصورة لجهازك"
            on:click={() => downloadImageFile(getCurrentViewerUrl(), `${flowerAnglesViewer.flower.name_ar}_${flowerAnglesViewer.activeAngle}.png`)}
          >
            ⬇ تنزيل هذه الزاوية ({getAngleLabel(flowerAnglesViewer.activeAngle)})
          </button>
          
          <button 
            type="button" 
            class="btn btn-secondary btn-sm" 
            title="تنزيل جميع صور الزوايا الأربعة معاً"
            on:click={() => downloadAllFlowerAngles(flowerAnglesViewer.flower)}
          >
             تنزيل جميع الزوايا الـ 4 معاً
          </button>
        </div>

        <div class="viewer-footer-info">
          <div>
            <b>اللون:</b> <span class="swatch-mini" style="background: {flowerAnglesViewer.flower.color}"></span> {flowerAnglesViewer.flower.color}
          </div>
          <div>
            <b>سعر الساق:</b> <b>{flowerAnglesViewer.flower.unit_price} د.ل</b>
          </div>
          <div>
            <b>الرصيد المتاح:</b> <b>{flowerAnglesViewer.flower.stock_quantity} ساق</b>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- مودال استلام وتسوية العهدة النقدية من الكابتن -->
  {#if settleModal.open && settleModal.driver}
    <div class="modal-backdrop fade-in" on:click|self={() => settleModal.open = false}>
      <div class="modal-card settle-modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            
            <div>
              <h3>استلام وتوريد العهدة النقدية</h3>
              <p class="modal-subtitle">توريد النقدية المحصلة من الكابتن: {settleModal.driver.full_name} وتصفية مستحقاته</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={() => settleModal.open = false}>✕</button>
        </div>

        {#if settleModal.errorMsg}
          <div class="alert-error">{settleModal.errorMsg}</div>
        {/if}
        {#if settleModal.successMsg}
          <div class="alert-success">{settleModal.successMsg}</div>
        {/if}

        <div class="modal-body-scroll">
          <!-- ملخص الموقف المالي الحالي للكابتن -->
          <div class="settle-summary-cards">
            <div class="settle-sum-box box-custody">
              <span class="sum-box-label">العهدة النقدية الحالية بحوزته:</span>
              <strong class="sum-box-val">{Number(settleModal.driver.current_custody_amount || 0).toLocaleString()} د.ل</strong>
              <small>كاش الطلبات المسلمة</small>
            </div>

            <div class="settle-sum-box box-earnings">
              <span class="sum-box-label">أرباح التوصيل المستحقة له:</span>
              <strong class="sum-box-val">{Number(settleModal.driver.pending_earnings || 0).toLocaleString()} د.ل</strong>
              <small>أجور التوصيل غير المصفاة</small>
            </div>

            <div class="settle-sum-box box-net">
              <span class="sum-box-label">صافي المبلغ لتسليمه للإدارة:</span>
              <strong class="sum-box-val">{Math.max(0, Number(settleModal.driver.current_custody_amount || 0) - Number(settleModal.driver.pending_earnings || 0)).toLocaleString()} د.ل</strong>
              <small>(العهدة - الأرباح)</small>
            </div>
          </div>

          <!-- تفاصيل التسوية الفعلية -->
          <div class="settle-form-fields">
            <div class="form-group">
              <label>قيمة العهدة النقدية المراد تصفيتها (د.ل): *</label>
              <input 
                type="number" 
                step="0.5" 
                class="input-field" 
                bind:value={settleModal.custodyCleared} 
                on:input={() => {
                  settleModal.netCashReceived = Math.max(0, (Number(settleModal.custodyCleared) || 0) - (Number(settleModal.driverEarningsDeducted) || 0));
                }}
              />
              <span class="field-hint">المبلغ الذي سيتم خصمه من عهدة السائق الحالية</span>
            </div>

            <div class="form-group">
              <label>أرباح التوصيل المخصومة / المستوفاة للكابتن (د.ل): *</label>
              <input 
                type="number" 
                step="0.5" 
                class="input-field" 
                bind:value={settleModal.driverEarningsDeducted} 
                on:input={() => {
                  settleModal.netCashReceived = Math.max(0, (Number(settleModal.custodyCleared) || 0) - (Number(settleModal.driverEarningsDeducted) || 0));
                }}
              />
              <span class="field-hint">سيتم تسوية هذا المبلغ واحتسابه مستلماً من قِبل الكابتن</span>
            </div>

            <div class="form-group full-width">
              <label>صافي المبلغ النقدي المستلم فعلياً والمودع بالخزينة (د.ل): *</label>
              <input 
                type="number" 
                step="0.5" 
                class="input-field net-cash-input" 
                bind:value={settleModal.netCashReceived} 
              />
              <span class="field-hint">المبلغ المالي الذي يستلمه أمين الصندوق / المدير نقداً</span>
            </div>

            <div class="form-group full-width">
              <label>ملاحظات وسند التوريد:</label>
              <textarea 
                class="input-field" 
                rows="2" 
                bind:value={settleModal.notes} 
                placeholder="أدخل أي ملاحظات إضافية حول التوريد أو الفروقات..."
              ></textarea>
            </div>
          </div>
        </div>

        <div class="modal-actions-styled">
          <button 
            type="button" 
            class="btn btn-primary" 
            disabled={settleModal.saving} 
            on:click={handleConfirmSettlement}
          >
            {settleModal.saving ? 'جاري توثيق التسوية...' : 'تأكيد استلام المبلغ وتصفية العهدة '}
          </button>
          <button type="button" class="btn btn-outline" on:click={() => settleModal.open = false}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- مودال كشف الحساب والحركات المالية للكابتن -->
  {#if driverStatementModal.open}
    <div class="modal-backdrop fade-in" on:click|self={() => driverStatementModal.open = false}>
      <div class="modal-card statement-modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge"></span>
            <div>
              <h3>كشف الحساب والعهدة المالية للكابتن</h3>
              <p class="modal-subtitle">
                {driverStatementModal.data?.profile?.full_name 
                  ? `تفاصيل الحركات والمستحقات للكابتن: ${driverStatementModal.data.profile.full_name} (${driverStatementModal.data.profile.phone || ''})` 
                  : 'جاري تحميل كشف الحساب...'}
              </p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={() => driverStatementModal.open = false}>✕</button>
        </div>

        <div class="modal-body-scroll">
          {#if driverStatementModal.loading}
            <div class="loading-state">
              <div class="spinner"></div>
              <p>جاري تحميل سجل الحركات المالية للكابتن...</p>
            </div>
          {:else if driverStatementModal.data}
            <!-- بطاقة الموقف المالي -->
            <div class="statement-profile-banner">
              <div class="stmt-col stmt-today-box">
                <span class="stmt-lbl">أرباح اليوم :</span>
                <strong class="stmt-val text-amber">+{Number(driverStatementModal.data.today?.earnings || driverStatementModal.data.profile.today_earnings || 0).toLocaleString()} د.ل</strong>
              </div>
              <div class="stmt-col">
                <span class="stmt-lbl">العهدة الحالية (كاش في حوزته):</span>
                <strong class="stmt-val text-custody">{Number(driverStatementModal.data.profile.current_custody_amount || 0).toLocaleString()} د.ل</strong>
              </div>
              <div class="stmt-col">
                <span class="stmt-lbl">أرباح التوصيل المستحقة:</span>
                <strong class="stmt-val text-profit">{Number(driverStatementModal.data.profile.pending_earnings || 0).toLocaleString()} د.ل</strong>
              </div>
              <div class="stmt-col">
                <span class="stmt-lbl">صافي المستحق للإدارة:</span>
                <strong class="stmt-val text-net">{Number(driverStatementModal.data.profile.net_due || 0).toLocaleString()} د.ل</strong>
              </div>
              <div class="stmt-col">
                <span class="stmt-lbl">إجمالي ما ورّده سابقاً:</span>
                <strong class="stmt-val">{Number(driverStatementModal.data.profile.settled_amount_total || 0).toLocaleString()} د.ل</strong>
              </div>
              <div class="stmt-col">
                <span class="stmt-lbl">الطلبات المسلمة:</span>
                <strong class="stmt-val">{driverStatementModal.data.profile.delivered_count || 0} طلب</strong>
              </div>
            </div>

            <!-- جدول الحركات المالية الأخيرة -->
            <h4 style="margin: 24px 0 12px; color: var(--olive); font-size: 1.05rem;">سجل حركات العهدة والأرباح الأخيرة:</h4>
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>التاريخ والوقت</th>
                    <th>نوع الحركة</th>
                    <th>البيان والتفاصيل</th>
                    <th>مبلغ الحركة</th>
                    <th>ربح السائق</th>
                    <th>رصيد العهدة بعدها</th>
                  </tr>
                </thead>
                <tbody>
                  {#each driverStatementModal.data.recent_transactions || [] as tx (tx.id)}
                    <tr>
                      <td>
                        <span style="font-size: 0.85rem; color: #666;">
                          {new Date(tx.created_at).toLocaleDateString('ar-LY')} {new Date(tx.created_at).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        {#if tx.type === 'order_collection'}
                          <span class="tx-badge tx-in">تحصيل كاش طلب</span>
                        {:else if tx.type === 'delivery_earning'}
                          <span class="tx-badge tx-in"> ربح توصيل</span>
                        {:else if tx.type === 'admin_settlement'}
                          <span class="tx-badge tx-out">توريد وتسوية للإدارة</span>
                        {:else}
                          <span class="tx-badge tx-other">{tx.type}</span>
                        {/if}
                      </td>
                      <td>
                        <strong>{tx.description}</strong>
                        {#if tx.order_id}
                          <small style="display:block; color:#888;">طلب رقم: #{tx.order_id}</small>
                        {/if}
                      </td>
                      <td>
                        {#if tx.type === 'order_collection'}
                          <strong style="color: #b45309;">+{Number(tx.amount || 0).toLocaleString()} د.ل</strong>
                        {:else if tx.type === 'admin_settlement'}
                          <strong style="color: #15803d;">{Number(tx.amount || 0).toLocaleString()} د.ل</strong>
                        {:else}
                          <strong>{Number(tx.amount || 0).toLocaleString()} د.ل</strong>
                        {/if}
                      </td>
                      <td>
                        {#if Number(tx.driver_profit) > 0}
                          <span style="color: #047857; font-weight: 700;">+{Number(tx.driver_profit).toLocaleString()} د.ل</span>
                        {:else}
                          <span style="color: #999;">-</span>
                        {/if}
                      </td>
                      <td>
                        <strong style="color: var(--olive);">{Number(tx.balance_after || 0).toLocaleString()} د.ل</strong>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td colspan="6" class="empty-table-cell">لا توجد حركات مسجلة لهذا الكابتن حتى الآن</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <!-- جدول التسويات السابقة -->
            {#if driverStatementModal.data.recent_settlements?.length > 0}
              <h4 style="margin: 28px 0 12px; color: var(--olive); font-size: 1.05rem;">إيصالات التوريد والتسوية السابقة للكابتن:</h4>
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>رقم الإيصال</th>
                      <th>تاريخ التوريد</th>
                      <th>العهدة المصفاة</th>
                      <th>أرباح التوصيل المستوفاة</th>
                      <th>المبلغ المودع بالخزينة</th>
                      <th>مسؤول الاستلام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each driverStatementModal.data.recent_settlements as s (s.id)}
                      <tr>
                        <td><span class="receipt-tag">#{s.settlement_number}</span></td>
                        <td>{new Date(s.created_at).toLocaleDateString('ar-LY')}</td>
                        <td>{Number(s.custody_cleared).toLocaleString()} د.ل</td>
                        <td>{Number(s.driver_earnings_deducted).toLocaleString()} د.ل</td>
                        <td><strong style="color: #047857;">{Number(s.net_cash_received).toLocaleString()} د.ل</strong></td>
                        <td>{s.admin_name || 'مدير النظام'}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {/if}
          {/if}
        </div>

        <div class="modal-actions-styled">
          {#if driverStatementModal.data?.profile && Number(driverStatementModal.data.profile.current_custody_amount) > 0}
            <button 
              type="button" 
              class="btn btn-primary"
              on:click={() => {
                const p = driverStatementModal.data.profile;
                driverStatementModal.open = false;
                openSettleModal(p);
              }}
            >
               توريد واستلام عهدة الكابتن الآن
            </button>
          {/if}
          <button type="button" class="btn btn-outline" on:click={() => driverStatementModal.open = false}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- مودال إضافة مستخدم أو عضو طاقم جديد -->
  {#if userModal.open}
    <div class="modal-backdrop fade-in" on:click|self={() => userModal.open = false}>
      <div class="modal-card user-modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge"></span>
            <div>
              <h3>إضافة مستخدم أو عضو طاقم جديد</h3>
              <p class="modal-subtitle">تسجيل حساب كابتن توصيل، منسق زهور، مدير، أو زبون</p>
            </div>
          </div>
          <button type="button" class="btn-close-modal" on:click={() => userModal.open = false}>✕</button>
        </div>

        {#if userModal.errorMsg}
          <div class="alert-error">{userModal.errorMsg}</div>
        {/if}
        {#if userModal.successMsg}
          <div class="alert-success">{userModal.successMsg}</div>
        {/if}

        <div class="modal-body-scroll">
          <!-- اختيار الدور / نوع الحساب -->
          <div class="role-selector-section">
            <label class="section-label"><b>اختر نوع الحساب / الدور: *</b></label>
            <div class="role-cards-grid">
              <label class="role-select-card" class:selected={userModal.role === 'driver'}>
                <input type="radio" bind:group={userModal.role} value="driver" />
                <span class="rc-icon"></span>
                <div class="rc-info">
                  <strong>كابتن توصيل</strong>
                  <small>استلام الطلبات، إدارة العهدة، والتتبع</small>
                </div>
              </label>

              <label class="role-select-card" class:selected={userModal.role === 'florist'}>
                <input type="radio" bind:group={userModal.role} value="florist" />
                <span class="rc-icon"></span>
                <div class="rc-info">
                  <strong>منسّق زهور</strong>
                  <small>استلام وتجهيز باقات الأتيليه</small>
                </div>
              </label>

              <label class="role-select-card" class:selected={userModal.role === 'admin'}>
                <input type="radio" bind:group={userModal.role} value="admin" />
                <span class="rc-icon"></span>
                <div class="rc-info">
                  <strong>مدير نظام</strong>
                  <small>إدارة كاملة للمتجر والأسعار والتقارير</small>
                </div>
              </label>

              <label class="role-select-card" class:selected={userModal.role === 'customer'}>
                <input type="radio" bind:group={userModal.role} value="customer" />
                <span class="rc-icon"></span>
                <div class="rc-info">
                  <strong>زبون متجر</strong>
                  <small>حساب عميل لطلب وتصميم الباقات</small>
                </div>
              </label>
            </div>
          </div>

          <!-- الحقول الأساسية -->
          <div class="user-fields-grid">
            <div class="form-group">
              <label>الاسم الكامل الكريم: *</label>
              <input 
                type="text" 
                class="input-field" 
                placeholder="مثال: طارق الزوي" 
                bind:value={userModal.fullName} 
              />
            </div>

            <div class="form-group">
              <label>رقم الهاتف الليبي: *</label>
              <input 
                type="tel" 
                class="input-field" 
                placeholder="مثال: 0912345678" 
                bind:value={userModal.phone} 
              />
            </div>

            <div class="form-group">
              <label>البريد الإلكتروني (اختياري):</label>
              <input 
                type="email" 
                class="input-field" 
                placeholder="staff@maska.ly" 
                bind:value={userModal.email} 
              />
            </div>

            <div class="form-group">
              <div class="label-with-action">
                <label>كلمة المرور الأولية: *</label>
                <button type="button" class="btn-text-sm" on:click={generateRandomPassword}> توليد تلقائي</button>
              </div>
              <input 
                type="text" 
                class="input-field" 
                placeholder="أدخل كلمة مرور قوية" 
                bind:value={userModal.password} 
              />
            </div>

            <!-- حقول إضافية لكابتن التوصيل -->
            {#if userModal.role === 'driver'}
              <div class="form-group">
                <label>نوع مركبة التوصيل:</label>
                <input 
                  type="text" 
                  class="input-field" 
                  placeholder="مثال: سيارة هيونداي تبريد / تويوتا" 
                  bind:value={userModal.vehicleType} 
                />
              </div>

              <div class="form-group">
                <label>رقم لوحة السيارة:</label>
                <input 
                  type="text" 
                  class="input-field" 
                  placeholder="مثال: طرابلس 5-14820" 
                  bind:value={userModal.plateNumber} 
                />
              </div>

              <div class="form-group full-width">
                <label>الرقم الوطني أو بطاقة الهوية (اختياري):</label>
                <input 
                  type="text" 
                  class="input-field" 
                  placeholder="الرقم الوطني للتوثيق الميداني" 
                  bind:value={userModal.nationalId} 
                />
              </div>
            {/if}

            {#if userModal.role === 'florist'}
              <div class="form-group full-width">
                <div class="florist-notice-box">
                   <b>ملاحظة منسق الورد:</b> سيتمكن المنسق من تسجيل الدخول إلى بوابته الخاصة واستلام باقات الزهور وتجهيز كروت الإهداء والختم الشمعي.
                </div>
              </div>
            {/if}
          </div>
        </div>

        <div class="modal-actions-styled">
          <button 
            type="button" 
            class="btn btn-primary" 
            disabled={userModal.saving} 
            on:click={handleSaveUser}
          >
            {userModal.saving ? 'جاري الحفظ...' : 'إضافة وتفعيل الحساب '}
          </button>
          <button type="button" class="btn btn-outline" on:click={() => userModal.open = false}>
            إلغاء
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-dashboard-page {
    padding: 30px 0 80px;
    background: var(--bg);
    min-height: 100vh;
  }

  .admin-shell-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 24px;
    width: 100%;
    box-sizing: border-box;
  }

  /* الهيكل العام: شريط جانبي + منطقة محتوى */
  .admin-dashboard-layout {
    display: flex;
    gap: 28px;
    align-items: flex-start;
  }

  /* =========================================================================
     الشريط الجانبي الفاخر للوحة التحكم (Admin Sidebar)
     ========================================================================= */
  .admin-sidebar {
    width: 290px;
    flex-shrink: 0;
    background: var(--card-solid);
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 22px 16px;
    position: sticky;
    top: 86px;
    max-height: calc(100vh - 104px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 4px 22px rgba(43, 43, 40, 0.04);
    z-index: 50;
    scrollbar-width: thin;
    scrollbar-color: #d8e5b6 transparent;
  }

  .admin-sidebar::-webkit-scrollbar {
    width: 5px;
  }
  .admin-sidebar::-webkit-scrollbar-thumb {
    background-color: #d8e5b6;
    border-radius: 999px;
  }

  /* ترويسة الشريط الجانبي */
  .sidebar-brand-box {
    padding-bottom: 14px;
    border-bottom: 1px solid var(--line);
  }
  .brand-top-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .sidebar-brand-badge {
    font-size: 0.72rem;
    font-weight: 800;
    background: #f1ebd8;
    color: var(--olive);
    padding: 3px 10px;
    border-radius: 999px;
    display: inline-block;
  }
  .btn-close-sidebar-mobile {
    display: none;
  }
  .sidebar-title {
    margin: 0 0 2px;
    font-size: 1.5rem;
    color: var(--olive);
    font-weight: 800;
    font-family: 'Playfair Display', serif;
  }
  .sidebar-subtitle {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted);
  }

  /* بطاقة المسؤول في الشريط الجانبي */
  .sidebar-admin-profile {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #faf6f0;
    border: 1px solid #ebd9c2;
    border-radius: 14px;
    padding: 10px 12px;
  }
  .admin-avatar-circle {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--olive);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1rem;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(94, 107, 44, 0.25);
  }
  .admin-profile-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
  }
  .admin-profile-name {
    font-size: 0.88rem;
    color: #2b2b28;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .admin-profile-role {
    font-size: 0.72rem;
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .online-indicator {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    display: inline-block;
  }

  /* قائمة التبويبات العمودية */
  .sidebar-nav-menu {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  .nav-group-header {
    font-size: 0.72rem;
    font-weight: 800;
    color: #8c887b;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin: 12px 8px 4px;
  }
  .sidebar-nav-btn {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 11px 14px;
    border: none;
    background: transparent;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.18s ease;
    text-align: right;
    font-size: 0.88rem;
    font-weight: 600;
    color: #4a4843;
    border-right: 3px solid transparent;
  }
  .sidebar-nav-btn:hover {
    background: #f7f3ea;
    color: var(--olive);
    transform: translateX(-3px);
  }
  .sidebar-nav-btn.active {
    background: rgba(94, 107, 44, 0.11);
    color: var(--olive);
    font-weight: 800;
    border-right-color: var(--olive);
    box-shadow: inset 0 0 0 1px rgba(94, 107, 44, 0.12);
  }
  .nav-btn-icon {
    font-size: 1.15rem;
    line-height: 1;
    flex-shrink: 0;
  }
  .nav-btn-title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nav-btn-badge {
    font-size: 0.72rem;
    font-weight: 700;
    background: #e8e2d4;
    color: #555146;
    padding: 2px 8px;
    border-radius: 999px;
    flex-shrink: 0;
  }
  .sidebar-nav-btn.active .nav-btn-badge {
    background: var(--olive);
    color: #ffffff;
  }
  .badge-gold {
    background: #fef3c7 !important;
    color: #b45309 !important;
  }
  .sidebar-nav-btn.active .badge-gold {
    background: #b45309 !important;
    color: #ffffff !important;
  }
  .badge-teal {
    background: #e0f2fe !important;
    color: #0284c7 !important;
  }
  .sidebar-nav-btn.active .badge-teal {
    background: #0284c7 !important;
    color: #ffffff !important;
  }

  /* أسفل القائمة الجانبية */
  .sidebar-bottom-actions {
    padding-top: 12px;
    border-top: 1px solid var(--line);
  }
  .btn-sidebar-sync {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px;
    border: 1px dashed var(--line-strong);
    background: #faf6f0;
    border-radius: 12px;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--olive);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .btn-sidebar-sync:hover {
    background: #f1ebd8;
    border-color: var(--olive);
  }

  /* =========================================================================
     منطقة المحتوى الرئيسية (Admin Main Area)
     ========================================================================= */
  .admin-main-viewport {
    flex: 1;
    min-width: 0;
  }

  .mobile-top-bar-admin {
    display: none;
  }
  .mobile-sidebar-backdrop {
    display: none;
  }

  .dash-current-tab-pill {
    display: inline-block;
    background: #f1ebd8;
    color: var(--olive);
    font-size: 0.78rem;
    font-weight: 800;
    padding: 3px 12px;
    border-radius: 999px;
    margin-bottom: 6px;
    border: 1px solid #ebd9c2;
  }

  .dash-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }
  .dash-title {
    font-size: 2.1rem;
    color: var(--olive);
    margin: 4px 0;
    font-family: 'Cairo', sans-serif;
  }
  .dash-sub {
    color: var(--text-muted);
    font-size: 0.95rem;
    margin: 0;
  }
  .desk-sync-btn {
    padding: 10px 18px;
    font-weight: 700;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }
  .kpi-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: var(--shadow-sm);
  }
  .kpi-icon {
    font-size: 1.8rem;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .kpi-label {
    display: block;
    font-size: 0.82rem;
    color: var(--muted);
    font-weight: 600;
  }
  .kpi-value {
    font-size: 1.4rem;
    color: var(--olive);
    font-weight: 800;
  }
  .highlight-profit-card {
    border-color: #a3e635;
    background: linear-gradient(135deg, #ffffff 0%, #f4fce3 100%);
  }
  .profit-color {
    color: #15803d !important;
  }

  /* استجابة الشاشات الصغيرة والهواتف */
  @media (max-width: 1024px) {
    .admin-dashboard-layout {
      flex-direction: column;
      gap: 16px;
    }
    .admin-sidebar {
      position: fixed;
      top: 0;
      bottom: 0;
      right: -320px;
      width: 290px;
      max-height: 100vh;
      border-radius: 0;
      z-index: 1000;
      transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: -4px 0 24px rgba(0,0,0,0.18);
    }
    .admin-sidebar.mobile-open {
      right: 0;
    }
    .btn-close-sidebar-mobile {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 1px solid var(--line);
      background: transparent;
      cursor: pointer;
      font-size: 1rem;
      color: #555146;
    }
    .mobile-sidebar-backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(2px);
      z-index: 999;
    }
    .mobile-top-bar-admin {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--card-solid);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 10px 14px;
      margin-bottom: 20px;
      box-shadow: var(--shadow-sm);
    }
    .btn-open-sidebar-mobile {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid #ebd9c2;
      background: #faf6f0;
      color: var(--olive);
      font-weight: 700;
      padding: 8px 14px;
      border-radius: 10px;
      cursor: pointer;
      font-size: 0.88rem;
    }
    .burger-icon {
      font-size: 1.1rem;
    }
    .btn-mobile-sync-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: #ffffff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
    }
    .desk-sync-btn {
      display: none;
    }
  }
  .table-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 28px;
    box-shadow: var(--shadow-sm);
  }
  .table-head-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .table-head-flex h3 {
    margin: 0;
    font-size: 1.3rem;
    color: var(--text);
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: right;
  }
  .data-table th {
    background: var(--bg);
    padding: 14px 16px;
    font-size: 0.88rem;
    color: var(--muted);
    border-bottom: 1px solid var(--line-strong);
  }
  .data-table td {
    padding: 14px 16px;
    border-bottom: 1px solid var(--line);
    font-size: 0.92rem;
  }
  .cell-sub {
    display: block;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .cell-price {
    color: var(--price);
    font-weight: 800;
  }
  .order-id-badge {
    background: var(--bg);
    padding: 4px 8px;
    border-radius: 4px;
    color: var(--olive);
  }
  .status-select {
    padding: 6px 12px;
    border-radius: var(--radius-full);
    border: 1px solid var(--line-strong);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
  }
  .status-select-confirmed { background: var(--pink); color: var(--rose-text); }
  .status-select-preparing { background: var(--lime); color: var(--olive); }
  .status-select-out_for_delivery { background: #e3f2fd; color: #1976d2; }
  .status-select-delivered { background: #e8f5e9; color: #2e7d32; }

  /* Drivers */
  .drivers-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-top: 20px;
  }
  .driver-profile-card {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 20px;
  }
  .driver-top {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 12px;
  }
  .driver-avatar {
    font-size: 1.8rem;
  }
  .driver-top h4 {
    margin: 0;
    font-size: 1.05rem;
  }
  .driver-phone {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .driver-status-badge {
    margin-right: auto;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: var(--radius-full);
  }
  .driver-details p {
    margin: 4px 0;
    font-size: 0.88rem;
    color: var(--text-muted);
  }

  /* Coupons */
  .coupons-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 18px;
    margin-top: 20px;
  }
  .coupon-card-tile {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 20px;
  }
  .coupon-tile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .coupon-code-text {
    font-size: 1.25rem;
    color: var(--olive);
    letter-spacing: 1px;
  }
  .active-badge {
    background: var(--lime);
    color: var(--olive);
    font-size: 0.75rem;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-weight: 700;
  }
  .active-badge.inactive {
    background: var(--pink);
    color: var(--price);
  }
  .coupon-tile-body p {
    margin: 4px 0;
    font-size: 0.88rem;
    color: var(--text-muted);
  }
  .coupon-tile-actions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
  }
  .btn-sm-action {
    flex: 1;
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    padding: 6px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-sm-action.danger {
    color: var(--price);
  }

  /* Reviews */
  .reviews-admin-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 20px;
  }
  .review-admin-item {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 18px;
  }
  .rev-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .stars {
    color: #f39c12;
    margin-right: 8px;
  }
  .rev-comment {
    font-size: 0.95rem;
    color: var(--text);
    margin: 6px 0 12px;
  }
  .reply-box-done {
    background: var(--card-solid);
    border-right: 3px solid var(--olive);
    padding: 8px 14px;
    font-size: 0.88rem;
    border-radius: 0 8px 8px 0;
  }
  .reply-box-done span {
    font-weight: 700;
    color: var(--olive);
  }
  .btn-badge {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
  }
  .btn-badge.featured {
    background: var(--lime);
    color: var(--olive);
    border-color: var(--olive);
  }

  /* History */
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
  }
  .history-item {
    display: flex;
    justify-content: space-between;
    background: var(--bg);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
  }
  .swatch-mini {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    vertical-align: middle;
    margin-left: 4px;
  }
  .input-field-sm {
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
    font-size: 0.85rem;
    width: 80px;
    text-align: center;
  }
  .modal-actions {
    display: flex;
    gap: 12px;
  }

  /* Real fixed overlay modal system */
  .modal-backdrop {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(15, 23, 42, 0.72) !important;
    backdrop-filter: blur(8px) !important;
    -webkit-backdrop-filter: blur(8px) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 999999 !important;
    padding: 20px !important;
    box-sizing: border-box !important;
  }
  .modal-card {
    background: var(--card-solid) !important;
    border: 1px solid var(--line-strong) !important;
    border-radius: var(--radius-lg) !important;
    box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.4) !important;
    padding: 30px !important;
    max-width: 560px !important;
    width: 100% !important;
    max-height: 90vh !important;
    overflow-y: auto !important;
    position: relative !important;
    animation: modalPopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  }
  @keyframes modalPopIn {
    0% { opacity: 0; transform: scale(0.93) translateY(14px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
  }
  .modal-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 16px;
  }
  .modal-form .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .modal-form .form-group label {
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--text);
  }

  /* Staff Cell in Orders Table */
  .staff-cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 175px;
  }
  .staff-line {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
  }
  .staff-badge {
    font-weight: 700;
    font-size: 0.78rem;
    padding: 2px 7px;
    border-radius: 4px;
    white-space: nowrap;
  }
  .staff-badge.florist {
    background: #fce4ec;
    color: #c2185b;
    border: 1px solid #f8bbd0;
  }
  .staff-badge.driver {
    background: #e3f2fd;
    color: #1976d2;
    border: 1px solid #bbdefb;
  }
  .staff-name {
    font-weight: 600;
    color: var(--text);
  }
  .staff-name.unassigned {
    color: var(--text-muted);
    font-style: italic;
    font-size: 0.82rem;
  }
  .btn-assign-trigger {
    margin-top: 4px;
    background: var(--lime);
    color: var(--olive);
    border: 1px solid var(--olive);
    padding: 3px 10px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
    align-self: flex-start;
  }
  .btn-assign-trigger:hover {
    background: var(--olive);
    color: #ffffff;
    transform: translateY(-1px);
  }
  .actions-cell {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .btn-icon-assign {
    background: #e8f5e9;
    border: 1px solid #a5d6a7;
    border-radius: var(--radius-sm);
    padding: 6px 10px;
    font-size: 1rem;
    cursor: pointer;
    transition: transform 0.2s;
  }
  .btn-icon-assign:hover {
    transform: scale(1.1);
    background: #c8e6c9;
  }

  /* Assign Modal Styles */
  .assign-modal-card {
    max-width: 580px;
    width: 95%;
  }
  .modal-header-styled {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 1px solid var(--line);
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .modal-title-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .modal-icon-badge {
    font-size: 1.8rem;
    background: #f1f8e9;
    padding: 8px;
    border-radius: 50%;
  }
  .modal-title-box h3 {
    margin: 0;
    font-size: 1.3rem;
    color: var(--olive);
  }
  .modal-subtitle {
    margin: 4px 0 0;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .btn-close-modal {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
  }
  .btn-close-modal:hover {
    color: var(--text);
  }

  .order-summary-box {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 12px 16px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 20px;
    font-size: 0.88rem;
  }
  .summary-col {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .summary-col.full-width {
    grid-column: span 2;
  }
  .summary-label {
    font-size: 0.78rem;
    color: var(--text-muted);
  }
  .customer-note-tag {
    color: var(--olive);
    font-style: italic;
    background: rgba(94, 107, 44, 0.08);
    padding: 4px 8px;
    border-radius: 4px;
    display: inline-block;
  }

  .assign-form-grid {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .assign-field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .assign-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.95rem;
    color: var(--text);
  }
  .assign-help {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: -2px 0 4px;
  }
  .styled-select {
    padding: 10px 14px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--card-solid);
    font-size: 0.92rem;
    color: var(--text);
    cursor: pointer;
  }
  .styled-select:focus {
    border-color: var(--olive);
    outline: none;
    box-shadow: 0 0 0 3px rgba(94, 107, 44, 0.15);
  }
  .status-radio-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 4px;
  }
  .status-radio-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    background: var(--card-solid);
    cursor: pointer;
    font-size: 0.88rem;
    transition: all 0.2s ease;
  }
  .status-radio-card.selected {
    border-color: var(--olive);
    background: #f7faed;
    font-weight: 700;
    color: var(--olive);
  }
  .modal-actions-styled {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
  }
  .btn-save-assign {
    padding: 10px 22px;
    font-weight: 700;
  }

  /* =========================================================================
     تنسيقات صور الزوايا المتعددة وتوليفات الباقات (Multi-Angle & Recipe Styles)
     ========================================================================= */
  .tab-subtext {
    font-size: 0.85rem;
    color: var(--muted);
    margin: 4px 0 0;
  }
  .flower-name-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .flower-desc-cell {
    font-size: 0.78rem;
    color: var(--muted);
    max-width: 200px;
    line-height: 1.3;
  }

  /* مصغرات الزوايا في جدول المخزون */
  .angle-thumbnails-flex {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .angle-thumb-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 4px 6px;
    background: #fbf7ee;
    border: 1px solid var(--line);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .angle-thumb-btn:hover {
    border-color: var(--olive);
    background: #f4fae6;
    transform: translateY(-2px);
  }
  .angle-thumb-btn img {
    width: 32px;
    height: 32px;
    object-fit: contain;
    border-radius: 4px;
  }
  .angle-thumb-btn span {
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--muted);
  }

  .actions-cell-flex {
    display: flex;
    gap: 6px;
  }
  .badge-danger-xs {
    display: inline-block;
    background: #ffe3e3;
    color: #c92a2a;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 999px;
    margin-right: 4px;
  }

  /* شبكة كتالوج الباقات في لوحة التحكم */
  .bouquets-admin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
    margin-top: 16px;
  }
  .bouquet-admin-card {
    background: var(--card-solid);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: all 0.25s ease;
    box-shadow: 0 4px 14px rgba(43, 43, 40, 0.03);
  }
  .bouquet-admin-card:hover {
    box-shadow: 0 10px 24px rgba(94, 107, 44, 0.08);
    border-color: #d8e5b6;
  }
  .bouquet-card-head {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .bouquet-thumb-box {
    position: relative;
    width: 72px;
    height: 72px;
    flex-shrink: 0;
  }
  .bouquet-thumb-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 14px;
    background: #faf6f0;
    padding: 2px;
    border: 1px solid var(--line);
  }
  .custom-photo-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background: #5e6b2c;
    color: #ffffff;
    font-size: 0.62rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 999px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    z-index: 2;
  }
  .thumb-upload-overlay {
    position: absolute;
    inset: 0;
    background: rgba(43, 43, 40, 0.55);
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    cursor: pointer;
    transition: opacity 0.2s ease;
    color: #ffffff;
    font-size: 1.1rem;
    z-index: 1;
  }
  .bouquet-thumb-box:hover .thumb-upload-overlay {
    opacity: 1;
  }
  .upload-btn-card {
    background: #f4fae6 !important;
    color: var(--olive) !important;
    border-color: #d8e5b6 !important;
    cursor: pointer;
    font-size: 0.78rem !important;
  }
  .upload-btn-card:hover {
    background: #e6f3cb !important;
  }
  .cam-btn-card {
    cursor: pointer;
    font-size: 0.78rem !important;
  }
  .bouquet-info-box h4 {
    margin: 0 0 6px;
    font-size: 1.15rem;
    color: var(--olive);
  }
  .occasion-chip {
    display: inline-block;
    background: #f1ebd8;
    color: #555146;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    margin-left: 8px;
  }
  .bouquet-price-tag {
    font-size: 1.1rem;
    color: #2b2b28;
    font-weight: 800;
  }

  /* قسم توليفة الورود بالباقة */
  .bouquet-recipe-section {
    background: #faf6f0;
    border: 1px solid #efe8da;
    border-radius: 12px;
    padding: 12px;
  }
  .recipe-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .recipe-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--olive);
  }
  .recipe-total-stems {
    font-size: 0.78rem;
    font-weight: 800;
    background: #eef5d8;
    color: #48551f;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .recipe-chips-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .recipe-flower-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #ffffff;
    border: 1px solid var(--line);
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 0.78rem;
  }
  .chip-flower-img {
    width: 18px;
    height: 18px;
    object-fit: contain;
    border-radius: 50%;
  }
  .chip-qty {
    color: var(--olive);
    font-weight: 800;
  }
  .chip-name {
    color: #3b3a36;
  }
  .recipe-empty {
    font-size: 0.8rem;
    color: var(--muted);
    font-style: italic;
  }
  .bouquet-card-desc {
    font-size: 0.83rem;
    color: var(--muted);
    line-height: 1.4;
    margin: 0;
  }
  .bouquet-card-actions {
    display: flex;
    gap: 8px;
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px solid #f0eae0;
  }

  /* مودالات الورد والباقات المتطورة */
  .flower-modal-card, .bouquet-modal-card {
    max-width: 680px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }
  .modal-body-scroll {
    overflow-y: auto;
    padding: 10px 4px;
    max-height: calc(90vh - 180px);
  }
  .flower-fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .flower-fields-grid .full-width {
    grid-column: 1 / -1;
  }

  /* نماذج ورود الأتيليه الجاهزة */
  .presets-box {
    background: #fbf7ee;
    border: 1px dashed var(--line);
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 18px;
  }
  .presets-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--olive);
    display: block;
    margin-bottom: 8px;
  }
  .presets-chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .preset-chip {
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .preset-chip:hover {
    background: #f1ebd8;
    border-color: var(--olive);
    color: var(--olive);
  }

  /* قسم صور الزوايا */
  .angles-config-section {
    background: #faf6f0;
    border: 1px solid #efe8da;
    border-radius: 16px;
    padding: 18px;
    margin-top: 20px;
  }
  .angles-section-title {
    margin: 0 0 4px;
    font-size: 1.05rem;
    color: var(--olive);
  }
  .angles-section-desc {
    margin: 0 0 14px;
    font-size: 0.82rem;
    color: var(--muted);
  }
  .angle-preview-container {
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  .angle-nav-tabs {
    display: flex;
    background: #f5eedf;
    border-bottom: 1px solid var(--line);
  }
  .angle-tab {
    flex: 1;
    padding: 8px;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--muted);
    transition: all 0.2s ease;
  }
  .angle-tab.active {
    background: #ffffff;
    color: var(--olive);
    border-bottom: 2px solid var(--olive);
  }
  .angle-live-display {
    padding: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle, #ffffff 40%, #fbf8f2 100%);
  }
  .preview-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }
  .preview-img {
    width: 140px;
    height: 140px;
    object-fit: contain;
    border-radius: 12px;
    box-shadow: 0 6px 16px rgba(0,0,0,0.06);
  }
  .preview-tag {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--olive);
    background: #eef5d8;
    padding: 2px 10px;
    border-radius: 999px;
  }

  .angles-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 12px;
  }
  .btn-bulk-upload {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #5e6b2c, #4a5522);
    color: #ffffff;
    font-size: 0.82rem;
    font-weight: 700;
    padding: 7px 14px;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(94, 107, 44, 0.25);
    transition: all 0.2s ease;
  }
  .btn-bulk-upload:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(94, 107, 44, 0.35);
  }
  .stage-actions-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .btn-stage-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.76rem;
    font-weight: 700;
    padding: 4px 10px;
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 999px;
    cursor: pointer;
    color: #4b4840;
    transition: all 0.15s ease;
  }
  .btn-stage-action:hover {
    background: #f5eedf;
    border-color: var(--olive);
    color: var(--olive);
  }
  .btn-stage-action.btn-stage-dl {
    background: #eef5d8;
    border-color: #cddfa0;
    color: var(--olive);
  }
  .upload-spinner-box {
    width: 140px;
    height: 140px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #fbf7ee;
    border: 2px dashed var(--olive);
    border-radius: 12px;
    font-size: 0.75rem;
    color: var(--olive);
    font-weight: 700;
    text-align: center;
    padding: 8px;
  }
  .spinner-mini {
    width: 28px;
    height: 28px;
    border: 3px solid #e7ded0;
    border-top-color: var(--olive);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* بطاقات إدخال ورفع الزوايا */
  .angle-inputs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .angle-input-card {
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: all 0.2s ease;
  }
  .angle-input-card.active-card {
    border-color: var(--olive);
    box-shadow: 0 0 0 2px rgba(94, 107, 44, 0.15);
  }
  .card-angle-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .card-angle-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: #2b2b28;
  }
  .angle-badge-num {
    background: var(--olive);
    color: #ffffff;
    font-size: 0.72rem;
    font-weight: 800;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .badge-uploaded {
    background: #e8f5e9;
    color: #2e7d32;
    border: 1px solid #c8e6c9;
    font-size: 0.68rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 6px;
  }
  .card-angle-body {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .angle-card-thumb {
    width: 52px;
    height: 52px;
    object-fit: contain;
    border-radius: 8px;
    background: #fbf7ee;
    border: 1px solid var(--line);
    padding: 3px;
    flex-shrink: 0;
  }
  .card-angle-controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .angle-btn-row {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .btn-angle-upload {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 0.74rem;
    font-weight: 700;
    padding: 4px 8px;
    background: #fbf7ee;
    border: 1px solid var(--line);
    border-radius: 6px;
    cursor: pointer;
    color: #3b3a36;
    transition: all 0.15s ease;
  }
  .btn-angle-upload:hover {
    background: #f1ebd8;
    border-color: var(--olive);
    color: var(--olive);
  }
  .btn-angle-cam {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    background: #fbf7ee;
    border: 1px solid var(--line);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.15s ease;
  }
  .btn-angle-cam:hover {
    border-color: var(--olive);
  }
  .btn-angle-dl {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 8px;
    background: #eef5d8;
    border: 1px solid #cddfa0;
    border-radius: 6px;
    cursor: pointer;
    color: var(--olive);
    font-size: 0.8rem;
    font-weight: 700;
    transition: all 0.15s ease;
  }
  .btn-angle-dl:hover {
    background: #e2efbe;
  }

  /* شريط تحميل وتنزيل صور الزوايا في المستعرض */
  .viewer-upload-toolbar {
    display: flex;
    justify-content: center;
    gap: 12px;
    padding: 12px 16px;
    background: #f4fae6;
    border-top: 1px solid #d8e8c8;
    flex-wrap: wrap;
  }
  .btn-upload-angle, .btn-cam-angle {
    cursor: pointer;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .viewer-download-toolbar {
    display: flex;
    justify-content: center;
    gap: 12px;
    padding: 12px 16px;
    background: #fcf9f2;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }

  /* تنسيقات رفع صورة الباقة في المودال */
  .bouquet-image-selector-wrap {
    margin-bottom: 8px;
  }
  .bouquet-img-upload-card {
    display: flex;
    align-items: center;
    gap: 18px;
    background: #faf6f0;
    border: 1px solid #ebd9c2;
    border-radius: 16px;
    padding: 14px 18px;
    margin-top: 6px;
  }
  .bouquet-img-preview-box {
    position: relative;
    width: 90px;
    height: 90px;
    flex-shrink: 0;
    border-radius: 14px;
    overflow: hidden;
    background: #ffffff;
    border: 2px solid #e2dac9;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .bouquet-modal-preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .bouquet-upload-overlay {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.92);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--olive);
    z-index: 3;
  }
  .badge-uploaded-tag {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(94, 107, 44, 0.95);
    color: #ffffff;
    font-size: 0.6rem;
    font-weight: 700;
    text-align: center;
    padding: 2px 0;
    z-index: 2;
  }
  .badge-preset-tag {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(100, 100, 95, 0.85);
    color: #ffffff;
    font-size: 0.6rem;
    font-weight: 700;
    text-align: center;
    padding: 2px 0;
    z-index: 2;
  }
  .bouquet-img-controls {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bouquet-upload-btns-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .btn-upload-device, .btn-cam-device {
    cursor: pointer;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .preset-fallback-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .fallback-label {
    font-size: 0.78rem;
    color: var(--muted);
    white-space: nowrap;
  }
  .select-sm {
    padding: 6px 12px;
    font-size: 0.82rem;
  }

  @media (max-width: 600px) {
    .angle-inputs-grid {
      grid-template-columns: 1fr;
    }
  }

  /* منشئ تركيبة الورود للباقة */
  .recipe-builder-section {
    background: #faf6f0;
    border: 1px solid #efe8da;
    border-radius: 16px;
    padding: 18px;
    margin-top: 20px;
  }
  .recipe-builder-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 10px;
  }
  .recipe-builder-title {
    margin: 0 0 4px;
    font-size: 1.05rem;
    color: var(--olive);
  }
  .recipe-builder-desc {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted);
  }

  /* تنبيه منع الورود من خارج القائمة */
  .strict-rule-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #f7faed;
    border: 1px solid #d8e5b6;
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 16px;
  }
  .strict-rule-banner .rule-icon {
    font-size: 1.2rem;
  }
  .strict-rule-banner p {
    margin: 0;
    font-size: 0.82rem;
    color: #3b4718;
    line-height: 1.4;
  }

  .recipe-rows-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .recipe-row-item {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px 14px;
    flex-wrap: wrap;
  }
  .row-num-badge {
    background: var(--olive);
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 800;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .row-flower-select {
    flex: 2;
    min-width: 220px;
  }
  .row-sublabel {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--muted);
    display: block;
    margin-bottom: 3px;
  }
  .row-qty-box {
    min-width: 110px;
  }
  .qty-stepper {
    display: flex;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
  }
  .stepper-btn {
    width: 32px;
    height: 34px;
    background: #fbf7ee;
    border: none;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 700;
  }
  .stepper-btn:hover {
    background: #f1ebd8;
  }
  .stepper-input {
    width: 44px;
    height: 34px;
    border: none;
    text-align: center;
    font-weight: 800;
    font-size: 0.95rem;
  }
  .row-subtotal-box {
    min-width: 80px;
  }
  .subtotal-val {
    display: block;
    font-size: 0.92rem;
    color: var(--olive);
  }
  .btn-remove-row {
    background: #fff0f0;
    border: 1px solid #ffd1d1;
    border-radius: 8px;
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  .btn-remove-row:hover {
    background: #ffe3e3;
  }
  .add-recipe-row-btn-box {
    margin-top: 12px;
  }

  /* شريط ملخص تركيبة الباقة */
  .recipe-summary-bar {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 12px 16px;
    margin-top: 16px;
  }
  .summary-metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .metric-title {
    font-size: 0.72rem;
    color: var(--muted);
    font-weight: 700;
  }
  .metric-val {
    font-size: 1.05rem;
    font-weight: 800;
    color: #2b2b28;
  }
  .metric-val.highlight {
    color: var(--olive);
  }
  .metric-val.price {
    color: #b83b5e;
  }
  .metric-val.profit {
    color: #2b8a3e;
  }

  /* مستعرض الزوايا التفاعلي */
  .viewer-card {
    max-width: 520px;
    text-align: center;
  }
  .viewer-tabs-row {
    display: flex;
    gap: 8px;
    background: #faf6f0;
    padding: 6px;
    border-radius: 12px;
    margin-bottom: 16px;
  }
  .viewer-angle-btn {
    flex: 1;
    padding: 8px;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 700;
    color: #6d6b63;
    transition: all 0.2s ease;
  }
  .viewer-angle-btn.active {
    background: #ffffff;
    border-color: var(--olive);
    color: var(--olive);
    box-shadow: 0 2px 6px rgba(0,0,0,0.04);
  }
  .viewer-img-container {
    background: radial-gradient(circle, #ffffff 40%, #fbf8f2 100%);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .viewer-main-img {
    width: 220px;
    height: 220px;
    object-fit: contain;
    filter: drop-shadow(0 10px 20px rgba(0,0,0,0.08));
    transition: transform 0.3s ease;
  }
  .viewer-main-img:hover {
    transform: scale(1.05);
  }
  .viewer-angle-badge {
    background: #eef5d8;
    color: #48551f;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 3px 14px;
    border-radius: 999px;
  }
  .viewer-footer-info {
    display: flex;
    justify-content: space-around;
    padding: 14px;
    background: #fbf7ee;
    border-radius: 12px;
    margin-top: 14px;
    font-size: 0.85rem;
  }

  /* ================= أنماط النظام المالي للعهد والتسويات ================= */
  .fin-tab-highlight {
    background: rgba(217, 119, 6, 0.08) !important;
    border-color: rgba(217, 119, 6, 0.3) !important;
    color: #92400e !important;
  }
  .fin-tab-highlight.active {
    background: linear-gradient(135deg, #b45309, #d97706) !important;
    color: #fff !important;
    border-color: #b45309 !important;
  }

  .financials-management-container {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .btn-refresh-fin {
    font-size: 0.9rem;
    padding: 8px 16px;
    border-radius: 10px;
    border: 1px solid var(--border-gold);
    background: #fff;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }
  .btn-refresh-fin:hover {
    background: #faf8f5;
    transform: translateY(-1px);
  }

  .fin-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
    gap: 16px;
  }

  .fin-kpi-card {
    background: #ffffff;
    border-radius: 16px;
    padding: 20px;
    display: flex;
    align-items: flex-start;
    gap: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
    border: 1px solid #f0eae1;
    position: relative;
    overflow: hidden;
  }

  .fin-kpi-card::before {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 6px;
    height: 100%;
  }

  .fin-card-custody::before { background: #d97706; }
  .fin-card-earnings::before { background: #059669; }
  .fin-card-net::before { background: #2563eb; }
  .fin-card-settled::before { background: #7c3aed; }

  .fin-kpi-icon {
    font-size: 2rem;
    background: #fdfaf5;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    flex-shrink: 0;
    border: 1px solid #f2ece4;
  }

  .fin-kpi-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .fin-kpi-label {
    font-size: 0.85rem;
    color: #64748b;
    font-weight: 600;
  }

  .fin-kpi-value {
    font-size: 1.6rem;
    font-weight: 800;
    font-family: inherit;
    line-height: 1.2;
  }

  .custody-val { color: #b45309; }
  .profit-val { color: #047857; }
  .net-val { color: #1d4ed8; }
  .settled-val { color: #6d28d9; }

  .fin-kpi-hint {
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .driver-cell-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .driver-avatar-icon {
    width: 38px;
    height: 38px;
    background: #fdfaf6;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    border: 1px solid #eee;
  }

  .driver-sub-meta {
    display: flex;
    gap: 10px;
    font-size: 0.78rem;
    color: #78716c;
    margin-top: 2px;
  }

  .financial-val-badge {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.95rem;
    direction: ltr;
  }

  .custody-badge {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #fde68a;
  }

  .profit-badge {
    background: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  .net-badge {
    background: #eff6ff;
    color: #1e40af;
    border: 1px solid #bfdbfe;
  }

  .net-badge.has-debt {
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 800;
  }

  .settled-sub-text {
    font-size: 0.9rem;
    color: #64748b;
    font-weight: 600;
  }

  .orders-count-badge {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
  }

  .has-pending-custody {
    background-color: rgba(254, 243, 199, 0.15);
  }

  .action-buttons-group {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .btn-fin-action {
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-settle-trigger {
    background: #d97706;
    color: #fff;
  }
  .btn-settle-trigger:hover {
    background: #b45309;
    box-shadow: 0 2px 8px rgba(217, 119, 6, 0.3);
  }

  .btn-statement-trigger {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #e5e7eb;
  }
  .btn-statement-trigger:hover {
    background: #e5e7eb;
  }

  .receipt-tag {
    background: #f1f5f9;
    color: #334155;
    padding: 4px 8px;
    border-radius: 6px;
    font-family: monospace;
    font-weight: 700;
    font-size: 0.88rem;
  }

  .date-time-box {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
  }
  .date-time-box small {
    color: #94a3b8;
  }

  .admin-badge {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.82rem;
    color: #475569;
  }

  .text-custody-cleared {
    color: #b45309;
    font-weight: 700;
  }
  .text-profit-deducted {
    color: #047857;
    font-weight: 700;
  }
  .text-net-received {
    color: #1d4ed8;
    font-weight: 800;
    font-size: 1rem;
  }

  .settle-notes-text {
    font-size: 0.82rem;
    color: #64748b;
  }

  /* أنماط مودال التسوية */
  .settle-modal-card {
    max-width: 620px;
    width: 95%;
  }

  .settle-summary-cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .settle-sum-box {
    padding: 14px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: center;
  }

  .settle-sum-box .sum-box-label {
    font-size: 0.78rem;
    color: #64748b;
    font-weight: 600;
  }

  .settle-sum-box .sum-box-val {
    font-size: 1.3rem;
    font-weight: 800;
  }

  .settle-sum-box small {
    font-size: 0.7rem;
    color: #94a3b8;
  }

  .settle-sum-box.box-custody {
    background: #fffbeb;
    border: 1px solid #fef3c7;
    color: #b45309;
  }

  .settle-sum-box.box-earnings {
    background: #ecfdf5;
    border: 1px solid #d1fae5;
    color: #047857;
  }

  .settle-sum-box.box-net {
    background: #eff6ff;
    border: 1px solid #dbeafe;
    color: #1d4ed8;
  }

  .settle-form-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .net-cash-input {
    font-size: 1.2rem;
    font-weight: 800;
    color: #1d4ed8;
    background: #eff6ff;
    border-color: #bfdbfe;
  }

  /* أنماط كشف الحساب */
  .statement-modal-card {
    max-width: 850px;
    width: 95%;
  }

  .statement-profile-banner {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 12px;
    background: #fdfaf6;
    border: 1px solid #f0e6d8;
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .stmt-col {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stmt-lbl {
    font-size: 0.75rem;
    color: #78716c;
  }

  .stmt-val {
    font-size: 1.15rem;
    font-weight: 800;
    color: #1c1917;
  }

  .tx-badge {
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .tx-in {
    background: #fef3c7;
    color: #92400e;
  }

  .tx-out {
    background: #ecfdf5;
    color: #065f46;
  }

  .tx-other {
    background: #f1f5f9;
    color: #475569;
  }

  @media (max-width: 768px) {
    .settle-summary-cards {
      grid-template-columns: 1fr;
    }
    .settle-form-fields {
      grid-template-columns: 1fr;
    }
  }

  /* ================= أنماط الأرباح اليومية ================= */
  .highlight-profit-card {
    border-color: #a7f3d0 !important;
    background: linear-gradient(135deg, #ffffff, #f0fdf4) !important;
  }
  .profit-color {
    color: #047857 !important;
  }

  .today-profit-banner {
    background: linear-gradient(135deg, #1e293b, #0f172a);
    border-radius: 18px;
    padding: 22px 26px;
    color: #fff;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
    margin-bottom: 8px;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .today-profit-banner::after {
    content: '';
    position: absolute;
    top: -50px;
    left: -50px;
    width: 150px;
    height: 150px;
    background: radial-gradient(circle, rgba(217, 119, 6, 0.25), transparent 70%);
    pointer-events: none;
  }

  .today-banner-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    margin-bottom: 18px;
  }

  .today-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .live-pulse-dot {
    width: 10px;
    height: 10px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
    animation: livePulse 2s infinite;
  }

  @keyframes livePulse {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
  }

  .today-icon {
    font-size: 1.6rem;
  }

  .today-banner-header h4 {
    margin: 0;
    font-size: 1.15rem;
    color: #f8fafc;
    font-weight: 700;
  }

  .today-subtitle {
    margin: 3px 0 0;
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .badge-today-orders {
    background: rgba(255, 255, 255, 0.12);
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.84rem;
    font-weight: 700;
    color: #f1f5f9;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .today-metrics-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .today-metric-box {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    backdrop-filter: blur(10px);
    transition: all 0.2s ease;
  }

  .today-metric-box:hover {
    background: rgba(255, 255, 255, 0.08);
    transform: translateY(-2px);
  }

  .tm-label {
    font-size: 0.82rem;
    color: #cbd5e1;
    font-weight: 600;
  }

  .tm-value {
    font-size: 1.55rem;
    font-weight: 800;
    line-height: 1.2;
    font-family: inherit;
  }

  .tm-hint {
    font-size: 0.74rem;
    color: #94a3b8;
  }

  .text-emerald { color: #34d399 !important; }
  .text-amber { color: #fbbf24 !important; }
  .text-gold { color: #f59e0b !important; }
  .text-blue { color: #60a5fa !important; }

  .today-earning-pill {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 0.82rem;
  }

  .today-earning-pill.has-earning {
    background: #fffbeb;
    border-color: #fde68a;
  }

  .today-earning-pill .te-num {
    font-weight: 800;
    color: #b45309;
  }

  .today-earning-pill .te-orders {
    font-size: 0.72rem;
    color: #78716c;
  }

  .stmt-today-box {
    background: #fffbeb;
    border: 1px dashed #fde68a;
    border-radius: 10px;
    padding: 8px 12px;
  }

  /* ================= أنماط إدارة الطاقم والمستخدمين ================= */
  .users-tab-highlight {
    background: rgba(99, 102, 241, 0.08) !important;
    border-color: rgba(99, 102, 241, 0.3) !important;
    color: #4338ca !important;
  }
  .users-tab-highlight.active {
    background: linear-gradient(135deg, #4338ca, #6366f1) !important;
    color: #fff !important;
    border-color: #4338ca !important;
  }

  .users-management-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .header-btns-row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .users-filter-bar {
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .user-role-chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .role-chip {
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 600;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s;
  }

  .role-chip:hover {
    background: #f1f5f9;
  }

  .role-chip.active {
    background: var(--olive);
    color: #fff;
    border-color: var(--olive);
  }

  .chip-driver.active { background: #b45309; border-color: #b45309; }
  .chip-florist.active { background: #be185d; border-color: #be185d; }
  .chip-admin.active { background: #4338ca; border-color: #4338ca; }
  .chip-customer.active { background: #047857; border-color: #047857; }

  .user-search-box {
    position: relative;
    min-width: 260px;
  }

  .btn-clear-search {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #94a3b8;
    font-size: 0.85rem;
  }

  .user-row-box {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-avatar-tag {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: #fdfaf6;
    border: 1px solid #f0e6d8;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    flex-shrink: 0;
  }

  .user-sub-info {
    display: flex;
    gap: 10px;
    font-size: 0.78rem;
    color: #64748b;
    margin-top: 3px;
    flex-wrap: wrap;
  }

  .user-role-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
  }

  .role-badge-driver { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
  .role-badge-florist { background: #fdf2f8; color: #9d174d; border: 1px solid #fbcfe8; }
  .role-badge-admin { background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; }
  .role-badge-customer { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }

  .work-meta-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.84rem;
  }

  .work-meta-box small {
    color: #64748b;
    font-size: 0.76rem;
  }

  .text-muted-meta {
    font-size: 0.82rem;
    color: #94a3b8;
  }

  .status-toggle-pill {
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    color: #64748b;
    transition: all 0.2s;
  }

  .status-toggle-pill.active {
    background: #ecfdf5;
    color: #065f46;
    border-color: #a7f3d0;
  }

  .btn-sm-action {
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
  }

  .btn-sm-fin {
    background: #fef3c7;
    color: #92400e;
    border-color: #fde68a;
  }
  .btn-sm-fin:hover {
    background: #fde68a;
  }

  .btn-sm-del {
    background: #fff1f2;
    color: #be123c;
    border-color: #fecdd3;
  }
  .btn-sm-del:hover {
    background: #ffe4e6;
  }

  /* مودال المستخدم */
  .user-modal-card {
    max-width: 650px;
    width: 95%;
  }

  .role-selector-section {
    margin-bottom: 22px;
  }

  .section-label {
    display: block;
    margin-bottom: 10px;
    font-size: 0.9rem;
    color: var(--olive);
  }

  .role-cards-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .role-select-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 2px solid #e2e8f0;
    background: #fafaf9;
    cursor: pointer;
    transition: all 0.2s;
  }

  .role-select-card input[type="radio"] {
    display: none;
  }

  .role-select-card:hover {
    border-color: #cbd5e1;
    background: #f5f5f4;
  }

  .role-select-card.selected {
    border-color: var(--olive);
    background: #fff;
    box-shadow: 0 4px 12px rgba(93, 107, 72, 0.15);
  }

  .rc-icon {
    font-size: 1.8rem;
    flex-shrink: 0;
  }

  .rc-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rc-info strong {
    font-size: 0.92rem;
    color: #1e293b;
  }

  .rc-info small {
    font-size: 0.72rem;
    color: #64748b;
  }

  .user-fields-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  .label-with-action {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .btn-text-sm {
    background: none;
    border: none;
    color: #b45309;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
  }

  .florist-notice-box {
    background: #fdf2f8;
    border: 1px dashed #fbcfe8;
    color: #9d174d;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  @media (max-width: 640px) {
    .role-cards-grid {
      grid-template-columns: 1fr;
    }
    .user-fields-grid {
      grid-template-columns: 1fr;
    }
  }

  /* =========================================================================
     نظام خريطة النطاقات والدوائر الجغرافية لأسعار التوصيل (Geo Delivery Zones)
     ========================================================================= */
  .geo-zones-management-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .geo-city-filter-bar {
    display: flex;
    align-items: center;
    gap: 14px;
    background: #faf6f0;
    border: 1px solid #efe8da;
    border-radius: 14px;
    padding: 10px 16px;
    flex-wrap: wrap;
  }
  .geo-filter-label {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--olive);
  }
  .city-chips-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .city-chip {
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 5px 14px;
    font-size: 0.82rem;
    font-weight: 700;
    color: #4a4843;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .city-chip:hover {
    border-color: var(--olive);
    background: #f7f3ea;
  }
  .city-chip.active {
    background: var(--olive);
    color: #ffffff;
    border-color: var(--olive);
    box-shadow: 0 2px 8px rgba(94, 107, 44, 0.25);
  }

  /* حاوية الخريطة وشريط الدليل */
  .geo-map-container-box {
    border-radius: 16px;
    overflow: hidden;
    border: 1.5px solid var(--line-strong);
    background: #ffffff;
    box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  }
  .admin-geo-map-canvas {
    height: 420px;
    width: 100%;
    z-index: 10;
  }
  .geo-map-legend-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #fcf9f2;
    border-top: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .legend-bar-title {
    font-size: 0.8rem;
    font-weight: 800;
    color: var(--olive);
    white-space: nowrap;
  }
  .legend-pills-wrap {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .legend-badge-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ffffff;
    border: 1px solid var(--line);
    border-right-width: 4px;
    padding: 3px 10px;
    border-radius: 8px;
    font-size: 0.75rem;
    color: #2b2b28;
  }
  .legend-swatch-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }

  /* خلايا الجدول */
  .color-swatch-circle {
    display: inline-block;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 1px #d8e5b6;
  }
  .zone-name-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .zone-time-sub {
    font-size: 0.72rem;
    color: var(--muted);
  }
  .badge-shape-type {
    display: inline-block;
    background: #f1ebd8;
    color: #4a4843;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .coords-tag {
    font-family: monospace;
    font-size: 0.76rem;
    background: #f5eedf;
    padding: 2px 6px;
    border-radius: 6px;
    color: #555146;
  }
  .radius-tag {
    color: var(--olive);
    font-size: 0.85rem;
  }

  /* مودال تعديل النطاق */
  .geo-zone-modal-card {
    max-width: 660px;
  }
  .range-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }
  .radius-range-slider {
    width: 100%;
    accent-color: var(--olive);
    cursor: pointer;
  }
  .range-hint {
    display: block;
    font-size: 0.72rem;
    color: var(--muted);
    margin-top: 2px;
  }
  .color-picker-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .native-color-picker {
    width: 44px;
    height: 38px;
    border: 1px solid var(--line);
    border-radius: 8px;
    cursor: pointer;
    background: transparent;
    padding: 2px;
  }
  .color-hex-tag {
    font-family: monospace;
    font-size: 0.85rem;
    font-weight: 700;
    color: #4a4843;
  }
  .map-helper-banner {
    background: #f0fdf4;
    border: 1px dashed #86efac;
    color: #166534;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 0.8rem;
    margin-top: 14px;
    line-height: 1.5;
  }

  /* مقابض التحكم التفاعلية على خريطة النطاقات */
  :global(.geo-vertex-handle-icon) {
    background: transparent !important;
    border: none !important;
  }
  :global(.geo-vertex-handle-inner) {
    background: #ffffff;
    border: 3px solid #5e6b2c;
    color: #5e6b2c;
    font-weight: 800;
    font-size: 11px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 10px rgba(0,0,0,0.35);
    cursor: grab;
    transition: transform 0.15s ease, background 0.15s ease;
  }
  :global(.geo-vertex-handle-inner:hover) {
    transform: scale(1.25);
    background: #fdfbf7;
  }

  .polygon-toolbar-box {
    background: #fbf9f4;
    border: 1.5px dashed #c9be9e;
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .polygon-toolbar-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .polygon-pts-badge {
    font-size: 0.85rem;
    color: #5e6b2c;
    font-weight: 700;
  }
  .polygon-mode-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .pill-mode-btn {
    background: #ffffff;
    border: 1px solid #d4cbb3;
    color: #555;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .pill-mode-btn.active {
    background: #5e6b2c;
    color: #ffffff;
    border-color: #5e6b2c;
    box-shadow: 0 2px 6px rgba(94, 107, 44, 0.3);
  }
  .polygon-actions-row, .shape-actions-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .btn-sub-tool {
    background: #ffffff;
    border: 1px solid #dcd3be;
    color: #3b3a36;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-sub-tool:hover {
    background: #ede6d4;
    border-color: #b7a988;
  }

  /* لوحة التشكيل المباشر العائمة فوق الخريطة */
  .geo-map-floating-dock {
    background: #fdfbf7;
    border: 2px solid #5e6b2c;
    border-radius: 14px;
    padding: 14px 18px;
    margin-bottom: 12px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .dock-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    border-bottom: 1px solid #e7decb;
    padding-bottom: 10px;
  }
  .dock-title-flex {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .dock-badge-icon {
    font-size: 1.4rem;
    background: #f1ebd8;
    padding: 4px 8px;
    border-radius: 8px;
  }
  .dock-title {
    font-size: 1.05rem;
    color: var(--olive);
    display: block;
  }
  .dock-subtext {
    font-size: 0.8rem;
    color: #666;
  }
  .dock-actions-flex {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .dock-coords-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    background: #f5f0e3;
    padding: 8px 12px;
    border-radius: 8px;
  }
  .dock-coords-text {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.84rem;
    flex-wrap: wrap;
  }
  .dock-coord-val {
    font-family: monospace;
    background: #ffffff;
    padding: 2px 7px;
    border-radius: 6px;
    border: 1px solid #d4cbb3;
    color: #2b2b28;
  }
  .dock-shape-val {
    font-size: 0.78rem;
    background: #ede6d4;
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 700;
    color: #4a4843;
  }
  .dock-confirmed-pill {
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #86efac;
    padding: 4px 12px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 0.82rem;
  }
  .dock-click-hint {
    color: #854d0e;
    background: #fef9c3;
    border: 1px dashed #fde047;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 700;
  }
  .dock-quick-tools {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  .dock-shape-pills {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .dock-pill {
    background: #ffffff;
    border: 1px solid #dcd3be;
    color: #444;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .dock-pill.active {
    background: #5e6b2c;
    color: #ffffff;
    border-color: #5e6b2c;
  }
  .dock-poly-tools {
    display: flex;
    gap: 6px;
  }
  .dock-btn-xs {
    background: #ffffff;
    border: 1px solid #dcd3be;
    color: #444;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 0.74rem;
    cursor: pointer;
    font-weight: 700;
  }
  .dock-btn-xs:hover {
    background: #ede6d4;
  }

  /* بنر الانتقال للخريطة داخل المودال */
  .map-direct-switch-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #fdfaf3;
    border: 1.5px solid #d4cbb3;
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 16px;
    gap: 14px;
    flex-wrap: wrap;
  }
  .banner-text-box {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 220px;
  }
  .banner-pin-icon {
    font-size: 1.5rem;
  }
  .banner-text-box p {
    margin: 2px 0 0;
    font-size: 0.78rem;
    color: var(--muted);
  }
  .map-btn-highlight {
    background: #f0fdf4 !important;
    color: #166534 !important;
    border: 1px solid #86efac !important;
    font-weight: 700 !important;
  }
  .map-btn-highlight:hover {
    background: #dcfce7 !important;
  }

  /* =========================================================================
     مسار مراحل الطلبات والتتبع اللحظي (Orders Pipeline & Live Tracking)
     ========================================================================= */
  .orders-section-wrap {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  /* أ. شريط ملخص مسار المراحل */
  .pipeline-summary-bar {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 20px 24px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.03);
  }
  .pipeline-summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 20px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--line);
  }
  .p-pre-badge {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--olive);
    background: var(--lime);
    padding: 3px 10px;
    border-radius: var(--radius-full);
    margin-bottom: 4px;
  }
  .pipeline-main-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--text);
    margin: 0;
  }
  .pipeline-subtitle {
    font-size: 0.82rem;
    color: var(--muted);
    margin: 4px 0 0;
  }
  .view-switch-group {
    display: flex;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    padding: 4px;
    gap: 4px;
  }
  .view-switch-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    background: transparent;
    padding: 7px 16px;
    border-radius: var(--radius-full);
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--muted);
    cursor: pointer;
    transition: all 0.2s;
  }
  .view-switch-btn.active {
    background: var(--card-solid);
    color: var(--olive);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  /* خط خطوات المسار */
  .pipeline-flow-track {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
  }
  .pipeline-flow-step {
    flex: 1;
    min-width: 160px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--radius);
    background: var(--bg);
    border: 2px solid transparent;
    cursor: pointer;
    transition: all 0.25s ease;
    text-align: right;
  }
  .pipeline-flow-step:hover {
    border-color: var(--line-strong);
    transform: translateY(-2px);
  }
  .pipeline-flow-step.active {
    border-color: var(--olive);
    background: rgba(46, 68, 50, 0.04);
    box-shadow: 0 4px 14px rgba(46, 68, 50, 0.08);
  }
  .step-num-badge {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.95rem;
    flex-shrink: 0;
  }
  .step-num-badge.stage-confirmed { background: #ffe4e6; color: #e11d48; }
  .step-num-badge.stage-preparing { background: #fef3c7; color: #d97706; }
  .step-num-badge.stage-delivery { background: #dbeafe; color: #2563eb; }
  .step-num-badge.stage-delivered { background: #dcfce7; color: #16a34a; }
  .step-content-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .step-name {
    font-size: 0.78rem;
    color: var(--muted);
    font-weight: 600;
  }
  .step-count {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--text);
  }
  .pipeline-flow-connector {
    color: var(--muted);
    font-size: 1.1rem;
    opacity: 0.5;
    flex-shrink: 0;
  }

  /* ب. شريط التحكم والبحث */
  .orders-controls-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    padding: 14px 18px;
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
  }
  .filter-pills-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filter-pill-btn {
    border: 1px solid var(--line-strong);
    background: var(--bg);
    color: var(--text);
    padding: 7px 14px;
    border-radius: var(--radius-full);
    font-size: 0.83rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .filter-pill-btn:hover {
    border-color: var(--olive);
  }
  .filter-pill-btn.active {
    background: var(--olive);
    color: #fff;
    border-color: var(--olive);
    box-shadow: 0 3px 10px rgba(46, 68, 50, 0.25);
  }
  .filter-pill-btn.pill-new.active { background: #e11d48; border-color: #e11d48; }
  .filter-pill-btn.pill-prep.active { background: #d97706; border-color: #d97706; }
  .filter-pill-btn.pill-deliv.active { background: #2563eb; border-color: #2563eb; }
  .filter-pill-btn.pill-done.active { background: #16a34a; border-color: #16a34a; }

  .orders-search-box {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 280px;
    flex: 1;
    max-width: 440px;
  }
  .search-icon {
    position: absolute;
    right: 12px;
    font-size: 0.9rem;
    pointer-events: none;
    opacity: 0.6;
  }
  .orders-search-input {
    width: 100%;
    padding: 8px 36px 8px 30px;
    border-radius: var(--radius-full);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    font-size: 0.84rem;
    color: var(--text);
    outline: none;
    transition: border-color 0.2s;
  }
  .orders-search-input:focus {
    border-color: var(--olive);
  }
  .btn-clear-search {
    position: absolute;
    left: 10px;
    background: transparent;
    border: none;
    color: var(--muted);
    cursor: pointer;
    font-size: 0.8rem;
    padding: 4px;
  }

  /* ج. أعمدة مسار المراحل (Pipeline Kanban Board) */
  .pipeline-columns-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    align-items: start;
  }
  @media (max-width: 1200px) {
    .pipeline-columns-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 700px) {
    .pipeline-columns-grid {
      grid-template-columns: 1fr;
    }
  }
  .pipeline-stage-col {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 14px;
    display: flex;
    flex-direction: column;
    min-height: 480px;
  }
  .stage-col-confirmed { border-top: 4px solid #e11d48; }
  .stage-col-preparing { border-top: 4px solid #d97706; }
  .stage-col-out_for_delivery { border-top: 4px solid #2563eb; }
  .stage-col-delivered { border-top: 4px solid #16a34a; }

  .pipeline-col-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 12px;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--line);
  }
  .col-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stage-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .col-stage-title {
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--text);
    margin: 0;
  }
  .col-count-badge {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    color: var(--text);
    font-size: 0.78rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: var(--radius-full);
  }
  .pipeline-cards-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }
  .pipeline-empty-col {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 160px;
    color: var(--muted);
    font-size: 0.82rem;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    text-align: center;
    padding: 20px;
  }

  /* بطاقة الطلب في مسار المراحل */
  .pipeline-order-card {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
    transition: all 0.2s ease;
  }
  .pipeline-order-card:hover {
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
    border-color: var(--olive);
  }
  .p-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .p-order-num {
    font-size: 0.9rem;
    font-weight: 800;
    color: var(--olive);
    background: var(--lime);
    padding: 2px 8px;
    border-radius: 4px;
  }
  .p-order-price {
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--text);
  }
  .p-card-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .p-recipient-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text);
  }
  .p-recipient-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.76rem;
    color: var(--muted);
    flex-wrap: wrap;
  }
  .p-window-pill {
    font-size: 0.72rem;
    background: rgba(0, 0, 0, 0.04);
    padding: 3px 8px;
    border-radius: 4px;
    color: var(--text);
    width: fit-content;
  }
  .p-staff-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .p-chip {
    font-size: 0.72rem;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    color: var(--muted);
  }
  .p-chip.assigned {
    color: var(--olive);
    border-color: var(--olive);
    background: rgba(46, 68, 50, 0.05);
    font-weight: 600;
  }

  /* مؤشر مسار المراحل داخل البطاقة */
  .p-card-stepper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
  }
  .p-stepper-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--line-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .p-stepper-dot.completed {
    background: #16a34a;
  }
  .p-stepper-dot.active {
    background: var(--olive);
    box-shadow: 0 0 0 3px rgba(46, 68, 50, 0.2);
  }
  .dot-inner {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #fff;
  }
  .p-stepper-line {
    flex: 1;
    height: 3px;
    background: var(--line-strong);
    margin: 0 4px;
  }
  .p-stepper-line.completed {
    background: #16a34a;
  }

  /* أزرار الإجراءات داخل البطاقة */
  .p-card-actions {
    display: flex;
    gap: 6px;
    margin-top: 6px;
    flex-wrap: wrap;
  }
  .btn-p-track {
    flex: 1;
    min-width: 90px;
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }
  .btn-p-track:hover {
    background: #bae6fd;
  }
  .btn-p-assign {
    background: #f1f5f9;
    color: var(--text);
    border: 1px solid #cbd5e1;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-p-assign:hover {
    background: #e2e8f0;
  }
  .btn-p-advance {
    width: 100%;
    background: var(--olive);
    color: #fff;
    border: none;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 4px;
    text-align: center;
  }
  .btn-p-advance:hover {
    background: #1b2b1f;
  }

  /* مسار المراحل داخل خلايا الجدول */
  .table-stage-stepper-cell {
    min-width: 280px;
  }
  .t-stepper-track {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .t-step-chip {
    border: 1px solid var(--line-strong);
    background: var(--bg);
    color: var(--muted);
    padding: 4px 8px;
    border-radius: var(--radius-full);
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .t-step-chip:hover {
    border-color: var(--olive);
    color: var(--text);
  }
  .t-step-chip.completed {
    background: #dcfce7;
    color: #166534;
    border-color: #86efac;
  }
  .t-step-chip.active {
    background: var(--olive);
    color: #fff;
    border-color: var(--olive);
    box-shadow: 0 2px 6px rgba(46, 68, 50, 0.25);
  }
  .t-step-arrow {
    color: var(--muted);
    font-size: 0.75rem;
    opacity: 0.5;
  }

  .btn-table-track {
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-table-track:hover {
    background: #bae6fd;
  }
  .btn-table-advance {
    background: var(--lime);
    color: var(--olive);
    border: 1px solid rgba(46, 68, 50, 0.2);
    padding: 6px 10px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-table-advance:hover {
    background: var(--olive);
    color: #fff;
  }

  /* د. نافذة التتبع اللحظي الشامل (Order Live Tracking Modal) */
  .tracking-modal-card {
    max-width: 960px;
    width: 95%;
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal-timeline-stepper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    padding: 14px 18px;
    background: var(--bg);
    border-radius: var(--radius);
    border: 1px solid var(--line-strong);
    flex-wrap: wrap;
    gap: 8px;
  }
  .m-step-node {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .m-marker {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--line-strong);
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 800;
  }
  .m-step-node.completed .m-marker {
    background: #16a34a;
    color: #fff;
  }
  .m-step-node.active .m-marker {
    background: var(--olive);
    color: #fff;
    box-shadow: 0 0 0 4px rgba(46, 68, 50, 0.2);
  }
  .m-label {
    font-size: 0.82rem;
    color: var(--text);
  }
  .m-stepper-line {
    flex: 1;
    height: 3px;
    background: var(--line-strong);
    margin: 0 10px;
    min-width: 20px;
  }
  .m-stepper-line.completed {
    background: #16a34a;
  }

  .tracking-modal-grid {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 20px;
  }
  @media (max-width: 850px) {
    .tracking-modal-grid {
      grid-template-columns: 1fr;
    }
  }

  .map-card-container {
    position: relative;
    border-radius: var(--radius);
    overflow: hidden;
    border: 1px solid var(--line-strong);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
  }
  .order-live-map-canvas {
    width: 100%;
    height: 320px;
    background: #e2e8f0;
  }
  .map-badges-overlay {
    position: absolute;
    bottom: 12px;
    right: 12px;
    left: 12px;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    z-index: 999;
    flex-wrap: wrap;
    pointer-events: none;
  }
  .map-stat-badge {
    background: rgba(255, 255, 255, 0.95);
    color: #1e293b;
    padding: 6px 12px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    font-weight: 700;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    backdrop-filter: blur(4px);
  }

  .tracking-driver-card {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    margin-top: 14px;
  }
  .d-avatar-box {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: #dbeafe;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.3rem;
    flex-shrink: 0;
  }
  .d-info-box {
    flex: 1;
  }
  .d-name {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--text);
  }
  .d-sub {
    margin: 2px 0 0;
    font-size: 0.76rem;
    color: var(--muted);
  }
  .btn-call-driver {
    display: inline-block;
    background: #16a34a;
    color: #fff;
    padding: 7px 12px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    font-weight: 700;
    text-decoration: none;
    transition: opacity 0.2s;
  }
  .btn-call-driver:hover {
    opacity: 0.9;
  }

  .tracking-details-col {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .track-info-section {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .t-sec-title {
    font-size: 0.88rem;
    font-weight: 800;
    color: var(--olive);
    margin: 0 0 4px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 6px;
  }
  .t-info-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.82rem;
    gap: 8px;
  }
  .t-info-row span:first-child {
    color: var(--muted);
  }
  .link-maps-nav {
    color: #2563eb;
    font-weight: 700;
    text-decoration: none;
  }
  .link-maps-nav:hover {
    text-decoration: underline;
  }
  .t-notes-box {
    background: rgba(0, 0, 0, 0.03);
    padding: 8px 10px;
    border-radius: 6px;
    font-style: italic;
    color: var(--text);
  }
  .t-items-mini-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .t-item-mini-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    padding-bottom: 4px;
    border-bottom: 1px dashed var(--line);
  }
  .t-total-row {
    display: flex;
    justify-content: space-between;
    padding-top: 6px;
    font-size: 0.88rem;
    font-weight: 800;
  }
  .t-total-price {
    color: var(--olive);
  }

  .t-history-timeline {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 160px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .h-step-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 0.78rem;
  }
  .h-step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--olive);
    margin-top: 5px;
    flex-shrink: 0;
  }
  .h-step-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .h-step-time {
    color: var(--muted);
    font-size: 0.7rem;
  }
  .h-step-comment {
    margin: 2px 0 0;
    color: var(--text);
  }

  .track-actions-bar {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
  .btn-track-action-assign {
    flex: 1;
    background: var(--bg);
    border: 1px solid var(--line-strong);
    color: var(--text);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-track-action-assign:hover {
    background: var(--line-strong);
  }
  .btn-track-action-public {
    flex: 1;
    background: var(--olive);
    color: #fff;
    border: none;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }
  .btn-track-action-public:hover {
    background: #1b2b1f;
  }

  .tracking-loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    gap: 14px;
    color: var(--muted);
  }
  .tracking-spinner {
    width: 36px;
    height: 36px;
    border: 3px solid rgba(46, 68, 50, 0.1);
    border-top-color: var(--olive);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

