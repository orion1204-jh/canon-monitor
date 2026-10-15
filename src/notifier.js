const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendNotification(message) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('Telegram settings not found. Notification cannot be sent. (Check .env file)');
    console.log('Notification Content:', message);
    return true;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
    console.log('Telegram notification sent successfully');
    return true;
  } catch (error) {
    console.error('Failed to send Telegram notification:', error.response?.data || error.message);
    return false;
  }
}

module.exports = { sendNotification };
