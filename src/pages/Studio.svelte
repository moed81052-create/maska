<script>
  import { onMount } from 'svelte';
  import { router } from '../stores/router.js';
  import { cart } from '../stores/cart.js';
  import { api } from '../lib/api.js';

  // قائمة الزهور الافتراضية
  let flowers = [
    { id: 1, name: 'جوري أحمر مخملي', color: '#c02741', unit_price: 6.0, qty: 5, stock_quantity: 150 },
    { id: 2, name: 'أوركيد عاجي ناصع', color: '#f7f4ed', unit_price: 12.0, qty: 2, stock_quantity: 45 },
    { id: 3, name: 'عباد الشمس الذهبي', color: '#f4b41a', unit_price: 7.0, qty: 0, stock_quantity: 60 },
    { id: 4, name: 'زنابق الليلي العطرة', color: '#fceded', unit_price: 10.0, qty: 2, stock_quantity: 35 },
    { id: 5, name: 'توليب هولندي زهري', color: '#f17296', unit_price: 8.5, qty: 3, stock_quantity: 70 },
    { id: 6, name: 'جيبسوفيلا (نَفَس الطفل)', color: '#e8f0fe', unit_price: 4.5, qty: 2, stock_quantity: 110 }
  ];

  // خيارات التغليف
  const wrapOptions = [
    { id: 'kraft', name: 'ورق كرافت فاخر', price: 10, color: '#c8a882' },
    { id: 'olive', name: 'زيتي مطفي ملكي', price: 12, color: '#5e6b2c' },
    { id: 'blush', name: 'وردي مخملي ناعم', price: 12, color: '#f2c0cc' },
    { id: 'black', name: 'أسود فاحم سهرة', price: 15, color: '#2b2b28' }
  ];
  let selectedWrap = wrapOptions[0];

  // خيارات الشريط
  const ribbonOptions = [
    { id: 'gold_rose', name: 'وردي مذهب', color: '#d4889c' },
    { id: 'sage', name: 'زيتي مسكة', color: '#5e6b2c' },
    { id: 'crimson', name: 'أحمر قرمزي', color: '#963547' },
    { id: 'silk_white', name: 'حرير عاجي', color: '#fcf8f6' }
  ];
  let selectedRibbon = ribbonOptions[0];

  // خيارات الختم الشمعي
  const waxSealColors = [
    { id: 'red', name: 'أحمر قرمزي ملكي', hex: '#851b2f' },
    { id: 'gold', name: 'ذهبي عتيق', hex: '#c59b27' },
    { id: 'olive', name: 'أخضر زيتي مسكة', hex: '#48551f' }
  ];
  let selectedWaxColor = waxSealColors[0];

  let cardMessage = 'أجمل اللحظات هي التي تبدأ بوردة صادقة…';
  let sealStamp = 'MASKA 🌸';
  let is3DRotating = true;
  let addedToast = false;

  onMount(async () => {
    try {
      const res = await api.getInventory();
      if (res && res.data && res.data.length > 0) {
        // تحديث الأسعار والمخزون الحي من الداتا بيس
        flowers = flowers.map(f => {
          const matched = res.data.find(inv => inv.id === f.id || inv.name_ar.includes(f.name.split(' ')[0]));
          if (matched) {
            return {
              ...f,
              name: matched.name_ar,
              unit_price: matched.unit_price,
              stock_quantity: matched.stock_quantity
            };
          }
          return f;
        });
      }
    } catch (e) {
      console.log('Using default flower pricing');
    }
  });

  function adjustQty(flowerId, delta) {
    flowers = flowers.map(f => {
      if (f.id === flowerId) {
        const nextQty = Math.max(0, Math.min(f.stock_quantity, f.qty + delta));
        return { ...f, qty: nextQty };
      }
      return f;
    });
  }

  $: totalStems = flowers.reduce((sum, f) => sum + f.qty, 0);
  $: flowersCost = flowers.reduce((sum, f) => sum + (f.qty * f.unit_price), 0);
  $: grandTotal = Math.round(flowersCost + (selectedWrap.price || 0));

  function handleAddCustomToCart() {
    if (totalStems < 3) {
      alert('الرجاء اختيار 3 سيقان زهور على الأقل لتنسيق باقة متناسقة 🌸');
      return;
    }

    const selectedFlowersList = flowers
      .filter(f => f.qty > 0)
      .map(f => ({ name: f.name, quantity: f.qty, price: f.unit_price }));

    cart.addItem({
      title: `باقة مخصصة (${totalStems} سيقان)`,
      price: grandTotal,
      quantity: 1,
      image: '/assets/bouquet-sage-whisper.svg',
      isCustom: true,
      wrapType: selectedWrap.name,
      ribbonColor: selectedRibbon.name,
      waxSealText: cardMessage,
      flowers: selectedFlowersList
    });

    addedToast = true;
    setTimeout(() => {
      addedToast = false;
      router.navigate('/cart');
    }, 1200);
  }
