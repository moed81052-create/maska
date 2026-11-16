const assert = require('assert');

function isStrictlyFlowerRelated(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase().trim();

  // 1. القائمة السوداء للمواضيع الخارجة تماماً عن السياق
  const offTopicPatterns = [
    /كود|برمج|بايثون|جافاسكريبت|html|css|sql|function|react|svelte|php|c\+\+|linux|windows|bug|error|script/i,
    /سياس|حكوم|رئيس|وزير|انتخاب|برلمان|حرب|جيش|سفار|دولة|عسكر|معاهدة|قانون|أحزاب|مظاهر/i,
    /مبارا|كرة|كورة|دوري|ريال|برشلونة|ميسي|رونالدو|كأس|هدف|لاعب|نادي|كلاسيكو|منتخب|فريق|مدرب|تشكيلة منتخب/i,
    /طبخ|وصفة|بيتزا|شاورما|برجر|معكرونة|كيكة|أكلة|مقادير|طريقة عمل|طبخة/i,
    /رياضيات|معادلة|حساب التفاضل|تكامل|فيزياء|كيمياء|فلسفة|فلك|كواكب|مجرة/i,
    /طقس|أمطار|درجة حرارة|دولار|يورو|سعر الصرف|عملات|بيتكوين|تداول|أسهم/i,
    /سيارة|محرك|مركبة|تويوتا|هيونداي|ميكانيك|بنزين/i
  ];

  for (const pattern of offTopicPatterns) {
    if (pattern.test(t)) {
      return false;
    }
  }

  // 2. الكلمات الجوهرية للزهور والباقات والنباتات
  const floralKeywords = [
    /ورد|زهر|باق|فلور|توليب|جوري|بيوني|فاوانيا|جيبسوفيلا|جبسوفيلا|طفل|أوكالبتوس|اوكالبتوس|أوركيد|اوركيد|شمس|ليلي|زنابق/i,
    /مزهر|فازة|ساق|سيقان|بتل|عطر الورد|نضار|ذبول|سقي|رائحة الورد|نبات/i,
    /مسكة|أتيليه/i
  ];

  const hasDirectFlowerMention = floralKeywords.some(regex => regex.test(t));
  if (hasDirectFlowerMention) return true;

  // 3. كلمات التغليف والمناسبات إذا اقترنت بسياق الهدية أو التنسيق للباقة
  const secondaryKeywords = [
    /تغليف|كرافت|شريط ساتان|ختم شمعي|كرت إهداء/i,
    /تنسيق هرمي|تنسيق دائري|تنسيق بوهيمي|تنسيق قلب/i
  ];

  return secondaryKeywords.some(regex => regex.test(t));
}

console.log('Testing refined Guardrail logic...');
assert(isStrictlyFlowerRelated('كيف أعتني بزهور الجوري؟') === true);
assert(isStrictlyFlowerRelated('ما هي باقة الزفاف الأنسب؟') === true);
assert(isStrictlyFlowerRelated('ما هو معنى الورد الجوري الأحمر؟') === true);
assert(isStrictlyFlowerRelated('اكتب لي برنامج بايثون') === false);
assert(isStrictlyFlowerRelated('ما هي تشكيلة منتخب البرازيل؟') === false);
assert(isStrictlyFlowerRelated('كم سعر صرف الدولار اليوم؟') === false);
assert(isStrictlyFlowerRelated('كيف اطبخ كيكة الشوكولاتة؟') === false);
console.log('✓ Refined Guardrail checks passed 100%!');
