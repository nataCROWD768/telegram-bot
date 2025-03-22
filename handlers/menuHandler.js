module.exports = {
  handleMainMenu: (bot, chatId) => {
    bot.sendMessage(chatId, 'Главное меню:', {
      reply_markup: {
        keyboard: [
          ['Личный кабинет', 'Витрина'],
          ['Бонусы и продукт', 'Отзывы']
        ],
        resize_keyboard: true
      }
    });
  }
};