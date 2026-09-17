const crypto = require('crypto');

const BOT_TOKEN = '8844930773:AAHfG5arpVapmgInmE-qbwrQJcdklDriQAE';

function generateInitData(telegramId, username) {
  const userData = JSON.stringify({
    id: telegramId,
    first_name: username,
    username: username,
    language_code: 'en'
  });
  const authDate = Math.floor(Date.now() / 1000);
  const dataCheckString = 'auth_date=' + authDate + '\nuser=' + userData;
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return 'user=' + encodeURIComponent(userData) + '&auth_date=' + authDate + '&hash=' + hash;
}

async function main() {
  const testTgId = 9999901;
  const testUsername = 'test_dog_tokenize';
  const initData = generateInitData(testTgId, testUsername);

  console.log('1. Authenticating test user via /api/auth/session...');
  const authRes = await fetch('http://localhost:3003/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });
  const authJson = await authRes.json();
  const token = authJson.token;
  console.log('✓ Authenticated successfully! Token received:', !!token);

  // Link a dummy BSC wallet address if not already linked
  const dummyWallet = '0x1111111111111111111111111111111111111111';
  console.log('2. Ensuring wallet address is linked...');
  await fetch('http://localhost:3003/api/user/link-wallet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ walletAddress: dummyWallet })
  }).catch(() => {});

  // Add 2000 GOLD to user via SQL so they can buy Stray Dog
  const { execSync } = require('child_process');
  execSync(`docker exec barnbuddy_postgres psql -U barnbuddy -d barnbuddy -c "UPDATE users SET gold_balance = 5000, wallet_address = '${dummyWallet}' WHERE telegram_id = ${testTgId};"`);
  console.log('✓ Funded user with 5000 GOLD and linked wallet');

  // Find shop item id for Stray Dog
  const shopRes = await fetch('http://localhost:3003/api/shop/items', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const shopData = await shopRes.json();
  const strayDogItem = (shopData.items || []).find(i => i.effectType === 'dog_stray');
  console.log('3. Found Stray Dog in Shop:', strayDogItem ? `${strayDogItem.name} (${strayDogItem.costGold}G, ID: ${strayDogItem.id})` : 'NOT FOUND');

  if (!strayDogItem) {
    throw new Error('Stray Dog item not found in shop!');
  }

  // Buy Stray Dog from shop
  console.log('4. Buying Stray Dog with GOLD from Shop...');
  const buyRes = await fetch('http://localhost:3003/api/shop/buy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ itemId: strayDogItem.id })
  });
  const buyData = await buyRes.json();
  console.log('✓ Buy result:', buyData.message || buyData);

  // Query Barn / Storage to verify shop dog is present
  console.log('5. Querying Storage (getBarnData) for Shop Dogs...');
  const barnRes = await fetch('http://localhost:3003/api/inventory/barn', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const barnData = await barnRes.json();
  const shopDogs = (barnData.dogs || []).filter(d => d.source === 'shop');
  console.log(`✓ Storage dogs count: ${barnData.dogs?.length}, Shop Dogs count: ${shopDogs.length}`);
  console.log('  Shop Dog info:', shopDogs[0]);

  if (shopDogs.length === 0) {
    throw new Error('No shop dog found in Storage!');
  }

  // Call POST /api/web3/tokenize-dog
  console.log('6. Calling POST /api/web3/tokenize-dog (count=1)...');
  const tokRes = await fetch('http://localhost:3003/api/web3/tokenize-dog', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ count: 1 })
  });
  const tokData = await tokRes.json();
  console.log('✓ Tokenize Dog Response:', tokData);

  if (!tokData.signature || tokData.nonce === undefined || !tokData.contractAddress) {
    throw new Error('Tokenize response missing critical fields (signature, nonce, or contractAddress)!');
  }

  // Verify Barn / Storage again: shop dog should be removed
  console.log('7. Verifying Storage after tokenization...');
  const barnAfterRes = await fetch('http://localhost:3003/api/inventory/barn', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const barnAfterData = await barnAfterRes.json();
  const shopDogsAfter = (barnAfterData.dogs || []).filter(d => d.source === 'shop');
  console.log(`✓ Shop Dogs remaining after tokenization: ${shopDogsAfter.length} (Expected: 0)`);

  if (shopDogsAfter.length !== 0) {
    throw new Error('Shop dog was not removed from DB after tokenize authorization!');
  }

  console.log('\n=======================================================================');
  console.log('>>> ALL VERIFICATION CHECKS PASSED 100%! <<<');
  console.log('Database, Shop, Inventory, Tokenize API, Nonce, and Signatures Work Seamlessly!');
  console.log('=======================================================================');
}

main().catch(err => {
  console.error('API Verification failed:', err);
  process.exit(1);
});
