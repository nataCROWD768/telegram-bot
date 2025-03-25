const handleMainMenu = (bot, chatId) => {
    const newMessage = bot.sendMessage(chatId, 'Добро пожаловать!', {
        reply_markup: {
            keyboard: [
                ['Личный кабинет', 'Витрина'],
                ['Бонусы и продукт', 'Отзывы']
            ],
            resize_keyboard: true,
            one_time_keyboard: false,
            persistent: true
        }
    }).then(msg => {
        bot.lastMessageId = bot.lastMessageId || {};
        bot.lastMessageId[chatId] = msg.message_id;
    });
};

module.exports = { handleMainMenu };