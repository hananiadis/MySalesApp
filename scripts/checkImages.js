const fs = require('fs');
const fetch = require('node-fetch'); // v2 syntax!
const products = require('./products.json');

async function checkUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET', // Use 'GET' instead of 'HEAD'
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

(async () => {
  let badCount = 0, goodCount = 0;
  for (const p of products) {
    if (!p.frontCover) continue;
    const ok = await checkUrl(p.frontCover);
    if (!ok) {
      console.warn(`❌ DEAD LINK: code=${p.productCode}, url=${p.frontCover}`);
      badCount++;
    } else {
      console.log(`✅ OK: code=${p.productCode}, url=${p.frontCover}`);
      goodCount++;
    }
  }
  console.log(`Done! ${goodCount} images OK, ${badCount} dead links.`);
})();
