<script>
  import { onMount, tick, onDestroy } from 'svelte';
  import { router } from '../stores/router.js';
  import { cart, cartSubtotal } from '../stores/cart.js';
  import { auth } from '../stores/auth.js';
  import { api } from '../lib/api.js';
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

  let isSubmitting = false;

  onMount(async () => {
    // ملء بيانات الزبون تلقائياً إذا كان مسجل دخول
    if ($auth) {
      orderForm.recipientName = $auth.full_name || '';
      orderForm.recipientPhone = $auth.phone || '';
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
      renderCustomerZoneCircles();
      updateCustomerZoneByCoords(customerLat, customerLng);
    } catch (e) {
      console.log('Using default delivery zones');
    } finally {
      loadingZones = false;
    }
  });

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });

  let customerZoneCircles = [];

  // معادلة هافيرسين لحساب المسافة الدقيقة بين نقطتين جغرافيتين بالأمتار
  function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // نصف قطر الأرض بالأمتار
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // رسم الدوائر والمربعات الجغرافية لكافة مناطق التوصيل على خريطة الزبون
  function renderCustomerZoneCircles() {
    if (!mapInstance || !deliveryZones || deliveryZones.length === 0) return;

    customerZoneCircles.forEach(c => mapInstance.removeLayer(c));
    customerZoneCircles = [];

    deliveryZones.forEach(z => {
      const lat = Number(z.center_lat);
      const lng = Number(z.center_lng);
      const radius = Number(z.radius_meters) || 3000;
      const color = z.zone_color || '#5e6b2c';

      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        let layer;
        if (z.shape_type === 'box') {
          const latDelta = radius / 111000;
          const lngDelta = radius / (111000 * Math.cos(lat * Math.PI / 180));
          layer = L.rectangle([[lat - latDelta, lng - lngDelta], [lat + latDelta, lng + lngDelta]], {
            color: color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.14,
            dashArray: '4, 4'
          });
        } else {
          layer = L.circle([lat, lng], {
            radius: radius,
            color: color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.14
          });
        }

        layer.addTo(mapInstance);
        layer.bindTooltip(`🌸 نطاق: <b>${z.zone_name}</b> (${z.delivery_fee} د.ل)`, {
          permanent: false,
          direction: 'center'
        });

        customerZoneCircles.push(layer);
      }
    });
  }

  // مطابقة إحداثيات موقع الزبون مع الدوائر الجغرافية واحتساب سعر التوصيل تلقائياً
  function updateCustomerZoneByCoords(lat, lng) {
    if (!deliveryZones || deliveryZones.length === 0) return;

    let matchedZones = [];
    let nearestZone = null;
    let minDistance = Infinity;

    for (const z of deliveryZones) {
      const zLat = Number(z.center_lat);
      const zLng = Number(z.center_lng);
      const radius = Number(z.radius_meters) || 3000;

      if (!isNaN(zLat) && !isNaN(zLng) && zLat !== 0 && zLng !== 0) {
        const dist = calculateDistanceMeters(lat, lng, zLat, zLng);
        if (dist < minDistance) {
          minDistance = dist;
          nearestZone = z;
        }

        let isInside = false;
        if (z.shape_type === 'box') {
          const latDelta = radius / 111000;
          const lngDelta = radius / (111000 * Math.cos(zLat * Math.PI / 180));
          if (lat >= zLat - latDelta && lat <= zLat + latDelta && lng >= zLng - lngDelta && lng <= zLng + lngDelta) {
            isInside = true;
          }
        } else {
          if (dist <= radius) {
            isInside = true;
          }
        }

        if (isInside) {
          matchedZones.push({ zone: z, distance: dist, radius: radius });
        }
      }
    }

    if (matchedZones.length > 0) {
      // اختيار الدائرة الأكثر دقة وتخصيصاً (الأصغر نصف قطر)
      matchedZones.sort((a, b) => a.radius - b.radius);
      const chosen = matchedZones[0].zone;
      selectedZone = chosen;
      orderForm.city = chosen.city || chosen.city_name || orderForm.city;
      locationStatus = `✅ تم التعرف على موقعك في دائرة: (${chosen.zone_name}) — رسوم التوصيل المعتمدة: ${chosen.delivery_fee} د.ل 🌸`;
    } else if (nearestZone) {
      selectedZone = nearestZone;
      locationStatus = `📍 الإحداثيات (${lat.toFixed(4)}, ${lng.toFixed(4)}) — تقع قرب نطاق (${nearestZone.zone_name}) بسعر: ${nearestZone.delivery_fee} د.ل`;
    } else {
      locationStatus = `تم اختيار الموقع: (${lat.toFixed(4)}, ${lng.toFixed(4)}) 📍`;
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
      "><span style="transform: rotate(45deg); font-size: 17px;">🌸</span></div>`,
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

    // رسم الدوائر الجغرافية ومطابقة الموقع
    renderCustomerZoneCircles();
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
        locationStatus = 'تعذر الوصول التلقائي للموقع، يمكنك النقر على الخريطة أو سحب الدبوس 🌸 لتحديده.';
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
      <h1 class="page-title">سلة المشتريات والدفع 🛍️</h1>
      <p class="page-subtitle">راجع طلبك، اختر منطقة التوصيل وكود الخصم، وأكّد وصول الباقة في موعدها.</p>
    </div>

    {#if $cart.length === 0}
      <div class="empty-cart-card">
        <span class="empty-icon">🌸</span>
        <h2>سلة المشتريات فارغة حالياً</h2>
        <p>لم تقم بإضافة أي باقة ورد بعد. تفضل بزيارة باقاتنا الجاهزة أو استوديو التصميم المخصص.</p>
        <div class="empty-actions">
          <button type="button" class="btn btn-primary" on:click={() => router.navigate('/')}>
            تصفح الباقات الجاهزة ←
          </button>
          <button type="button" class="btn btn-outline" on:click={() => router.navigate('/studio')}>
            صمم باقة في الاستوديو 💐
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
          <div class="card box-card">
            <h3>بيانات استلام الهدية 📍</h3>
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
                    <label class="map-label">📍 تحديد موقع الاستلام بدقة على الخريطة (GPS):</label>
                    <small class="map-desc">يتم تزويد السائق بهذه الإحداثيات لفتح مسار الملاحة المباشر عبر Google Maps</small>
                  </div>
                  <button 
                    type="button" 
                    class="btn-detect-gps" 
                    disabled={detectingLocation}
                    on:click={detectCustomerLocation}
                  >
                    {detectingLocation ? 'جاري الاتصال بالأقمار...' : '📍 موقعي الحالي (GPS)'}
                  </button>
                </div>

                {#if locationStatus}
                  <div class="location-status-bar" class:success={locationStatus.includes('✅')}>
                    {locationStatus}
                  </div>
                {/if}

                <div id="customer-map" class="customer-map-canvas"></div>

                <div class="coords-display-bar">
                  <span>الإحداثيات المعتمدة: <strong>{customerLat.toFixed(5)}° N, {customerLng.toFixed(5)}° E</strong></span>
                  <small>💡 يمكنك سحب الدبوس 🌸 أو النقر على الخريطة لضبط موقع التوصيل</small>
                </div>
              </div>

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
                  <span>🏷️ تم تفعيل كود: <b>{appliedCoupon.code}</b> (-{appliedCoupon.discountAmount} د.ل)</span>
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
              <span>🔒 ضمان سلامة ونضارة الورد</span>
              <span>🚚 توصيل مبرد في موعدك</span>
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

  @media (max-width: 900px) {
    .cart-grid {
      grid-template-columns: 1fr;
    }
    .form-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

