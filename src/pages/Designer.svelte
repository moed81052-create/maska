<script>
  import { router } from '../stores/router.js';
  import { cart } from '../stores/cart.js';

  let budget = 120;
  let selectedOccasion = 'عيد ميلاد';
  let selectedPalette = 'وردي باستيل';
  let noteText = 'أتمنى لك عاماً مليئاً بالبهجة والزهور الجميلة مثلك 🌸';

  const occasions = [
    { name: 'عيد ميلاد', icon: '🎂', defaultNote: 'أتمنى لك عاماً مليئاً بالبهجة والزهور الجميلة مثلك 🌸' },
    { name: 'زفاف وخطوبة', icon: '💍', defaultNote: 'بارك الله لكما وبارك عليكما وجمع بينكما في خير 🤍' },
    { name: 'تخرج ونجاح', icon: '🎓', defaultNote: 'مبارك التخرج وجعل الله أيامك القادمة نجاحاً وتألقاً 👑' },
    { name: 'اعتذار ومودة', icon: '🕊️', defaultNote: 'مكانتك في القلب لا يعوضها أحد، أرجو قبول هذا الورد بكل ود ❤️' },
    { name: 'شكر وامتنان', icon: '✨', defaultNote: 'شكراً من أعماق القلب على كل ما قدمته، وردة لا تفي حقك 🌿' }
  ];

  const palettes = [
    { name: 'وردي باستيل', color1: '#fae6ea', color2: '#da8699' },
    { name: 'أبيض عاجي ملكي', color1: '#f7f4ed', color2: '#e5dbd4' },
    { name: 'أحمر قرمزي مخملي', color1: '#851b2f', color2: '#c02741' },
    { name: 'مشمشي وذهبي مشرق', color1: '#fceded', color2: '#f4b41a' }
  ];

  // النتيجة المقترحة الذكية
  $: generatedResult = generateBouquetProposal(budget, selectedOccasion, selectedPalette);

  function generateBouquetProposal(b, occ, pal) {
    let title = `باقة ${occ} الفاخرة`;
    let wrap = pal.includes('أبيض') ? 'ورق كرافت عاجي فاخر' : (pal.includes('أحمر') ? 'مخملي أسود سهرة' : 'وردي ناعم مذهب');
    let ribbon = pal.includes('أحمر') ? 'أحمر قرمزي' : 'وردي مذهب';
    let image = pal.includes('أبيض') ? '/assets/bouquet-ivory-elegance.svg' : (pal.includes('أحمر') ? '/assets/bouquet-royal.svg' : '/assets/bouquet-pink-spring.svg');

    let roseCount = Math.max(3, Math.floor((b * 0.4) / 6));
    let orchidCount = Math.max(1, Math.floor((b * 0.3) / 12));
    let lilyCount = Math.max(1, Math.floor((b * 0.2) / 10));
    let totalCalculated = (roseCount * 6) + (orchidCount * 12) + (lilyCount * 10) + 15; // + wrap

    return {
      title,
      price: Math.min(b, Math.round(totalCalculated)),
      wrap,
      ribbon,
      image,
      stems: [
        { name: 'جوري طبيعي نضر', count: roseCount, color: '#c02741' },
        { name: 'أوركيد فاخر', count: orchidCount, color: '#f7f4ed' },
        { name: 'زنابق الليلي العطرة', count: lilyCount, color: '#fceded' },
        { name: 'أغصان جيبسوفيلا مكملة', count: 2, color: '#eef2cd' }
      ]
    };
  }

  function handleOccasionChange(occ) {
    selectedOccasion = occ.name;
    noteText = occ.defaultNote;
  }

  let toast = false;
  function addProposedToCart() {
    cart.addItem({
      title: generatedResult.title,
      price: generatedResult.price,
      quantity: 1,
      image: generatedResult.image,
      isCustom: true,
      wrapType: generatedResult.wrap,
      ribbonColor: generatedResult.ribbon,
      waxSealText: noteText,
      flowers: generatedResult.stems.map(s => ({ name: s.name, quantity: s.count }))
    });

    toast = true;
    setTimeout(() => {
      toast = false;
      router.navigate('/cart');
    }, 1000);
  }
</script>

