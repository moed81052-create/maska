<script>
  import { onMount, onDestroy } from 'svelte';
  import { router } from '../stores/router.js';
  import { api } from '../lib/api.js';

  let orderNumberInput = '';
  let orderData = null;
  let loading = false;
  let errorMessage = '';
  let gpsInterval = null;

  // إحداثيات السائق التفاعلية المحاكاة
  let simLat = 32.8872;
  let simLng = 13.1913;
  let simSpeed = 38;

  onMount(async () => {
    // قراءة رقم الطلب من المعلمات إذا توفر
    const qOrder = $router.params?.order || $router.params?.orderNumber;
    if (qOrder) {
      orderNumberInput = qOrder;
      loadOrder(qOrder);
    } else {
      orderNumberInput = '1048';
      loadOrder('1048');
    }

    // محاكاة تحرك السائق وتحديث موقعه كل 5 ثوانٍ
    gpsInterval = setInterval(() => {
      if (orderData && orderData.order && orderData.order.status === 'out_for_delivery') {
        simLat += (Math.random() - 0.48) * 0.001;
        simLng += (Math.random() - 0.48) * 0.001;
        simSpeed = Math.floor(30 + Math.random() * 25);
      }
    }, 4000);
  });

  onDestroy(() => {
    if (gpsInterval) clearInterval(gpsInterval);
  });

  async function loadOrder(num) {
    if (!num) return;
    loading = true;
    errorMessage = '';
    try {
      const res = await api.getOrderDetails(num.trim());
      if (res && res.success && res.data) {
        orderData = res.data;
        if (orderData.order && orderData.order.driver_lat) {
          simLat = Number(orderData.order.driver_lat);
          simLng = Number(orderData.order.driver_lng);
        }
      }
    } catch (err) {
      orderData = null;
      errorMessage = `لم نعثر على الطلب رقم #${num}. تأكد من صحة الرقم أو اتصل بفريق الدعم.`;
    } finally {
      loading = false;
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    loadOrder(orderNumberInput);
  }

  // مراحل الطلب الأربعة
  const stages = [
    { key: 'confirmed', label: 'تم تأكيد الطلب', desc: 'تم استلام طلبك ومراجعته بنجاح' },
    { key: 'preparing', label: 'جاري التنسيق في الأتيليه', desc: 'يقوم منسق الورد بتجهيز الباقة وختم الكرت' },
    { key: 'out_for_delivery', label: 'في الطريق للتوصيل', desc: 'استلم السائق الباقة وهي في طريقها إليك بسيارة مبردة' },
    { key: 'delivered', label: 'تم التسليم بنجاح', desc: 'وصلت الباقة بحمد الله وزرعت الابتسامة 🌸' }
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
</script>

<div class="track-page fade-in">
  <div class="container">
    <div class="track-header">
      <span class="badge badge-lime">تتبع مسار الطلب لحظة بلحظة 📍</span>
      <h1 class="page-title">شاشة التتبع المباشر للطلب</h1>
      <p class="page-subtitle">
        تابع مراحل تجهيز الباقة في الأتيليه، وموقع السائق المباشر عبر الـ GPS حتى وصولها للمستلم.
      </p>

      <!-- نموذج البحث برقم الطلب -->
      <form class="search-order-form" on:submit={handleSearch}>
        <input 
          type="text" 
          class="input-field search-input" 
          placeholder="أدخل رقم الطلب (مثال: 1048، 1049، 1050)" 
          bind:value={orderNumberInput} 
          required 
        />
        <button type="submit" class="btn btn-primary" disabled={loading}>
          {loading ? 'جاري البحث...' : 'تتبع الآن 🔍'}
        </button>
      </form>

      <div class="quick-orders-nav">
        <span>أو اختر طلباً للاختبار السريع: </span>
        <button type="button" on:click={() => { orderNumberInput = '1048'; loadOrder('1048'); }}>#1048 (مكتمل)</button>
        <button type="button" on:click={() => { orderNumberInput = '1049'; loadOrder('1049'); }}>#1049 (جاري التنسيق)</button>
        <button type="button" on:click={() => { orderNumberInput = '1050'; loadOrder('1050'); }}>#1050 (في الطريق 🚗)</button>
        <button type="button" on:click={() => { orderNumberInput = '1051'; loadOrder('1051'); }}>#1051 (مؤكد)</button>
      </div>
    </div>

    {#if errorMessage}
      <div class="error-card fade-in">
        <span>⚠️ {errorMessage}</span>
      </div>
    {/if}

    {#if orderData && orderData.order}
      {@const o = orderData.order}
      {@const currentStageIdx = getStageIndex(o.status)}

      <div class="track-content-grid">
        <!-- 1. العمود الأيمن: خط المراحل والتفاصيل -->
        <div class="track-main-col">
          <!-- شريط المراحل الزمني -->
          <div class="card timeline-card">
            <div class="order-top-banner">
              <div>
                <span class="order-num-tag">طلب رقم #{o.order_number}</span>
                <h3 class="recipient-headline">المستلم: {o.recipient_name}</h3>
              </div>
              <span class="status-pill status-{o.status}">
                {stages[currentStageIdx]?.label || o.status}
              </span>
            </div>

            <!-- مؤشر الخطوات الأربعة -->
            <div class="timeline-stepper">
              {#each stages as stage, idx}
                <div class="step-node" class:completed={idx <= currentStageIdx} class:active={idx === currentStageIdx}>
                  <div class="node-marker">
                    {#if idx < currentStageIdx}
                      ✓
                    {:else}
                      {idx + 1}
                    {/if}
                  </div>
                  <div class="node-text">
                    <span class="node-title">{stage.label}</span>
                    <span class="node-desc">{stage.desc}</span>
                  </div>
                </div>
              {/each}
            </div>

            <div class="delivery-time-slot">
              <span>📅 موعد التوصيل المحدد:</span>
              <b>{o.delivery_window || 'اليوم — خلال 3 ساعات'}</b>
            </div>
          </div>

          <!-- تفاصيل السائق والمنسق -->
          <div class="card staff-card">
            <h3>طاقم تجهيز وتوصيل مسكة 🌸</h3>
            <div class="staff-grid">
              <div class="staff-box">
                <span class="staff-role">منسق الورد في الأتيليه:</span>
                <h4 class="staff-name">{o.florist_name || 'فاطمة الورفلي (منسقة معتمدة)'}</h4>
                <p class="staff-desc">تنسيق يدوي وعناية فائقة بكل ساق زهور</p>
              </div>

              <div class="staff-box">
                <span class="staff-role">سائق التوصيل المعتمد:</span>
                <h4 class="staff-name">{o.driver_name || 'طارق الزوي'}</h4>
                <div class="vehicle-info">
                  <span>🚗 {o.vehicle_type || 'تويوتا كورولا مكيفة'}</span>
                  <span>لوحة: {o.plate_number || 'طرابلس 5-12345'}</span>
                </div>
                {#if o.driver_phone}
                  <a href="tel:{o.driver_phone}" class="call-driver-btn">
                    📞 اتصال بالسائق ({o.driver_phone})
                  </a>
                {/if}
              </div>
            </div>
          </div>

          <!-- عناصر الطلب وبطاقة الإهداء -->
          <div class="card items-card">
            <h3>محتويات الباقة والهدية 💐</h3>
            <div class="ordered-items-list">
              {#each orderData.items as item (item.id)}
                <div class="order-item-tile">
                  <div class="item-name-group">
                    <span class="flower-icon">🌸</span>
                    <div>
                      <h4>{item.item_title}</h4>
                      {#if item.wrap_type}
                        <small>التغليف: {item.wrap_type} | الشريط: {item.ribbon_color}</small>
                      {/if}
                    </div>
                  </div>
                  <div class="item-price-group">
                    <span>{item.quantity} × {item.unit_price} د.ل</span>
                    <b>{item.total_price} د.ل</b>
                  </div>
                </div>

                {#if item.wax_seal_text}
                  <div class="wax-seal-preview-box">
                    <div class="seal-stamp-circle" style="background: #851b2f;">
                      {item.seal_stamp || 'MASKA 🌸'}
                    </div>
                    <div class="card-written-content">
                      <span class="card-label">نص كرت الإهداء المكتوب بخط اليد:</span>
                      <p class="handwritten-note">"{item.wax_seal_text}"</p>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>

            <div class="bill-summary">
              <div class="bill-line">
                <span>قيمة الباقات:</span>
                <span>{o.subtotal} د.ل</span>
              </div>
              {#if o.discount_amount > 0}
                <div class="bill-line discount">
                  <span>خصم كود التخفيض:</span>
                  <span>-{o.discount_amount} د.ل</span>
                </div>
              {/if}
              <div class="bill-line">
                <span>رسوم التوصيل ({o.delivery_city} - {o.delivery_zone}):</span>
                <span>{o.delivery_fee} د.ل</span>
              </div>
              <div class="bill-line total">
                <span>المبلغ الإجمالي المدفوع:</span>
                <span class="total-num">{o.total_amount} د.ل</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. العمود الأيسر: خريطة التتبع المباشر بالـ GPS -->
        <aside class="track-map-col">
          <div class="card map-card">
            <div class="map-header">
              <h3>التتبع الجغرافي الحي (GPS) 📍</h3>
              {#if o.status === 'out_for_delivery'}
                <span class="live-pulse-badge">🔴 بث مباشر للسائق</span>
              {:else}
                <span class="idle-badge">جاهزية المسار</span>
              {/if}
            </div>

            <!-- محاكي الخريطة التفاعلية -->
            <div class="gps-map-canvas">
              <div class="map-grid-lines"></div>
              
              <!-- مسار التوصيل المبرمج -->
              <svg class="map-route-svg" viewBox="0 0 300 240">
                <path d="M 50 200 Q 150 140 250 60" fill="none" stroke="var(--olive-light)" stroke-width="4" stroke-dasharray="6,6" />
              </svg>

              <!-- موقع المستلم / الوجهة -->
              <div class="map-pin destination-pin">
                <span class="pin-icon">🏡</span>
                <span class="pin-label">{o.delivery_city} - {o.delivery_zone}</span>
              </div>

              <!-- موقع السائق المتحرك -->
              <div class="map-pin driver-pin" class:moving={o.status === 'out_for_delivery'}>
                <span class="radar-ripple"></span>
                <span class="pin-icon">🚗</span>
                <span class="pin-label">{o.driver_name || 'السائق'} ({simSpeed} كم/س)</span>
              </div>
            </div>

            <div class="map-telemetry">
              <div class="telemetry-item">
                <span>إحداثيات العرض (Lat):</span>
                <b>{simLat.toFixed(4)}° N</b>
              </div>
              <div class="telemetry-item">
                <span>إحداثيات الطول (Lng):</span>
                <b>{simLng.toFixed(4)}° E</b>
              </div>
              <div class="telemetry-item">
                <span>سرعة المركبة:</span>
                <b>{o.status === 'out_for_delivery' ? simSpeed : 0} كم/س</b>
              </div>
              <div class="telemetry-item">
                <span>عنوان التسليم:</span>
                <b>{o.delivery_address_details || o.delivery_city}</b>
              </div>
            </div>

            <div class="guarantee-box">
              <span>🌸 سيارة التوصيل مجهزة بنظام تبريد مستمر للحفاظ على نضارة كل ساق زهور حتى باب منزلك.</span>
            </div>
          </div>
        </aside>
      </div>
    {/if}
  </div>
</div>

<style>
  .track-page {
    padding: 40px 0 80px;
    background: var(--bg);
  }
  .track-header {
    text-align: center;
    max-width: 680px;
    margin: 0 auto 40px;
  }
  .page-title {
    font-size: 2.3rem;
    font-weight: 800;
    color: var(--olive);
    margin: 12px 0 8px;
    font-family: 'Cairo', sans-serif;
  }
  .page-subtitle {
    font-size: 1.05rem;
    color: var(--text-muted);
    line-height: 1.7;
    margin-bottom: 24px;
  }
  .search-order-form {
    display: flex;
    gap: 12px;
    max-width: 480px;
    margin: 0 auto 16px;
  }
  .search-input {
    flex: 1;
    text-align: center;
    font-weight: 700;
  }
  .quick-orders-nav {
    font-size: 0.85rem;
    color: var(--muted);
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .quick-orders-nav button {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    color: var(--olive);
    padding: 3px 10px;
    border-radius: var(--radius-full);
    font-weight: 700;
    cursor: pointer;
  }
  .error-card {
    background: var(--pink);
    border: 1px solid var(--pink-2);
    color: var(--price);
    padding: 16px 24px;
    border-radius: var(--radius-md);
    max-width: 600px;
    margin: 0 auto 30px;
    text-align: center;
    font-weight: 700;
  }
  .track-content-grid {
    display: grid;
    grid-template-columns: 1.25fr 0.9fr;
    gap: 36px;
    align-items: start;
  }
  .track-main-col {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 28px;
    box-shadow: var(--shadow-sm);
  }
  .order-top-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    border-bottom: 1px solid var(--line);
    padding-bottom: 16px;
  }
  .order-num-tag {
    font-size: 0.9rem;
    color: var(--muted);
    font-weight: 700;
  }
  .recipient-headline {
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--olive);
    margin: 4px 0 0;
  }
  .status-pill {
    padding: 6px 16px;
    border-radius: var(--radius-full);
    font-size: 0.88rem;
    font-weight: 700;
  }
  .status-confirmed { background: var(--pink); color: var(--rose-text); }
  .status-preparing { background: var(--lime); color: var(--olive); }
  .status-out_for_delivery { background: #e3f2fd; color: #1976d2; }
  .status-delivered { background: #e8f5e9; color: #2e7d32; }

  /* Stepper */
  .timeline-stepper {
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: relative;
    margin-left: 20px;
  }
  .timeline-stepper::before {
    content: '';
    position: absolute;
    top: 20px;
    bottom: 20px;
    right: 17px;
    width: 2px;
    background: var(--line);
    z-index: 1;
  }
  .step-node {
    display: flex;
    gap: 18px;
    position: relative;
    z-index: 2;
  }
  .node-marker {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--card-solid);
    border: 2px solid var(--line-strong);
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.9rem;
    flex-shrink: 0;
  }
  .step-node.completed .node-marker {
    background: var(--olive);
    border-color: var(--olive);
    color: #fff;
  }
  .step-node.active .node-marker {
    box-shadow: 0 0 0 4px var(--olive-glow);
    border-color: var(--olive);
    color: var(--olive);
  }
  .node-title {
    display: block;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text);
  }
  .step-node.completed .node-title {
    color: var(--olive);
  }
  .node-desc {
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  .delivery-time-slot {
    margin-top: 24px;
    background: var(--bg);
    padding: 12px 18px;
    border-radius: var(--radius-sm);
    display: flex;
    justify-content: space-between;
    font-size: 0.92rem;
  }

  /* Staff */
  .staff-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 16px;
  }
  .staff-box {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 18px;
  }
  .staff-role {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--muted);
    display: block;
    margin-bottom: 4px;
  }
  .staff-name {
    font-size: 1.08rem;
    font-weight: 800;
    color: var(--text);
    margin: 0 0 6px;
  }
  .staff-desc {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: 0;
  }
  .vehicle-info {
    display: flex;
    flex-direction: column;
    font-size: 0.82rem;
    color: var(--text-muted);
    gap: 2px;
    margin-bottom: 12px;
  }
  .call-driver-btn {
    display: inline-block;
    background: var(--olive);
    color: #fff;
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
  }

  /* Items */
  .ordered-items-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 16px 0;
  }
  .order-item-tile {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg);
    border-radius: var(--radius-sm);
  }
  .item-name-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .flower-icon {
    font-size: 1.5rem;
  }
  .item-name-group h4 {
    margin: 0;
    font-size: 1rem;
    color: var(--text);
  }
  .item-name-group small {
    color: var(--muted);
    font-size: 0.8rem;
  }
  .item-price-group {
    text-align: left;
    display: flex;
    flex-direction: column;
  }
  .item-price-group b {
    color: var(--price);
    font-size: 1.1rem;
  }
  .wax-seal-preview-box {
    display: flex;
    gap: 16px;
    align-items: center;
    background: #fdfaf6;
    border: 1px dashed #d8c2b5;
    border-radius: var(--radius-md);
    padding: 16px;
  }
  .seal-stamp-circle {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.75rem;
    text-align: center;
    flex-shrink: 0;
    box-shadow: 0 4px 10px rgba(133, 27, 47, 0.35);
  }
  .card-label {
    font-size: 0.78rem;
    color: var(--muted);
    font-weight: 700;
  }
  .handwritten-note {
    font-family: 'Cormorant Garamond', 'Cairo', serif;
    font-size: 1.1rem;
    font-style: italic;
    color: #4a382f;
    margin: 4px 0 0;
  }
  .bill-summary {
    border-top: 1.5px solid var(--line);
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bill-line {
    display: flex;
    justify-content: space-between;
    font-size: 0.92rem;
    color: var(--text-muted);
  }
  .bill-line.discount {
    color: var(--price);
  }
  .bill-line.total {
    border-top: 1px solid var(--line);
    padding-top: 10px;
    font-size: 1.2rem;
    font-weight: 800;
    color: var(--text);
  }
  .total-num {
    color: var(--price);
  }

  /* Map */
  .track-map-col {
    position: sticky;
    top: 90px;
  }
  .map-card {
    padding: 24px;
  }
  .map-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .map-header h3 {
    margin: 0;
    font-size: 1.15rem;
    color: var(--olive);
  }
  .live-pulse-badge {
    background: #ffebee;
    color: #c62828;
    font-size: 0.75rem;
    font-weight: 800;
    padding: 3px 10px;
    border-radius: var(--radius-full);
    animation: pulseRed 1.5s infinite;
  }
  @keyframes pulseRed {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .idle-badge {
    background: var(--lime);
    color: var(--olive);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: var(--radius-full);
  }
  .gps-map-canvas {
    background: #eef2eb;
    border-radius: var(--radius-md);
    height: 240px;
    position: relative;
    overflow: hidden;
    border: 1px solid var(--line-strong);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .map-grid-lines {
    position: absolute;
    inset: 0;
    background-size: 24px 24px;
    background-image: 
      linear-gradient(to right, rgba(94, 107, 44, 0.08) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(94, 107, 44, 0.08) 1px, transparent 1px);
  }
  .map-route-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .map-pin {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .destination-pin {
    top: 30px;
    right: 40px;
  }
  .driver-pin {
    bottom: 40px;
    left: 50px;
  }
  .driver-pin.moving {
    animation: moveAlong 6s infinite alternate ease-in-out;
  }
  @keyframes moveAlong {
    0% { transform: translate(0, 0); }
    100% { transform: translate(70px, -40px); }
  }
  .pin-icon {
    font-size: 1.8rem;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
  }
  .pin-label {
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid var(--line-strong);
    padding: 2px 8px;
    border-radius: var(--radius-full);
    font-size: 0.72rem;
    font-weight: 800;
    color: var(--text);
    white-space: nowrap;
    margin-top: 2px;
  }
  .radar-ripple {
    position: absolute;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(94, 107, 44, 0.3);
    animation: ripple 1.6s infinite ease-out;
    top: -5px;
  }
  @keyframes ripple {
    0% { transform: scale(0.6); opacity: 1; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  .map-telemetry {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin: 16px 0;
  }
  .telemetry-item {
    background: var(--bg);
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    font-size: 0.8rem;
  }
  .telemetry-item span {
    display: block;
    color: var(--muted);
  }
  .telemetry-item b {
    color: var(--text);
  }
  .guarantee-box {
    background: var(--lime);
    color: var(--olive-darker);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    font-size: 0.82rem;
    font-weight: 600;
    line-height: 1.5;
  }

  @media (max-width: 900px) {
    .track-content-grid {
      grid-template-columns: 1fr;
    }
    .staff-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

