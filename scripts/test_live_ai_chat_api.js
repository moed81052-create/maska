const assert = require('assert');

async function testLiveAiApi() {
  console.log('--- Testing Live /api/ai/chat Endpoint ---');

  // 1. In-Scope Floral Query
  const floralReq = await fetch('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'ما هو معنى ودلالة الورد الجوري الأحمر؟'
    })
  });

  assert(floralReq.ok, `HTTP request failed: ${floralReq.status}`);
  const floralData = await floralReq.json();
  console.log('Floral Response:', floralData);
  assert(floralData.success === true);
  assert(floralData.isOffTopic === false);
  assert(floralData.reply && floralData.reply.length > 20);
  console.log('✓ In-scope floral query answered successfully!');

  // 2. Out-of-Scope Off-Topic Query
  const offTopicReq = await fetch('http://localhost:3000/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'اكتب لي كود بايثون لحساب الأرقام'
    })
  });

  assert(offTopicReq.ok);
  const offTopicData = await offTopicReq.json();
  console.log('Off-Topic Response:', offTopicData);
  assert(offTopicData.success === true);
  assert(offTopicData.isOffTopic === true);
  assert(offTopicData.reply.includes('خارج سياق اختصاصي في الزهور والباقات'));
  console.log('✓ Off-topic query successfully rejected with strict guardrail message!');

  console.log('--- ALL LIVE AI API TESTS PASSED! ---');
}

testLiveAiApi().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