<div class="designer-page fade-in">
  <div class="container">
    <div class="designer-header">
      <span class="badge badge-pink">المصمم الذكي التفاعلي ✨</span>
      <h1 class="page-title">دع الذكاء الفني يقترح باقتك المثالية</h1>
      <p class="page-subtitle">
        حدد ميزانيتك، مناسبتك، وتدرجات الألوان المفضلة، وسيقوم المصمم الذكي بتوليف باقة فريدة متوازنة هندسياً ولونياً.
      </p>
    </div>

    {#if toast}
      <div class="designer-toast fade-in">
        🌸 تمت إضافة التصميم المقترح إلى سلتك بنجاح!
      </div>
    {/if}

    <div class="designer-grid">
      <!-- 1. معايير التصميم الذكي -->
      <div class="designer-form-col">
        <!-- أ. شريط الميزانية -->
        <div class="card param-box">
          <div class="box-head">
            <h3>1. الميزانية المحددة للهدية</h3>
            <span class="budget-display">{budget} د.ل</span>
          </div>
          <p class="box-desc">حرّك المؤشر وسيقوم النظام بتوزيع الميزانية على أجمل أنواع الزهور:</p>
          
          <div class="slider-wrapper">
            <input 
              type="range" 
              min="50" 
              max="250" 
              step="5" 
              class="budget-slider" 
              bind:value={budget} 
            />
            <div class="slider-markers">
              <span>50 د.ل (بسيطة وأنيقة)</span>
              <span>150 د.ل (ملكية)</span>
              <span>250 د.ل (فخامة كبرى)</span>
            </div>
          </div>
        </div>

        <!-- ب. اختيار المناسبة -->
        <div class="card param-box">
          <div class="box-head">
            <h3>2. ما هي المناسبة؟</h3>
          </div>
          <div class="occasions-selector">
            {#each occasions as occ (occ.name)}
              <button 
                type="button" 
                class="occ-btn" 
                class:active={selectedOccasion === occ.name}
                on:click={() => handleOccasionChange(occ)}
              >
                <span class="occ-icon">{occ.icon}</span>
                <span>{occ.name}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- ج. تناغم الألوان -->
        <div class="card param-box">
          <div class="box-head">
            <h3>3. تدرجات الألوان المرغوبة</h3>
          </div>
          <div class="palettes-selector">
            {#each palettes as pal (pal.name)}
              <div 
                class="palette-chip" 
                class:selected={selectedPalette === pal.name}
                on:click={() => selectedPalette = pal.name}
              >
                <div class="chip-gradient" style="background: linear-gradient(135deg, {pal.color1}, {pal.color2});"></div>
                <span>{pal.name}</span>
              </div>
            {/each}
          </div>
        </div>

        <!-- د. كرت الإهداء المخصص -->
        <div class="card param-box">
          <div class="box-head">
            <h3>4. كرت الإهداء الشمعي المرفق</h3>
          </div>
          <textarea 
            class="textarea-field" 
            rows="3" 
            bind:value={noteText}
            placeholder="اكتب رسالتك..."
          ></textarea>
        </div>
      </div>

      <!-- 2. النتيجة المقترحة التفاعلية -->
      <aside class="designer-result-col">
        <div class="card result-card">
          <div class="result-badge-row">
            <span class="badge badge-lime">اقتراح ذكي متكامل 🌸</span>
            <span class="stems-badge">
              {generatedResult.stems.reduce((a, b) => a + b.count, 0)} ساق
            </span>
          </div>

          <h3 class="result-title">{generatedResult.title}</h3>
          
          <div class="visual-box">
            <img src={generatedResult.image} alt={generatedResult.title} class="result-img" />
          </div>

          <div class="result-details">
            <h4 class="details-heading">تركيبة الزهور المقترحة:</h4>
            <div class="stems-breakdown">
              {#each generatedResult.stems as s (s.name)}
                <div class="stem-row">
                  <div class="stem-name-box">
                    <span class="stem-dot" style="background: {s.color};"></span>
                    <span>{s.name}</span>
                  </div>
                  <b>{s.count} سيقان</b>
                </div>
              {/each}
            </div>

            <div class="meta-row">
              <span>التغليف:</span>
              <b>{generatedResult.wrap}</b>
            </div>
            <div class="meta-row">
              <span>الشريط:</span>
              <b>{generatedResult.ribbon}</b>
            </div>
            <div class="meta-row">
              <span>الختم الشمعي:</span>
              <b class="free-text">أحمر ملكي (مجاناً)</b>
            </div>

            <div class="price-row">
              <span>سعر الباقة الإجمالي:</span>
              <span class="final-price">{generatedResult.price} د.ل</span>
            </div>

            <button 
              type="button" 
              class="btn btn-primary btn-block btn-lg" 
              on:click={addProposedToCart}
            >
              أضف التصميم الذكي للسلة 🛍️
            </button>
          </div>
        </div>
      </aside>
    </div>
  </div>
</div>

<style>
  .designer-page {
    padding: 40px 0 80px;
    background: var(--bg);
  }
  .designer-header {
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
  }
  .designer-grid {
    display: grid;
    grid-template-columns: 1.25fr 0.9fr;
    gap: 36px;
    align-items: start;
  }
  .designer-form-col {
    display: flex;
    flex-direction: column;
    gap: 22px;
  }
  .param-box {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 26px;
    box-shadow: var(--shadow-sm);
  }
  .box-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .box-head h3 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text);
  }
  .budget-display {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--price);
    background: var(--pink);
    padding: 4px 16px;
    border-radius: var(--radius-full);
  }
  .slider-wrapper {
    margin-top: 18px;
  }
  .budget-slider {
    width: 100%;
    accent-color: var(--olive);
    cursor: pointer;
  }
  .slider-markers {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--muted);
    margin-top: 8px;
  }
  .occasions-selector {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 10px;
  }
  .occ-btn {
    background: var(--bg);
    border: 1.5px solid var(--line);
    padding: 12px;
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    font-size: 0.92rem;
    font-weight: 600;
    color: var(--text);
    cursor: pointer;
    transition: all 0.2s;
  }
  .occ-btn:hover, .occ-btn.active {
    border-color: var(--olive);
    background: var(--card);
  }
  .occ-btn.active {
    box-shadow: 0 0 0 2px var(--olive-glow);
    color: var(--olive);
  }
  .occ-icon {
    font-size: 1.4rem;
  }
  .palettes-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .palette-chip {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: var(--bg);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .palette-chip:hover, .palette-chip.selected {
    border-color: var(--olive);
    background: var(--card);
  }
  .palette-chip.selected {
    box-shadow: 0 0 0 2px var(--olive-glow);
  }
  .chip-gradient {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1.5px solid #fff;
    box-shadow: 0 2px 5px rgba(0,0,0,0.15);
  }

  /* Result Card */
  .designer-result-col {
    position: sticky;
    top: 90px;
  }
  .result-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    padding: 30px;
    box-shadow: var(--shadow-lg);
  }
  .result-badge-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .stems-badge {
    background: var(--line);
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: 0.8rem;
    font-weight: 700;
  }
  .result-title {
    font-size: 1.45rem;
    font-weight: 800;
    color: var(--olive);
    margin: 0 0 16px;
  }
  .visual-box {
    background: var(--bg);
    border-radius: var(--radius-md);
    padding: 24px;
    text-align: center;
    margin-bottom: 20px;
  }
  .result-img {
    height: 180px;
    object-fit: contain;
    filter: drop-shadow(0 12px 20px rgba(94, 107, 44, 0.2));
  }
  .details-heading {
    font-size: 0.95rem;
    color: var(--text-muted);
    margin-bottom: 10px;
  }
  .stems-breakdown {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--bg);
    padding: 12px 14px;
    border-radius: var(--radius-sm);
    margin-bottom: 16px;
  }
  .stem-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
  }
  .stem-name-box {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .stem-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .free-text {
    color: var(--olive);
  }
  .price-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1.5px solid var(--line);
    margin-top: 16px;
    padding-top: 14px;
    margin-bottom: 20px;
  }
  .final-price {
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--price);
  }
  .designer-toast {
    background: var(--lime);
    color: var(--olive-darker);
    padding: 14px;
    border-radius: var(--radius-sm);
    text-align: center;
    font-weight: 700;
    margin-bottom: 24px;
  }

  @media (max-width: 900px) {
    .designer-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

