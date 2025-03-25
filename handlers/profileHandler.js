const Visit = require('../models/visit');

const showProfile = async (bot, chatId) => {
  try {
    const visit = await Visit.findOne({ userId: chatId });
    if (!visit) {
      const errorMsg = await bot.sendMessage(chatId, '❌ Профиль не найден');
      bot.lastMessageId[chatId] = errorMsg.message_id;
      return;
    }
    const profileText = `👤 **Личный кабинет**\n━━━━━━━━━━━━━━━━\n**Имя:** ${visit.username}\n**ID:** ${visit.userId}\n━━━━━━━━━━━━━━━━`;
    const newMessage = await bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
    bot.lastMessageId[chatId] = newMessage.message_id;
  } catch (error) {
    const errorMsg = await bot.sendMessage(chatId, '❌ Ошибка');
    bot.lastMessageId[chatId] = errorMsg.message_id;
  }
};

module.exports = { showProfile };