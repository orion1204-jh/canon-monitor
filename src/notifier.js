const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MAX_LEN = 4000; // 텔레그램 한도 4096자, 여유를 둠

// 상품 블록("\n\n") 경계에서 잘라 HTML 태그가 중간에 끊기지 않게 함
function splitMessage(message) {
  const chunks = [''];
  for (const block of message.split(/(?<=\n\n)/)) {
    if (chunks[chunks.length - 1].length + block.length > MAX_LEN) chunks.push('');
    chunks[chunks.length - 1] += block;
  }
  return chunks.filter(Boolean);
}

async function sendNotification(message) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('Telegram settings not found. Notification cannot be sent. (Check .env file)');
    console.log('Notification Content:', message);
    return true;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    for (const text of splitMessage(message)) {
      await axios.post(url, {
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    }
    console.log('Telegram notification sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send Telegram notification:', error.response?.data || error.message);
    return false;
  }
}

module.exports = { sendNotification, splitMessage };
