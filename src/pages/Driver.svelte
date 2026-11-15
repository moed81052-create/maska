<script>
  import { onMount, onDestroy } from 'svelte';
  import { auth, isAuthenticated, isDriver } from '../stores/auth.js';
  import { router } from '../stores/router.js';
  import { api } from '../lib/api.js';

  let orders = [];
  let loading = true;
  let activeTab = 'active'; // 'active' | 'delivered' | 'all'
  let driverStatus = 'available'; // 'available' | 'busy' | 'offline'
  let updatingStatus = false;
  let locationPinging = false;
  let locationSuccessMsg = '';
  let gpsWatcher = null;

  onMount(async () => {
    // إذا لم يكن مسجل دخول كسائق، سنعرض واجهة السائق مع الحساب التجريبي السريع
    await loadDriverData();

    // بدء محاكاة تحديث موقع السائق التلقائي إذا كان في مهمة توصيل
    startAutoLocationSync();
  });

  onDestroy(() => {
    if (gpsWatcher) clearInterval(gpsWatcher);
  });

  let financialSummary = {
    driver: null,
    transactions: [],
    settlements: [],
    net_cash_due_to_admin: 0
  };

  async function loadDriverData() {
    loading = true;
    try {
      const driverId = $auth?.id || null;
      const res = await api.getDriverOrders(driverId);
      if (res && res.data) {
        orders = res.data;
      }

      if (driverId) {
        const finRes = await api.getDriverFinancialSummary(driverId);
        if (finRes && finRes.data) {
          financialSummary = finRes.data;
        }
      }
    } catch (err) {
      console.error('Failed to load driver orders/financials:', err);
    } finally {
      loading = false;
    }
  }

  async function handleToggleStatus(newStatus) {
    driverStatus = newStatus;
    if (!$auth?.id) return;
    updatingStatus = true;
    try {
      await api.updateDriverStatus($auth.id, newStatus);
    } catch (err) {
      console.error('Failed to update driver status:', err);
    } finally {
      updatingStatus = false;
    }
  }

  // تحديث حالة الطلب (بدء التوصيل / تم التسليم)
  async function handleUpdateOrderStatus(orderNumber, newStatus) {
    try {
      await api.updateOrderStatus(orderNumber, newStatus, `تحديث بواسطة السائق (${$auth?.full_name || 'سائق التوصيل'})`, $auth?.id);
      
      // تحديث الحالة محلياً
      orders = orders.map(o => o.order_number === orderNumber ? { ...o, status: newStatus } : o);

      if (newStatus === 'out_for_delivery') {
        driverStatus = 'busy';
        sendCurrentDriverGPS(orderNumber);
      } else if (newStatus === 'delivered') {
        driverStatus = 'available';
        // تحديث كشف الحساب والعهدة النقدية فوراً بعد التسليم
        await loadDriverData();
      }
    } catch (err) {
      alert('تعذر تحديث حالة الطلب: ' + err.message);
    }
  }

  // إرسال موقع السائق الحالي بالـ GPS عبر إحداثيات المتصفح الحقيقية
  function sendCurrentDriverGPS(currentOrderNumber = null) {
    if (!navigator.geolocation) return;
    locationPinging = true;
    locationSuccessMsg = '';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 35;

          const driverId = $auth?.id || 'dc81ad09-3702-4ece-b7cb-bebe08cc3bd9';
          await api.updateDriverLocation({
            driverId,
            lat,
            lng,
            speed,
            orderId: currentOrderNumber
          });

          locationSuccessMsg = `تم إرسال إحداثياتك الحالية (${lat.toFixed(4)}, ${lng.toFixed(4)}) لنظام التتبع بنجاح 📍`;
          setTimeout(() => locationSuccessMsg = '', 4000);
        } catch (e) {
          console.error(e);
        } finally {
          locationPinging = false;
        }
      },
      (err) => {
        // Fallback simulate Tripoli coords
        locationPinging = false;
      },
      { enableHighAccuracy: true }
    );
  }

  function startAutoLocationSync() {
    gpsWatcher = setInterval(() => {
      const activeDelivery = orders.find(o => o.status === 'out_for_delivery');
      if (activeDelivery) {
        sendCurrentDriverGPS(activeDelivery.order_number);
      }
    }, 15000);
  }

  function getGoogleMapsUrl(lat, lng, addressDetails = '') {
    if (lat && lng) {
      // رابط الملاحة المباشر في خرائط جوجل باللات واللونق
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    }
    // رابط احتياطي بالاسم والمدينة
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressDetails || 'طرابلس ليبيا')}`;
  }

  $: activeOrders = orders.filter(o => ['confirmed', 'preparing', 'out_for_delivery'].includes(o.status));
  $: deliveredOrders = orders.filter(o => o.status === 'delivered');
  $: displayedOrders = activeTab === 'active' 
    ? activeOrders 
    : (activeTab === 'delivered' ? deliveredOrders : orders);
</script>

<div class="driver-portal-page fade-in">
  <div class="container">
    <!-- 1. شريط ترحيب السائق والملف الشخصي -->
    <div class="driver-header-card card">
      <div class="driver-info-main">
        <div class="driver-avatar-circle">🚗</div>
        <div>
          <span class="portal-badge">بوابة مهام كابتن التوصيل 🌸</span>
          <h1 class="driver-name">
            مرحباً كابتن {$auth?.full_name || 'طارق الزوي'}
          </h1>
          <p class="driver-vehicle-text">
            مركبة التوصيل: <strong>تويوتا كورولا مبردة (لوحة: طرابلس 5-12345)</strong>
          </p>
        </div>
      </div>

      <!-- تبديل حالة التفرغ -->
      <div class="driver-status-toggle">
        <span class="status-toggle-label">حالتك الآن:</span>
        <div class="status-buttons">
          <button 
            type="button" 
            class="status-btn available" 
            class:active={driverStatus === 'available'}
            on:click={() => handleToggleStatus('available')}
          >
            🟢 متاح
          </button>
          <button 
            type="button" 
            class="status-btn busy" 
            class:active={driverStatus === 'busy'}
            on:click={() => handleToggleStatus('busy')}
          >
            🟡 في مهمة
          </button>
          <button 
            type="button" 
            class="status-btn offline" 
            class:active={driverStatus === 'offline'}
            on:click={() => handleToggleStatus('offline')}
          >
            ⚪ غير متصل
          </button>
        </div>
      </div>
    </div>

    <!-- رسالة نجاح تحديث الـ GPS -->
    {#if locationSuccessMsg}
      <div class="alert-success fade-in">
        {locationSuccessMsg}
      </div>
    {/if}

    <!-- 2. شريط محفظة العهدة النقدية وأرباح التوصيل اللحظية لكابتن التوصيل -->
    <div class="driver-financial-banner card">
      <div class="fin-banner-item fin-today-highlight">
        <span class="fin-b-icon">⚡</span>
        <div>
          <span class="fin-b-title">أرباحك اليومية:</span>
          <b class="fin-b-val text-gold">+{Number(financialSummary.today?.earnings || financialSummary.driver?.today_earnings || 0).toLocaleString()} د.ل</b>
          <span class="fin-b-sub">{financialSummary.today?.delivered_count || financialSummary.driver?.today_delivered_count || 0} طلبات سُلّمت اليوم</span>
        </div>
      </div>

      <div class="fin-banner-divider"></div>

      <div class="fin-banner-item">
        <span class="fin-b-icon">💵</span>
        <div>
          <span class="fin-b-title">العهدة النقدية الحالية:</span>
          <b class="fin-b-val">{Number(financialSummary.driver?.current_custody_amount || 0).toLocaleString()} د.ل</b>
          <span class="fin-b-sub">كاش في حوزتك للإدارة</span>
        </div>
      </div>

      <div class="fin-banner-divider"></div>

      <div class="fin-banner-item">
        <span class="fin-b-icon">🌟</span>
        <div>
          <span class="fin-b-title">إجمالي أرباحك المعلقة:</span>
          <b class="fin-b-val text-green">+{Number(financialSummary.driver?.pending_earnings || 0).toLocaleString()} د.ل</b>
          <span class="fin-b-sub">تخصم لصالحك</span>
        </div>
      </div>

      <div class="fin-banner-divider"></div>

      <div class="fin-banner-item">
        <span class="fin-b-icon">⚖️</span>
        <div>
          <span class="fin-b-title">الصافي لتوريده للإدارة:</span>
          <b class="fin-b-val text-blue">{Number(financialSummary.net_cash_due_to_admin || 0).toLocaleString()} د.ل</b>
          <span class="fin-b-sub">العهدة بعد خصم أرباحك</span>
        </div>
      </div>

      <div class="fin-banner-divider"></div>

      <div class="fin-banner-action">
        <button 
          type="button" 
          class="btn-fin-view" 
          class:active={activeTab === 'financials'}
          on:click={() => activeTab = 'financials'}
        >
          📜 كشف الحساب والعهدة
        </button>
      </div>
    </div>

    <!-- 2b. إحصائيات سريعة للسائق -->
    <div class="driver-kpis">
      <div class="kpi-pill">
        <span class="kpi-num">{activeOrders.length}</span>
        <span class="kpi-text">طلبات بانتظار التسليم</span>
      </div>
      <div class="kpi-pill">
        <span class="kpi-num">{deliveredOrders.length}</span>
        <span class="kpi-text">طلبات تم تسليمها بنجاح</span>
      </div>
      <div class="kpi-pill">
        <span class="kpi-num">4.9 ★</span>
        <span class="kpi-text">تقييمك من الزبائن</span>
      </div>
      <div class="kpi-pill">
        <button 
          type="button" 
          class="btn-send-gps" 
          disabled={locationPinging}
          on:click={() => sendCurrentDriverGPS()}
        >
          {locationPinging ? 'جاري التحديد...' : '📍 إرسال موقعي الحالي (GPS)'}
        </button>
      </div>
    </div>

    <!-- 3. تبويبات الطلبات -->
    <div class="driver-tabs">
      <button 
        type="button" 
        class="d-tab" 
        class:active={activeTab === 'active'}
        on:click={() => activeTab = 'active'}
      >
        الطلبات النشطة للتوصيل ({activeOrders.length})
      </button>
      <button 
        type="button" 
        class="d-tab" 
        class:active={activeTab === 'delivered'}
        on:click={() => activeTab = 'delivered'}
      >
        تم تسليمها ({deliveredOrders.length})
      </button>
      <button 
        type="button" 
        class="d-tab" 
        class:active={activeTab === 'all'}
        on:click={() => activeTab = 'all'}
      >
        كافة الطلبات ({orders.length})
      </button>
      <button 
        type="button" 
        class="d-tab fin-tab" 
        class:active={activeTab === 'financials'}
        on:click={() => activeTab = 'financials'}
      >
        💰 العهدة وكشف الحساب ({financialSummary.driver?.current_custody_amount || 0} د.ل)
      </button>
    </div>

    <!-- 4. قائمة بطاقات الطلبات الموجهة للسائق -->
    {#if loading}
      <div class="loading-state">جاري تحميل مهام وطلبات التوصيل... 🌸</div>
    {:else if activeTab === 'financials'}
      <!-- كشف الحساب وسجل العهدة والتسويات لكابتن التوصيل -->
      <div class="driver-financial-view fade-in">
        <!-- كرت ملخص العهدة والأرباح التفصيلي -->
        <div class="card fin-detail-card">
          <div class="fin-card-top">
            <div>
              <h3>💰 كشف الحساب المالي والعهدة النقدية</h3>
              <p class="fin-sub">توثيق المبالغ المحصلة، أرباح التوصيل المكتسبة، وإيصالات التوريد للإدارة</p>
            </div>
            <button type="button" class="btn btn-outline btn-sm" on:click={loadDriverData}>
              🔄 تحديث الكشف
            </button>
          </div>

          <div class="fin-grid-4">
            <div class="fin-stat-box gold">
              <span class="stat-title">⚡ أرباحك اليومية المحققة</span>
              <b class="stat-num text-gold">+{Number(financialSummary.today?.earnings || 0).toLocaleString()} د.ل</b>
              <small>{financialSummary.today?.delivered_count || 0} طلبات سُلّمت اليوم | كاش: {Number(financialSummary.today?.cash_collected || 0).toLocaleString()} د.ل</small>
            </div>
            <div class="fin-stat-box red">
              <span class="stat-title">💵 العهدة النقدية المعلقة (كاش)</span>
              <b class="stat-num">{Number(financialSummary.driver?.current_custody_amount || 0).toLocaleString()} د.ل</b>
              <small>المطلوب تسليمه للإدارة عند تصفية العهدة</small>
            </div>
            <div class="fin-stat-box green">
              <span class="stat-title">🌟 إجمالي أرباحك المعلقة</span>
              <b class="stat-num">{Number(financialSummary.driver?.pending_earnings || 0).toLocaleString()} د.ل</b>
              <small>عمولات التوصيل المكتسبة التي تخصم لصالحك</small>
            </div>
            <div class="fin-stat-box blue">
              <span class="stat-title">⚖️ صافي المبلغ المطلوب توريده</span>
              <b class="stat-num">{Number(financialSummary.net_cash_due_to_admin || 0).toLocaleString()} د.ل</b>
              <small>صافي الكاش الذي تسلمه للإدارة</small>
            </div>
          </div>
        </div>

        <!-- جدول الحركات المالية وحركات تحصيل الطلبات -->
        <div class="card table-card">
          <div class="table-head-flex">
            <div>
              <h3>سجل الحركات المالية الميدانية (Custody Ledger)</h3>
              <p class="tab-subtext">توثيق لحظي لكل طلب تم تسليمه وإيداع مبلغه في العهدة النقدية</p>
            </div>
          </div>

          {#if !financialSummary.transactions || financialSummary.transactions.length === 0}
            <div class="empty-state-sm">لا توجد حركات مالية مسجلة بعد. عند تسليم أي طلب سيظهر في السجل تلقائياً.</div>
          {:else}
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>التاريخ والتوقيت</th>
                    <th>نوع الحركة</th>
                    <th>الطلب</th>
                    <th>المبلغ المحصل</th>
                    <th>ربح التوصيل</th>
                    <th>رصيد العهدة</th>
                    <th>البيان</th>
                  </tr>
                </thead>
                <tbody>
                  {#each financialSummary.transactions as tx}
                    <tr>
                      <td>#{tx.id}</td>
                      <td>{new Date(tx.created_at).toLocaleString('ar-LY', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td>
                        {#if tx.type === 'order_collection'}
                          <span class="tx-badge collect">تحصيل كاش 💵</span>
                        {:else if tx.type === 'delivery_earning'}
                          <span class="tx-badge earn">ربح توصيل 🌟</span>
                        {:else if tx.type === 'admin_settlement'}
                          <span class="tx-badge settle">تسوية إدارة 🧾</span>
                        {:else}
                          <span class="tx-badge">حركة مالية</span>
                        {/if}
                      </td>
                      <td>
                        {#if tx.order_number}
                          <b>#{tx.order_number}</b>
                        {:else}
                          -
                        {/if}
                      </td>
                      <td>
                        <b class:text-green={Number(tx.amount) > 0} class:text-red={Number(tx.amount) < 0}>
                          {Number(tx.amount) > 0 ? `+${tx.amount}` : tx.amount} د.ل
                        </b>
                      </td>
                      <td>
                        <span class="driver-profit-tag">+{tx.driver_profit || 0} د.ل</span>
                      </td>
                      <td>
                        <b class="balance-tag">{tx.balance_after} د.ل</b>
                      </td>
                      <td>
                        <small class="tx-desc">{tx.description || '-'}</small>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

        <!-- جدول إيصالات تسوية العهدة مع الإدارة -->
        <div class="card table-card">
          <div class="table-head-flex">
            <div>
              <h3>إيصالات تسوية العهدة وتوريد المبالغ للإدارة</h3>
              <p class="tab-subtext">كافة المخالصات الرسمية واستلامات النقدية المعتمدة من الإدارة</p>
            </div>
          </div>

          {#if !financialSummary.settlements || financialSummary.settlements.length === 0}
            <div class="empty-state-sm">لا توجد تسويات سابقة حتى الآن. يتم تسجيل الإيصال فور تسليمك العهدة لمسؤول الإدارة.</div>
          {:else}
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>رقم الإيصال</th>
                    <th>تاريخ التسوية</th>
                    <th>المستلم (الإدارة)</th>
                    <th>العهدة المسواة</th>
                    <th>أرباحك المخصومة</th>
                    <th>الصافي المورّد للخزينة</th>
                    <th>ملاحظات</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {#each financialSummary.settlements as set}
                    <tr>
                      <td><b>{set.settlement_number}</b></td>
                      <td>{new Date(set.created_at).toLocaleDateString('ar-LY')}</td>
                      <td>{set.admin_name || 'إدارة مسكة'}</td>
                      <td><b>{set.custody_cleared} د.ل</b></td>
                      <td><span class="text-green">-{set.driver_earnings_deducted} د.ل</span></td>
                      <td><b class="text-primary">{set.net_cash_received} د.ل</b></td>
                      <td><small>{set.notes || '-'}</small></td>
                      <td><span class="badge-success">✓ تم الاستلام والإبراء</span></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    {:else if displayedOrders.length === 0}
      <div class="card empty-state">
        <span class="empty-icon">🎉</span>
        <h3>لا توجد طلبات في هذا القسم حالياً</h3>
        <p>جميع الطلبات مسندة ومسلمة بأمان. ستصلك إشعارات بالطلبات الجديدة فور تجهيزها في الأتيليه.</p>
      </div>
    {:else}
      <div class="driver-orders-list">
        {#each displayedOrders as order (order.id || order.order_number)}
          <article class="card order-dispatch-card" class:highlight={order.status === 'out_for_delivery'}>
            <!-- رأس الطلب -->
            <div class="dispatch-header">
              <div class="dispatch-title-group">
                <span class="dispatch-order-num">طلب رقم #{order.order_number}</span>
                <h3 class="dispatch-recipient-name">المستلم: {order.recipient_name}</h3>
              </div>

              <div class="dispatch-badge-group">
                <span class="status-badge status-{order.status}">
                  {#if order.status === 'out_for_delivery'}
                    🚗 جاري التوصيل الآن
                  {:else if order.status === 'preparing'}
                    💐 قيد التنسيق بالأتيليه
                  {:else if order.status === 'delivered'}
                    ✅ تم التسليم بنجاح
                  {:else}
                    📋 مؤكد
                  {/if}
                </span>

                <span class="payment-method-badge">
                  {order.payment_method === 'cash_on_delivery' ? 'كاش عند الاستلام' : 'مدفوع إلكترونياً'}
                </span>
              </div>
            </div>

            <!-- شبكة تفاصيل الطلب الثلاثية (المكان، الماهية، الإجراءات) -->
            <div class="dispatch-content-grid">
              <!-- أ. مكان الطلبية والموقع الجغرافي وخريطة قوقل -->
              <div class="dispatch-section location-box">
                <h4 class="section-title">📍 مكان ووجهة الطلبية</h4>
                
                <div class="location-details">
                  <p class="loc-line">
                    <span>المدينة والمنطقة:</span>
                    <strong>{order.delivery_city} — {order.delivery_zone}</strong>
                  </p>
                  
                  {#if order.delivery_address_details}
                    <p class="loc-line">
                      <span>العنوان التفصيلي:</span>
                      <b>{order.delivery_address_details}</b>
                    </p>
                  {/if}

                  <p class="loc-line">
                    <span>إحداثيات الزبون (GPS):</span>
                    <code class="gps-coords">
                      {order.delivery_lat ? Number(order.delivery_lat).toFixed(5) : '32.8872'}° N, 
                      {order.delivery_lng ? Number(order.delivery_lng).toFixed(5) : '13.1913'}° E
                    </code>
                  </p>

                  <p class="loc-line">
                    <span>موعد التسليم المرغوب:</span>
                    <span class="time-window">{order.delivery_window || 'اليوم — خلال ساعتين'}</span>
                  </p>
                </div>

                <!-- زر التوجيه في خرائط قوقل ماب (Google Maps) -->
                <div class="maps-action-box">
                  <a 
                    href={getGoogleMapsUrl(order.delivery_lat, order.delivery_lng, `${order.delivery_city} ${order.delivery_zone} ${order.delivery_address_details}`)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="btn btn-google-maps"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <span>فتح الوجهة في خرائط Google (ملاحة GPS) 🗺️</span>
                  </a>

                  {#if order.recipient_phone}
                    <a href="tel:{order.recipient_phone}" class="btn btn-call-client">
                      📞 اتصال بالزبون ({order.recipient_phone})
                    </a>
                  {/if}
                </div>
              </div>

              <!-- ب. ماهية الطلبية ومحتويات الزهور وبطاقة الإهداء -->
              <div class="dispatch-section contents-box">
                <h4 class="section-title">💐 ماهية ومحتويات الطلبية</h4>

                <div class="items-list-compact">
                  {#if order.items && order.items.length > 0}
                    {#each order.items as item (item.id)}
                      <div class="item-mini-card">
                        <div class="item-mini-head">
                          <span class="flower-symbol">🌸</span>
                          <strong>{item.item_title}</strong>
                          <span class="item-qty">({item.quantity} باقة)</span>
                        </div>

                        {#if item.wrap_type}
                          <div class="custom-specs">
                            <span>التغليف: {item.wrap_type}</span>
                            <span>الشريط: {item.ribbon_color}</span>
                          </div>
                        {/if}

                        {#if item.wax_seal_text}
                          <div class="wax-seal-note-box">
                            <span class="wax-badge" style="background: {item.seal_color || '#851b2f'};">
                              {item.seal_stamp || 'MASKA 🌸'}
                            </span>
                            <div class="note-text-area">
                              <small>كرت الإهداء المكتوب:</small>
                              <p>"{item.wax_seal_text}"</p>
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/each}
                  {:else}
                    <p class="text-muted">باقة زهور طبيعية منسقة في الأتيليه.</p>
                  {/if}
                </div>

                {#if order.customer_notes}
                  <div class="customer-instructions">
                    <span class="instructions-tag">ملاحظة الزبون للسائق:</span>
                    <p>"{order.customer_notes}"</p>
                  </div>
                {/if}
              </div>

              <!-- ج. التحصيل المالي وأزرار تحديث حالة التوصيل -->
              <div class="dispatch-section actions-box">
                <h4 class="section-title">💵 التحصيل المالي والتسليم</h4>

                <div class="collection-summary">
                  <div class="col-line">
                    <span>قيمة الطلبية:</span>
                    <span>{order.subtotal} د.ل</span>
                  </div>
                  <div class="col-line">
                    <span>رسوم التوصيل:</span>
                    <span>{order.delivery_fee} د.ل</span>
                  </div>
                  <div class="col-line total-to-collect">
                    <span>المطلوب تحصيله:</span>
                    <b class="collect-price">{order.total_amount} د.ل</b>
                  </div>
                  <small class="collect-hint">
                    {order.payment_method === 'cash_on_delivery' 
                      ? '⚠️ يرجى استلام المبلغ نقداً من المستلم' 
                      : '✅ تم الدفع مسبقاً، فقط سلّم الباقة'}
                  </small>
                </div>

                <!-- أزرار تحديث الحالة -->
                <div class="status-action-buttons">
                  {#if order.status !== 'out_for_delivery' && order.status !== 'delivered'}
                    <button 
                      type="button" 
                      class="btn btn-primary btn-block btn-start-delivery" 
                      on:click={() => handleUpdateOrderStatus(order.order_number, 'out_for_delivery')}
                    >
                      بدء التوصيل الآن 🚗
                    </button>
                  {/if}

                  {#if order.status === 'out_for_delivery'}
                    <button 
                      type="button" 
                      class="btn btn-delivered btn-block" 
                      on:click={() => handleUpdateOrderStatus(order.order_number, 'delivered')}
                    >
                      ✅ تم التسليم بنجاح للزبون
                    </button>
                  {/if}

                  {#if order.status === 'delivered'}
                    <div class="delivered-confirmed-banner">
                      🎉 تم تسليم هذا الطلب بنجاح وإغلاقه
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .driver-portal-page {
    padding: 36px 0 80px;
    background: var(--bg);
    min-height: 85vh;
  }
  .driver-header-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 28px 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: var(--shadow-md);
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 20px;
  }
  .driver-info-main {
    display: flex;
    align-items: center;
    gap: 18px;
  }
  .driver-avatar-circle {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: #e3f2fd;
    font-size: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #90caf9;
  }
  .portal-badge {
    background: var(--pink);
    color: var(--rose-text);
    padding: 3px 10px;
    border-radius: var(--radius-full);
    font-size: 0.78rem;
    font-weight: 700;
  }
  .driver-name {
    font-size: 1.6rem;
    color: var(--olive);
    margin: 4px 0 2px;
    font-family: 'Cairo', sans-serif;
  }
  .driver-vehicle-text {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin: 0;
  }
  .driver-status-toggle {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }
  .status-toggle-label {
    font-size: 0.8rem;
    color: var(--muted);
    font-weight: 700;
  }
  .status-buttons {
    display: flex;
    gap: 6px;
    background: var(--bg);
    padding: 4px;
    border-radius: var(--radius-full);
    border: 1px solid var(--line);
  }
  .status-btn {
    background: none;
    border: none;
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    color: var(--text-muted);
  }
  .status-btn.active.available {
    background: #e8f5e9;
    color: #2e7d32;
    box-shadow: var(--shadow-xs);
  }
  .status-btn.active.busy {
    background: #fff8e1;
    color: #f57f17;
    box-shadow: var(--shadow-xs);
  }
  .status-btn.active.offline {
    background: #f5f5f5;
    color: #757575;
    box-shadow: var(--shadow-xs);
  }

  /* KPIs */
  .driver-kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }
  .kpi-pill {
    background: var(--card-solid);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .kpi-num {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--olive);
  }
  .kpi-text {
    font-size: 0.82rem;
    color: var(--muted);
    font-weight: 600;
  }
  .btn-send-gps {
    background: var(--olive);
    color: #fff;
    border: none;
    padding: 10px 16px;
    border-radius: var(--radius-full);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    width: 100%;
    margin-top: 4px;
    transition: all 0.2s;
  }
  .btn-send-gps:hover {
    background: var(--olive-dark);
  }

  /* Tabs */
  .driver-tabs {
    display: flex;
    gap: 8px;
    border-bottom: 2px solid var(--line);
    margin-bottom: 24px;
  }
  .d-tab {
    background: none;
    border: none;
    padding: 12px 20px;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text-muted);
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
  }
  .d-tab:hover, .d-tab.active {
    color: var(--olive);
    border-color: var(--olive);
  }

  /* Order Card */
  .driver-orders-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .order-dispatch-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 28px;
    box-shadow: var(--shadow-sm);
    transition: all 0.25s;
  }
  .order-dispatch-card.highlight {
    border-color: #1976d2;
    box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2), var(--shadow-md);
  }
  .dispatch-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid var(--line);
    padding-bottom: 18px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 12px;
  }
  .dispatch-order-num {
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--muted);
  }
  .dispatch-recipient-name {
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--olive);
    margin: 2px 0 0;
  }
  .dispatch-badge-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .status-badge {
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.85rem;
    font-weight: 700;
  }
  .status-confirmed { background: var(--pink); color: var(--rose-text); }
  .status-preparing { background: var(--lime); color: var(--olive); }
  .status-out_for_delivery { background: #e3f2fd; color: #1976d2; font-weight: 800; }
  .status-delivered { background: #e8f5e9; color: #2e7d32; }
  .payment-method-badge {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    padding: 5px 12px;
    border-radius: var(--radius-full);
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  /* Tri-column Grid */
  .dispatch-content-grid {
    display: grid;
    grid-template-columns: 1.2fr 1.2fr 0.9fr;
    gap: 24px;
  }
  .dispatch-section {
    background: var(--bg);
    border-radius: var(--radius-md);
    padding: 20px;
    border: 1px solid var(--line);
    display: flex;
    flex-direction: column;
  }
  .section-title {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--olive);
    margin: 0 0 14px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 8px;
  }
  .location-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
    flex: 1;
  }
  .loc-line {
    margin: 0;
    font-size: 0.88rem;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .loc-line span {
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 600;
  }
  .gps-coords {
    background: var(--card-solid);
    padding: 2px 8px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85rem;
    color: #1565c0;
    border: 1px solid var(--line);
    width: fit-content;
  }
  .time-window {
    color: var(--rose-text);
    font-weight: 700;
  }

  /* Maps Button */
  .maps-action-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .btn-google-maps {
    background: #1a73e8;
    color: #ffffff;
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(26, 115, 232, 0.25);
    transition: all 0.2s;
  }
  .btn-google-maps:hover {
    background: #1557b0;
    transform: translateY(-2px);
  }
  .btn-call-client {
    background: #2e7d32;
    color: #ffffff;
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    text-decoration: none;
    font-size: 0.85rem;
    font-weight: 700;
    text-align: center;
  }

  /* Items & Composition */
  .items-list-compact {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }
  .item-mini-card {
    background: var(--card-solid);
    border-radius: var(--radius-sm);
    padding: 12px;
    border: 1px solid var(--line);
  }
  .item-mini-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.92rem;
  }
  .item-qty {
    color: var(--price);
    font-weight: 700;
  }
  .custom-specs {
    font-size: 0.78rem;
    color: var(--muted);
    margin: 4px 0 8px;
    display: flex;
    gap: 12px;
  }
  .wax-seal-note-box {
    display: flex;
    gap: 10px;
    align-items: center;
    background: #fffdfa;
    border: 1px dashed #d7ccc8;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
  }
  .wax-badge {
    color: #fff;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.68rem;
    font-weight: 800;
    white-space: nowrap;
  }
  .note-text-area small {
    display: block;
    font-size: 0.7rem;
    color: var(--muted);
  }
  .note-text-area p {
    margin: 0;
    font-size: 0.85rem;
    font-style: italic;
    color: #4e342e;
  }
  .customer-instructions {
    background: #fff9c4;
    border: 1px solid #fff59d;
    padding: 10px;
    border-radius: var(--radius-sm);
    margin-top: 12px;
  }
  .instructions-tag {
    font-size: 0.75rem;
    font-weight: 800;
    color: #f57f17;
    display: block;
  }
  .customer-instructions p {
    margin: 2px 0 0;
    font-size: 0.85rem;
    color: #5d4037;
  }

  /* Collection & Actions */
  .collection-summary {
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: var(--card-solid);
    padding: 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    margin-bottom: 16px;
  }
  .col-line {
    display: flex;
    justify-content: space-between;
    font-size: 0.88rem;
    color: var(--text-muted);
  }
  .total-to-collect {
    border-top: 1px solid var(--line);
    padding-top: 8px;
    font-size: 1rem;
    color: var(--text);
  }
  .collect-price {
    color: var(--price);
    font-size: 1.25rem;
  }
  .collect-hint {
    font-size: 0.75rem;
    color: var(--muted);
    font-weight: 600;
    margin-top: 2px;
  }
  .status-action-buttons {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .btn-start-delivery {
    background: #1976d2;
    color: #fff;
    padding: 12px;
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 800;
    border: none;
    cursor: pointer;
  }
  .btn-start-delivery:hover {
    background: #1565c0;
  }
  .btn-delivered {
    background: #2e7d32;
    color: #fff;
    padding: 12px;
    border-radius: var(--radius-sm);
    font-size: 0.95rem;
    font-weight: 800;
    border: none;
    cursor: pointer;
  }
  .btn-delivered:hover {
    background: #1b5e20;
  }
  .delivered-confirmed-banner {
    background: #e8f5e9;
    color: #2e7d32;
    padding: 10px;
    border-radius: var(--radius-sm);
    text-align: center;
    font-weight: 700;
    font-size: 0.88rem;
  }

  .alert-success {
    background: #e8f5e9;
    color: #2e7d32;
    padding: 12px 20px;
    border-radius: var(--radius-md);
    margin-bottom: 20px;
    font-weight: 700;
    text-align: center;
    border: 1px solid #c8e6c9;
  }
  .empty-state {
    text-align: center;
    padding: 48px;
  }
  .empty-icon {
    font-size: 3rem;
  }

  @media (max-width: 1000px) {
    .dispatch-content-grid {
      grid-template-columns: 1fr;
    }
  }

  /* شريط العهدة النقدية والأرباح اللحظية */
  .driver-financial-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, #ffffff 0%, #fbf8f2 100%);
    border: 1px solid #e7ded0;
    border-radius: var(--radius-lg);
    padding: 18px 24px;
    margin-bottom: 24px;
    box-shadow: 0 4px 16px rgba(43, 43, 40, 0.05);
    flex-wrap: wrap;
    gap: 16px;
  }
  .fin-banner-item {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .fin-b-icon {
    font-size: 2rem;
    background: #fbf7ee;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line);
  }
  .fin-b-title {
    font-size: 0.78rem;
    color: var(--muted);
    display: block;
    font-weight: 700;
  }
  .fin-b-val {
    font-size: 1.35rem;
    color: #2b2b28;
    display: block;
  }
  .fin-b-sub {
    font-size: 0.7rem;
    color: var(--muted);
  }
  .fin-banner-divider {
    width: 1px;
    height: 40px;
    background: var(--line);
  }
  .btn-fin-view {
    background: var(--olive);
    color: #ffffff;
    border: none;
    border-radius: 999px;
    padding: 10px 20px;
    font-size: 0.88rem;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(94, 107, 44, 0.2);
  }
  .btn-fin-view:hover, .btn-fin-view.active {
    background: var(--olive-dark);
    transform: translateY(-1px);
  }

  /* تفاصيل كشف الحساب والعهدة */
  .driver-financial-view {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .fin-detail-card {
    padding: 24px;
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 16px;
  }
  .fin-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--line);
    padding-bottom: 14px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 10px;
  }
  .fin-card-top h3 {
    margin: 0 0 4px;
    font-size: 1.2rem;
    color: var(--olive);
  }
  .fin-sub {
    margin: 0;
    font-size: 0.82rem;
    color: var(--muted);
  }
  .fin-grid-4, .fin-grid-3 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
  }
  .fin-today-highlight {
    background: rgba(217, 119, 6, 0.05);
    padding: 6px 14px;
    border-radius: 12px;
    border: 1px dashed rgba(217, 119, 6, 0.3);
  }
  .text-gold {
    color: #b45309 !important;
    font-weight: 800;
  }
  .fin-stat-box.gold {
    border-color: #fde68a;
    background: #fffbeb;
  }
  .fin-stat-box.gold .stat-num {
    color: #b45309;
  }
  .fin-stat-box {
    background: #faf7f0;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .fin-stat-box.red {
    border-color: #ffcdd2;
    background: #fff8f8;
  }
  .fin-stat-box.red .stat-num {
    color: #c62828;
  }
  .fin-stat-box.green {
    border-color: #c8e6c9;
    background: #f4fbf5;
  }
  .fin-stat-box.green .stat-num {
    color: #2e7d32;
  }
  .fin-stat-box.blue {
    border-color: #bbdefb;
    background: #f4f9ff;
  }
  .fin-stat-box.blue .stat-num {
    color: #1565c0;
  }
  .stat-title {
    font-size: 0.82rem;
    font-weight: 700;
    color: #4b4840;
  }
  .stat-num {
    font-size: 1.6rem;
    font-weight: 800;
  }
  .fin-stat-box small {
    font-size: 0.72rem;
    color: var(--muted);
  }

  /* جداول الحركات والتسويات */
  .table-card {
    background: #ffffff;
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 24px;
    box-shadow: var(--shadow-sm);
  }
  .table-head-flex {
    margin-bottom: 16px;
  }
  .table-head-flex h3 {
    margin: 0 0 4px;
    font-size: 1.1rem;
    color: var(--olive);
  }
  .tab-subtext {
    margin: 0;
    font-size: 0.8rem;
    color: var(--muted);
  }
  .table-responsive {
    overflow-x: auto;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    text-align: right;
  }
  .data-table th {
    background: #faf6f0;
    padding: 10px 14px;
    color: #4b4840;
    font-weight: 700;
    border-bottom: 2px solid var(--line);
    white-space: nowrap;
  }
  .data-table td {
    padding: 12px 14px;
    border-bottom: 1px solid #f0eae0;
    vertical-align: middle;
  }
  .tx-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 700;
  }
  .tx-badge.collect {
    background: #fff3e0;
    color: #e65100;
    border: 1px solid #ffe0b2;
  }
  .tx-badge.earn {
    background: #e8f5e9;
    color: #2e7d32;
    border: 1px solid #c8e6c9;
  }
  .tx-badge.settle {
    background: #e3f2fd;
    color: #1565c0;
    border: 1px solid #bbdefb;
  }
  .driver-profit-tag {
    background: #e8f5e9;
    color: #2e7d32;
    font-weight: 800;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.8rem;
  }
  .balance-tag {
    color: #2b2b28;
    font-size: 0.9rem;
  }
  .text-green { color: #2e7d32 !important; }
  .text-red { color: #c62828 !important; }
  .text-blue { color: #1565c0 !important; }
  .tx-desc {
    color: #55534c;
    line-height: 1.3;
    display: block;
  }
  .empty-state-sm {
    padding: 28px;
    text-align: center;
    color: var(--muted);
    font-size: 0.88rem;
    background: #fbf9f5;
    border-radius: 12px;
  }
  .badge-success {
    background: #e8f5e9;
    color: #2e7d32;
    padding: 2px 8px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 0.76rem;
  }

  @media (max-width: 800px) {
    .driver-financial-banner {
      flex-direction: column;
      align-items: stretch;
    }
    .fin-banner-divider {
      display: none;
    }
    .fin-grid-4, .fin-grid-3 {
      grid-template-columns: 1fr;
    }
  }
</style>

