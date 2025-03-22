const handleMainMenu = (bot, chatId) => {
  bot.sendMessage(chatId, 'Меню:', {
    reply_markup: {
      keyboard: [
        ['Витрина', 'Личный кабинет'],
        ['Бонусы и продукт', 'Отзывы']
      ],
      resize_keyboard: true
    }
  });
};

module.exports = { handleMainMenu };