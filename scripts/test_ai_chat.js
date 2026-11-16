const assert = require('assert');

// 1. Test Flower Guardrail Function
function isStrictlyFlowerRelated(text) {
  if (!text || typeof text !== 'string') return false;
  const t = text.toLowerCase().trim();

  const offTopicPatterns = [
    /كود|برمج|بايثون|جافاسكريبت|html|css|sql|function|react|svelte|php|c\+\+|linux|windows|bug|error|script/i,
    /سياس|حكوم|رئيس|وزير|انتخاب|برلمان|حرب|جيش|سفار|دولة|عسكر|معاهدة|قانون|أحزاب|مظاهر/i,
    /مبارا|كرة|دوري|ريال|برشلونة|ميسي|رونالدو|كأس|هدف|لاعب|نادي|كلاسيكو/i,
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

  const floralWhitelist = [
    /ورد|زهر|باق|فلور|توليب|جوري|بيوني|فاوانيا|جيبسوفيلا|جبسوفيلا|طفل|أوكالبتوس|اوكالبتوس|أوركيد|اوركيد|شمس|ليلي|زنابق/i,
    /تغليف|كرافت|شريط|ساتان|شمع|ختم|مزهر|فازة|ساق|سيقان|بتل|عطر|نضار|ذبول|ماء|ري|سقي|رائحة|نبات/i,
    /مناسب|زفاف|عرس|خطوب|تخرج|عيد ميلاد|اعتذار|شكر|هدية|مبروك|تهنئة|كرت|إهداء|محبة|حب|رومانسي/i,
    /تنسيق|تشكيل|هرمي|دائري|بوهيمي|قلب|ألوان|أحمر|وردي|أبيض|أصفر|بنفسجي|أخضر|عاجي|شامبين/i,
    /مسكة|أتيليه|استوديو|زهور|طبيعي|فازات|بتلات/i
  ];

  return floralWhitelist.some(regex => regex.test(t));
}

console.log('--- Testing Flower AI Guardrails ---');

// In-Scope Questions (Must Pass)
const flowerQuestions = [
  'ما هو معنى الورد الجوري الأحمر؟',
  'كيف أعتني بالباقة في المزهرية لتطول نضارتها؟',
  'اقترح لي باقة تخرج فخمة',
  'ما هو ورق التغليف المناسب للورد الأبيض؟',
  'هل يمكن تنسيق زهور البيوني مع الجيبسوفيلا؟',
  'حط الجوري في الوسط والبيوني فوق'
];

flowerQuestions.forEach(q => {
  const result = isStrictlyFlowerRelated(q);
  assert(result === true, `Expected "${q}" to be recognized as flower related!`);
});
console.log('✓ All floral queries passed validation.');

// Out-of-Scope Questions (Must Be Blocked)
const offTopicQuestions = [
  'اكتب لي كود بايثون لحساب الأرقام',
  'من هو رئيس وزراء بريطانيا؟',
  'كم نتيجة مباراة ريال مدريد وبرشلونة؟',
  'ما هي طريقة عمل البيتزا الإيطالية؟',
  'حل المعادلة الرياضية x + y = 10',
  'كم سعر صرف الدولار اليوم؟'
];

offTopicQuestions.forEach(q => {
  const result = isStrictlyFlowerRelated(q);
  assert(result === false, `Expected "${q}" to be BLOCKED as off-topic!`);
});
console.log('✓ All off-topic queries were strictly blocked.');

console.log('--- ALL GUARDRAIL TESTS PASSED! ---');

