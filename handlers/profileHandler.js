const Visit = require('../models/visit');

const showProfile = async (bot, chatId) => {
  try {
    const visit = await Visit.findOne({ userId: chatId });
    if (!visit) {
      await bot.sendMessage(chatId, '❌ Профиль не найден');
      return;
    }
    const profileText = `👤 **Личный кабинет**\n━━━━━━━━━━━━━━━━\n**Имя:** ${visit.username}\n**ID:** ${visit.userId}\n━━━━━━━━━━━━━━━━`;
    await bot.sendMessage(chatId, profileText, { parse_mode: 'Markdown' });
  } catch (error) {
    await bot.sendMessage(chatId, '❌ Ошибка');
  }
};

module.exports = { showProfile };