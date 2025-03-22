require('dotenv').config();

module.exports = {
  token: process.env.BOT_TOKEN,
  adminId: process.env.ADMIN_ID,
  welcomeVideo: './public/welcome.mp4',
  companyInfo: `
  
*О компании ООО "Радар Грейс Пипл"*  

Мы предлагаем:  
✓ Товары высокого качества  
✓ Без оптовых и розничных наценок  
✓ Без маркетинговых накруток  
✓ С сертификатами и декларациями  
✓ Уникальная клубная система  

Работаем для вашего комфорта и выгоды!`
};