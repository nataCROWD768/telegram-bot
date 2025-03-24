const Visit = require('../models/visit');

const showProfile = async (bot, chatId) => {
  try {
    const visit = await Visit.findOne({ userId: chatId });
    if (!visit) {
      const errorMsg = await bot.sendMessage(chatId, '❌ Профиль не найден');
      bot.lastMessageId[chatId] = errorMsg.message_id;
      return;
    }
    const profileText = `
            👤 **Личный кабинет**
            ━━━━━━━━━━━━━━━━
            **Имя:** ${visit.username}
            **ID:** ${visit.userId}
            ━━━━━━━━━━━━━━━━
        `;
    const newMessage = await bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
    bot.lastMessageId[chatId] = newMessage.message_id;
  } catch (error) {
    console.error('Ошибка профиля:', error);
    const errorMsg = await bot.sendMessage(chatId, '❌ Ошибка');
    bot.lastMessageId[chatId] = errorMsg.message_id;
  }
};

module.exports = { showProfile };