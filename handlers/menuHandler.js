const handleMainMenu = async (bot, chatId) => {
  const newMessage = await bot.sendMessage(chatId, 'Меню:', {
    reply_markup: {
      keyboard: [
        ['Личный кабинет', 'Витрина'],
        ['Бонусы и продукт', 'Отзывы']
      ],
      resize_keyboard: true,
      one_time_keyboard: false, // Клавиатура не исчезает после нажатия
      persistent: true // Закрепляем клавиатуру (Telegram Bot API 6.4+)
    }
  });
  bot.lastMessageId = bot.lastMessageId || {};
  bot.lastMessageId[chatId] = newMessage.message_id; // Сохраняем ID сообщения меню
};

module.exports = { handleMainMenu };