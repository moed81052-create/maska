<script>
  import { onMount } from 'svelte';
  import { router } from '../stores/router.js';
  import { auth, isAuthenticated } from '../stores/auth.js';
  import { api } from '../lib/api.js';

  let activeTab = 'orders'; // 'orders' | 'profile' | 'locations' | 'notifications'
  let ordersFilter = 'all'; // 'all' | 'active' | 'delivered'

  let loading = true;
  let savingProfile = false;
  let profileMessage = '';
  let profileMessageType = 'success'; // 'success' | 'error'

  let orders = [];
  let addresses = [];
  let notifications = [];

  // نموذج تعديل الملف الشخصي
  let fullName = '';
  let phone = '';
  let email = '';
  let newPassword = '';
  let confirmPassword = '';

  // نموذج إضافة موقع / عنوان جديد
  let showAddAddressModal = false;
  let savingAddress = false;
  let addressTitle = 'المنزل';
  let addrRecipientName = '';
  let addrRecipientPhone = '';
  let addrCity = 'طرابلس';
  let addrZone = '';
  let addrStreet = '';
  let addrLandmark = '';
  let addrLat = 32.8872;
  let addrLng = 13.1913;
  let addrIsDefault = true;
  let gpsDetecting = false;
  let gpsMessage = '';

  // حالة التقييم اللحظي للسائق
  let ratingOrder = null; // الطلب الجاري تقييمه
  let ratingDelivery = 5;
  let ratingFlowers = 5;
  let ratingComment = '';
  let submittingRating = false;
  let ratingSuccessOrderId = null;

  onMount(async () => {
    if (!$isAuthenticated || !$auth) {
      router.navigate('/login');
      return;
    }

    // تعبئة البيانات الأولية
    fullName = $auth.full_name || '';
    phone = $auth.phone || '';
    email = $auth.email || '';
    addrRecipientName = fullName;
    addrRecipientPhone = phone;

    await loadAllUserData();
  });

  async function loadAllUserData() {
    loading = true;
    try {
      const userId = $auth?.id;
      const userPhone = $auth?.phone;

      const [ordersRes, addrsRes, notifsRes] = await Promise.allSettled([
        api.getUserOrders(userId, userPhone),
        api.getUserAddresses(userId),
        api.getUserNotifications(userId, userPhone)
      ]);

      if (ordersRes.status === 'fulfilled' && ordersRes.value?.data) {
        orders = ordersRes.value.data;
      }
      if (addrsRes.status === 'fulfilled' && addrsRes.value?.data) {
        addresses = addrsRes.value.data;
      }
      if (notifsRes.status === 'fulfilled' && notifsRes.value?.data) {
        notifications = notifsRes.value.data;
      }
    } catch (e) {
      console.error('Error loading profile data:', e);
    } finally {
      loading = false;
    }
  }

  // --- 1. حفظ تعديلات الملف الشخصي ---
  async function handleSaveProfile(e) {
    e.preventDefault();
    profileMessage = '';

    if (!fullName.trim() || !phone.trim()) {
      profileMessage = 'الاسم الكامل ورقم الهاتف حقول مطلوبة';
      profileMessageType = 'error';
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      profileMessage = 'كلمات المرور الجديدة غير متطابقة';
      profileMessageType = 'error';
      return;
    }

    savingProfile = true;
    try {
      const res = await api.updateUserProfile({
        userId: $auth.id,
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        password: newPassword ? newPassword.trim() : undefined
      });

      if (res && res.success) {
        auth.updateUser({
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null
        });
        profileMessage = 'تم حفظ وتحديث بيانات حسابك بنجاح ✨';
        profileMessageType = 'success';
        newPassword = '';
        confirmPassword = '';
      }
    } catch (err) {
      profileMessage = err.message || 'حدث خطأ أثناء حفظ البيانات';
      profileMessageType = 'error';
    } finally {
      savingProfile = false;
    }
  }

  // --- 2. كشف الموقع الجغرافي بنقرة واحدة بالـ GPS ---
  function detectCurrentLocation() {
    if (!navigator.geolocation) {
      gpsMessage = 'المتصفح لا يدعم تحديد الموقع التلقائي';
      return;
    }

    gpsDetecting = true;
    gpsMessage = 'جاري الاتصال بالأقمار الاصطناعية وتحديد موقعك بدقة...';

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        addrLat = Number(pos.coords.latitude.toFixed(6));
        addrLng = Number(pos.coords.longitude.toFixed(6));
        gpsDetecting = false;
        gpsMessage = `تم تحديد إحداثيات موقعك بنجاح (${addrLat}, ${addrLng}) 📍`;
        
        // استنتاج المدينة إن أمكن
        if (Math.abs(addrLat - 32.88) < 0.3) addrCity = 'طرابلس';
        else if (Math.abs(addrLat - 32.08) < 0.3) addrCity = 'بنغازي';
        else if (Math.abs(addrLat - 32.37) < 0.3) addrCity = 'مصراتة';
      },
      (err) => {
        gpsDetecting = false;
        gpsMessage = 'تعذر التقاط الموقع تلقائياً. تأكد من تفعيل إذن الموقع في متصفحك.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // --- 3. إضافة عنوان جديد ---
  async function handleAddAddress(e) {
    e.preventDefault();
    if (!addrZone.trim() && !addrStreet.trim()) {
      alert('الرجاء كتابة اسم المنطقة أو الشارع');
      return;
    }

    savingAddress = true;
    try {
      const res = await api.addUserAddress({
        userId: $auth.id,
        title: addressTitle.trim() || 'عنوان جديد',
        recipientName: addrRecipientName.trim() || fullName,
        recipientPhone: addrRecipientPhone.trim() || phone,
        city: addrCity,
        zone: addrZone.trim() || 'المركز',
        street: addrStreet.trim(),
        landmark: addrLandmark.trim(),
        latitude: addrLat,
        longitude: addrLng,
        isDefault: addrIsDefault
      });

      if (res && res.success) {
        showAddAddressModal = false;
        gpsMessage = '';
        addrZone = '';
        addrStreet = '';
        addrLandmark = '';
        await loadAllUserData();
      }
    } catch (err) {
      alert(err.message || 'فشل حفظ العنوان');
    } finally {
      savingAddress = false;
    }
  }

  async function handleDeleteAddress(addrId) {
    if (!confirm('هل أنت متأكد من حذف هذا العنوان المحفوظ؟')) return;
    try {
      await api.deleteUserAddress(addrId, $auth.id);
      addresses = addresses.filter(a => a.id !== addrId);
    } catch (err) {
      alert(err.message || 'فشل حذف العنوان');
    }
  }

  // --- 4. تقييم السائق والخدمة ---
  function openRatingModal(order) {
    ratingOrder = order;
    ratingDelivery = 5;
    ratingFlowers = 5;
    ratingComment = '';
  }

  async function submitDriverRating() {
    if (!ratingOrder) return;
    submittingRating = true;
    try {
      const res = await api.rateDriver({
        orderId: ratingOrder.id,
        orderNumber: ratingOrder.order_number,
        customerId: $auth.id,
        customerName: $auth.full_name,
        ratingDelivery: Number(ratingDelivery),
        ratingFlowers: Number(ratingFlowers),
        comment: ratingComment.trim()
      });

      if (res && res.success) {
        ratingSuccessOrderId = ratingOrder.id;
        // تحديث الطلب محلياً ليظهر التقييم فوراً
        orders = orders.map(o => {
          if (o.id === ratingOrder.id) {
            return {
              ...o,
              review_id: res.data?.reviewId || 'rev-done',
              rating_delivery: ratingDelivery,
              rating_overall: res.data?.rating || ratingDelivery,
              review_comment: ratingComment.trim()
            };
          }
          return o;
        });

        setTimeout(() => {
          ratingOrder = null;
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'حدث خطأ أثناء إرسال التقييم');
    } finally {
      submittingRating = false;
    }
  }

  // تصفية الطلبات المعروضة
  $: filteredOrders = orders.filter(o => {
    if (ordersFilter === 'active') {
      return ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(o.status);
    }
    if (ordersFilter === 'delivered') {
      return o.status === 'delivered';
    }
    return true;
  });

  function getStatusBadge(status) {
    switch (status) {
      case 'confirmed':
        return { text: 'تم التأكيد 🌸', class: 'status-confirmed' };
      case 'preparing':
        return { text: 'جاري التنسيق في الأتيليه ✂️', class: 'status-preparing' };
      case 'out_for_delivery':
        return { text: 'في الطريق للتوصيل 🚗', class: 'status-delivery' };
      case 'delivered':
        return { text: 'تم التسليم بنجاح ✓', class: 'status-delivered' };
      case 'cancelled':
        return { text: 'ملغي', class: 'status-cancelled' };
      default:
        return { text: 'قيد المراجعة ⏳', class: 'status-pending' };
    }
  }
</script>

<div class="profile-page fade-in">
  <div class="container">
    
    <!-- 1. ترويسة الحساب الشخصي الفاخرة (Account Profile Hero) -->
    <header class="profile-hero card">
      <div class="hero-main-content">
        <div class="avatar-box">
          <div class="avatar-circle">
            {#if $auth?.full_name}
              <span class="avatar-initials">{$auth.full_name.charAt(0)}</span>
            {:else}
              <span class="avatar-initials">🌸</span>
            {/if}
          </div>
          <span class="online-indicator" title="متصل"></span>
        </div>

        <div class="user-intro">
          <div class="user-name-row">
            <h1 class="user-title">{$auth?.full_name || 'عميل مسكة'}</h1>
            <span class="vip-badge">عضو مميز 🌸</span>
          </div>
          <p class="user-contact-text">
            <span>📞 {$auth?.phone || 'غير محدد'}</span>
            {#if $auth?.email}
              <span>• ✉️ {$auth.email}</span>
            {/if}
            <span>• 📍 ليبيا</span>
          </p>
        </div>
      </div>

      <!-- إحصائيات سريعة للحساب -->
      <div class="user-quick-stats">
        <div class="stat-pill" on:click={() => activeTab = 'orders'}>
          <span class="stat-num">{orders.length}</span>
          <span class="stat-label">إجمالي الطلبات</span>
        </div>
        <div class="stat-pill" on:click={() => { activeTab = 'orders'; ordersFilter = 'active'; }}>
          <span class="stat-num active-highlight">
            {orders.filter(o => ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status)).length}
          </span>
          <span class="stat-label">طلبات نشطة</span>
        </div>
        <div class="stat-pill" on:click={() => activeTab = 'locations'}>
          <span class="stat-num">{addresses.length}</span>
          <span class="stat-label">عناوين محفوظة</span>
        </div>
      </div>
    </header>

    <!-- 2. أزرار تبويبات الحساب الشخصي (Profile Tab Navigation) -->
    <nav class="profile-tabs-nav">
      <button 
        type="button" 
        class="tab-btn" 
        class:active={activeTab === 'orders'}
        on:click={() => activeTab = 'orders'}
      >
        <span class="tab-icon">📦</span>
        <span class="tab-text">طلباتي وين ({orders.length})</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        class:active={activeTab === 'profile'}
        on:click={() => activeTab = 'profile'}
      >
        <span class="tab-icon">👤</span>
        <span class="tab-text">بياناتي الشخصية</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        class:active={activeTab === 'locations'}
        on:click={() => activeTab = 'locations'}
      >
        <span class="tab-icon">📍</span>
        <span class="tab-text">موقعي وعناويني ({addresses.length})</span>
      </button>

      <button 
        type="button" 
        class="tab-btn" 
        class:active={activeTab === 'notifications'}
        on:click={() => activeTab = 'notifications'}
      >
        <span class="tab-icon">🔔</span>
        <span class="tab-text">الإشعارات ({notifications.filter(n => !n.is_read).length})</span>
      </button>
    </nav>

    <!-- 3. محتوى التبويبات -->
    <div class="tab-content-wrapper">

      <!-- ===================================================================== -->
      <!-- التبويب 1: طلباتي وتتبعها ومسار السائق والتقييم ("طلباتي وين") -->
      <!-- ===================================================================== -->
      {#if activeTab === 'orders'}
        <div class="orders-tab-view fade-in">
          
          <div class="tab-subhead">
            <div>
              <h2 class="section-heading">قائمة طلباتي ومتابعة التوصيل</h2>
              <p class="section-subtext">تتبع مسار باقتك لحظة بلحظة بالـ GPS، وتعرف على الكابتن وقيّم تجربتك بعد الاستلام.</p>
            </div>

            <!-- أزرار التصفية -->
            <div class="orders-filter-pills">
              <button 
                type="button" 
                class="filter-pill" 
                class:active={ordersFilter === 'all'}
                on:click={() => ordersFilter = 'all'}
              >
                الكل ({orders.length})
              </button>
              <button 
                type="button" 
                class="filter-pill" 
                class:active={ordersFilter === 'active'}
                on:click={() => ordersFilter = 'active'}
              >
                قيد التجهيز والتوصيل ({orders.filter(o => ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status)).length})
              </button>
              <button 
                type="button" 
                class="filter-pill" 
                class:active={ordersFilter === 'delivered'}
                on:click={() => ordersFilter = 'delivered'}
              >
                مكتملة ({orders.filter(o => o.status === 'delivered').length})
              </button>
            </div>
          </div>

          {#if loading}
            <div class="card empty-orders-box">
              <span class="loading-spinner">🌸</span>
              <p>جاري تحميل طلباتك وتتبع مسارها المباشر...</p>
            </div>
          {:else if filteredOrders.length === 0}
            <div class="card empty-orders-box">
              <span class="empty-icon">💐</span>
              <h3>لا توجد طلبات في هذا القسم</h3>
              <p>لم تقم بطلب أي باقة بعد، أو لا توجد طلبات نشطة حالياً.</p>
              <button type="button" class="btn btn-primary" on:click={() => router.navigate('/studio')}>
                صمم باقتك الأولى في الاستوديو 🌸
              </button>
            </div>
          {:else}
            <div class="orders-list-grid">
              {#each filteredOrders as order (order.id || order.order_number)}
                {@const badge = getStatusBadge(order.status)}
                <div class="card order-card" class:is-out-delivery={order.status === 'out_for_delivery'}>
                  
                  <!-- ترويسة كرت الطلب -->
                  <div class="order-card-header">
                    <div>
                      <div class="order-num-row">
                        <span class="order-id-tag">طلب #{order.order_number}</span>
                        <span class="badge {badge.class}">{badge.text}</span>
                      </div>
                      <span class="order-time-text">
                        📅 {order.created_at ? new Date(order.created_at).toLocaleDateString('ar-LY', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'اليوم'}
                      </span>
                    </div>

                    <div class="order-price-badge">
                      <span class="total-label">الإجمالي</span>
                      <b class="total-val">{order.total_amount} د.ل</b>
                    </div>
                  </div>

                  <!-- شريط تنبيه إذا كان الطلب في الطريق الآن -->
                  {#if order.status === 'out_for_delivery'}
                    <div class="live-transit-banner">
                      <span class="pulse-beacon"></span>
                      <div>
                        <b>الكابتن في الطريق لتسليم باقتك الآن!</b>
                        <span>سيارة مبردة ومجهزة للحفاظ على نضارة الزهور.</span>
                      </div>
                      <button 
                        type="button" 
                        class="btn btn-sm btn-gps-live"
                        on:click={() => router.navigate('/track', { order: order.order_number })}
                      >
                        خريطة الـ GPS المباشرة 📍
                      </button>
                    </div>
                  {/if}

                  <!-- تفاصيل الباقات المندرجة في الطلب -->
                  <div class="order-items-preview">
                    {#if order.items && order.items.length > 0}
                      <div class="items-thumbnails">
                        {#each order.items as item}
                          <div class="item-thumb-chip">
                            <span class="item-name">
                              {item.item_title || 'باقة مسكة'}
                              {#if item.quantity > 1}
                                <small>({item.quantity}x)</small>
                              {/if}
                            </span>
                            <span class="item-cost">{item.total_price} د.ل</span>
                          </div>
                        {/each}
                      </div>
                    {:else}
                      <span class="single-item-note">باقة زهور طبيعية منسقة</span>
                    {/if}
                  </div>

                  <!-- تفاصيل عنوان وموقع التسليم -->
                  <div class="order-location-strip">
                    <span class="loc-pin">📍</span>
                    <span class="loc-text">
                      {order.delivery_city || 'طرابلس'} - {order.delivery_zone || 'المركز'} {order.delivery_address_details ? `(${order.delivery_address_details})` : ''}
                    </span>
                  </div>

                  <!-- معلومات كابتن التوصيل المعين للطلب -->
                  {#if order.driver_name || order.assigned_driver_id}
                    <div class="driver-info-box">
                      <div class="driver-avatar-col">
                        <span class="driver-avatar-icon">🚗</span>
                      </div>
                      <div class="driver-meta-col">
                        <div class="driver-name-row">
                          <span class="driver-role-tag">كابتن التوصيل:</span>
                          <b class="driver-name">{order.driver_name}</b>
                          {#if order.driver_rating}
                            <span class="driver-rating-badge">⭐ {order.driver_rating}</span>
                          {/if}
                        </div>
                        <span class="vehicle-details">
                          {order.driver_vehicle || 'سيارة هيونداي تبريد'} {order.driver_plate ? `• لوحة: ${order.driver_plate}` : ''}
                        </span>
                      </div>

                      {#if order.driver_phone}
                        <a href="tel:{order.driver_phone}" class="btn btn-outline btn-sm call-driver-btn">
                          📞 اتصال
                        </a>
                      {/if}
                    </div>
                  {/if}

                  <!-- قسم تقييم السائق والخدمة للطلبات المسلّمة -->
                  {#if order.status === 'delivered'}
                    <div class="driver-rating-section">
                      {#if order.review_id}
                        <div class="review-completed-banner">
                          <span class="check-icon">✓</span>
                          <div>
                            <b>تم تقييم الكابتن والخدمة بنجاح</b>
                            <span class="stars-display">{'★'.repeat(order.rating_delivery || 5)} ({order.rating_delivery || 5}/5)</span>
                            {#if order.review_comment}
                              <p class="user-comment-preview">"{order.review_comment}"</p>
                            {/if}
                          </div>
                        </div>
                      {:else}
                        <div class="review-prompt-box">
                          <div class="prompt-text">
                            <b>كيف كانت معاملة وسرعة الكابتن؟</b>
                            <span>رأيك يساعدنا في مكافأة السائقين المتميزين وتطوير الأسطول.</span>
                          </div>
                          <button 
                            type="button" 
                            class="btn btn-sm btn-gold-rate"
                            on:click={() => openRatingModal(order)}
                          >
                            ⭐ تقييم السائق الآن
                          </button>
                        </div>
                      {/if}
                    </div>
                  {/if}

                  <!-- أزرار الإجراءات السريعة على الطلب -->
                  <div class="order-card-actions">
                    <button 
                      type="button" 
                      class="btn btn-outline btn-sm"
                      on:click={() => router.navigate('/track', { order: order.order_number })}
                    >
                      تتبع مسار الطلب بالـ GPS 🛰️
                    </button>

                    <button 
                      type="button" 
                      class="btn btn-text btn-sm"
                      on:click={() => router.navigate('/track', { order: order.order_number })}
                    >
                      تفاصيل الفاتورة 📄
                    </button>
                  </div>

                </div>
              {/each}
            </div>
          {/if}

        </div>
      {/if}

      <!-- ===================================================================== -->
      <!-- التبويب 2: بياناتي الشخصية وتعديلها -->
      <!-- ===================================================================== -->
      {#if activeTab === 'profile'}
        <div class="profile-tab-view fade-in">
          <div class="tab-subhead">
            <div>
              <h2 class="section-heading">بياناتي الشخصية وحسابي</h2>
              <p class="section-subtext">تحديث اسمك ورقم هاتفك وبيانات الدخول لسهولة التواصل وسرعة إتمام الطلبات.</p>
            </div>
          </div>

          <div class="card profile-form-card">
            {#if profileMessage}
              <div class="alert-box" class:success={profileMessageType === 'success'} class:error={profileMessageType === 'error'}>
                <span>{profileMessage}</span>
              </div>
            {/if}

            <form on:submit={handleSaveProfile} class="profile-edit-form">
              <div class="form-grid">
                
                <div class="form-group">
                  <label for="prof-name">الاسم الكامل *</label>
                  <input 
                    type="text" 
                    id="prof-name" 
                    class="input-field" 
                    placeholder="مثال: محمد العماري" 
                    bind:value={fullName} 
                    required 
                  />
                </div>

                <div class="form-group">
                  <label for="prof-phone">رقم الهاتف (الأساسي لتسليم الطلبات) *</label>
                  <input 
                    type="tel" 
                    id="prof-phone" 
                    class="input-field ltr" 
                    placeholder="091XXXXXXX" 
                    bind:value={phone} 
                    required 
                  />
                  <small class="field-hint">يستخدمه كابتن التوصيل للتنسيق المباشر عند الوصول.</small>
                </div>

                <div class="form-group full-width">
                  <label for="prof-email">البريد الإلكتروني (اختياري)</label>
                  <input 
                    type="email" 
                    id="prof-email" 
                    class="input-field ltr" 
                    placeholder="name@example.com" 
                    bind:value={email} 
                  />
                  <small class="field-hint">لاستلام الفواتير الإلكترونية والعروض الحصرية.</small>
                </div>

                <div class="form-divider full-width">
                  <span>تغيير كلمة المرور (اتركها فارغة إذا لا ترغب بالتغيير)</span>
                </div>

                <div class="form-group">
                  <label for="prof-pass">كلمة المرور الجديدة</label>
                  <input 
                    type="password" 
                    id="prof-pass" 
                    class="input-field ltr" 
                    placeholder="••••••••" 
                    bind:value={newPassword} 
                  />
                </div>

                <div class="form-group">
                  <label for="prof-confirm">تأكيد كلمة المرور الجديدة</label>
                  <input 
                    type="password" 
                    id="prof-confirm" 
                    class="input-field ltr" 
                    placeholder="••••••••" 
                    bind:value={confirmPassword} 
                  />
                </div>

              </div>

              <div class="form-actions-bar">
                <button type="submit" class="btn btn-primary btn-save" disabled={savingProfile}>
                  {savingProfile ? 'جاري الحفظ...' : 'حفظ التعديلات ✨'}
                </button>
              </div>
            </form>
          </div>
        </div>
      {/if}

      <!-- ===================================================================== -->
      <!-- التبويب 3: موقعي وعناويني المحفوظة بالـ GPS -->
      <!-- ===================================================================== -->
      {#if activeTab === 'locations'}
        <div class="locations-tab-view fade-in">
          <div class="tab-subhead">
            <div>
              <h2 class="section-heading">عناويني ومواقع التوصيل المحفوظة</h2>
              <p class="section-subtext">احفظ مواقعك المفضلة (المنزل، العمل، عنوان الهدية) مع تحديد دقيق بالـ GPS لسرعة وصول السائق.</p>
            </div>

            <button 
              type="button" 
              class="btn btn-primary"
              on:click={() => { showAddAddressModal = true; detectCurrentLocation(); }}
            >
              ➕ إضافة عنوان جديد
            </button>
          </div>

          {#if addresses.length === 0}
            <div class="card empty-locations-box">
              <span class="empty-icon">📍</span>
              <h3>لا توجد مواقع محفوظة حتى الآن</h3>
              <p>أضف موقعك الحالي لتسهيل إرسال باقات الورد إليك أو لأحبائك دون الحاجة لإعادة كتابة العنوان في كل مرة.</p>
              <button 
                type="button" 
                class="btn btn-primary"
                on:click={() => { showAddAddressModal = true; detectCurrentLocation(); }}
              >
                تحديد وحفظ موقعي الحالي بالـ GPS 🛰️
              </button>
            </div>
          {:else}
            <div class="addresses-grid">
              {#each addresses as addr (addr.id)}
                <div class="card address-card" class:is-default={addr.is_default}>
                  <div class="addr-card-top">
                    <div class="addr-title-row">
                      <span class="addr-icon">📍</span>
                      <h3 class="addr-title">{addr.title || 'عنوان التوصيل'}</h3>
                      {#if addr.is_default}
                        <span class="default-pill">الافتراضي</span>
                      {/if}
                    </div>

                    <button 
                      type="button" 
                      class="del-addr-btn" 
                      title="حذف هذا العنوان"
                      on:click={() => handleDeleteAddress(addr.id)}
                    >
                      🗑️
                    </button>
                  </div>

                  <div class="addr-details">
                    <div class="detail-row">
                      <span class="detail-lbl">المستلم:</span>
                      <span class="detail-val">{addr.recipient_name} ({addr.recipient_phone})</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-lbl">المدينة والمنطقة:</span>
                      <span class="detail-val">{addr.city} - {addr.zone}</span>
                    </div>
                    {#if addr.street || addr.landmark}
                      <div class="detail-row">
                        <span class="detail-lbl">تفاصيل العنوان:</span>
                        <span class="detail-val">{addr.street} {addr.landmark ? `(أقرب نقطة دالة: ${addr.landmark})` : ''}</span>
                      </div>
                    {/if}
                    <div class="detail-row">
                      <span class="detail-lbl">إحداثيات الـ GPS:</span>
                      <span class="detail-val ltr">{addr.latitude}, {addr.longitude}</span>
                    </div>
                  </div>

                  <div class="addr-card-actions">
                    <a 
                      href={addr.google_maps_url || `https://www.google.com/maps?q=${addr.latitude},${addr.longitude}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      class="btn btn-outline btn-sm btn-map"
                    >
                      فتح على خرائط Google 🗺️
                    </a>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <!-- ===================================================================== -->
      <!-- التبويب 4: الإشعارات والتنبيهات اللحظية -->
      <!-- ===================================================================== -->
      {#if activeTab === 'notifications'}
        <div class="notifications-tab-view fade-in">
          <div class="tab-subhead">
            <div>
              <h2 class="section-heading">الإشعارات وتنبيهات الطلبات</h2>
              <p class="section-subtext">تحديثات فورية حول حالة باقاتك، خروج السائق للتوصيل، وأحدث العروض الملكية.</p>
            </div>
          </div>

          <div class="notifications-list card">
            {#if notifications.length === 0}
              <div class="empty-notifs">
                <span>🔔</span>
                <p>لا توجد إشعارات جديدة حالياً</p>
              </div>
            {:else}
              {#each notifications as notif (notif.id)}
                <div class="notification-item" class:unread={!notif.is_read}>
                  <div class="notif-icon-col">
                    {#if notif.type === 'delivery'}
                      <span class="notif-bubble icon-delivery">🚗</span>
                    {:else if notif.type === 'order'}
                      <span class="notif-bubble icon-order">✂️</span>
                    {:else if notif.type === 'review'}
                      <span class="notif-bubble icon-review">⭐</span>
                    {:else}
                      <span class="notif-bubble icon-promo">🌸</span>
                    {/if}
                  </div>

                  <div class="notif-body-col">
                    <div class="notif-title-row">
                      <h4 class="notif-title">{notif.title}</h4>
                      <span class="notif-time">{notif.time || 'مؤخراً'}</span>
                    </div>
                    <p class="notif-msg">{notif.message}</p>
                    {#if notif.orderNumber}
                      <button 
                        type="button" 
                        class="btn-track-jump"
                        on:click={() => router.navigate('/track', { order: notif.orderNumber })}
                      >
                        متابعة مسار الطلب #{notif.orderNumber} ←
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/if}

    </div>

  </div>
</div>

<!-- ========================================================================= -->
<!-- Modal 1: نافذة تقييم السائق والخدمة (Driver Rating Modal) -->
<!-- ========================================================================= -->
{#if ratingOrder}
  <div class="modal-backdrop fade-in" on:click|self={() => ratingOrder = null}>
    <div class="card modal-card rating-modal-card slide-up">
      <div class="modal-header">
        <div>
          <span class="badge badge-gold">تقييم تجربة التوصيل</span>
          <h3>تقييم الكابتن {ratingOrder.driver_name || 'مسكة'}</h3>
          <p class="modal-sub">للطلب رقم #{ratingOrder.order_number}</p>
        </div>
        <button type="button" class="close-modal-btn" on:click={() => ratingOrder = null}>✕</button>
      </div>

      {#if ratingSuccessOrderId === ratingOrder.id}
        <div class="rating-success-box fade-in">
          <span class="success-icon">🎉</span>
          <h4>شكراً جزيلاً لتقييمك!</h4>
          <p>تم تسجيل تقييمك ورأيك بنجاح. يسعدنا دائماً تقديم أفضل خدمة توصيل في ليبيا.</p>
        </div>
      {:else}
        <div class="modal-body">
          <!-- تقييم السائق والتوصيل -->
          <div class="star-group-box">
            <label class="star-label">تقييم سرعة التوصيل وحسن معاملة الكابتن:</label>
            <div class="stars-picker">
              {#each [1, 2, 3, 4, 5] as star}
                <button 
                  type="button" 
                  class="star-btn" 
                  class:active={star <= ratingDelivery}
                  on:click={() => ratingDelivery = star}
                >
                  ★
                </button>
              {/each}
              <span class="star-count-text">({ratingDelivery} من 5 نجوم)</span>
            </div>
          </div>

          <!-- تقييم نضارة وجمال الزهور -->
          <div class="star-group-box">
            <label class="star-label">تقييم نضارة وتغليف باقة الورد:</label>
            <div class="stars-picker">
              {#each [1, 2, 3, 4, 5] as star}
                <button 
                  type="button" 
                  class="star-btn" 
                  class:active={star <= ratingFlowers}
                  on:click={() => ratingFlowers = star}
                >
                  ★
                </button>
              {/each}
              <span class="star-count-text">({ratingFlowers} من 5 نجوم)</span>
            </div>
          </div>

          <!-- التعليق والملاحظات -->
          <div class="form-group">
            <label for="rating-comm">ملاحظاتك الإضافية للكابتن والفريق (اختياري):</label>
            <textarea 
              id="rating-comm" 
              class="input-field" 
              rows="3" 
              placeholder="اكتب كلمة طيبة للكابتن أو أي ملاحظة تود مشاركتها معنا..." 
              bind:value={ratingComment}
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline" on:click={() => ratingOrder = null}>إلغاء</button>
          <button 
            type="button" 
            class="btn btn-primary" 
            disabled={submittingRating}
            on:click={submitDriverRating}
          >
            {submittingRating ? 'جاري الإرسال...' : 'إرسال التقييم للكابتن ⭐'}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ========================================================================= -->
<!-- Modal 2: نافذة إضافة موقع وعنوان جديد مع GPS -->
<!-- ========================================================================= -->
{#if showAddAddressModal}
  <div class="modal-backdrop fade-in" on:click|self={() => showAddAddressModal = false}>
    <div class="card modal-card address-modal-card slide-up">
      <div class="modal-header">
        <div>
          <span class="badge badge-lime">إحداثيات وموقع التوصيل</span>
          <h3>إضافة موقع توصيل جديد</h3>
        </div>
        <button type="button" class="close-modal-btn" on:click={() => showAddAddressModal = false}>✕</button>
      </div>

      <form on:submit={handleAddAddress} class="modal-body">
        
        <!-- زر الكشف بالـ GPS -->
        <div class="gps-detect-banner">
          <div>
            <b>تحديد الموقع التلقائي بالـ GPS</b>
            <span>التقاط إحداثيات موقعك الحالي بدقة عبر الأقمار الاصطناعية.</span>
          </div>
          <button 
            type="button" 
            class="btn btn-sm btn-gps-detect" 
            disabled={gpsDetecting}
            on:click={detectCurrentLocation}
          >
            {gpsDetecting ? 'جاري الالتقاط...' : 'التقاط موقعي الآن 🛰️'}
          </button>
        </div>

        {#if gpsMessage}
          <div class="gps-status-pill">{gpsMessage}</div>
        {/if}

        <div class="form-grid">
          <div class="form-group">
            <label for="addr-t">تسمية العنوان *</label>
            <input type="text" id="addr-t" class="input-field" placeholder="مثال: المنزل، المكتب، فيلا الوالدة" bind:value={addressTitle} required />
          </div>

          <div class="form-group">
            <label for="addr-city">المدينة *</label>
            <select id="addr-city" class="input-field" bind:value={addrCity}>
              <option value="طرابلس">طرابلس</option>
              <option value="بنغازي">بنغازي</option>
              <option value="مصراتة">مصراتة</option>
              <option value="الزاوية">الزاوية</option>
              <option value="زليتن">زليتن</option>
              <option value="الخمس">الخمس</option>
            </select>
          </div>

          <div class="form-group">
            <label for="addr-zone">المنطقة / الحي *</label>
            <input type="text" id="addr-zone" class="input-field" placeholder="مثال: النوفليين، بن عاشور، السياحية" bind:value={addrZone} required />
          </div>

          <div class="form-group">
            <label for="addr-street">الشارع أو العنوان التفصيلي</label>
            <input type="text" id="addr-street" class="input-field" placeholder="اسم الشارع أو رقم العمارة" bind:value={addrStreet} />
          </div>

          <div class="form-group full-width">
            <label for="addr-mark">أقرب نقطة دالة (Landmark)</label>
            <input type="text" id="addr-mark" class="input-field" placeholder="مثال: بالقرب من مسجد القدس، خلف مدرسة..." bind:value={addrLandmark} />
          </div>

          <div class="form-group">
            <label for="addr-lat">خط العرض (Latitude)</label>
            <input type="number" step="any" id="addr-lat" class="input-field ltr" bind:value={addrLat} />
          </div>

          <div class="form-group">
            <label for="addr-lng">خط الطول (Longitude)</label>
            <input type="number" step="any" id="addr-lng" class="input-field ltr" bind:value={addrLng} />
          </div>

          <div class="form-group full-width checkbox-row">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={addrIsDefault} />
              <span>تعيين كعنوان توصيل افتراضي لحسابي</span>
            </label>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline" on:click={() => showAddAddressModal = false}>إلغاء</button>
          <button type="submit" class="btn btn-primary" disabled={savingAddress}>
            {savingAddress ? 'جاري الحفظ...' : 'حفظ الموقع والعنوان 📍'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .profile-page {
    padding: 32px 0 60px;
    min-height: 80vh;
  }

  /* 1. ترويسة الحساب الشخصي */
  .profile-hero {
    background: linear-gradient(135deg, var(--card) 0%, rgba(94, 107, 44, 0.08) 100%);
    border: 1.5px solid var(--line-strong);
    padding: 24px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 24px;
    border-radius: var(--radius-lg);
  }
  .hero-main-content {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .avatar-box {
    position: relative;
  }
  .avatar-circle {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: var(--olive);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    font-weight: 800;
    box-shadow: 0 8px 20px rgba(94, 107, 44, 0.28);
    border: 3px solid var(--card);
  }
  .online-indicator {
    position: absolute;
    bottom: 2px;
    left: 4px;
    width: 14px;
    height: 14px;
    background: #10b981;
    border-radius: 50%;
    border: 2px solid var(--card);
  }
  .user-intro {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .user-name-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .user-title {
    font-size: 1.5rem;
    font-weight: 800;
    margin: 0;
    color: var(--text);
  }
  .vip-badge {
    background: linear-gradient(90deg, #d4af37, #f3e5ab);
    color: #4a3500;
    font-size: 0.72rem;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: var(--radius-full);
    box-shadow: 0 2px 6px rgba(212, 175, 55, 0.3);
  }
  .user-contact-text {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .user-quick-stats {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .stat-pill {
    background: var(--card);
    border: 1px solid var(--line);
    padding: 10px 18px;
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.2s;
  }
  .stat-pill:hover {
    border-color: var(--olive);
    transform: translateY(-2px);
  }
  .stat-num {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--text);
  }
  .stat-num.active-highlight {
    color: var(--olive);
  }
  .stat-label {
    font-size: 0.72rem;
    color: var(--text-muted);
    font-weight: 600;
  }

  /* 2. شريط التبويبات */
  .profile-tabs-nav {
    display: flex;
    gap: 10px;
    margin-bottom: 24px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .tab-btn {
    background: var(--card);
    border: 1.5px solid var(--line);
    color: var(--text);
    padding: 12px 22px;
    border-radius: var(--radius-full);
    font-weight: 700;
    font-size: 0.92rem;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  .tab-btn:hover {
    border-color: var(--olive);
    color: var(--olive);
  }
  .tab-btn.active {
    background: var(--olive);
    border-color: var(--olive);
    color: #ffffff;
    box-shadow: 0 4px 14px rgba(94, 107, 44, 0.25);
  }

  /* 3. العناوين الفرعية */
  .tab-subhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .section-heading {
    font-size: 1.25rem;
    font-weight: 800;
    margin: 0 0 4px;
  }
  .section-subtext {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 0;
  }

  /* تصفية الطلبات */
  .orders-filter-pills {
    display: flex;
    gap: 6px;
  }
  .filter-pill {
    background: var(--card);
    border: 1px solid var(--line);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
  }
  .filter-pill.active {
    background: var(--text);
    color: var(--bg);
    border-color: var(--text);
  }

  /* قائمة الطلبات */
  .orders-list-grid {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .order-card {
    border: 1.5px solid var(--line);
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    transition: all 0.25s ease;
  }
  .order-card.is-out-delivery {
    border-color: var(--olive);
    box-shadow: 0 6px 24px rgba(94, 107, 44, 0.14);
  }
  .order-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    border-bottom: 1px dashed var(--line);
    padding-bottom: 12px;
  }
  .order-num-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }
  .order-id-tag {
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--text);
  }
  .order-time-text {
    font-size: 0.78rem;
    color: var(--text-muted);
  }
  .order-price-badge {
    text-align: left;
  }
  .total-label {
    display: block;
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .total-val {
    font-size: 1.25rem;
    font-weight: 800;
    color: var(--price);
  }

  /* شريط التوصيل المباشر */
  .live-transit-banner {
    background: linear-gradient(90deg, rgba(94, 107, 44, 0.12), rgba(16, 185, 129, 0.12));
    border: 1px solid var(--olive);
    padding: 12px 18px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .pulse-beacon {
    width: 14px;
    height: 14px;
    background: #10b981;
    border-radius: 50%;
    animation: beaconPulse 1.8s infinite;
  }
  @keyframes beaconPulse {
    0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
    70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
    100% { transform: scale(0.9); }
  }
  .live-transit-banner div {
    flex: 1;
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
  }
  .btn-gps-live {
    background: var(--olive);
    color: #ffffff;
    font-weight: 700;
  }

  /* عناصر الطلب */
  .items-thumbnails {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .item-thumb-chip {
    background: var(--bg);
    border: 1px solid var(--line);
    padding: 5px 12px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .item-cost {
    font-weight: 700;
    color: var(--olive);
  }

  /* شريط موقع التسليم */
  .order-location-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.84rem;
    color: var(--text-muted);
  }

  /* صندوق كابتن التوصيل */
  .driver-info-box {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    padding: 12px 16px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .driver-avatar-icon {
    font-size: 1.5rem;
  }
  .driver-meta-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .driver-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.88rem;
  }
  .driver-role-tag {
    color: var(--text-muted);
    font-size: 0.78rem;
  }
  .driver-rating-badge {
    background: #fef3c7;
    color: #92400e;
    font-size: 0.72rem;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
  }
  .vehicle-details {
    font-size: 0.76rem;
    color: var(--text-muted);
  }

  /* قسم تقييم السائق */
  .driver-rating-section {
    margin-top: 4px;
  }
  .review-completed-banner {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.3);
    padding: 10px 16px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.84rem;
  }
  .review-completed-banner .check-icon {
    color: #10b981;
    font-weight: 900;
    font-size: 1.1rem;
  }
  .stars-display {
    color: #f59e0b;
    font-weight: 700;
    margin-right: 8px;
  }
  .user-comment-preview {
    margin: 4px 0 0;
    font-style: italic;
    color: var(--text-muted);
  }
  .review-prompt-box {
    background: rgba(212, 175, 55, 0.08);
    border: 1px dashed #d4af37;
    padding: 12px 18px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }
  .prompt-text {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
  }
  .prompt-text span {
    font-size: 0.76rem;
    color: var(--text-muted);
  }
  .btn-gold-rate {
    background: linear-gradient(135deg, #d4af37, #b8860b);
    color: #ffffff;
    font-weight: 800;
    border: none;
  }

  /* أزرار أسفل كرت الطلب */
  .order-card-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-top: 1px dashed var(--line);
    padding-top: 12px;
    margin-top: 4px;
  }

  /* شارات الحالة */
  .badge.status-confirmed { background: #e0f2fe; color: #0369a1; }
  .badge.status-preparing { background: #fef3c7; color: #92400e; }
  .badge.status-delivery { background: #dcfce7; color: #15803d; }
  .badge.status-delivered { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
  .badge.status-cancelled { background: #fee2e2; color: #991b1b; }
  .badge.status-pending { background: #f3f4f6; color: #4b5563; }

  /* صندوق الطلبات الفارغ */
  .empty-orders-box, .empty-locations-box {
    text-align: center;
    padding: 60px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .empty-icon {
    font-size: 3rem;
  }

  /* نموذج الملف الشخصي */
  .profile-form-card {
    max-width: 760px;
    padding: 28px 32px;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  .form-group.full-width, .form-divider.full-width {
    grid-column: 1 / -1;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .form-group label {
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--text);
  }
  .field-hint {
    font-size: 0.74rem;
    color: var(--text-muted);
  }
  .form-divider {
    border-top: 1px dashed var(--line);
    margin: 12px 0 4px;
    padding-top: 14px;
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: 700;
  }
  .form-actions-bar {
    margin-top: 24px;
    display: flex;
    justify-content: flex-end;
  }
  .btn-save {
    padding: 12px 32px;
    font-size: 0.95rem;
    font-weight: 800;
  }
  .alert-box {
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    margin-bottom: 20px;
    font-size: 0.88rem;
    font-weight: 700;
  }
  .alert-box.success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .alert-box.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

  /* شبكة العناوين */
  .addresses-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 18px;
  }
  .address-card {
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border: 1.5px solid var(--line);
  }
  .address-card.is-default {
    border-color: var(--olive);
    background: linear-gradient(180deg, var(--card) 0%, rgba(94, 107, 44, 0.04) 100%);
  }
  .addr-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px dashed var(--line);
    padding-bottom: 8px;
  }
  .addr-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .addr-title {
    font-size: 1.05rem;
    font-weight: 800;
    margin: 0;
  }
  .default-pill {
    background: rgba(94, 107, 44, 0.15);
    color: var(--olive);
    font-size: 0.72rem;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: var(--radius-full);
  }
  .del-addr-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.95rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }
  .del-addr-btn:hover { opacity: 1; }
  .addr-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 0.82rem;
  }
  .detail-row {
    display: flex;
    gap: 8px;
  }
  .detail-lbl {
    color: var(--text-muted);
    min-width: 95px;
  }
  .detail-val {
    color: var(--text);
    font-weight: 600;
  }
  .addr-card-actions {
    margin-top: 4px;
    border-top: 1px dashed var(--line);
    padding-top: 10px;
  }

  /* الإشعارات */
  .notifications-list {
    padding: 8px 16px;
  }
  .notification-item {
    display: flex;
    gap: 16px;
    padding: 18px 12px;
    border-bottom: 1px solid var(--line);
    transition: background 0.15s;
  }
  .notification-item:last-child {
    border-bottom: none;
  }
  .notification-item.unread {
    background: rgba(94, 107, 44, 0.04);
  }
  .notif-bubble {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
  }
  .icon-delivery { background: #e0f2fe; }
  .icon-order { background: #fef3c7; }
  .icon-review { background: #fef9c3; }
  .icon-promo { background: #fce7f3; }
  .notif-body-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .notif-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .notif-title {
    font-size: 0.95rem;
    font-weight: 800;
    margin: 0;
  }
  .notif-time {
    font-size: 0.74rem;
    color: var(--text-muted);
  }
  .notif-msg {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.5;
  }
  .btn-track-jump {
    background: none;
    border: none;
    color: var(--olive);
    font-weight: 800;
    font-size: 0.8rem;
    cursor: pointer;
    text-align: right;
    padding: 4px 0 0;
    width: fit-content;
  }
  .btn-track-jump:hover { text-decoration: underline; }

  /* النوافذ المنبثقة (Modals) */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(6px);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .modal-card {
    width: 100%;
    max-width: 560px;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-height: 90vh;
    overflow-y: auto;
  }
  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 1px dashed var(--line);
    padding-bottom: 12px;
  }
  .modal-header h3 {
    margin: 4px 0 2px;
    font-size: 1.2rem;
    font-weight: 800;
  }
  .modal-sub {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin: 0;
  }
  .close-modal-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    opacity: 0.6;
  }
  .close-modal-btn:hover { opacity: 1; }
  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    border-top: 1px dashed var(--line);
    padding-top: 14px;
    margin-top: 6px;
  }

  /* تقييم النجوم */
  .star-group-box {
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .star-label {
    font-size: 0.85rem;
    font-weight: 700;
  }
  .stars-picker {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .star-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: #cbd5e1;
    cursor: pointer;
    transition: transform 0.15s, color 0.15s;
    line-height: 1;
    padding: 0 2px;
  }
  .star-btn:hover, .star-btn.active {
    color: #f59e0b;
    transform: scale(1.15);
  }
  .star-count-text {
    font-size: 0.82rem;
    font-weight: 700;
    color: #b45309;
    margin-right: 8px;
  }
  .rating-success-box {
    text-align: center;
    padding: 30px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .success-icon { font-size: 3rem; }

  /* كشف الموقع بالـ GPS */
  .gps-detect-banner {
    background: linear-gradient(90deg, rgba(94, 107, 44, 0.1), rgba(16, 185, 129, 0.1));
    border: 1px solid var(--olive);
    padding: 12px 16px;
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .gps-detect-banner div {
    display: flex;
    flex-direction: column;
    font-size: 0.84rem;
  }
  .gps-detect-banner span {
    font-size: 0.74rem;
    color: var(--text-muted);
  }
  .btn-gps-detect {
    background: var(--olive);
    color: #ffffff;
    font-weight: 700;
    white-space: nowrap;
  }
  .gps-status-pill {
    background: var(--bg);
    border: 1px dashed var(--olive);
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
    color: var(--olive);
    font-weight: 700;
    margin-bottom: 12px;
  }
  .checkbox-row {
    flex-direction: row;
    align-items: center;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .profile-hero {
      flex-direction: column;
      align-items: flex-start;
      padding: 20px;
    }
    .user-quick-stats {
      width: 100%;
      justify-content: space-between;
    }
    .stat-pill {
      flex: 1;
      padding: 8px 10px;
    }
    .form-grid {
      grid-template-columns: 1fr;
    }
    .tab-subhead {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>

