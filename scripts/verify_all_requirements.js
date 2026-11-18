const http = require('http');

async function testQuery(message) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ message });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/ai/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('====================================================');
  console.log('🌸 بدء الفحص الشامل لكل متطلبات الذكاء الاصطناعي لمسكة');
  console.log('====================================================\n');

  // Test 1: Greetings & pleasantries
  console.log('--- اختبار 1: التحيات والكلام العام ("أهلاً، كيف حالك؟") ---');
  try {
    const res1 = await testQuery('أهلاً وسهلاً كيف حالك اليوم؟');
    console.log('المصدر:', res1.source);
    console.log('الرد:\n', res1.reply);
  } catch (err) {
    console.error('فشل اختبار 1:', err.message);
  }

  // Test 2: Reading prices from Database
  console.log('\n--- اختبار 2: قراءة الأسعار من الداتابيز ("كم سعر الورد الجوري وكم سعر الباقة الملكية والتوصيل لطرابلس؟") ---');
  try {
    const res2 = await testQuery('كم سعر الورد الجوري الوردي والأحمر، وكم سعر الباقة الملكية، وكم رسوم التوصيل لطرابلس وبنغازي؟');
    console.log('المصدر:', res2.source);
    console.log('الرد:\n', res2.reply);
  } catch (err) {
    console.error('فشل اختبار 2:', err.message);
  }

  // Test 3: Flower species and Care
  console.log('\n--- اختبار 3: معلومات أنواع الورد وطريقة العناية ("كيف أعتني بزهرة الهيدرانجيا والتوليب في المزهرية؟") ---');
  try {
    const res3 = await testQuery('كيف أعتني بزهرة الهيدرانجيا والتوليب والورد الطبيعي في المزهرية ليطول عمره؟');
    console.log('المصدر:', res3.source);
    console.log('الرد:\n', res3.reply);
  } catch (err) {
    console.error('فشل اختبار 3:', err.message);
  }

  // Test 4: Design bouquet from inventory
  console.log('\n--- اختبار 4: تصميم باقة من المخزون المتوفر ("صمملي باقة تخرج فخمة") ---');
  try {
    const res4 = await testQuery('صمملي باقة تخرج فخمة من الورد المتوفر عندكم');
    console.log('المصدر:', res4.source);
    console.log('هل يتضمن كائن تصميم (designAction)؟', res4.designAction ? 'نعم ✅' : 'لا ❌');
    if (res4.designAction) {
      console.log('تفاصيل التصميم:', {
        name: res4.designAction.name,
        style: res4.designAction.style,
        wrap: res4.designAction.wrapName || res4.designAction.wrap,
        totalPrice: res4.designAction.totalPrice + ' د.ل',
        stemsCount: res4.designAction.stems.length
      });
    }
    console.log('مقتطف من الرد:\n', res4.reply.substring(0, 300) + '...');
  } catch (err) {
    console.error('فشل اختبار 4:', err.message);
  }

  // Test 5: Guardrail - Off-topic question (Sports/Football)
  console.log('\n--- اختبار 5: القيود - سؤال خارج السياق ("من فاز في مباراة اليوم؟") ---');
  try {
    const res5 = await testQuery('من فاز في مباراة ريال مدريد وبرشلونة اليوم؟');
    console.log('المصدر:', res5.source);
    console.log('هل تم حظره كخارج السياق؟', res5.isOffTopic ? 'نعم ✅' : 'لا ❌');
    console.log('الرد:\n', res5.reply);
  } catch (err) {
    console.error('فشل اختبار 5:', err.message);
  }

  // Test 6: Guardrail - Off-topic question (Programming)
  console.log('\n--- اختبار 6: القيود - سؤال برمجة ("اكتب كود بايثون") ---');
  try {
    const res6 = await testQuery('اكتب لي كود بايثون لحساب الأرقام');
    console.log('المصدر:', res6.source);
    console.log('هل تم حظره كخارج السياق؟', res6.isOffTopic ? 'نعم ✅' : 'لا ❌');
    console.log('الرد:\n', res6.reply);
  } catch (err) {
    console.error('فشل اختبار 6:', err.message);
  }

  console.log('\n====================================================');
  console.log('✨ اكتملت جميع الاختبارات!');
  console.log('====================================================');
})();
