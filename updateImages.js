const mongoose = require('mongoose');
const Product = require('./models/product');

mongoose.connect('mongodb+srv://nataCROWD768:april1987@cluster0.7hwwy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log('MongoDB подключен');
        const products = await Product.find();
        for (const product of products) {
            if (product.image === '/images/image1.jpg') {
                product.image = 'AgACAgIAAyEFAASJXc1UAAMXZ-F0dcUsBhoLYimz17lQAAGUiw-9AALd8DEbnl0IS-pXq5KpmW1RAQADAgADeQADNgQ'; // Замените на реальный file_id
            } else if (product.image === '/images/image2.jpg') {
                product.image = 'AgACAgIAAxkBAAILaGfhbLUyubfMY9OK_gvo60ZyVpMyAAL47DEbNvUIS-82pEMqNMCiAQADAgADeQADNgQ'; // Замените на реальный file_id
            } else if (product.image === '/images/image3.jpg') {
                product.image = 'AgACAgIAAxkBAAILa2fhd3_-vqyFuPWD7cOE4FxxKcaRAAIy7TEbNvUIS1eQny9QHO0uAQADAgADeQADNgQ'; // Замените на реальный file_id
            } else if (product.image === '/images/image4.jpg') {
                product.image = 'AgACAgIAAxkBAAILbWfhd6fACBOlXtwo6gNS7eYkdOVwAAIz7TEbNvUIS5IyhGcDd3PfAQADAgADeQADNgQ'; // Замените на реальный file_id
            } else if (product.image === '/images/image5.jpg') {
                product.image = 'AgACAgIAAyEFAASJXc1UAAMpZ-F381EI1-xsaNXm7bVnmfMUIDIAAiTxMRueXQhLaBx-rijAAAH9AQADAgADeQADNgQ'; // Замените на реальный file_id
            } else if (product.image === '/images/image6.jpg') {
                product.image = 'AgACAgIAAyEFAASJXc1UAAMqZ-F4EVgvK_HlDIiDNRzlw6A0LLQAAiXxMRueXQhLNRisr5C3q1ABAAMCAAN5AAM2BA'; // Замените на реальный file_id
            } else if (product.image === '/images/image7.jpg') {
                product.image = 'AgACAgIAAyEFAASJXc1UAAMrZ-F4MX1Nw1vZgydlgWbYYQTfmPcAAibxMRueXQhLGeb6m8TDFLYBAAMCAAN5AAM2BA'; // Замените на реальный file_id
            } else if (product.image === '/images/image8.jpg') {
                product.image = 'AgACAgIAAyEFAASJXc1UAAMsZ-F4WETAer29K0SWHqfXi0MuvlsAAifxMRueXQhL-pp6t9GTwcYBAAMCAAN5AAM2BA'; // Замените на реальный file_id
            } else if (product.image === '/images/image9.jpg') {
                product.image = 'AgACAgIAAyEFAASJXc1UAAMtZ-F4emwxy0SV21jk6dnz6d-NsTkAAijxMRueXQhLF59HEcCIqn0BAAMCAAN5AAM2BA'; // Замените на реальный file_id
            }
            await product.save();
        }
        console.log('База данных обновлена');
        mongoose.connection.close();
    })
    .catch(err => console.error('Ошибка:', err));