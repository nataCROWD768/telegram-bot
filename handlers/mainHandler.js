const handleMainMenu = (bot, chatId) => {
    bot.sendMessage(chatId, 'Добро пожаловать!', {
        reply_markup: {
            keyboard: [
                ['Отзывы'],
                ['Назад в меню']
            ],
            resize_keyboard: true
        }
    });
};

module.exports = { handleMainMenu };