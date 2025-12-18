const fs = require('fs');
const path = require('path');
const { scrapeProducts } = require('./scraper');
const { sendNotification } = require('./notifier');

const DATA_PATH = path.join(__dirname, '../data/products.json');

async function main() {
  console.log('Monitoring started:', new Date().toLocaleString());

  // 1. Scrape current products
  const currentProducts = await scrapeProducts();

  if (currentProducts.length === 0) {
    console.log('No products found.');
    return;
  }

  // 2. Load saved products
  let savedProducts = [];
  if (fs.existsSync(DATA_PATH)) {
    savedProducts = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
  }

  // 3. Compare for new items
  const savedNames = new Set(savedProducts.map(p => p.name));
  const newItems = currentProducts.filter(p => !savedNames.has(p.name) && !p.isSoldOut);

  if (newItems.length > 0) {
    console.log(`${newItems.length} new items found!`);
    let message = `<b>[Canon Refurbished New Product Alert]</b>\n\n`;
    newItems.forEach(item => {
      message += `🛒 <b>${item.name}</b>\n`;
      message += `💰 Price: ${item.price}KRW\n`;
      message += `🔗 <a href="${item.link}">View Product</a>\n\n`;
    });
    await sendNotification(message);
  } else {
    console.log('No new items.');
  }

  // 4. Update state
  fs.writeFileSync(DATA_PATH, JSON.stringify(currentProducts, null, 2));
  console.log('State updated.');
}

main().catch(console.error);
