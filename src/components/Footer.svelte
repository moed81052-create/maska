<script>
  import { router } from '../stores/router.js';
  import { isDriver } from '../stores/auth.js';
</script>

{#if $isDriver}
  <footer class="driver-footer">
    <div class="bottom-container">
      <div class="driver-footer-info">
        <span class="symbol">🚗</span>
        <span>مَـسْـكَة — بوابة كابتن التوصيل والخدمات اللوجستية | التواصل المباشر مع غرفة العمليات: <strong>091-1111111</strong></span>
      </div>
      <p class="love">نتمنى لك قيادة آمنة وتوصيلاً مباركاً 🌸</p>
    </div>
  </footer>
{:else}
  <footer class="site-footer">
    <div class="footer-container">
      <div class="footer-col brand-col">
        <div class="footer-logo">
          <span class="symbol">🌸</span>
          <span class="name">مَـسْـكَة</span>
        </div>
        <p class="brand-desc">
          أتيليه متخصص في باقات الزهور الطبيعية الهولندية الفاخرة، المصممة بشغف ومختومة بالشمع الملكي الأحمر مع بطاقات إهداء مخصصة. توصيل فوري ومبرد في جميع المدن الليبية.
        </p>
        <div class="social-links">
          <span class="social-tag">#مسكة_تصلك_بحب</span>
          <span class="social-tag">طرابلس • بنغازي • مصراتة</span>
        </div>
      </div>

      <div class="footer-col">
        <h4 class="col-title">أقسام الأتيليه</h4>
        <ul class="col-links">
          <li><button type="button" on:click={() => router.navigate('/')}>الرئيسية والباقات الجاهزة</button></li>
          <li><button type="button" on:click={() => router.navigate('/studio')}>استوديو تصميم الباقة المخصصة</button></li>
          <li><button type="button" on:click={() => router.navigate('/designer')}>المصمم التفاعلي ثلاثي الأبعاد</button></li>
          <li><button type="button" on:click={() => router.navigate('/cart')}>سلة المشتريات والدفع</button></li>
          <li><button type="button" on:click={() => router.navigate('/track')}>تتبع الطلب وسائق الـ GPS</button></li>
        </ul>
      </div>

      <div class="footer-col">
        <h4 class="col-title">مناطق التوصيل في ليبيا</h4>
        <ul class="col-links">
          <li>طرابلس وضواحيها (سياحية، بن عاشور، النوفليين)</li>
          <li>بنغازي (البركة، الفويهات، الكيش)</li>
          <li>مصراتة (المركز، قصر أحمد)</li>
          <li>الزاوية، جنزور، الخمس، زليتن</li>
        </ul>
      </div>

      <div class="footer-col">
        <h4 class="col-title">تواصل مع مسكة</h4>
        <div class="contact-info">
          <p>📍 طرابلس، زاوية الدهماني — قرب الواجهة البحرية</p>
          <p>📞 هاتف الإدارة والطلبات: <strong>091-1111111</strong></p>
          <p>🕒 ساعات العمل: يومياً من 9:00 ص حتى 11:30 م</p>
          <p>✨ مشروع تخرج نُفذ بأعلى معايير الويب الحديثة (Svelte + Node.js Express + SQLite)</p>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="bottom-container">
        <p>© {new Date().getFullYear()} مسكة — MASKA ATELIER. جميع الحقوق محفوظة.</p>
        <p class="love">صُنع بحب وعناية لأجمل المناسبات 🌸</p>
      </div>
    </div>
  </footer>
{/if}

<style>
  .driver-footer {
    background: var(--card-solid);
    border-top: 2px solid #90caf9;
    margin-top: 40px;
    padding: 20px 24px;
    color: var(--text);
  }
  .driver-footer-info {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.95rem;
    color: var(--text);
  }
  .driver-footer-info strong {
    color: var(--olive);
    font-size: 1.05rem;
  }
  .site-footer {
    background: var(--card-solid);
    border-top: 1px solid var(--line);
    margin-top: 60px;
    padding-top: 50px;
    color: var(--text);
  }
  .footer-container {
    max-width: 1240px;
    margin: 0 auto;
    padding: 0 24px;
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1.5fr;
    gap: 40px;
  }
  .footer-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 1.6rem;
    font-weight: 800;
    color: var(--olive);
    margin-bottom: 12px;
  }
  .brand-desc {
    font-size: 0.92rem;
    color: var(--text-muted);
    line-height: 1.7;
    margin-bottom: 16px;
  }
  .social-links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .social-tag {
    background: var(--pink);
    color: var(--rose-text);
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 0.8rem;
    font-weight: 600;
  }
  .col-title {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--olive);
    margin-bottom: 16px;
    position: relative;
    padding-bottom: 8px;
  }
  .col-title::after {
    content: '';
    position: absolute;
    bottom: 0;
    right: 0;
    width: 32px;
    height: 2px;
    background: var(--olive);
    border-radius: 2px;
  }
  .col-links {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .col-links li button {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 0.92rem;
    cursor: pointer;
    padding: 0;
    text-align: right;
    transition: color 0.2s ease;
  }
  .col-links li button:hover {
    color: var(--olive);
    text-decoration: underline;
  }
  .col-links li {
    font-size: 0.92rem;
    color: var(--text-muted);
  }
  .contact-info p {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 8px;
    line-height: 1.6;
  }
  .footer-bottom {
    border-top: 1px solid var(--line);
    margin-top: 40px;
    padding: 20px 24px;
    font-size: 0.88rem;
    color: var(--muted);
  }
  .bottom-container {
    max-width: 1240px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  @media (max-width: 900px) {
    .footer-container {
      grid-template-columns: 1fr;
      gap: 32px;
    }
  }
</style>

