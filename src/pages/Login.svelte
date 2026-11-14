<script>
  import { router } from '../stores/router.js';
  import { auth } from '../stores/auth.js';
  import { api } from '../lib/api.js';

  let activeTab = 'login'; // 'login' | 'register'

  // بيانات الدخول
  let loginPhone = '';
  let loginPassword = '';
  let loginError = '';
  let loginLoading = false;

  // بيانات إنشاء الحساب
  let regName = '';
  let regPhone = '';
  let regEmail = '';
  let regPassword = '';
  let regError = '';
  let regLoading = false;

  async function handleLogin(e) {
    e.preventDefault();
    loginError = '';
    loginLoading = true;
    try {
      const res = await api.login(loginPhone.trim(), loginPassword.trim());
      if (res && res.success && res.user) {
        auth.login(res.user);
        if (res.user.role_name === 'driver') {
          router.navigate('/driver');
        } else if (res.user.role_name === 'admin' || res.user.role_name === 'florist') {
          router.navigate('/admin');
        } else {
          router.navigate('/');
        }
      }
    } catch (err) {
      loginError = err.message || 'بيانات الدخول غير صحيحة';
    } finally {
      loginLoading = false;
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    regError = '';
    regLoading = true;
    try {
      const res = await api.register({
        fullName: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim() || undefined,
        password: regPassword.trim()
      });
      if (res && res.success && res.user) {
        auth.login(res.user);
        router.navigate('/');
      }
    } catch (err) {
      regError = err.message || 'حدث خطأ أثناء إنشاء الحساب';
    } finally {
      regLoading = false;
    }
  }

  function fillDemoAccount(phone, pass) {
    loginPhone = phone;
    loginPassword = pass;
    activeTab = 'login';
  }
</script>

<div class="login-page fade-in">
  <div class="container">
    <div class="auth-card">
      <div class="auth-brand">
        <span class="auth-symbol">🌸</span>
        <h2>مَـسْـكَة</h2>
        <p>أتيليه الزهور الطبيعية وبطاقات الإهداء الملكية</p>
      </div>

      <!-- تبديل التبويبات -->
      <div class="auth-tabs">
        <button 
          type="button" 
          class="auth-tab-btn" 
          class:active={activeTab === 'login'}
          on:click={() => activeTab = 'login'}
        >
          تسجيل الدخول
        </button>
        <button 
          type="button" 
          class="auth-tab-btn" 
          class:active={activeTab === 'register'}
          on:click={() => activeTab = 'register'}
        >
          حساب زبون جديد
        </button>
      </div>

      <!-- نموذج الدخول -->
      {#if activeTab === 'login'}
        <form class="auth-form fade-in" on:submit={handleLogin}>
          {#if loginError}
            <div class="alert-error">{loginError}</div>
          {/if}

          <div class="form-group">
            <label>
              <span class="field-icon">📱</span>
              <span>رقم الهاتف الليبي:</span>
            </label>
            <div class="input-with-icon">
              <span class="input-prefix-icon">🇱🇾</span>
              <input 
                type="tel" 
                class="input-field input-lux" 
                placeholder="091XXXXXXX أو 092XXXXXXX" 
                bind:value={loginPhone} 
                required 
              />
            </div>
          </div>

          <div class="form-group">
            <label>
              <span class="field-icon">🔒</span>
              <span>كلمة المرور:</span>
            </label>
            <div class="input-with-icon">
              <span class="input-prefix-icon">🔑</span>
              <input 
                type="password" 
                class="input-field input-lux" 
                placeholder="••••••••" 
                bind:value={loginPassword} 
                required 
              />
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg btn-lux" disabled={loginLoading}>
            {loginLoading ? 'جاري التحقق من الهوية...' : 'تسجيل الدخول الفوري 🌸'}
          </button>
        </form>
      {:else}
        <!-- نموذج إنشاء حساب جديد -->
        <form class="auth-form fade-in" on:submit={handleRegister}>
          {#if regError}
            <div class="alert-error">{regError}</div>
          {/if}

          <div class="vip-welcome-banner">
            <span class="vip-icon">✨</span>
            <div class="vip-text">
              <strong>تذكرة عضوية مسكة الملكية</strong>
              <p>استمتعي بتصميم باقاتك الخاصة، ومتابعة السائق بالـ GPS، وتخفيضات المواسم</p>
            </div>
          </div>

          <div class="form-group">
            <label>
              <span class="field-icon">👤</span>
              <span>الاسم الكريم:</span>
            </label>
            <input 
              type="text" 
              class="input-field input-lux" 
              placeholder="مثال: مريم الفيتوري" 
              bind:value={regName} 
              required 
            />
          </div>

          <div class="form-group">
            <label>
              <span class="field-icon">📱</span>
              <span>رقم الهاتف:</span>
            </label>
            <div class="input-with-icon">
              <span class="input-prefix-icon">🇱🇾</span>
              <input 
                type="tel" 
                class="input-field input-lux" 
                placeholder="091XXXXXXX أو 092XXXXXXX" 
                bind:value={regPhone} 
                required 
              />
            </div>
          </div>

          <div class="form-group">
            <label>
              <span class="field-icon">✉️</span>
              <span>البريد الإلكتروني (اختياري):</span>
            </label>
            <input 
              type="email" 
              class="input-field input-lux" 
              placeholder="name@example.com" 
              bind:value={regEmail} 
            />
          </div>

          <div class="form-group">
            <label>
              <span class="field-icon">🔒</span>
              <span>كلمة المرور الجديدة:</span>
            </label>
            <div class="input-with-icon">
              <span class="input-prefix-icon">🔑</span>
              <input 
                type="password" 
                class="input-field input-lux" 
                placeholder="••••••••" 
                bind:value={regPassword} 
                required 
              />
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-block btn-lg btn-lux" disabled={regLoading}>
            {regLoading ? 'جاري إصدار العضوية...' : 'تأكيد إنشاء الحساب الملكي 🌸'}
          </button>
        </form>
      {/if}

      <!-- بطاقات وتذاكر الحسابات التجريبية للمشروع -->
      <div class="demo-accounts-box">
        <div class="demo-title-bar">
          <span class="ticket-symbol">🎟️</span>
          <div>
            <span class="demo-title">تذاكر الدخول السريع (مشروع التخرج)</span>
            <small class="demo-subtitle">اضغط على أي تذكرة لتعبئة الحساب وتجربة الصلاحيات فوراً</small>
          </div>
        </div>

        <div class="tickets-grid">
          <!-- تذكرة المدير -->
          <button 
            type="button" 
            class="ticket-pass admin-pass" 
            class:selected={loginPhone === '0911111111'}
            on:click={() => fillDemoAccount('0911111111', 'admin123')}
          >
            <div class="ticket-header-line">
              <span class="ticket-role-pill admin">👑 مدير النظام</span>
              <span class="ticket-status-dot"></span>
            </div>
            <div class="ticket-user-info">
              <b class="user-fullname">محمد المنفي</b>
              <span class="user-cred">📞 0911111111</span>
            </div>
            <div class="ticket-footer-line">
              <span class="ticket-action-hint">استخدام التذكرة ⚡</span>
            </div>
          </button>

          <!-- تذكرة الزبونة -->
          <button 
            type="button" 
            class="ticket-pass customer-pass" 
            class:selected={loginPhone === '0915555555'}
            on:click={() => fillDemoAccount('0915555555', 'customer123')}
          >
            <div class="ticket-header-line">
              <span class="ticket-role-pill customer">🌸 زبونة المتجر</span>
              <span class="ticket-status-dot"></span>
            </div>
            <div class="ticket-user-info">
              <b class="user-fullname">سارة المحمودي</b>
              <span class="user-cred">📞 0915555555</span>
            </div>
            <div class="ticket-footer-line">
              <span class="ticket-action-hint">استخدام التذكرة ⚡</span>
            </div>
          </button>

          <!-- تذكرة المنسقة -->
          <button 
            type="button" 
            class="ticket-pass florist-pass" 
            class:selected={loginPhone === '0912222222'}
            on:click={() => fillDemoAccount('0912222222', 'florist123')}
          >
            <div class="ticket-header-line">
              <span class="ticket-role-pill florist">💐 منسقة الزهور</span>
              <span class="ticket-status-dot"></span>
            </div>
            <div class="ticket-user-info">
              <b class="user-fullname">فاطمة الورفلي</b>
              <span class="user-cred">📞 0912222222</span>
            </div>
            <div class="ticket-footer-line">
              <span class="ticket-action-hint">استخدام التذكرة ⚡</span>
            </div>
          </button>

          <!-- تذكرة السائق -->
          <button 
            type="button" 
            class="ticket-pass driver-pass" 
            class:selected={loginPhone === '0923333333'}
            on:click={() => fillDemoAccount('0923333333', 'driver123')}
          >
            <div class="ticket-header-line">
              <span class="ticket-role-pill driver">🚗 كابتن التوصيل</span>
              <span class="ticket-status-dot"></span>
            </div>
            <div class="ticket-user-info">
              <b class="user-fullname">طارق الزوي</b>
              <span class="user-cred">📞 0923333333</span>
            </div>
            <div class="ticket-footer-line">
              <span class="ticket-action-hint">استخدام التذكرة ⚡</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .login-page {
    padding: 60px 0 100px;
    background: var(--bg-gradient);
    min-height: 80vh;
    display: flex;
    align-items: center;
  }
  .auth-card {
    background: var(--card-solid);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-lg);
    max-width: 520px;
    margin: 0 auto;
    padding: 38px 34px;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.08);
  }
  .auth-brand {
    text-align: center;
    margin-bottom: 24px;
  }
  .auth-symbol {
    font-size: 2.4rem;
    display: inline-block;
  }
  .auth-brand h2 {
    font-size: 1.8rem;
    color: var(--olive);
    margin: 4px 0 2px;
    font-family: 'Cairo', sans-serif;
  }
  .auth-brand p {
    font-size: 0.88rem;
    color: var(--text-muted);
  }
  .auth-tabs {
    display: flex;
    background: var(--bg);
    border-radius: var(--radius-full);
    padding: 4px;
    margin-bottom: 24px;
    border: 1px solid var(--line);
  }
  .auth-tab-btn {
    flex: 1;
    background: none;
    border: none;
    padding: 10px;
    border-radius: var(--radius-full);
    font-weight: 700;
    font-size: 0.95rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
  }
  .auth-tab-btn.active {
    background: var(--card-solid);
    color: var(--olive);
    box-shadow: var(--shadow-xs);
  }
  .auth-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .form-group label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.88rem;
    font-weight: 700;
    margin-bottom: 6px;
    color: var(--text);
  }
  .field-icon {
    font-size: 1rem;
  }
  .input-with-icon {
    position: relative;
    display: flex;
    align-items: center;
  }
  .input-prefix-icon {
    position: absolute;
    right: 14px;
    font-size: 1rem;
    pointer-events: none;
    z-index: 2;
  }
  .input-lux {
    padding-right: 42px !important;
    height: 48px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }
  .input-lux:focus {
    background: var(--card-solid);
    border-color: var(--olive);
    box-shadow: 0 0 0 3px rgba(94, 107, 44, 0.15);
  }
  .btn-lux {
    height: 50px;
    font-size: 1.02rem;
    font-weight: 800;
    border-radius: var(--radius-full);
    box-shadow: 0 8px 20px rgba(94, 107, 44, 0.25);
    transition: all 0.25s ease;
    margin-top: 6px;
  }
  .btn-lux:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(94, 107, 44, 0.35);
  }

  .vip-welcome-banner {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, rgba(230, 201, 140, 0.18), rgba(184, 150, 78, 0.12));
    border: 1px solid rgba(184, 150, 78, 0.4);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    margin-bottom: 4px;
  }
  .vip-icon {
    font-size: 1.6rem;
  }
  .vip-text strong {
    display: block;
    font-size: 0.95rem;
    color: #8c6b2d;
    margin-bottom: 2px;
  }
  .vip-text p {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .alert-error {
    background: var(--pink);
    border: 1px solid var(--pink-2);
    color: var(--price);
    padding: 10px 14px;
    border-radius: var(--radius-sm);
    font-size: 0.88rem;
    font-weight: 700;
    text-align: center;
  }

  /* Tickets Grid */
  .demo-accounts-box {
    margin-top: 32px;
    border-top: 1px dashed var(--line-strong);
    padding-top: 22px;
  }
  .demo-title-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }
  .ticket-symbol {
    font-size: 1.6rem;
  }
  .demo-title {
    font-size: 0.88rem;
    font-weight: 800;
    color: var(--text);
    display: block;
  }
  .demo-subtitle {
    font-size: 0.76rem;
    color: var(--text-muted);
  }
  .tickets-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .ticket-pass {
    position: relative;
    background: var(--bg);
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    text-align: right;
    transition: all 0.22s ease;
    overflow: hidden;
  }
  .ticket-pass:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.08);
  }
  .ticket-pass.selected {
    box-shadow: 0 0 0 2px var(--olive);
    border-style: solid;
  }
  .ticket-header-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .ticket-role-pill {
    font-size: 0.78rem;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: var(--radius-full);
  }
  .ticket-role-pill.admin { background: #fce4ec; color: #880e4f; }
  .ticket-role-pill.customer { background: #fff3e0; color: #e65100; }
  .ticket-role-pill.florist { background: #f1f8e9; color: #33691e; }
  .ticket-role-pill.driver { background: #e3f2fd; color: #0d47a1; }

  .ticket-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4caf50;
  }
  .ticket-user-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .user-fullname {
    font-size: 0.92rem;
    color: var(--text);
  }
  .user-cred {
    font-size: 0.78rem;
    color: var(--text-muted);
    direction: ltr;
    display: inline-block;
    align-self: flex-start;
  }
  .ticket-footer-line {
    border-top: 1px dotted var(--line);
    padding-top: 6px;
    display: flex;
    justify-content: flex-end;
  }
  .ticket-action-hint {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--olive);
  }

  /* Role specific card backgrounds */
  .admin-pass {
    background: linear-gradient(135deg, rgba(136, 14, 79, 0.04), rgba(136, 14, 79, 0.08));
    border-color: rgba(136, 14, 79, 0.25);
  }
  .admin-pass:hover {
    border-color: #880e4f;
  }
  .customer-pass {
    background: linear-gradient(135deg, rgba(230, 81, 0, 0.04), rgba(230, 81, 0, 0.08));
    border-color: rgba(230, 81, 0, 0.25);
  }
  .customer-pass:hover {
    border-color: #e65100;
  }
  .florist-pass {
    background: linear-gradient(135deg, rgba(51, 105, 30, 0.04), rgba(51, 105, 30, 0.08));
    border-color: rgba(51, 105, 30, 0.25);
  }
  .florist-pass:hover {
    border-color: #33691e;
  }
  .driver-pass {
    background: linear-gradient(135deg, rgba(13, 71, 161, 0.04), rgba(13, 71, 161, 0.08));
    border-color: rgba(13, 71, 161, 0.25);
  }
  .driver-pass:hover {
    border-color: #0d47a1;
  }
</style>

