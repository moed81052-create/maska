<script>
  import { onMount, tick } from 'svelte';
  import { isGlobalChatOpen, toggleGlobalChat, closeGlobalChat, setPendingBouquetDesign } from '../stores/aiChatStore.js';
  import { api } from '../lib/api.js';
  import { router } from '../stores/router.js';

  let messages = [
    {
      id: 1,
      sender: 'ai',
      text: 'مرحباً بك في مسكة 🌸! أنا خبير ومستشار الزهور الذكي.\n\nيسعدني جداً مساعدتك في اختيار أفضل أنواع الورد لمناسبتك من مخزوننا الحي، معاني ألوان الزهور، نصائح العناية، أو تصميم باقة مخصصة لك وتطبيقها فوراً في استوديو مسكة! كيف يمكنني مساعدتك اليوم؟',
      time: new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })
    }
  ];

  let inputMessage = '';
  let isLoading = false;
  let chatBoxEl;
  let isMinimized = false;
  let showKeySettings = false;
  let userApiKey = '';
  let keyStatusMessage = '';
  let isSavingKey = false;
  let aiConfigured = false;

  const quickQuestions = [
    '💖 صمملي باقة رومانسية فخمة',
    '🎓 صمملي باقة تخرج بالورد المتاح',
    '💍 صمملي باقة زفاف ملكية ناصعة',
    '🌹 ما هي معاني ألوان الجوري والتوليب؟',
    '💧 كيف أعتني بالورد الطبيعي ليدوم 14 يوماً؟'
  ];

  onMount(async () => {
    try {
      const status = await api.getAiStatus();
      if (status && status.configured) {
        aiConfigured = true;
      }
    } catch (e) {}
  });

  async function scrollToBottom() {
    await tick();
    if (chatBoxEl) {
      chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
    }
  }

  async function saveKey() {
    if (!userApiKey.trim()) return;
    isSavingKey = true;
    keyStatusMessage = '';
    try {
      const res = await api.saveAiKey(userApiKey.trim());
      keyStatusMessage = '✅ تم حفظ وتفعيل مفتاح Gemini API بنجاح!';
      aiConfigured = true;
      setTimeout(() => {
        showKeySettings = false;
        keyStatusMessage = '';
      }, 1500);
    } catch (err) {
      keyStatusMessage = '❌ فشل في حفظ المفتاح: ' + (err.message || 'خطأ غير معروف');
    } finally {
      isSavingKey = false;
    }
  }

  async function sendMessage(textToSend) {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    inputMessage = '';

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })
    };

    messages = [...messages, userMsg];
    isLoading = true;
    scrollToBottom();

    try {
      const history = messages.slice(-6).map(m => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }));

      const res = await api.aiChat(text, history, { source: 'global_widget' });

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: res.reply || 'أهلاً بك! أنا في خدمتك دائماً في كل ما يخص الزهور.',
        designAction: res.designAction || null,
        time: new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }),
        source: res.source
      };

      messages = [...messages, aiMsg];
    } catch (err) {
      console.error('Chat error:', err);
      messages = [
        ...messages,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: 'عذراً، حدث خطأ مؤقت في الاتصال بمستشار الذكاء الاصطناعي. تفضل بإعادة المحاولة وسأكون سعيداً بالإجابة عن استفساراتك الزهرية! 🌸',
          time: new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }),
          error: true
        }
      ];
    } finally {
      isLoading = false;
      scrollToBottom();
    }
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function applyProposalAndGoToStudio(designAction) {
    if (designAction) {
      setPendingBouquetDesign(designAction);
    }
    closeGlobalChat();
    router.navigate('/studio');
  }

  function goToStudio() {
    closeGlobalChat();
    router.navigate('/studio');
  }
</script>