</script>

<div class="studio-page fade-in">
  <div class="container">
    <div class="studio-header">
      <span class="badge badge-lime">استوديو التصميم الحي 💐</span>
      <h1 class="page-title">صمّم باقتك قطعة بقطعة</h1>
      <p class="page-subtitle">
        اختر أنواع الورد الطبيعي وسيقانه بدقة، حدّد نوع التغليف الملكي، واكتب كرت الإهداء ليُختم بالشمع الأحمر الفاخر.
      </p>
    </div>

    {#if addedToast}
      <div class="studio-toast fade-in">
        🌸 تمت إضافة باقتك المخصصة للسلة! جاري نقلك للدفع...
      </div>
    {/if}

    <div class="studio-layout">
      <!-- 1. لوحة الخيارات والتحكم -->
      <div class="studio-controls">
        <!-- أ. اختيار الزهور -->
        <div class="card control-box">
          <div class="box-head">
            <h3>1. اختيار زهور الباقة الطبيعية</h3>
            <span class="count-badge">{totalStems} ساق مختارة</span>
          </div>
          <p class="box-desc">ورد طبيعي مستورد طازج، يُنسق فورياً حسب طلبك في الاستوديو:</p>

          <div class="flowers-list">
            {#each flowers as f (f.id)}
              <div class="flower-row">
                <div class="flower-meta">
                  <span class="color-dot" style="background-color: {f.color};"></span>
                  <div>
                    <h4 class="flower-name">{f.name}</h4>
                    <span class="flower-stock">المخزون المتوفر: {f.stock_quantity} ساق</span>
                  </div>
                </div>

                <div class="flower-price">
                  {f.unit_price} د.ل
                  <small>/ساق</small>
                </div>

                <div class="qty-counter">
                  <button 
                    type="button" 
                    class="counter-btn" 
                    disabled={f.qty <= 0} 
                    on:click={() => adjustQty(f.id, -1)}
                  >
                    -
                  </button>
                  <span class="qty-val">{f.qty}</span>
                  <button 
                    type="button" 
                    class="counter-btn" 
                    disabled={f.qty >= f.stock_quantity} 
                    on:click={() => adjustQty(f.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- ب. اختيار ورق التغليف الفاخر -->
        <div class="card control-box">
          <div class="box-head">
            <h3>2. نوع التغليف الملكي</h3>
            <span class="selected-text">{selectedWrap.name} ({selectedWrap.price} د.ل)</span>
          </div>
          <div class="options-grid">
            {#each wrapOptions as wrap (wrap.id)}
              <div 
                class="option-pill" 
                class:selected={selectedWrap.id === wrap.id}
                on:click={() => selectedWrap = wrap}
              >
                <span class="option-color" style="background: {wrap.color};"></span>
                <span>{wrap.name}</span>
                <small>+{wrap.price} د.ل</small>
              </div>
            {/each}
          </div>
        </div>

        <!-- ج. شريط الساتان -->
        <div class="card control-box">
          <div class="box-head">
            <h3>3. لون شريط الساتان</h3>
            <span class="selected-text">{selectedRibbon.name}</span>
          </div>
          <div class="options-grid">
            {#each ribbonOptions as ribbon (ribbon.id)}
              <div 
                class="option-pill" 
                class:selected={selectedRibbon.id === ribbon.id}
                on:click={() => selectedRibbon = ribbon}
              >
                <span class="option-color" style="background: {ribbon.color};"></span>
                <span>{ribbon.name}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- د. كرت الإهداء والختم الشمعي -->
        <div class="card control-box">
          <div class="box-head">
            <h3>4. كرت الإهداء المكتوب بخط اليد مع الختم الشمعي (مجاناً)</h3>
          </div>
          <div class="card-message-box">
            <label>نص الإهداء المكتوب على الكرت:</label>
            <textarea 
              rows="3" 
              class="textarea-field" 
              bind:value={cardMessage} 
              placeholder="اكتب رسالتك الدافئة لمن تحب..."
            ></textarea>
          </div>

          <div class="seal-config">
            <div>
              <label>لون الختم الشمعي:</label>
              <div class="wax-colors">
                {#each waxSealColors as wax (wax.id)}
                  <button 
                    type="button" 
                    class="wax-dot" 
                    class:active={selectedWaxColor.id === wax.id}
                    style="background: {wax.hex};" 
                    title={wax.name}
                    on:click={() => selectedWaxColor = wax}
                  ></button>
                {/each}
                <span class="wax-name">{selectedWaxColor.name}</span>
              </div>
            </div>
            <div>
              <label>نقشة الختم:</label>
              <select class="input-field" bind:value={sealStamp}>
                <option value="MASKA 🌸">MASKA 🌸 (شعار مسكة الرسمي)</option>
                <option value="زهرة اللوتس 🪷">زهرة اللوتس الملكية</option>
                <option value="غصن الزيتون 🌿">غصن الزيتون والأصالة</option>
                <option value="تاج المحبة 👑">تاج المحبة والتقدير</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. بطاقة المعاينة المباشرة (Sticky Preview) -->
      <aside class="studio-preview-col">
        <div class="card preview-card">
          <div class="preview-header">
            <h3>معاينة الباقة</h3>
            <button 
              type="button" 
              class="toggle-spin-btn" 
              class:active={is3DRotating}
              on:click={() => is3DRotating = !is3DRotating}
            >
              {is3DRotating ? 'إيقاف الدوران ⏸' : 'دوران 360° 🔄'}
            </button>
          </div>

          <div class="preview-canvas-box">
            <div class="preview-stage">
              <img 
                src="/assets/bouquet-sage-whisper.svg" 
                alt="معاينة الباقة المخصصة" 
                class="bouquet-visual" 
                class:rotating={is3DRotating} 
              />
              <div class="stage-plate"></div>
            </div>
          </div>

          <div class="preview-summary">
            <div class="summary-line">
              <span>زهور طبيعية ({totalStems} ساق):</span>
              <b>{flowersCost.toFixed(1)} د.ل</b>
            </div>
            <div class="summary-line">
              <span>التغليف ({selectedWrap.name}):</span>
              <b>{selectedWrap.price} د.ل</b>
            </div>
            <div class="summary-line">
              <span>شريط الساتان والختم الشمعي:</span>
              <b class="free-tag">مجاني 🌸</b>
            </div>

            <div class="total-bar">
              <span>إجمالي الباقة:</span>
              <span class="total-price">{grandTotal} د.ل</span>
            </div>

            <button 
              type="button" 
              class="btn btn-primary btn-block btn-lg" 
              on:click={handleAddCustomToCart}
            >
              أضف الباقة المخصصة للسلة 🛍️
            </button>

            <button 
              type="button" 
              class="btn btn-outline btn-block" 
              style="margin-top: 10px;"
              on:click={() => router.navigate('/designer')}
            >
              جرب تركيبها في المصمم التفاعلي 3D ✨
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</div>

<style>
  .studio-page {
    padding: 40px 0 80px;
    background: var(--bg);
  }
  .studio-header {
    text-align: center;
    max-width: 680px;
    margin: 0 auto 40px;
  }
  .page-title {
    font-size: 2.4rem;
    font-weight: 800;
    color: var(--olive);
    margin: 12px 0 8px;
    font-family: 'Cairo', sans-serif;
  }
  .page-subtitle {
    font-size: 1.05rem;
    color: var(--text-muted);
    line-height: 1.7;
  }
  .studio-layout {
    display: grid;
    grid-template-columns: 1.3fr 0.85fr;
    gap: 36px;
    align-items: start;
  }
  .studio-controls {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .control-box {
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
    margin-bottom: 6px;
  }
  .box-head h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text);
    margin: 0;
  }
  .count-badge {
    background: var(--lime);
    color: var(--olive);
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 0.82rem;
    font-weight: 700;
  }
  .box-desc {
    font-size: 0.88rem;
    color: var(--text-muted);
    margin-bottom: 20px;
  }
  .flowers-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .flower-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: var(--bg);
    border-radius: var(--radius-md);
    border: 1px solid var(--line);
  }
  .flower-meta {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .color-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  }
  .flower-name {
    font-size: 0.98rem;
    font-weight: 700;
    margin: 0 0 2px;
    color: var(--text);
  }
  .flower-stock {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .flower-price {
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--price);
  }
  .flower-price small {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .qty-counter {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    padding: 4px 8px;
    border-radius: var(--radius-full);
  }
  .counter-btn {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: var(--olive);
    color: #fff;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .counter-btn:disabled {
    background: var(--line-strong);
    cursor: not-allowed;
  }
  .qty-val {
    font-size: 1rem;
    font-weight: 800;
    min-width: 20px;
    text-align: center;
  }
  .options-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-top: 14px;
  }
  .option-pill {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: var(--bg);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
    transition: all 0.2s ease;
  }
  .option-pill:hover, .option-pill.selected {
    border-color: var(--olive);
    background: var(--card);
  }
  .option-pill.selected {
    box-shadow: 0 0 0 2px var(--olive-glow);
  }
  .option-color {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1.5px solid #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  .card-message-box {
    margin-bottom: 20px;
  }
  .seal-config {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    border-top: 1px solid var(--line);
    padding-top: 18px;
  }
  .wax-colors {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }
  .wax-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid #fff;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    transition: transform 0.2s;
  }
  .wax-dot.active {
    transform: scale(1.2);
    box-shadow: 0 0 0 2px var(--olive);
  }
  .wax-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  /* Preview Card */
  .studio-preview-col {
    position: sticky;
    top: 90px;
  }
  .preview-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 28px;
    box-shadow: var(--shadow-lg);
  }
  .preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }
  .preview-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--olive);
  }
  .toggle-spin-btn {
    background: var(--bg);
    border: 1px solid var(--line-strong);
    padding: 6px 14px;
    border-radius: var(--radius-full);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
  }
  .preview-canvas-box {
    background: var(--bg);
    border-radius: var(--radius-md);
    padding: 30px;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 260px;
    position: relative;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .preview-stage {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .bouquet-visual {
    width: 170px;
    height: auto;
    filter: drop-shadow(0 12px 24px rgba(94, 107, 44, 0.2));
    transition: transform 0.5s ease;
  }
  .bouquet-visual.rotating {
    animation: rotateBouquet 12s infinite ease-in-out;
  }
  @keyframes rotateBouquet {
    0%, 100% { transform: rotate(0deg) scale(1); }
    50% { transform: rotate(15deg) scale(1.05); }
  }
  .stage-plate {
    width: 190px;
    height: 30px;
    border-radius: 50%;
    background: radial-gradient(ellipse at center, rgba(94, 107, 44, 0.25) 0%, rgba(94, 107, 44, 0.02) 70%);
    margin-top: -15px;
  }
  .preview-summary {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .summary-line {
    display: flex;
    justify-content: space-between;
    font-size: 0.92rem;
    color: var(--text-muted);
  }
  .free-tag {
    color: var(--olive);
    font-weight: 700;
  }
  .total-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1.5px solid var(--line);
    margin-top: 8px;
    padding-top: 14px;
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text);
  }
  .total-price {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--price);
  }
  .studio-toast {
    background: var(--lime);
    color: var(--olive-darker);
    padding: 14px;
    border-radius: var(--radius-sm);
    text-align: center;
    font-weight: 700;
    margin-bottom: 24px;
  }

  @media (max-width: 900px) {
    .studio-layout {
      grid-template-columns: 1fr;
    }
  }
</style>

