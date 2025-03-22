const Visit = require('../models/visit');

const showProfile = async (bot, chatId) => {
  try {
    const visit = await Visit.findOne({ userId: chatId });
    if (!visit) {
      await bot.sendMessage(chatId, '❌ Профиль не найден');
      return;
    }
    await bot.sendMessage(chatId, `👤 Ваш профиль:\nИмя: ${visit.username}\nID: ${visit.userId}`);
  } catch (error) {
    console.error('Ошибка профиля:', error);
    await bot.sendMessage(chatId, '❌ Ошибка');
  }
};

module.exports = { showProfile };