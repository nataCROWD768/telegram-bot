const handleMainMenu = async (bot, chatId) => {
  const newMessage = await bot.sendMessage(chatId, 'Меню:', {
    reply_markup: {
      keyboard: [
        ['Личный кабинет', 'Витрина'],
        ['Бонусы и продукт', 'Отзывы']
      ],
      resize_keyboard: true,
      one_time_keyboard: false // Кнопки всегда видны
    }
  });
  bot.lastMessageId = bot.lastMessageId || {};
  bot.lastMessageId[chatId] = newMessage.message_id; // Сохраняем ID сообщения меню
};

module.exports = { handleMainMenu };