const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const mongoose = require('mongoose');
const { token, welcomeVideo, companyInfo } = require('./config/botConfig');
const { handleMainMenu } = require('./handlers/menuHandler');
const { handleAdmin, showStats, showProducts, addProduct, editProduct, deleteProduct, moderateReviews, handleAdminCallback } = require('./handlers/adminHandler');
const { showProducts: showCatalog, handleCallback, searchProducts } = require('./handlers/productHandler');
const { showProfile, showOrderHistory } = require('./handlers/profileHandler');
const Visit = require('./models/visit');
const Product = require('./models/product');
const Order = require('./models/order');
const Review = require('./models/review');

const app = express();
const bot = new TelegramBot(token, { polling: true });

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Обработка старта
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;

  await Visit.create({ username, userId: chatId });
  await bot.sendVideoNote(chatId, welcomeVideo);
  await bot.sendMessage(chatId, companyInfo, { parse_mode: 'Markdown' });
  handleMainMenu(bot, chatId);
});

// Обработка команд
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  switch (msg.text) {
    case 'Личный кабинет':
      showProfile(bot, chatId);
      break;
    case 'Витрина':
      showCatalog(bot, chatId);
      break;
    case 'Бонусы и продукт':
      bot.sendMessage(chatId, 'Информация о бонусах (в разработке)');
      break;
    case 'Отзывы':
      bot.sendMessage(chatId, 'Оставьте отзыв через карточку товара');
      break;
    case '/admin':
      handleAdmin(bot, msg);
      break;
    case 'История заказов':
      showOrderHistory(bot, chatId);
      break;
    case 'Назад в меню':
      handleMainMenu(bot, chatId);
      break;
    case 'Статистика':
      showStats(bot, chatId);
      break;
    case 'Список товаров':
      showProducts(bot, chatId);
      break;
    case 'Добавить товар':
      addProduct(bot, chatId);
      break;
    case 'Редактировать товар':
      editProduct(bot, chatId);
      break;
    case 'Удалить товар':
      deleteProduct(bot, chatId);
      break;
    case 'Модерация отзывов':
      moderateReviews(bot, chatId);
      break;
  }

  if (msg.text?.startsWith('/search')) {
    const query = msg.text.split(' ').slice(1).join(' ');
    searchProducts(bot, chatId, query);
  }
});

bot.on('callback_query', (callbackQuery) => {
  handleCallback(bot, callbackQuery);
  handleAdminCallback(bot, callbackQuery);
});

// Инициализация тестовых данных
const initData = async () => {
  if (await Product.countDocuments() === 0) {
    await Product.create([
      {
        name: 'Продукт 1',
        description: 'Качественный товар',
        category: 'Электроника',
        clientPrice: 1000,
        clubPrice: 800,
        image: './public/product1.jpg',
        certificates: ['./public/cert1.jpg'],
        stock: 10
      },
      {
        name: 'Продукт 2',
        description: 'Еще один товар',
        category: 'Бытовая техника',
        clientPrice: 1500,
        clubPrice: 1200,
        image: './public/product2.jpg',
        certificates: ['./public/cert2.jpg'],
        stock: 5
      }
    ]);
  }
};
initData();

app.get('/', (req, res) => res.send('Bot is running'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));