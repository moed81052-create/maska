<script>
  import { onMount, tick, onDestroy } from 'svelte';
  import { router } from '../stores/router.js';
  import { cart, cartSubtotal } from '../stores/cart.js';
  import { auth } from '../stores/auth.js';
  import { api } from '../lib/api.js';
  import { calculateDistanceMeters, isCoordinateInsideZone, extractZonePoints, calculateApproxArea } from '../lib/geoUtils.js';
  import 'leaflet/dist/leaflet.css';
  import L from 'leaflet';

  // الكوبونات
  let couponCode = '';
  let couponLoading = false;
  let appliedCoupon = null;
  let couponError = '';

  // مناطق التوصيل
  let deliveryZones = [];
  let selectedZone = null;
  let loadingZones = true;

  // تحديد الموقع الجغرافي للزبون على الخريطة عبر GPS
  let customerLat = 32.8872;
  let customerLng = 13.1913;
  let detectingLocation = false;
  let locationStatus = '';
  let mapInstance = null;
  let mapMarker = null;

  // بيانات المستلم والطلب
  let orderForm = {
    recipientName: '',
    recipientPhone: '',
    city: 'طرابلس',
    addressDetails: '',
    deliveryDate: 'اليوم — خلال 3 ساعات',
    notes: '',
    paymentMethod: 'cash_on_delivery'
  };

  // العناوين والمواقع المحفوظة في حساب الزبون
  let savedAddresses = [];
  let selectedSavedAddressId = null; // null | addr.id | 'custom'
  let loadingAddresses = false;
  let addressesLoadedForUserId = null;
  let saveNewAddressToAccount = false;
  let newAddressTitle = '';

  // جلب العناوين المحفوظة في حساب الزبون
  async function loadUserSavedAddresses(userId) {
    if (!userId || loadingAddresses) return;
    addressesLoadedForUserId = userId;
    loadingAddresses = true;
    try {
      const res = await api.getUserAddresses(userId);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        savedAddresses = res.data;
        // إذا لم يكن قد تم اختيار عنوان مسبقاً، يتم تطبيق العنوان الافتراضي
        if (!selectedSavedAddressId) {
          const defaultAddr = savedAddresses.find(a => a.is_default) || savedAddresses[0];
          if (defaultAddr) {
            applySavedAddress(defaultAddr);
          }
        }
      }
    } catch (e) {
      console.warn('Could not load saved addresses:', e);
    } finally {
      loadingAddresses = false;
    }
  }

  // تطبيق بيانات العنوان المحفوظ على الحقول والخريطة
  function applySavedAddress(addr) {
    if (!addr) return;
    selectedSavedAddressId = addr.id;
    if (addr.recipient_name) orderForm.recipientName = addr.recipient_name;
    if (addr.recipient_phone) orderForm.recipientPhone = addr.recipient_phone;

    const streetParts = [];
    if (addr.street) streetParts.push(addr.street);
    if (addr.landmark) streetParts.push(`(أقرب نقطة دالة: ${addr.landmark})`);
    orderForm.addressDetails = streetParts.join(' ') || addr.title || '';

    const lat = Number(addr.latitude);
    const lng = Number(addr.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      customerLat = lat;
      customerLng = lng;

      if (mapInstance && mapMarker) {
        mapInstance.setView([customerLat, customerLng], 15);
        mapMarker.setLatLng([customerLat, customerLng]);
      }
      updateCustomerZoneByCoords(customerLat, customerLng);
    } else if (addr.city || addr.zone) {
      const match = deliveryZones.find(z => 
        (addr.zone && z.zone_name.includes(addr.zone)) || 
        (addr.city && z.city_name.includes(addr.city))
      );
      if (match) {
        selectedZone = match;
      }
    }

    locationStatus = `تم اختيار العنوان المحفوظ من حسابك: «${addr.title || 'العنوان'}» 📍`;
  }

  // اختيار إدخال موقع / عنوان جديد
  function handleSelectCustomAddress() {
    selectedSavedAddressId = 'custom';
    orderForm.addressDetails = '';
    locationStatus = 'يمكنك الآن إدخال تفاصيل عنوان جديد أو تحديده على الخريطة.';
  }

  let isSubmitting = false;

  onMount(async () => {
    // ملء بيانات الزبون وجلب عناوينه المحفوظة تلقائياً إذا كان مسجل دخول
    if ($auth) {
      orderForm.recipientName = $auth.full_name || '';
      orderForm.recipientPhone = $auth.phone || '';
      if ($auth.id) {
        loadUserSavedAddresses($auth.id);
      }
    }

    // تهيئة الخريطة التفاعلية وتحديد الموقع الحالي فوراً
    if ($cart.length > 0) {
      initCustomerMap();
    }

    try {
      const res = await api.getPricingZones();
      if (res && res.data && res.data.length > 0) {
        deliveryZones = res.data;
        selectedZone = deliveryZones[0];
      } else {
        deliveryZones = [
          { id: 1, city: 'طرابلس', city_name: 'طرابلس', zone_name: 'طرابلس المركز', delivery_fee: 10.0, center_lat: 32.8925, center_lng: 13.1800, radius_meters: 3500, zone_color: '#5e6b2c' },
          { id: 2, city: 'طرابلس', city_name: 'طرابلس', zone_name: 'النوفليين وبن عاشور', delivery_fee: 10.0, center_lat: 32.8750, center_lng: 13.2050, radius_meters: 3000, zone_color: '#b45309' },
          { id: 3, city: 'طرابلس', city_name: 'طرابلس', zone_name: 'السياحية وحي الأندلس', delivery_fee: 10.0, center_lat: 32.8680, center_lng: 13.1100, radius_meters: 4000, zone_color: '#0284c7' },
          { id: 4, city: 'طرابلس', city_name: 'طرابلس', zone_name: 'تاجوراء', delivery_fee: 15.0, center_lat: 32.8810, center_lng: 13.3400, radius_meters: 6000, zone_color: '#7c3aed' },
          { id: 5, city: 'طرابلس', city_name: 'طرابلس', zone_name: 'جنزور', delivery_fee: 15.0, center_lat: 32.8180, center_lng: 13.0100, radius_meters: 5500, zone_color: '#059669' },
          { id: 6, city: 'بنغازي', city_name: 'بنغازي', zone_name: 'كافة مناطق بنغازي', delivery_fee: 15.0, center_lat: 32.1167, center_lng: 20.0667, radius_meters: 12000, zone_color: '#dc2626' },
          { id: 7, city: 'مصراتة', city_name: 'مصراتة', zone_name: 'كافة مناطق مصراتة', delivery_fee: 16.0, center_lat: 32.3754, center_lng: 15.0925, radius_meters: 10000, zone_color: '#d97706' }
        ];
        selectedZone = deliveryZones[0];
      }
      updateCustomerZoneByCoords(customerLat, customerLng);
    } catch (e) {
      console.log('Using default delivery zones');
    } finally {
      loadingZones = false;
    }
  });

  // تفاعل تلقائي في حال تسجيل الدخول لاحقاً (مرة واحدة لكل مستخدم لتفادي التكرار)
  $: if ($auth && $auth.id && addressesLoadedForUserId !== $auth.id && !loadingAddresses) {
    loadUserSavedAddresses($auth.id);
  }

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });

  // مطابقة إحداثيات موقع الزبون مع النطاقات الجغرافية واحتساب سعر التوصيل تلقائياً في الخلفية
  function updateCustomerZoneByCoords(lat, lng) {
    if (!deliveryZones || deliveryZones.length === 0) return;

    let matchedZones = [];
    let nearestZone = null;
    let minDistance = Infinity;

    for (const z of deliveryZones) {
      const zLat = Number(z.center_lat);
      const zLng = Number(z.center_lng);
      const radius = Number(z.radius_meters) || 3000;
      const points = extractZonePoints(z);

      const dist = (!isNaN(zLat) && !isNaN(zLng) && zLat !== 0 && zLng !== 0)
        ? calculateDistanceMeters(lat, lng, zLat, zLng)
        : Infinity;

      if (dist < minDistance) {
        minDistance = dist;
        nearestZone = z;
      }

      // فحص هل الزبون داخل النطاق (مضلع، مربع غير متناسق، دائرة بيضاوية أو منتظمة)
      const isInside = isCoordinateInsideZone(lat, lng, z);

      if (isInside) {
        const area = points && points.length >= 3
          ? calculateApproxArea(points)
          : (Math.PI * radius * radius);
        matchedZones.push({ zone: z, distance: dist, area: area });
      }
    }

    if (matchedZones.length > 0) {
      // اختيار النطاق الأكثر دقة وتخصيصاً (الأصغر مساحة)
      matchedZones.sort((a, b) => a.area - b.area);
      const chosen = matchedZones[0].zone;
      selectedZone = chosen;
      orderForm.city = chosen.city || chosen.city_name || orderForm.city;
      locationStatus = `تم التعرف على موقعك في نطاق: (${chosen.zone_name}) — رسوم التوصيل المعتمدة: ${chosen.delivery_fee} د.ل`;
    } else if (nearestZone) {
      selectedZone = nearestZone;
      locationStatus = `الإحداثيات (${lat.toFixed(4)}, ${lng.toFixed(4)}) — تقع قرب نطاق (${nearestZone.zone_name}) بسعر: ${nearestZone.delivery_fee} د.ل`;
    } else {
      locationStatus = `تم اختيار الموقع: (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
  }

  // تهيئة خريطة تحديد موقع الزبون التفاعلية
  async function initCustomerMap() {
    await tick();
    const mapEl = document.getElementById('customer-map');
    if (!mapEl || mapInstance) return;

    mapInstance = L.map('customer-map').setView([customerLat, customerLng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap - مسكة'
    }).addTo(mapInstance);

    const flowerPin = L.divIcon({
      className: 'maska-map-pin',
      html: `<div style="
        background: #5e6b2c;
        color: #fff;
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(94, 107, 44, 0.45);
        border: 2.5px solid #fff;
      "><div style="width: 10px; height: 10px; background: #fff; border-radius: 50%; margin: 6px;"></div></div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 36]
    });

    mapMarker = L.marker([customerLat, customerLng], {
      draggable: true,
      icon: flowerPin
    }).addTo(mapInstance);

    mapMarker.on('dragend', () => {
      const pos = mapMarker.getLatLng();
      customerLat = pos.lat;
      customerLng = pos.lng;
      updateCustomerZoneByCoords(customerLat, customerLng);
    });

    mapInstance.on('click', (e) => {
      customerLat = e.latlng.lat;
      customerLng = e.latlng.lng;
      mapMarker.setLatLng(e.latlng);
      updateCustomerZoneByCoords(customerLat, customerLng);
    });

    // مطابقة الموقع الجغرافي للزبون مع النطاقات تلقائياً في الخلفية
    updateCustomerZoneByCoords(customerLat, customerLng);

    // تحديد الموقع الحالي للزبون تلقائياً كأول خطوة
    detectCustomerLocation();
  }

  // دالة تحديد الموقع الحالي للزبون عبر الـ GPS
  function detectCustomerLocation() {
    if (!navigator.geolocation) {
      locationStatus = 'تحديد الموقع التلقائي غير مدعوم، يمكنك النقر على الخريطة لتحديده يدوياً.';
      return;
    }

    detectingLocation = true;
    locationStatus = 'جاري تحديد موقعك الجغرافي الحالي عبر الـ GPS...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        customerLat = pos.coords.latitude;
        customerLng = pos.coords.longitude;
        detectingLocation = false;

        if (mapInstance && mapMarker) {
          mapInstance.setView([customerLat, customerLng], 15);
          mapMarker.setLatLng([customerLat, customerLng]);
        }
        updateCustomerZoneByCoords(customerLat, customerLng);
      },
      (err) => {
        detectingLocation = false;
        locationStatus = 'تعذر الوصول التلقائي للموقع، يمكنك النقر على الخريطة أو سحب الدبوس لتحديده.';
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function handleZoneSelectionChange() {
    if (!selectedZone || !mapInstance || !mapMarker) return;
    if (selectedZone.city_name.includes('بنغازي')) {
      customerLat = 32.1167;
      customerLng = 20.0667;
    } else if (selectedZone.city_name.includes('مصراتة')) {
      customerLat = 32.3754;
      customerLng = 15.0925;
    } else if (selectedZone.city_name.includes('طرابلس')) {
      customerLat = 32.8872;
      customerLng = 13.1913;
    }
    mapInstance.setView([customerLat, customerLng], 14);
    mapMarker.setLatLng([customerLat, customerLng]);
    locationStatus = `تم توجيه الخريطة إلى: ${selectedZone.city_name} — ${selectedZone.zone_name}`;
  }

  // تفعيل الخريطة إذا كانت السلة تحتوي عناصر
  $: if ($cart.length > 0 && !mapInstance) {
    initCustomerMap();
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    couponLoading = true;
    couponError = '';
    try {
      const res = await api.validateCoupon(couponCode.trim(), $cartSubtotal);
      if (res && res.success && res.data) {
        appliedCoupon = res.data;
      }
    } catch (err) {
      couponError = err.message || 'كود الخصم غير صالح';
      appliedCoupon = null;
    } finally {
      couponLoading = false;
    }
  }

  function handleRemoveCoupon() {
    appliedCoupon = null;
    couponCode = '';
    couponError = '';
  }

  $: deliveryFee = selectedZone ? Number(selectedZone.delivery_fee) : 10.0;
  $: discountAmount = appliedCoupon ? Number(appliedCoupon.discountAmount) : 0.0;
  $: finalTotal = Math.max(0, $cartSubtotal - discountAmount + deliveryFee);

  async function handleCheckout(e) {
    e.preventDefault();
    if ($cart.length === 0) return;

    if (!orderForm.recipientName || !orderForm.recipientPhone) {
      alert('الرجاء إدخال اسم ورقم هاتف المستلم');
      return;
    }

    isSubmitting = true;
    try {
      const payload = {
        customerId: $auth ? $auth.id : null,
        recipientName: orderForm.recipientName,
        recipientPhone: orderForm.recipientPhone,
        city: selectedZone ? selectedZone.city_name : orderForm.city,
        zone: selectedZone ? selectedZone.zone_name : 'المركز',
        addressDetails: orderForm.addressDetails,
        lat: customerLat,
        lng: customerLng,
        deliveryWindow: orderForm.deliveryDate,
        subtotal: $cartSubtotal,
        discountAmount: discountAmount,
        deliveryFee: deliveryFee,
        totalAmount: finalTotal,
        couponId: appliedCoupon ? appliedCoupon.coupon_id : null,
        paymentMethod: orderForm.paymentMethod,
        notes: orderForm.notes,
        items: $cart.map(item => ({
          bouquetId: item.bouquetId || null,
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          isCustom: item.isCustom,
          wrapType: item.wrapType,
          ribbonColor: item.ribbonColor,
          waxSealText: item.waxSealText,
          flowers: item.flowers
        }))
      };

      const res = await api.createOrder(payload);
      if (res && res.success && res.data) {
        // إذا اختار الزبون حفظ العنوان الجديد في حسابه للطلبات القادمة
        if (saveNewAddressToAccount && $auth && $auth.id && selectedSavedAddressId === 'custom') {
          try {
            await api.addUserAddress({
              userId: $auth.id,
              title: newAddressTitle.trim() || `عنوان ${orderForm.addressDetails.slice(0, 20) || 'جديد'}`,
              recipientName: orderForm.recipientName,
              recipientPhone: orderForm.recipientPhone,
              city: selectedZone ? selectedZone.city_name : orderForm.city,
              zone: selectedZone ? selectedZone.zone_name : 'المركز',
              street: orderForm.addressDetails,
              latitude: customerLat,
              longitude: customerLng,
              isDefault: savedAddresses.length === 0
            });
          } catch (saveErr) {
            console.warn('Auto-save address error:', saveErr);
          }
        }

        const orderNum = (res.data.order && res.data.order.order_number) || '1048';
        cart.clearCart();
        router.navigate('/track', { order: orderNum, new: 'true' });
      }
    } catch (err) {
      alert('حدث خطأ أثناء تثبيت الطلب: ' + err.message);
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="cart-page fade-in">
  <div class="container">
    <div class="cart-header">
      <h1 class="page-title">سلة المشتريات والدفع</h1>
      <p class="page-subtitle">راجع طلبك، اختر منطقة التوصيل وكود الخصم، وأكّد وصول الباقة في موعدها.</p>
    </div>

    {#if $cart.length === 0}
      <div class="empty-cart-card">
        <span class="empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg></span>
        <h2>سلة المشتريات فارغة حالياً</h2>
        <p>لم تقم بإضافة أي باقة ورد بعد. تفضل بزيارة باقاتنا الجاهزة أو استوديو التصميم المخصص.</p>
        <div class="empty-actions">
          <button type="button" class="btn btn-primary" on:click={() => router.navigate('/')}>
            تصفح الباقات الجاهزة ←
          </button>
          <button type="button" class="btn btn-outline" on:click={() => router.navigate('/studio')}>
            صمم باقة في الاستوديو
          </button>
        </div>
      </div>
    {:else}
      <div class="cart-grid">
        <!-- 1. قائمة عناصر السلة -->
        <div class="cart-items-col">
          <div class="card box-card">
            <div class="box-head">
              <h3>عناصر الباقات المختارة ({$cart.length})</h3>
              <button type="button" class="clear-btn" on:click={() => cart.clearCart()}>
                تفريغ السلة
              </button>
            </div>

            <div class="items-list">
              {#each $cart as item (item.id)}
                <div class="cart-item-row">
                  <img src={item.image} alt={item.title} class="item-thumb" />
                  <div class="item-details">
                    <h4 class="item-title">{item.title}</h4>
                    {#if item.isCustom}
                      <span class="custom-tag">تصميم مخصص بختم شمعي</span>
                      {#if item.wrapType}
                        <small class="item-meta">التغليف: {item.wrapType} | الشريط: {item.ribbonColor}</small>
                      {/if}
                    {/if}
                    <span class="item-unit-price">{item.price} د.ل</span>
                  </div>

                  <div class="item-controls">
                    <div class="qty-control">
                      <button type="button" on:click={() => cart.updateQuantity(item.id, item.quantity - 1)}>-</button>
                      <span>{item.quantity}</span>
                      <button type="button" on:click={() => cart.updateQuantity(item.id, item.quantity + 1)}>+</button>
                    </div>

                    <span class="item-total">{(item.price * item.quantity).toFixed(0)} د.ل</span>

                    <button 
                      type="button" 
                      class="remove-item-btn" 
                      on:click={() => cart.removeItem(item.id)}
                      title="حذف الباقة"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          </div>

          <!-- نموذج بيانات المستلم والتوصيل -->
          <div class="card box-card delivery-box-card">
            <div class="delivery-card-header">
              <div class="dch-text">
                <h3 class="delivery-title">بيانات استلام الهدية وموقع التوصيل</h3>
                <p class="delivery-subtitle">اختاري عنواناً وموقعاً محفوظاً في حسابك أو حددي موقعاً جديداً على الخريطة</p>
              </div>
              {#if $auth}
                <div class="user-account-badge">
                  <span class="uab-icon">👤</span>
                  <span class="uab-name">{$auth.full_name || $auth.phone}</span>
                </div>
              {/if}
            </div>

            <!-- 1. قسم العناوين المحفوظة في الحساب الشخصي -->
            {#if $auth}
              <div class="saved-addresses-block">
                <div class="sab-header">
                  <span class="sab-title">
                    📍 <b>العناوين والمواقع المحفوظة في حسابك:</b>
                    {#if savedAddresses.length > 0}
                      <small class="sab-count">({savedAddresses.length} عناوين متاحة)</small>
                    {/if}
                  </span>
                  <button 
                    type="button" 
                    class="btn-manage-addrs-link" 
                    on:click={() => router.navigate('/profile', { tab: 'addresses' })}
                  >
                    إدارة العناوين في حسابي ⚙️
                  </button>
                </div>

                {#if loadingAddresses}
                  <div class="loading-addrs-strip">جاري استرجاع عناوِينك المحفوظة...</div>
                {:else if savedAddresses.length > 0}
                  <div class="saved-addrs-chips-row">
                    {#each savedAddresses as addr (addr.id)}
                      <button 
                        type="button" 
                        class="saved-addr-chip" 
                        class:active={selectedSavedAddressId === addr.id}
                        on:click={() => applySavedAddress(addr)}
                      >
                        <div class="sac-top">
                          <span class="sac-icon">{addr.title?.includes('عمل') || addr.title?.includes('مكتب') ? '🏢' : (addr.title?.includes('بيت') || addr.title?.includes('منزل') ? '🏠' : '📍')}</span>
                          <span class="sac-title">{addr.title || 'عنوان محفوظ'}</span>
                          {#if addr.is_default}
                            <span class="sac-def-badge">الافتراضي</span>
                          {/if}
                          {#if selectedSavedAddressId === addr.id}
                            <span class="sac-check">✓ تم اختياره</span>
                          {/if}
                        </div>
                        <div class="sac-body">
                          <span class="sac-zone">{addr.city} • {addr.zone}</span>
                          {#if addr.street}
                            <small class="sac-street">{addr.street}</small>
                          {/if}
                        </div>
                        <div class="sac-recipient">
                          <small>👤 {addr.recipient_name || 'المستلم'} ({addr.recipient_phone || ''})</small>
                        </div>
                      </button>
                    {/each}

                    <!-- زر اختيار إدخال موقع جديد -->
                    <button 
                      type="button" 
                      class="saved-addr-chip new-custom-chip" 
                      class:active={selectedSavedAddressId === 'custom'}
                      on:click={handleSelectCustomAddress}
                    >
                      <div class="sac-top">
                        <span class="sac-icon">➕</span>
                        <span class="sac-title">عنوان / موقع جديد</span>
                      </div>
                      <div class="sac-body">
                        <small class="sac-street">تحديد يدوي وإدخال تفاصيل جديدة</small>
                      </div>
                      {#if selectedSavedAddressId === 'custom'}
                        <span class="sac-check custom">✓ إدخال جديد</span>
                      {/if}
                    </button>
                  </div>
                {:else}
                  <div class="no-addrs-notice">
                    <span>💡 لا توجد لديك عناوين محفوظة بعد. يمكنك تحديد موقعك بالأسفل وحفظه في حسابك للطلبات القادمة بنقرة واحدة! 📍</span>
                  </div>
                {/if}
              </div>
            {:else}
              <div class="login-quick-prompt">
                <span class="lqp-icon">💡</span>
                <div class="lqp-text">
                  <b>هل لديك حساب شخصي في مسكة؟</b>
                  <span>سجّل دخولك الآن لاختيار عناوينك ومواقعك المحفوظة بنقرة واحدة دون إعادة إدخالها في كل مرة.</span>
                </div>
                <button type="button" class="btn btn-outline btn-sm lqp-btn" on:click={() => router.navigate('/login')}>
                  تسجيل الدخول 🔑
                </button>
              </div>
            {/if}

            <div class="form-grid">
              <div class="form-group">
                <label>اسم المستلم أو المحتفى به:</label>
                <input 
                  type="text" 
                  class="input-field" 
                  bind:value={orderForm.recipientName} 
                  placeholder="مثال: منى الفيتوري" 
                  required 
                />
              </div>

              <div class="form-group">
                <label>رقم هاتف المستلم (للتنسيق مع السائق):</label>
                <input 
                  type="tel" 
                  class="input-field" 
                  bind:value={orderForm.recipientPhone} 
                  placeholder="091XXXXXXX أو 092XXXXXXX" 
                  required 
                />
              </div>

              <div class="form-group full-width">
                <label>مدينة ومنطقة التوصيل:</label>
                <select 
                  class="input-field" 
                  bind:value={selectedZone}
                  on:change={handleZoneSelectionChange}
                >
                  {#each deliveryZones as zone (zone.id)}
                    <option value={zone}>
                      {zone.city_name} — {zone.zone_name} (رسوم التوصيل: {zone.delivery_fee} د.ل)
                    </option>
                  {/each}
                </select>
              </div>

              <div class="form-group full-width">
                <label>تفاصيل العنوان الدقيق (الشارع أو معلم مشهور):</label>
                <input 
                  type="text" 
                  class="input-field" 
                  bind:value={orderForm.addressDetails} 
                  placeholder="مثال: قرب صيدلية البركة، شارع عمر المختار" 
                />
              </div>

              <!-- خريطة تفاعلية لتحديد موقع منزل الزبون عبر GPS -->
              <div class="form-group full-width map-picker-section">
                <div class="map-picker-head">
                  <div>
                    <label class="map-label">تحديد موقع الاستلام بدقة على الخريطة (GPS):</label>
                    <small class="map-desc">يتم تزويد السائق بهذه الإحداثيات لفتح مسار الملاحة المباشر عبر Google Maps</small>
                  </div>
                  <button 
                    type="button" 
                    class="btn-detect-gps" 
                    disabled={detectingLocation}
                    on:click={detectCustomerLocation}
                  >
                    {detectingLocation ? 'جاري الاتصال بالأقمار...' : 'موقعي الحالي (GPS)'}
                  </button>
                </div>

                {#if locationStatus}
                  <div class="location-status-bar" class:success={locationStatus.includes('تم التعرف') || locationStatus.includes('تم اختيار')}>
                    {locationStatus}
                  </div>
                {/if}

                <div id="customer-map" class="customer-map-canvas"></div>

                <div class="coords-display-bar">
                  <span>الإحداثيات المعتمدة: <strong>{customerLat.toFixed(5)}° N, {customerLng.toFixed(5)}° E</strong></span>
                  <small>يمكنك سحب الدبوس أو النقر على الخريطة لضبط موقع التوصيل</small>
                </div>
              </div>

              <!-- خيار حفظ العنوان الجديد في حساب الزبون -->
              {#if $auth && (selectedSavedAddressId === 'custom' || savedAddresses.length === 0)}
                <div class="form-group full-width save-addr-opt-wrap">
                  <label class="save-addr-checkbox">
                    <input type="checkbox" bind:checked={saveNewAddressToAccount} />
                    <span>💾 حفظ هذا العنوان في حسابي الشخصي للاستخدام في المرات القادمة</span>
                  </label>
                  {#if saveNewAddressToAccount}
                    <div class="new-addr-title-box fade-in">
                      <label>اسم هذا العنوان (مثال: بيت العائلة، شقة تاجوراء، مكتب النوفليين):</label>
                      <input 
                        type="text" 
                        class="input-field" 
                        placeholder="اكتبي اسماً مميزاً للعنوان..." 
                        bind:value={newAddressTitle} 
                      />
                    </div>
                  {/if}
                </div>
              {/if}

              <div class="form-group">
                <label>موعد التسليم المرغوب:</label>
                <select class="input-field" bind:value={orderForm.deliveryDate}>
                  <option value="اليوم — توصيل فوري خلال 3 ساعات">اليوم — فوري خلال 3 ساعات</option>
                  <option value="اليوم — الفترة المسائية (6 - 9 مساءً)">اليوم — الفترة المسائية (6 - 9 م)</option>
                  <option value="غداً — صباحاً (10 - 1 ظهراً)">غداً — صباحاً (10 - 1 ظهراً)</option>
                  <option value="غداً — مساءً (5 - 9 مساءً)">غداً — مساءً (5 - 9 مساءً)</option>
                </select>
              </div>

              <div class="form-group">
                <label>طريقة الدفع:</label>
                <select class="input-field" bind:value={orderForm.paymentMethod}>
                  <option value="cash_on_delivery">الدفع عند الاستلام (كاش للسائق)</option>
                  <option value="bank_transfer">تحويل مصرفي (سداد / تداول / يسر باي)</option>
                </select>
              </div>

              <div class="form-group full-width">
                <label>ملاحظات إضافية للتوصيل (اختياري):</label>
                <input 
                  type="text" 
                  class="input-field" 
                  bind:value={orderForm.notes} 
                  placeholder="مثال: يرجى عدم الاتصال قبل الوصول للحفاظ على المفاجأة" 
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 2. بطاقة ملخص الحساب والكوبون -->
        <aside class="cart-summary-col">
          <div class="card summary-card">
            <h3 class="summary-title">ملخص الطلب والدفع</h3>

            <!-- إدخال كود الخصم -->
            <div class="coupon-box">
              <label>هل لديك كود تخفيض؟</label>
              {#if appliedCoupon}
                <div class="applied-coupon-pill">
                  <span>تم تفعيل كود: <b>{appliedCoupon.code}</b> (-{appliedCoupon.discountAmount} د.ل)</span>
                  <button type="button" on:click={handleRemoveCoupon}>إلغاء</button>
                </div>
              {:else}
                <div class="coupon-input-group">
                  <input 
                    type="text" 
                    class="input-field" 
                    placeholder="مثل: MASKA15" 
                    bind:value={couponCode} 
                  />
                  <button 
                    type="button" 
                    class="btn btn-outline btn-sm" 
                    disabled={couponLoading}
                    on:click={handleApplyCoupon}
                  >
                    {couponLoading ? '...' : 'تطبيق'}
                  </button>
                </div>
                {#if couponError}
                  <span class="coupon-error">{couponError}</span>
                {/if}
                <small class="coupon-hint">جرب كود التخفيض: <b>MASKA15</b> أو <b>GRAD2026</b></small>
              {/if}
            </div>

            <!-- الحسابات المالية -->
            <div class="financial-lines">
              <div class="fin-line">
                <span>المجموع الفرعي للباقات:</span>
                <b>{$cartSubtotal.toFixed(0)} د.ل</b>
              </div>

              {#if discountAmount > 0}
                <div class="fin-line discount-line">
                  <span>قيمة الخصم بالكوبون:</span>
                  <b>-{discountAmount.toFixed(0)} د.ل</b>
                </div>
              {/if}

              <div class="fin-line">
                <span>رسوم التوصيل المبرد ({selectedZone ? selectedZone.city_name : 'طرابلس'}):</span>
                <b>{deliveryFee.toFixed(0)} د.ل</b>
              </div>

              <div class="fin-total-row">
                <span>المبلغ الإجمالي النهائي:</span>
                <span class="grand-price">{finalTotal.toFixed(0)} د.ل</span>
              </div>
            </div>

            <button 
              type="button" 
              class="btn btn-primary btn-block btn-lg" 
              disabled={isSubmitting}
              on:click={handleCheckout}
            >
              {isSubmitting ? 'جاري تثبيت الطلب...' : 'تأكيد الطلب والتسليم ←'}
            </button>

            <div class="security-badges">
              <span>ضمان سلامة ونضارة الورد</span>
              <span>توصيل مبرد في موعدك</span>
            </div>
          </div>
        </aside>
      </div>
    {/if}
  </div>
</div>

<style>
  .cart-page {
    padding: 40px 0 80px;
    background: var(--bg);
  }
  .cart-header {
    text-align: center;
    max-width: 600px;
    margin: 0 auto 36px;
  }
  .page-title {
    font-size: 2.3rem;
    font-weight: 800;
    color: var(--olive);
    margin-bottom: 8px;
    font-family: 'Cairo', sans-serif;
  }
  .page-subtitle {
    font-size: 1.05rem;
    color: var(--text-muted);
  }
  .empty-cart-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 60px 24px;
    text-align: center;
    max-width: 580px;
    margin: 40px auto;
    box-shadow: var(--shadow-md);
  }
  .empty-icon {
    font-size: 3.5rem;
    margin-bottom: 16px;
    display: inline-block;
  }
  .empty-cart-card h2 {
    color: var(--olive);
    margin-bottom: 10px;
  }
  .empty-cart-card p {
    color: var(--text-muted);
    margin-bottom: 28px;
    line-height: 1.6;
  }
  .empty-actions {
    display: flex;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .cart-grid {
    display: grid;
    grid-template-columns: 1.35fr 0.85fr;
    gap: 36px;
    align-items: start;
  }
  .cart-items-col {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .box-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 28px;
    box-shadow: var(--shadow-sm);
  }
  .box-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .box-head h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--text);
  }
  .clear-btn {
    background: none;
    border: none;
    color: var(--price);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }
  .items-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .cart-item-row {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 14px 16px;
    background: var(--bg);
    border-radius: var(--radius-md);
    border: 1px solid var(--line);
  }
  .item-thumb {
    width: 65px;
    height: 65px;
    object-fit: contain;
    border-radius: var(--radius-sm);
    background: var(--card);
    padding: 4px;
  }
  .item-details {
    flex: 1;
  }
  .item-title {
    font-size: 1.05rem;
    font-weight: 700;
    margin: 0 0 4px;
    color: var(--text);
  }
  .custom-tag {
    display: inline-block;
    background: var(--pink);
    color: var(--rose-text);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: var(--radius-full);
    margin-bottom: 4px;
  }
  .item-meta {
    display: block;
    font-size: 0.78rem;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .item-unit-price {
    font-size: 0.9rem;
    color: var(--text-muted);
    font-weight: 600;
  }
  .item-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .qty-control {
    display: flex;
    align-items: center;
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-full);
    padding: 2px 8px;
    gap: 8px;
  }
  .qty-control button {
    background: none;
    border: none;
    font-size: 1.1rem;
    font-weight: bold;
    color: var(--olive);
    cursor: pointer;
    width: 22px;
  }
  .item-total {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--price);
    min-width: 65px;
    text-align: center;
  }
  .remove-item-btn {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 1.1rem;
    cursor: pointer;
  }
  .remove-item-btn:hover {
    color: var(--price);
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 16px;
  }
  .full-width {
    grid-column: 1 / -1;
  }
  .form-group label {
    display: block;
    font-size: 0.88rem;
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--text);
  }

  /* Map Location Picker */
  .map-picker-section {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-md);
    padding: 16px;
    margin-top: 4px;
  }
  .map-picker-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    flex-wrap: wrap;
    gap: 10px;
  }
  .map-label {
    font-size: 0.95rem !important;
    font-weight: 700 !important;
    color: var(--olive) !important;
    margin: 0 !important;
  }
  .map-desc {
    font-size: 0.78rem;
    color: var(--muted);
    display: block;
    margin-top: 2px;
  }
  .btn-detect-gps {
    background: var(--olive);
    color: #ffffff;
    border: none;
    padding: 8px 14px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    box-shadow: var(--shadow-xs);
    transition: all 0.2s;
  }
  .btn-detect-gps:hover {
    background: var(--olive-dark);
    transform: translateY(-1px);
  }
  .location-status-bar {
    background: var(--card-solid);
    border: 1px solid var(--line);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 10px;
    font-weight: 600;
  }
  .location-status-bar.success {
    background: #e8f5e9;
    color: #2e7d32;
    border-color: #c8e6c9;
  }
  .customer-map-canvas {
    height: 250px;
    width: 100%;
    border-radius: var(--radius-sm);
    border: 1.5px solid var(--line-strong);
    z-index: 10;
  }
  .coords-display-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
    font-size: 0.82rem;
    color: var(--text-muted);
    flex-wrap: wrap;
    gap: 6px;
  }
  .coords-display-bar b {
    color: #1565c0;
  }
  .coords-display-bar small {
    color: var(--muted);
  }

  /* Summary Card */
  .cart-summary-col {
    position: sticky;
    top: 90px;
  }
  .summary-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 28px;
    box-shadow: var(--shadow-lg);
  }
  .summary-title {
    font-size: 1.35rem;
    color: var(--olive);
    margin-bottom: 20px;
  }
  .coupon-box {
    background: var(--bg);
    padding: 16px;
    border-radius: var(--radius-md);
    margin-bottom: 22px;
    border: 1px solid var(--line);
  }
  .coupon-box label {
    display: block;
    font-size: 0.85rem;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .coupon-input-group {
    display: flex;
    gap: 8px;
  }
  .coupon-error {
    color: var(--price);
    font-size: 0.8rem;
    font-weight: 600;
    display: block;
    margin-top: 6px;
  }
  .coupon-hint {
    display: block;
    font-size: 0.78rem;
    color: var(--muted);
    margin-top: 6px;
  }
  .applied-coupon-pill {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--lime);
    color: var(--olive-darker);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
    font-weight: 700;
  }
  .applied-coupon-pill button {
    background: none;
    border: none;
    color: var(--price);
    font-size: 0.8rem;
    cursor: pointer;
    text-decoration: underline;
  }
  .financial-lines {
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-bottom: 1.5px solid var(--line);
    padding-bottom: 18px;
    margin-bottom: 20px;
  }
  .fin-line {
    display: flex;
    justify-content: space-between;
    font-size: 0.95rem;
    color: var(--text-muted);
  }
  .discount-line {
    color: var(--price);
  }
  .fin-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--text);
    padding-top: 8px;
  }
  .grand-price {
    font-size: 1.7rem;
    color: var(--price);
  }
  .security-badges {
    display: flex;
    justify-content: space-between;
    margin-top: 18px;
    font-size: 0.78rem;
    color: var(--muted);
  }

  /* =========================================================================
     عناصر اختيار العناوين المحفوظة من الحساب الشخصي (Saved Addresses in Cart)
     ========================================================================= */
  .delivery-box-card {
    position: relative;
  }
  .delivery-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 18px;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--line);
  }
  .delivery-title {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--olive);
    margin: 0 0 4px;
  }
  .delivery-subtitle {
    font-size: 0.85rem;
    color: var(--muted);
    margin: 0;
  }
  .user-account-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
    padding: 5px 12px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 700;
  }

  /* كتلة العناوين المحفوظة */
  .saved-addresses-block {
    background: #fbf9f5;
    border: 1px solid rgba(94, 107, 44, 0.18);
    border-radius: var(--radius-md);
    padding: 16px;
    margin-bottom: 20px;
  }
  .sab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }
  .sab-title {
    font-size: 0.9rem;
    color: var(--text);
  }
  .sab-title b {
    color: var(--olive);
  }
  .sab-count {
    color: var(--muted);
    font-size: 0.8rem;
    margin-right: 4px;
  }
  .btn-manage-addrs-link {
    background: none;
    border: none;
    color: var(--olive);
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }
  .btn-manage-addrs-link:hover {
    color: var(--olive-darker);
  }

  .loading-addrs-strip {
    font-size: 0.82rem;
    color: var(--muted);
    padding: 8px;
  }
  .no-addrs-notice {
    font-size: 0.82rem;
    color: var(--text-muted);
    background: #ffffff;
    border: 1px dashed var(--line-strong);
    padding: 12px 14px;
    border-radius: var(--radius-sm);
  }

  /* صف شرائح العناوين */
  .saved-addrs-chips-row {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }
  .saved-addr-chip {
    background: #ffffff;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius-sm);
    padding: 12px 14px;
    text-align: right;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
  }
  .saved-addr-chip:hover {
    border-color: var(--olive);
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.05);
    transform: translateY(-1px);
  }
  .saved-addr-chip.active {
    border-color: var(--olive);
    background: #f6f8ee;
    box-shadow: 0 4px 14px rgba(94, 107, 44, 0.15);
  }
  .sac-top {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .sac-icon {
    font-size: 1.1rem;
  }
  .sac-title {
    font-weight: 800;
    font-size: 0.88rem;
    color: var(--text);
  }
  .sac-def-badge {
    background: #fef3c7;
    color: #92400e;
    font-size: 0.65rem;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 10px;
    border: 1px solid #fde68a;
  }
  .sac-check {
    margin-right: auto;
    font-size: 0.72rem;
    font-weight: 800;
    color: #065f46;
    background: #d1fae5;
    padding: 2px 7px;
    border-radius: 10px;
  }
  .sac-check.custom {
    color: var(--olive);
    background: #f0fdf4;
  }
  .sac-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 2px;
  }
  .sac-zone {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--olive);
  }
  .sac-street {
    font-size: 0.74rem;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sac-recipient {
    margin-top: 4px;
    border-top: 1px dashed rgba(0,0,0,0.06);
    padding-top: 4px;
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .new-custom-chip {
    border-style: dashed;
    background: #fafafa;
    justify-content: center;
  }
  .new-custom-chip:hover {
    background: #ffffff;
  }

  /* تنبيه الزبون غير المسجل */
  .login-quick-prompt {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .lqp-icon {
    font-size: 1.3rem;
  }
  .lqp-text {
    flex: 1;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .lqp-text b {
    font-size: 0.88rem;
    color: #166534;
  }
  .lqp-text span {
    font-size: 0.78rem;
    color: #374151;
  }
  .lqp-btn {
    border-color: #166534;
    color: #166534;
    font-weight: 700;
    white-space: nowrap;
  }
  .lqp-btn:hover {
    background: #166534;
    color: #ffffff;
  }

  /* خيار حفظ العنوان */
  .save-addr-opt-wrap {
    background: #f8fafc;
    border: 1px solid var(--line-strong);
    padding: 14px 16px;
    border-radius: var(--radius-sm);
    margin-top: 8px;
  }
  .save-addr-checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: 700;
    font-size: 0.88rem;
    color: #065f46;
  }
  .save-addr-checkbox input {
    width: 17px;
    height: 17px;
    cursor: pointer;
    accent-color: var(--olive);
  }
  .new-addr-title-box {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed var(--line);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .new-addr-title-box label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--text-muted);
  }

  @media (max-width: 900px) {
    .cart-grid {
      grid-template-columns: 1fr;
    }
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