<!-- الزر العائم الدائم في زاوية الشاشة -->
<div class="global-chat-anchor">
  {#if !$isGlobalChatOpen}
    <button 
      type="button" 
      class="floating-chat-bubble" 
      on:click={toggleGlobalChat}
      title="محادثة خبير مسكة للذكاء الاصطناعي"
    >
      <div class="bubble-pulse"></div>
      <div class="bubble-icon">💬</div>
      <div class="bubble-text">
        <span class="bubble-title">شات الذكاء الاصطناعي ✦</span>
        <span class="bubble-status"><span class="dot"></span> متاح الآن للإجابة عن الزهور</span>
      </div>
    </button>
  {/if}

  <!-- نافذة المحادثة العائمة الفاخرة -->
  {#if $isGlobalChatOpen}
    <div class="chat-window-card" class:minimized={isMinimized}>
      <!-- ترويسة الشات -->
      <div class="chat-window-header">
        <div class="header-info">
          <div class="header-avatar">🌸</div>
          <div>
            <div class="header-title">
              <span>خبير مسكة للزهور</span>
              <span class="ai-badge">AI ✦ فوري</span>
            </div>
            <div class="header-sub">
              <span class="online-dot"></span>
              يجيب فقط على كل ما يخص الزهور والباقات
            </div>
          </div>
        </div>

        <div class="header-controls">
          <button 
            type="button" 
            class="control-btn" 
            on:click={() => showKeySettings = !showKeySettings}
            title="إعدادات مفتاح الذكاء الاصطناعي (Gemini API)"
          >
            ⚙️
          </button>
          <button 
            type="button" 
            class="control-btn" 
            on:click={() => isMinimized = !isMinimized}
            title={isMinimized ? 'تكبير' : 'تصغير'}
          >
            {isMinimized ? '▢' : '—'}
          </button>
          <button 
            type="button" 
            class="control-btn close" 
            on:click={closeGlobalChat}
            title="إغلاق الشات"
          >
            ✕
          </button>
        </div>
      </div>

      {#if !isMinimized}
        {#if showKeySettings}
          <div class="key-settings-panel">
            <div class="key-panel-title">
              <span>🔑 إعداد مفتاح Google Gemini API:</span>
              <button type="button" class="close-panel-btn" on:click={() => showKeySettings = false}>✕</button>
            </div>
            <p class="key-panel-desc">
              يمكنك ربط مفتاح Gemini API الحقيقي للحصول على ذكاء اصطناعي مباشر. المفتاح متوفر مجاناً من Google AI Studio:
            </p>
            <div class="key-input-row">
              <input 
                type="password" 
                class="key-text-input" 
                placeholder="AIzaSy..." 
                bind:value={userApiKey} 
              />
              <button type="button" class="key-save-btn" on:click={saveKey} disabled={isSavingKey || !userApiKey.trim()}>
                {isSavingKey ? '...' : 'حفظ'}
              </button>
            </div>
            {#if keyStatusMessage}
              <div class="key-status-msg">{keyStatusMessage}</div>
            {/if}
          </div>
        {/if}

        <!-- تنبيه القيود والسياق -->
        <div class="guardrail-strip">
          <span>🌿 متخصص حصرياً في الزهور، معانيها، وتنسيق الباقات</span>
          <button type="button" class="studio-link-btn" on:click={goToStudio}>
            💐 الذهاب للاستوديو
          </button>
        </div>

        <!-- صندوق الرسائل -->
        <div class="messages-container" bind:this={chatBoxEl}>
          {#each messages as msg (msg.id)}
            <div class="chat-message-row" class:user-row={msg.sender === 'user'} class:ai-row={msg.sender === 'ai'}>
              {#if msg.sender === 'ai'}
                <div class="sender-avatar">🌸</div>
              {/if}
              <div class="message-bubble" class:user-bubble={msg.sender === 'user'} class:ai-bubble={msg.sender === 'ai'} class:is-error={msg.error}>
                <div class="bubble-content">{msg.text}</div>

                {#if msg.designAction}
                  <div class="widget-proposal-card">
                    <div class="w-head">
                      <span class="w-badge">🎨 باقة مقترحة من المخزون المتوفر</span>
                      <h5 class="w-title">🌺 {msg.designAction.name}</h5>
                    </div>
                    <div class="w-stems">
                      {#each msg.designAction.stems as s}
                        <div class="w-chip">
                          <span class="chip-dot" style="background-color: {s.color || '#5e6b2c'}"></span>
                          <span>{s.qty} × {s.name}</span>
                        </div>
                      {/each}
                    </div>
                    <div class="w-meta">
                      <span>🎀 {msg.designAction.wrapName || msg.designAction.wrap}</span>
                      <b class="w-price">{msg.designAction.totalPrice} د.ل</b>
                    </div>
                    <button 
                      type="button" 
                      class="w-apply-btn" 
                      on:click={() => applyProposalAndGoToStudio(msg.designAction)}
                    >
                      🌸 تطبيق هذا التصميم في استوديو مسكة 🎨
                    </button>
                  </div>
                {/if}

                <div class="bubble-time">{msg.time}</div>
              </div>
            </div>
          {/each}

          {#if isLoading}
            <div class="chat-message-row ai-row">
              <div class="sender-avatar">🌸</div>
              <div class="message-bubble ai-bubble typing-bubble">
                <div class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span class="typing-label">خبير مسكة يكتب لك الآن...</span>
              </div>
            </div>
          {/if}
        </div>

        <!-- أسئلة سريعة مقترحة -->
        <div class="quick-chips-wrapper">
          <div class="chips-label">💡 أسئلة شائعة:</div>
          <div class="quick-chips-scroll">
            {#each quickQuestions as q}
              <button 
                type="button" 
                class="chip-pill" 
                disabled={isLoading}
                on:click={() => sendMessage(q)}
              >
                {q}
              </button>
            {/each}
          </div>
        </div>

        <!-- حقل الإدخال وزر الإرسال -->
        <form class="chat-input-bar" on:submit|preventDefault={() => sendMessage()}>
          <input 
            type="text" 
            class="chat-text-input" 
            placeholder="اسأل خبير مسكة عن أي نوع ورد، معناه، أو مناسبته..."
            bind:value={inputMessage}
            on:keydown={handleKeydown}
            disabled={isLoading}
          />
          <button 
            type="submit" 
            class="chat-send-btn" 
            disabled={isLoading || !inputMessage.trim()}
          >
            {#if isLoading}
              ⏳
            {:else}
              إرسال ↵
            {/if}
          </button>
        </form>
      {/if}
    </div>
  {/if}
</div>

<style>
  .global-chat-anchor {
    position: fixed;
    bottom: 24px;
    left: 24px;
    z-index: 99999;
    font-family: var(--font-cairo, 'Cairo', system-ui, sans-serif);
    direction: rtl;
  }

  /* الزر العائم */
  .floating-chat-bubble {
    display: flex;
    align-items: center;
    gap: 12px;
    background: linear-gradient(135deg, #5e6b2c 0%, #465020 100%);
    color: #ffffff;
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-radius: 999px;
    padding: 10px 20px 10px 14px;
    box-shadow: 0 10px 30px rgba(94, 107, 44, 0.4), 0 4px 12px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    user-select: none;
  }

  .floating-chat-bubble:hover {
    transform: translateY(-4px) scale(1.02);
    box-shadow: 0 14px 38px rgba(94, 107, 44, 0.5), 0 6px 18px rgba(0, 0, 0, 0.2);
    border-color: #d4af37;
  }

  .bubble-pulse {
    position: absolute;
    inset: -3px;
    border-radius: 999px;
    border: 2px solid #5e6b2c;
    animation: chatPulse 2.4s infinite ease-out;
    pointer-events: none;
    opacity: 0.6;
  }

  @keyframes chatPulse {
    0% { transform: scale(0.98); opacity: 0.8; }
    50% { transform: scale(1.06); opacity: 0.2; }
    100% { transform: scale(1.12); opacity: 0; }
  }

  .bubble-icon {
    font-size: 1.4rem;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bubble-text {
    display: flex;
    flex-direction: column;
    text-align: right;
  }

  .bubble-title {
    font-weight: 800;
    font-size: 0.95rem;
    color: #ffffff;
    letter-spacing: -0.2px;
  }

  .bubble-status {
    font-size: 0.74rem;
    color: #e5f0d0;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .bubble-status .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4ade80;
    display: inline-block;
  }

  /* نافذة الشات العائمة */
  .chat-window-card {
    width: 380px;
    max-width: calc(100vw - 32px);
    height: 560px;
    max-height: calc(100vh - 100px);
    background: #ffffff;
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(94, 107, 44, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    transition: height 0.25s ease;
  }

  .chat-window-card.minimized {
    height: 64px;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* ترويسة النافذة */
  .chat-window-header {
    background: linear-gradient(135deg, #5e6b2c 0%, #465020 100%);
    color: #ffffff;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 2px solid rgba(212, 175, 55, 0.3);
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.15rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .header-title {
    font-weight: 800;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .ai-badge {
    background: #d4af37;
    color: #2b2b28;
    font-size: 0.65rem;
    font-weight: 900;
    padding: 1px 6px;
    border-radius: 999px;
  }

  .header-sub {
    font-size: 0.7rem;
    color: #e5f0d0;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .online-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #4ade80;
    display: inline-block;
  }

  .header-controls {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .control-btn {
    background: rgba(255, 255, 255, 0.15);
    color: #ffffff;
    border: none;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    transition: background 0.15s;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .control-btn.close:hover {
    background: #dc2626;
  }

  /* لوحة إعدادات مفتاح الذكاء الاصطناعي */
  .key-settings-panel {
    background: #fffdf8;
    border-bottom: 2px solid #d4af37;
    padding: 12px 14px;
    font-size: 0.8rem;
    animation: fadeIn 0.2s ease;
  }

  .key-panel-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 800;
    color: #5e6b2c;
    margin-bottom: 4px;
  }

  .close-panel-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    color: #888;
  }

  .key-panel-desc {
    font-size: 0.7rem;
    color: #666;
    margin: 0 0 8px;
    line-height: 1.4;
  }

  .key-input-row {
    display: flex;
    gap: 6px;
  }

  .key-text-input {
    flex: 1;
    border: 1px solid #d4c5b3;
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 0.75rem;
    font-family: monospace;
    direction: ltr;
  }

  .key-save-btn {
    background: #5e6b2c;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
  }

  .key-status-msg {
    margin-top: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    color: #15803d;
  }

  /* بطاقة تصميم الباقة المقترحة داخل الويدجت */
  .widget-proposal-card {
    margin-top: 8px;
    background: #ffffff;
    border: 1.5px solid #5e6b2c;
    border-radius: 12px;
    padding: 10px;
    box-shadow: 0 4px 12px rgba(94, 107, 44, 0.12);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .w-head {
    border-bottom: 1px solid #ebd9c8;
    padding-bottom: 4px;
  }

  .w-badge {
    background: #eef2dc;
    color: #5e6b2c;
    font-size: 0.65rem;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 999px;
  }

  .w-title {
    font-size: 0.92rem;
    font-weight: 800;
    color: #2b2b28;
    margin: 4px 0 0;
  }

  .w-stems {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .w-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #fdfaf4;
    border: 1px solid #ebd9c8;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    color: #465020;
  }

  .w-chip .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .w-meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #555;
  }

  .w-price {
    color: #b45309;
    font-size: 0.9rem;
  }

  .w-apply-btn {
    background: linear-gradient(135deg, #5e6b2c 0%, #465020 100%);
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 7px 12px;
    font-size: 0.78rem;
    font-weight: 800;
    cursor: pointer;
    text-align: center;
    transition: background 0.15s;
    font-family: inherit;
  }

  .w-apply-btn:hover {
    background: #465020;
  }

  /* شريط الإشعار والحصريات */
  .guardrail-strip {
    background: #faf7f2;
    padding: 6px 14px;
    font-size: 0.72rem;
    color: #5e6b2c;
    border-bottom: 1px solid #ebd9c8;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .studio-link-btn {
    background: none;
    border: none;
    color: #b45309;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
  }

  /* حاوية الرسائل */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #fdfcf9;
  }

  .chat-message-row {
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }

  .chat-message-row.user-row {
    justify-content: flex-end;
  }

  .sender-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #eef2dc;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .message-bubble {
    max-width: 82%;
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 0.85rem;
    line-height: 1.55;
    position: relative;
    word-break: break-word;
    white-space: pre-line;
  }

  .message-bubble.ai-bubble {
    background: #ffffff;
    color: #2b2b28;
    border: 1px solid #e8e2d8;
    border-top-right-radius: 4px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }

  .message-bubble.user-bubble {
    background: #5e6b2c;
    color: #ffffff;
    border-top-left-radius: 4px;
  }

  .message-bubble.is-error {
    background: #fef2f2;
    border-color: #fecaca;
    color: #991b1b;
  }

  .bubble-time {
    font-size: 0.65rem;
    margin-top: 4px;
    opacity: 0.65;
    text-align: left;
  }

  .user-bubble .bubble-time {
    color: #e5f0d0;
  }

  /* مؤشر الكتابة */
  .typing-bubble {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
  }

  .typing-indicator {
    display: flex;
    gap: 4px;
  }

  .typing-indicator span {
    width: 6px;
    height: 6px;
    background: #5e6b2c;
    border-radius: 50%;
    animation: typingBounce 1.4s infinite ease-in-out;
  }

  .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
  .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes typingBounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  .typing-label {
    font-size: 0.72rem;
    color: #71716e;
  }

  /* شرائح الأسئلة المقترحة */
  .quick-chips-wrapper {
    padding: 8px 12px;
    background: #faf7f2;
    border-top: 1px solid #ebd9c8;
  }

  .chips-label {
    font-size: 0.68rem;
    font-weight: 700;
    color: #5e6b2c;
    margin-bottom: 4px;
  }

  .quick-chips-scroll {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    scrollbar-width: none;
  }

  .quick-chips-scroll::-webkit-scrollbar {
    display: none;
  }

  .chip-pill {
    background: #ffffff;
    border: 1px solid #d4c5b3;
    color: #465020;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s;
    font-family: inherit;
  }

  .chip-pill:hover:not(:disabled) {
    background: #5e6b2c;
    color: #ffffff;
    border-color: #5e6b2c;
  }

  /* شريط الإدخال */
  .chat-input-bar {
    padding: 10px 12px;
    background: #ffffff;
    border-top: 1px solid #ebd9c8;
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .chat-text-input {
    flex: 1;
    border: 1px solid #d4c5b3;
    border-radius: 12px;
    padding: 8px 12px;
    font-size: 0.85rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .chat-text-input:focus {
    border-color: #5e6b2c;
    box-shadow: 0 0 0 2px rgba(94, 107, 44, 0.15);
  }

  .chat-send-btn {
    background: #5e6b2c;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    padding: 8px 14px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
    white-space: nowrap;
  }

  .chat-send-btn:hover:not(:disabled) {
    background: #465020;
  }

  .chat-send-btn:disabled {
    background: #d4c5b3;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .global-chat-anchor {
      left: 12px;
      bottom: 16px;
    }
    .chat-window-card {
      width: calc(100vw - 24px);
      height: 480px;
    }
  }
</style>

