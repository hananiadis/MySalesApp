const fetch = require('node-fetch'); // v2 syntax!

async function checkUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
      }
    });
    console.log(`status=${res.status}`);
    return res.ok;
  } catch (e) {
    console.error('Fetch error:', e.message || e);
    return false;
  }
}

checkUrl('https://images.unsplash.com/photo-1519125323398-675f0ddb6308')
  .then(ok => console.log(ok ? 'Image is reachable!' : 'Image is NOT reachable!'));

checkUrl('https://playmodb.org/backs/5/5557_box.jpg')
  .then(ok => console.log(ok ? 'Image is reachable!' : 'Image is NOT reachable!'));
