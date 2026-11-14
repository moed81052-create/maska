<script>
  import { onMount } from 'svelte';
  import { auth, isStaff, isAdmin } from '../stores/auth.js';
  import { router } from '../stores/router.js';
  import { api } from '../lib/api.js';

  let currentTab = 'orders'; // 'orders' | 'drivers' | 'inventory' | 'coupons' | 'reviews' | 'pricing'
  let loading = true;
  let stats = null;

  // الطلبات
  let orders = [];
  let filterStatus = 'all';

  // السائقون ومنسقو الورد
  let drivers = [];
  let florists = [];

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

        assignModal.successMsg = `تم توجيه وإسناد الطلب #${assignModal.order.order_number} بنجاح! 🌸`;
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
    saving: false,
    errorMsg: '',
    successMsg: ''
  };

  let flowerAnglesViewer = {
    open: false,
    flower: null,
    activeAngle: 'front'
  };

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

      flowerModal.successMsg = 'تم حفظ صنف الورد وصور زواياه بنجاح 🌸';
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

      bouquetModal.successMsg = 'تم حفظ الباقة وتركيبة الورود بنجاح 💐';
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
      const [sRes, oRes, dRes, flRes, invRes, bRes, cRes, rRes, fbRes, zRes, hRes] = await Promise.allSettled([
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
        api.getPriceHistory(20)
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

  // تعديل سعر توصيل منطقة
  async function handleUpdateZoneFee(id, newFee) {
    try {
      await api.updateZoneFee(id, Number(newFee), 'تعديل السعر من لوحة الإدارة', $auth?.id);
      zones = zones.map(z => z.id === id ? { ...z, delivery_fee: Number(newFee) } : z);
      const h = await api.getPriceHistory(20);
      if (h && h.data) priceHistory = h.data;
    } catch (err) {
      alert('فشل تعديل السعر: ' + err.message);
    }
  }

  $: filteredOrders = filterStatus === 'all' 
    ? orders 
    : orders.filter(o => o.status === filterStatus);
</script>

<div class="admin-dashboard-page fade-in">
  <div class="container">
    <div class="dash-top-bar">
      <div>
        <span class="badge badge-pink">لوحة تحكم الأتيليه والإدارة 👑</span>
        <h1 class="dash-title">نظام إدارة مسكة الموحد</h1>
        <p class="dash-sub">
          مرحباً بك {$auth?.full_name || 'يا مدير النظام'} — متابعة الطلبات، السائقين، المخزون الحي، والكوبونات
        </p>
      </div>

      <button type="button" class="btn btn-outline" on:click={loadAllAdminData}>
        تحديث البيانات 🔄
      </button>
    </div>

    <!-- بطاقات الإحصائيات (KPI Cards) -->
    {#if stats}
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-icon">📦</span>
          <div>
            <span class="kpi-label">طلبات اليوم</span>
            <b class="kpi-value">{stats.todayOrders} طلب</b>
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-icon">💰</span>
          <div>
            <span class="kpi-label">مبيعات اليوم</span>
            <b class="kpi-value">{stats.todaySales} د.ل</b>
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-icon">💐</span>
          <div>
            <span class="kpi-label">قيد التنسيق</span>
            <b class="kpi-value">{stats.preparingCount} باقة</b>
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-icon">🚗</span>
          <div>
            <span class="kpi-label">السائقون النشطون</span>
            <b class="kpi-value">{stats.activeDrivers} سائقين</b>
          </div>
        </div>
      </div>
    {/if}

    <!-- تبويبات لوحة التحكم -->
    <div class="admin-tabs-bar">
      <button 
        type="button" 
        class="admin-tab" 
        class:active={currentTab === 'orders'}
        on:click={() => currentTab = 'orders'}
      >
        الطلبات والتسليم ({orders.length})
      </button>

      <button 
        type="button" 
        class="admin-tab" 
        class:active={currentTab === 'drivers'}
        on:click={() => currentTab = 'drivers'}
      >
        السائقون والتتبع ({drivers.length})
      </button>

      <button 
        type="button" 
        class="admin-tab" 
        class:active={currentTab === 'inventory'}
        on:click={() => currentTab = 'inventory'}
      >
        مخزون الورود والزوايا ({inventory.length})
      </button>

      <button 
        type="button" 
        class="admin-tab" 
        class:active={currentTab === 'bouquets'}
        on:click={() => currentTab = 'bouquets'}
      >
        كتالوج الباقات والتركيبات ({bouquets.length})
      </button>

      <button 
        type="button" 
        class="admin-tab" 
        class:active={currentTab === 'coupons'}
        on:click={() => currentTab = 'coupons'}
      >
        الكوبونات والخصومات ({coupons.length})
      </button>

      <button 
        type="button" 
        class="admin-tab" 
        class:active={currentTab === 'reviews'}
        on:click={() => currentTab = 'reviews'}
      >
        التقييمات والملاحظات ({reviews.length})
      </button>

      <button 
        type="button" 
        class="admin-tab" 
        class:active={currentTab === 'pricing'}
        on:click={() => currentTab = 'pricing'}
      >
        أسعار التوصيل والرقابة ({zones.length})
      </button>
    </div>

    <!-- محتوى التبويبات -->
    <div class="tab-content-area">
      <!-- 1. تبويب الطلبات -->
      {#if currentTab === 'orders'}
        <div class="card table-card">
          <div class="table-head-flex">
            <h3>سجل الطلبات وإسناد الطاقم</h3>
            <div class="filter-actions">
              <select class="input-field-sm" bind:value={filterStatus}>
                <option value="all">كل الحالات ({orders.length})</option>
                <option value="confirmed">مؤكد</option>
                <option value="preparing">جاري التنسيق</option>
                <option value="out_for_delivery">في الطريق</option>
                <option value="delivered">تم التسليم</option>
              </select>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>المستلم والهاتف</th>
                  <th>الوجهة والمدينة</th>
                  <th>المبلغ</th>
                  <th>توجيه الطاقم (المنسقة والسائق) 🎯</th>
                  <th>حالة الطلب</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredOrders as o (o.id || o.order_number)}
                  <tr>
                    <td><b class="order-id-badge">#{o.order_number}</b></td>
                    <td>
                      <strong>{o.recipient_name}</strong>
                      <small class="cell-sub">{o.recipient_phone}</small>
                    </td>
                    <td>
                      <span>{o.delivery_city}</span>
                      <small class="cell-sub">{o.delivery_zone}</small>
                    </td>
                    <td><b class="cell-price">{o.total_amount} د.ل</b></td>
                    <td>
                      <div class="staff-cell">
                        <div class="staff-line">
                          <span class="staff-badge florist">💐 منسقة:</span>
                          <span class="staff-name" class:unassigned={!o.florist_name}>
                            {o.florist_name || 'غير مسندة'}
                          </span>
                        </div>
                        <div class="staff-line">
                          <span class="staff-badge driver">🚗 سائق:</span>
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
                          توجيه الطاقم 🎯
                        </button>
                      </div>
                    </td>
                    <td>
                      <select 
                        class="status-select status-select-{o.status}"
                        value={o.status}
                        on:change={(e) => handleStatusChange(o.order_number, e.target.value)}
                      >
                        <option value="confirmed">مؤكد</option>
                        <option value="preparing">جاري التنسيق 💐</option>
                        <option value="out_for_delivery">في الطريق للتوصيل 🚗</option>
                        <option value="delivered">تم التسليم 🌸</option>
                      </select>
                    </td>
                    <td>
                      <div class="actions-cell">
                        <button 
                          type="button" 
                          class="btn-icon-assign" 
                          on:click={() => openAssignModal(o)}
                          title="توجيه وإسناد الطلب"
                        >
                          🎯
                        </button>
                        <button 
                          type="button" 
                          class="btn-icon" 
                          on:click={() => router.navigate('/track', { order: o.order_number })}
                          title="فتح شاشة التتبع بالخريطة"
                        >
                          📍
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

      <!-- 2. تبويب السائقين -->
      {#if currentTab === 'drivers'}
        <div class="card table-card">
          <h3>أسطول السائقين والتتبع اللحظي</h3>
          <div class="drivers-cards-grid">
            {#each drivers as d (d.id || d.user_id)}
              <div class="driver-profile-card">
                <div class="driver-top">
                  <div class="driver-avatar">🚗</div>
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
                  <p>التقييم: <b>{d.rating} ★</b></p>
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
              + إضافة صنف ورد جديد بزواياه 🌸
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
                          تعديل ✏️
                        </button>
                        <button type="button" class="btn-sm-action danger" on:click={() => handleDeleteFlower(item.id)}>
                          حذف 🗑️
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
              + إضافة باقة جديدة بتوليفة مخصصة 💐
            </button>
          </div>

          <div class="bouquets-admin-grid">
            {#each bouquets as b (b.id)}
              <div class="bouquet-admin-card">
                <div class="bouquet-card-head">
                  <div class="bouquet-thumb-box">
                    <img src={b.image_svg_path || '/assets/bouquet-pink-spring.svg'} alt={b.title} />
                  </div>
                  <div class="bouquet-info-box">
                    <h4>{b.title}</h4>
                    <span class="occasion-chip">{b.occasion_tag}</span>
                    <b class="bouquet-price-tag">{b.price} د.ل</b>
                  </div>
                </div>

                <div class="bouquet-recipe-section">
                  <div class="recipe-header-row">
                    <span class="recipe-label">🌸 تركيبة وعدد الورود:</span>
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
                  <button type="button" class="btn-sm-action" on:click={() => openEditBouquetModal(b)}>
                    تعديل الباقة والتركيبة ✏️
                  </button>
                  <button type="button" class="btn-sm-action danger" on:click={() => handleDeleteBouquet(b.id)}>
                    حذف 🗑️
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
              + إنشاء كوبون جديد 🏷️
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
                    <span class="stars">{'★'.repeat(r.rating || 5)}</span>
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
                    إرسال رد رسمي من الإدارة ✍️
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 6. تبويب أسعار التوصيل -->
      {#if currentTab === 'pricing'}
        <div class="card table-card">
          <h3>أسعار توصيل المدن والمناطق وسجل الرقابة</h3>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>المدينة</th>
                  <th>المنطقة والنطاق</th>
                  <th>رسوم التوصيل الحالية</th>
                  <th>تعديل السعر</th>
                </tr>
              </thead>
              <tbody>
                {#each zones as z (z.id)}
                  <tr>
                    <td><strong>{z.city_name}</strong></td>
                    <td>{z.zone_name}</td>
                    <td><b class="cell-price">{z.delivery_fee} د.ل</b></td>
                    <td>
                      <div class="inline-edit">
                        <input 
                          type="number" 
                          class="input-field-sm" 
                          value={z.delivery_fee} 
                          on:change={(e) => handleUpdateZoneFee(z.id, e.target.value)}
                        />
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

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
    </div>
  </div>

  <!-- مودال إنشاء كوبون جديد -->
  {#if showNewCouponModal}
    <div class="modal-backdrop fade-in" on:click|self={() => showNewCouponModal = false}>
      <div class="modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge">🏷️</span>
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
            <button type="button" class="btn btn-primary" on:click={handleCreateCoupon}>إنشاء وتفعيل الكوبون 🌸</button>
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
            <span class="modal-icon-badge">✍️</span>
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
          <button type="button" class="btn btn-primary" on:click={handleReplyReview}>إرسال الرد المعتمد ✨</button>
          <button type="button" class="btn btn-outline" on:click={() => replyModal.open = false}>إلغاء</button>
        </div>
      </div>
    </div>
  {/if}

  <!-- مودال توجيه وإسناد الطلب للمنسقة والسائق -->
  {#if assignModal.open && assignModal.order}
    <div class="modal-backdrop fade-in" on:click|self={closeAssignModal}>
      <div class="modal-card assign-modal-card">
        <div class="modal-header-styled">
          <div class="modal-title-box">
            <span class="modal-icon-badge">🎯</span>
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
              <span class="label-icon">💐</span>
              <b>توجيه إلى منسقة الورد:</b>
            </label>
            <p class="assign-help">تتولى قص وتنسيق الورود وإعداد كرت الإهداء وختم الشمع الملكي</p>
            <select class="input-field styled-select" bind:value={assignModal.floristId}>
              <option value="">-- بدون إسناد (بانتظار التنسيق) --</option>
              {#each florists as f (f.id)}
                <option value={f.id}>
                  🌸 {f.full_name} ({f.phone}) — {f.active_tasks_count ? `مهام نشطة: ${f.active_tasks_count}` : 'متفرغة للعمل'}
                </option>
              {/each}
            </select>
          </div>

          <!-- 2. توجيه سائق التوصيل -->
          <div class="assign-field-group">
            <label class="assign-label">
              <span class="label-icon">🚗</span>
              <b>توجيه إلى سائق التوصيل:</b>
            </label>
            <p class="assign-help">يستلم الباقة ويبدأ رحلة التوصيل مع فتح الموقع عبر GPS في Google Maps</p>
            <select class="input-field styled-select" bind:value={assignModal.driverId}>
              <option value="">-- بدون سائق (متاح للسائقين) --</option>
              {#each drivers as d (d.id || d.user_id)}
                <option value={d.id || d.user_id}>
                  🚗 {d.full_name} ({d.vehicle_type || 'سيارة تبريد'}) — {d.current_status === 'available' ? '🟢 متاح' : (d.current_status === 'busy' ? '🟡 في مهمة' : '⚪ غير متصل')} (تقييم {d.rating || 4.9}★)
                </option>
              {/each}
            </select>
          </div>

          <!-- 3. مسار حالة الطلب -->
          <div class="assign-field-group full-width">
            <label class="assign-label">
              <span class="label-icon">🔄</span>
              <b>تحديث حالة مسار الطلب:</b>
            </label>
            <div class="status-radio-group">
              <label class="status-radio-card" class:selected={assignModal.targetStatus === 'confirmed'}>
                <input type="radio" bind:group={assignModal.targetStatus} value="confirmed" />
                <span>مؤكد (بانتظار البدء)</span>
              </label>
              <label class="status-radio-card" class:selected={assignModal.targetStatus === 'preparing'}>
                <input type="radio" bind:group={assignModal.targetStatus} value="preparing" />
                <span>جاري التنسيق (عند المنسقة) 💐</span>
              </label>
              <label class="status-radio-card" class:selected={assignModal.targetStatus === 'out_for_delivery'}>
                <input type="radio" bind:group={assignModal.targetStatus} value="out_for_delivery" />
                <span>في الطريق (مع السائق) 🚗</span>
              </label>
              <label class="status-radio-card" class:selected={assignModal.targetStatus === 'delivered'}>
                <input type="radio" bind:group={assignModal.targetStatus} value="delivered" />
                <span>تم التسليم بنجاح 🌸</span>
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
            {assignModal.saving ? 'جاري توجيه الطلب...' : 'تأكيد التوجيه والإسناد 🎯'}
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
            <span class="modal-icon-badge">🌸</span>
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
            <label class="presets-label">⚡ نماذج جاهزة من ورود الأتيليه (انقر لتعبئة الزوايا والصور تلقائياً):</label>
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

          <!-- قسم صور الزوايا المتعددة -->
          <div class="angles-config-section">
            <div class="angles-header-flex">
              <div>
                <h4 class="angles-section-title">📷 صور الزهرة من كافة الزوايا (Front / Side / Top / Stem)</h4>
                <p class="angles-section-desc">وثق مظهر الوردة ليتسنى للمنسقين والزبائن استعراضها بزوايا 360°</p>
              </div>
            </div>

            <!-- محاكي معاينة الزاوية الحية -->
            <div class="angle-preview-container">
              <div class="angle-nav-tabs">
                <button 
                  type="button" 
                  class="angle-tab" 
                  class:active={flowerModal.activeAnglePreview === 'front'} 
                  on:click={() => flowerModal.activeAnglePreview = 'front'}
                >
                  📷 1. زاوية أمامية
                </button>
                <button 
                  type="button" 
                  class="angle-tab" 
                  class:active={flowerModal.activeAnglePreview === 'side'} 
                  on:click={() => flowerModal.activeAnglePreview = 'side'}
                >
                  📐 2. زاوية جانبية
                </button>
                <button 
                  type="button" 
                  class="angle-tab" 
                  class:active={flowerModal.activeAnglePreview === 'top'} 
                  on:click={() => flowerModal.activeAnglePreview = 'top'}
                >
                  🔍 3. زاوية علوية (ماكرو)
                </button>
                <button 
                  type="button" 
                  class="angle-tab" 
                  class:active={flowerModal.activeAnglePreview === 'stem'} 
                  on:click={() => flowerModal.activeAnglePreview = 'stem'}
                >
                  🌿 4. تفاصيل الساق
                </button>
              </div>

              <div class="angle-live-display">
                {#if flowerModal.activeAnglePreview === 'front'}
                  <div class="preview-stage">
                    <img src={flowerModal.image_front || '/assets/flowers/pink-rose-front.svg'} alt="معاينة أمامية" class="preview-img" />
                    <span class="preview-tag">الزاوية الأمامية (Front View)</span>
                  </div>
                {:else if flowerModal.activeAnglePreview === 'side'}
                  <div class="preview-stage">
                    <img src={flowerModal.image_side || '/assets/flowers/pink-rose-side.svg'} alt="معاينة جانبية" class="preview-img" />
                    <span class="preview-tag">الزاوية الجانبية (Side View)</span>
                  </div>
                {:else if flowerModal.activeAnglePreview === 'top'}
                  <div class="preview-stage">
                    <img src={flowerModal.image_top || '/assets/flowers/pink-rose-top.svg'} alt="معاينة علوية" class="preview-img" />
                    <span class="preview-tag">الزاوية العلوية والبتلات (Top View)</span>
                  </div>
                {:else if flowerModal.activeAnglePreview === 'stem'}
                  <div class="preview-stage">
                    <img src={flowerModal.image_stem || '/assets/flowers/pink-rose-stem.svg'} alt="معاينة الساق" class="preview-img" />
                    <span class="preview-tag">تفاصيل الساق والورق (Stem View)</span>
                  </div>
                {/if}
              </div>
            </div>

            <!-- روابط مسارات صور الزوايا الأربعة -->
            <div class="angle-inputs-grid">
              <div class="angle-input-card">
                <label>1. مسار أو رابط الزاوية الأمامية:</label>
                <input type="text" class="input-field input-field-sm" bind:value={flowerModal.image_front} placeholder="/assets/flowers/pink-rose-front.svg" />
              </div>

              <div class="angle-input-card">
                <label>2. مسار أو رابط الزاوية الجانبية:</label>
                <input type="text" class="input-field input-field-sm" bind:value={flowerModal.image_side} placeholder="/assets/flowers/pink-rose-side.svg" />
              </div>

              <div class="angle-input-card">
                <label>3. مسار أو رابط الزاوية العلوية (بتلات ماكرو):</label>
                <input type="text" class="input-field input-field-sm" bind:value={flowerModal.image_top} placeholder="/assets/flowers/pink-rose-top.svg" />
              </div>

              <div class="angle-input-card">
                <label>4. مسار أو رابط تفاصيل الساق والأوراق:</label>
                <input type="text" class="input-field input-field-sm" bind:value={flowerModal.image_stem} placeholder="/assets/flowers/pink-rose-stem.svg" />
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions-styled">
          <button type="button" class="btn btn-primary" disabled={flowerModal.saving} on:click={handleSaveFlower}>
            {flowerModal.saving ? 'جاري الحفظ...' : (flowerModal.isEdit ? 'حفظ التعديلات 🌸' : 'إضافة الوردة واعتماد الزوايا 🌸')}
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
            <span class="modal-icon-badge">💐</span>
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
                <option value="عيد ميلاد">🎂 عيد ميلاد</option>
                <option value="زفاف">💍 زفاف وخطوبة</option>
                <option value="تخرج">🎓 تخرج ونجاح</option>
                <option value="حب وغرام">❤️ حب ورومانسية</option>
                <option value="شكر">🌿 شكر وامتنان</option>
                <option value="اعتذار">🕊️ اعتذار ومودة</option>
                <option value="عام">🌸 مناسبات عامة</option>
              </select>
            </div>

            <div class="form-group">
              <label>سعر بيع الباقة للزبون (د.ل): *</label>
              <input type="number" step="1" class="input-field" bind:value={bouquetModal.price} />
            </div>

            <div class="form-group">
              <label>صورة الغلاف للباقة:</label>
              <select class="input-field styled-select" bind:value={bouquetModal.image_svg_path}>
                {#each bouquetImagePresets as bip}
                  <option value={bip.path}>{bip.name}</option>
                {/each}
              </select>
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
                <h4 class="recipe-builder-title">🌸 تركيبة وعدد الورود من قائمة الورود المسجلة</h4>
                <p class="recipe-builder-desc">حدد كم وردة من كل نوع تدخل في تكوين هذه الباقة (لا يمكن إدخال وردة خارج القائمة)</p>
              </div>
              <button type="button" class="btn btn-outline btn-sm" on:click={openAddFlowerModal}>
                ➕ الوردة غير موجودة؟ أضفها أولاً للمخزون
              </button>
            </div>

            <!-- تنبيه قيود الورد المعتمد -->
            <div class="strict-rule-banner">
              <span class="rule-icon">🔒</span>
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
                          🌸 {f.name_ar} ({f.color}) — سعر الساق: {f.unit_price} د.ل (المتوفر: {f.stock_quantity})
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
                      🗑️
                    </button>
                  </div>
                </div>
              {/each}
            </div>

            <div class="add-recipe-row-btn-box">
              <button type="button" class="btn btn-outline btn-sm" on:click={addBouquetFlowerRow}>
                ➕ إضافة صنف ورد آخر للباقة
              </button>
            </div>

            <!-- شريط ملخص تركيبة الباقة -->
            <div class="recipe-summary-bar">
              <div class="summary-metric">
                <span class="metric-title">🌸 إجمالي عدد الورود بالباقة:</span>
                <b class="metric-val highlight">{bouquetTotalStems} زهرة</b>
              </div>
              <div class="summary-metric">
                <span class="metric-title">💰 تكلفة الورود الأصلية من المخزون:</span>
                <b class="metric-val">{bouquetEstimatedCost.toFixed(1)} د.ل</b>
              </div>
              <div class="summary-metric">
                <span class="metric-title">🏷️ سعر بيع الباقة المقترح:</span>
                <b class="metric-val price">{bouquetModal.price} د.ل</b>
              </div>
              <div class="summary-metric">
                <span class="metric-title">📈 هامش الربح التقديري:</span>
                <b class="metric-val profit">{(Number(bouquetModal.price) - bouquetEstimatedCost).toFixed(1)} د.ل</b>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions-styled">
          <button type="button" class="btn btn-primary" disabled={bouquetModal.saving} on:click={handleSaveBouquet}>
            {bouquetModal.saving ? 'جاري الحفظ...' : (bouquetModal.isEdit ? 'تحديث الباقة والتركيبة 💐' : 'اعتماد وإنشاء الباقة 💐')}
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
            <span class="modal-icon-badge">🔄</span>
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
            📷 زاوية أمامية
          </button>
          <button 
            type="button" 
            class="viewer-angle-btn" 
            class:active={flowerAnglesViewer.activeAngle === 'side'}
            on:click={() => flowerAnglesViewer.activeAngle = 'side'}
          >
            📐 زاوية جانبية
          </button>
          <button 
            type="button" 
            class="viewer-angle-btn" 
            class:active={flowerAnglesViewer.activeAngle === 'top'}
            on:click={() => flowerAnglesViewer.activeAngle = 'top'}
          >
            🔍 زاوية علوية (ماكرو)
          </button>
          <button 
            type="button" 
            class="viewer-angle-btn" 
            class:active={flowerAnglesViewer.activeAngle === 'stem'}
            on:click={() => flowerAnglesViewer.activeAngle = 'stem'}
          >
            🌿 تفاصيل الساق
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
</div>

<style>
  .admin-dashboard-page {
    padding: 40px 0 80px;
    background: var(--bg);
  }
  .dash-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 30px;
    flex-wrap: wrap;
    gap: 16px;
  }
  .dash-title {
    font-size: 2.2rem;
    color: var(--olive);
    margin: 8px 0 4px;
    font-family: 'Cairo', sans-serif;
  }
  .dash-sub {
    color: var(--text-muted);
    font-size: 1rem;
    margin: 0;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 20px;
    margin-bottom: 32px;
  }
  .kpi-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 22px;
    display: flex;
    align-items: center;
    gap: 18px;
    box-shadow: var(--shadow-sm);
  }
  .kpi-icon {
    font-size: 2rem;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--bg);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kpi-label {
    display: block;
    font-size: 0.85rem;
    color: var(--muted);
    font-weight: 600;
  }
  .kpi-value {
    font-size: 1.5rem;
    color: var(--olive);
    font-weight: 800;
  }
  .admin-tabs-bar {
    display: flex;
    gap: 8px;
    border-bottom: 2px solid var(--line);
    margin-bottom: 24px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .admin-tab {
    background: none;
    border: none;
    padding: 12px 20px;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-muted);
    cursor: pointer;
    border-bottom: 3px solid transparent;
    white-space: nowrap;
    transition: all 0.2s;
  }
  .admin-tab:hover, .admin-tab.active {
    color: var(--olive);
    border-color: var(--olive);
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
  .bouquet-thumb-box img {
    width: 68px;
    height: 68px;
    object-fit: contain;
    border-radius: 12px;
    background: #faf6f0;
    padding: 4px;
    border: 1px solid var(--line);
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
  .angle-inputs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .angle-input-card label {
    font-size: 0.78rem;
    font-weight: 700;
    color: #4b4840;
    display: block;
    margin-bottom: 4px;
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
</style>

