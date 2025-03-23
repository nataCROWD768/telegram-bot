// Проверка, является ли устройство мобильным
function isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
}

// Данные о продуктах (будут загружаться с бэкенда)
let products = [];

// Хранилище для отзывов на модерации
let pendingReviews = [];

// WebSocket для обновления данных в реальном времени
let ws;

// Функция для подключения к WebSocket
function connectWebSocket() {
    ws = new WebSocket('ws://localhost:8080'); // Замените на ваш URL WebSocket

    ws.onopen = () => {
        console.log('Подключено к WebSocket');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'update_products') {
            products = message.data;
            renderProducts(products); // Обновляем список продуктов
            // Если открыта карточка продукта, обновляем её
            const productDetail = document.getElementById('product-detail');
            if (productDetail.style.display === 'block') {
                const productId = parseInt(document.querySelector('.submit-btn').getAttribute('data-id'));
                const product = products.find(p => p.id === productId);
                showProductDetail(product);
            }
            // Если открыт список отзывов, обновляем его
            const reviewsSection = document.getElementById('reviews-section');
            if (reviewsSection.style.display === 'block') {
                showReviews();
            }
        }
    };

    ws.onclose = () => {
        console.log('WebSocket отключён, пытаемся переподключиться...');
        setTimeout(connectWebSocket, 5000); // Переподключаемся через 5 секунд
    };

    ws.onerror = (error) => {
        console.error('Ошибка WebSocket:', error);
    };
}

// Функция для загрузки продуктов с бэкенда
async function loadProducts() {
    try {
        console.log('Попытка загрузить продукты с http://localhost:3000/products');
        const response = await fetch('http://localhost:3000/products'); // Замените на ваш URL API
        console.log('Ответ от сервера:', response);
        if (!response.ok) {
            throw new Error(`Не удалось загрузить продукты. Статус: ${response.status}`);
        }
        products = await response.json();
        console.log('Продукты загружены:', products);
        renderProducts(products);
    } catch (error) {
        console.error('Ошибка при загрузке продуктов:', error.message);
        alert('Не удалось загрузить продукты. Попробуйте позже.');
    }
}

// Функция для синхронизации отзывов с бэкендом
async function syncReviews() {
    try {
        const response = await fetch('http://localhost:3000/sync-reviews', { // Замените на ваш URL API
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pendingReviews })
        });
        if (!response.ok) throw new Error('Не удалось синхронизировать отзывы');
    } catch (error) {
        console.error('Ошибка при синхронизации отзывов:', error);
    }
}

// Функция для рендеринга списка товаров
function renderProducts(productArray) {
    const productList = document.getElementById('product-list');
    productList.innerHTML = ''; // Очищаем список перед рендерингом

    productArray.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-image">
                <img src="${product.image || '/images/placeholder.jpg'}" alt="${product.name}">
                <div class="rating">★ ${product.rating || 0}</div>
            </div>
            <div class="card-content">
                <h3>${product.name}</h3>
                <div class="prices">
                    <div class="price-container">
                        <i class="fas fa-crown price-icon"></i>
                        <span class="club-price">${product.clubPrice || 0} ₽</span>
                    </div>
                    <div class="price-container">
                        <i class="fas fa-user price-icon"></i>
                        <span class="client-price">${product.clientPrice || 0} ₽</span>
                    </div>
                </div>
                <div class="card-button">
                    <a href="#" class="product-detail-link" data-id="${product.id}">Карточка продукта</a>
                </div>
            </div>
        `;
        productList.appendChild(card);
    });

    // Добавляем обработчики событий для кнопок "Карточка продукта"
    document.querySelectorAll('.product-detail-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const productId = parseInt(e.target.getAttribute('data-id'));
            const product = products.find(p => p.id === productId);
            showProductDetail(product);
        });
    });
}

// Функция для отображения карточки товара
function showProductDetail(product) {
    const showcase = document.getElementById('showcase');
    const productDetail = document.getElementById('product-detail');
    const reviewsSection = document.getElementById('reviews-section');
    const productDetailContent = document.querySelector('.product-detail-content');
    const headerTitle = document.querySelector('.header-title');
    const searchBar = document.querySelector('.search-bar');
    const backBtn = document.getElementById('back-to-showcase');

    // Скрываем витрину и показываем карточку товара
    showcase.style.display = 'none';
    reviewsSection.style.display = 'none';
    productDetail.style.display = 'block';

    // Скрываем заголовок "Витрина" и строку поиска, показываем кнопку "Назад"
    headerTitle.style.display = 'none';
    searchBar.style.display = 'none';
    backBtn.style.display = 'flex';

    // Формируем содержимое карточки товара
    productDetailContent.innerHTML = `
        <div class="product-detail-image">
            <img src="${product.image || '/images/placeholder.jpg'}" alt="${product.name}">
            <div class="product-detail-rating">★ ${product.rating || 0}</div>
        </div>
        <div class="product-detail-info">
            <h3>${product.name}</h3>
            <div class="product-detail-prices">
                <div class="price-container">
                    <i class="fas fa-crown price-icon"></i>
                    <span class="club-price">${product.clubPrice || 0} ₽</span>
                    <span class="price-label">Клубная цена</span>
                </div>
                <div class="price-container">
                    <i class="fas fa-user price-icon"></i>
                    <span class="client-price">${product.clientPrice || 0} ₽</span>
                    <span class="price-label">Клиентская цена</span>
                </div>
            </div>
            <div class="product-detail-description">
                <h4>Описание</h4>
                <p>${product.description || 'Описание отсутствует'}</p>
            </div>
            <div class="product-detail-reviews">
                <h4>Отзывы (${product.reviews.filter(r => r.status === 'approved').length})</h4>
                ${product.reviews.filter(r => r.status === 'approved').length > 0 ? product.reviews.filter(r => r.status === 'approved').map(review => `
                    <div class="review">
                        <p><strong>${review.user}</strong> (★ ${review.rating})</p>
                        <p>${review.comment}</p>
                    </div>
                `).join('') : '<p>Пока нет отзывов.</p>'}
            </div>
            <div class="product-detail-review-form">
                <h4>Оставить отзыв</h4>
                <div class="rating-stars" id="rating-stars-${product.id}">
                    <span class="star" data-value="1">★</span>
                    <span class="star" data-value="2">★</span>
                    <span class="star" data-value="3">★</span>
                    <span class="star" data-value="4">★</span>
                    <span class="star" data-value="5">★</span>
                </div>
                <textarea id="review-comment-${product.id}" placeholder="Ваш отзыв..."></textarea>
                <button class="submit-btn" data-id="${product.id}">Отправить</button>
            </div>
        </div>
    `;

    // Обработчик для кнопки "Назад"
    backBtn.addEventListener('click', () => {
        productDetail.style.display = 'none';
        showcase.style.display = 'block';
        headerTitle.style.display = 'block';
        headerTitle.textContent = 'Витрина';
        searchBar.style.display = 'flex';
        backBtn.style.display = 'none';
    });

    // Обработчик для звёзд рейтинга
    const stars = document.querySelectorAll(`#rating-stars-${product.id} .star`);
    let selectedRating = 0;
    stars.forEach(star => {
        star.addEventListener('click', () => {
            selectedRating = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => s.classList.remove('filled'));
            for (let i = 0; i < selectedRating; i++) {
                stars[i].classList.add('filled');
            }
        });
    });

    // Обработчик для отправки отзыва
    document.querySelector(`.submit-btn[data-id="${product.id}"]`).addEventListener('click', () => {
        const comment = document.getElementById(`review-comment-${product.id}`).value;
        if (selectedRating > 0 && comment.trim() !== '') {
            const review = {
                productId: product.id,
                user: 'Пользователь', // Здесь можно добавить авторизацию для имени
                rating: selectedRating,
                comment: comment,
                status: 'pending' // Статус "на модерации"
            };
            pendingReviews.push(review);
            alert('Отзыв отправлен на модерацию.');
            document.getElementById(`review-comment-${product.id}`).value = ''; // Очищаем поле
            stars.forEach(s => s.classList.remove('filled')); // Сбрасываем рейтинг
            selectedRating = 0;
            sendReviewToAdmin(review); // Отправляем уведомление администратору
            syncReviews(); // Синхронизируем с бэкендом
        } else {
            alert('Пожалуйста, выберите рейтинг и напишите отзыв.');
        }
    });
}

// Функция для отправки уведомления администратору о новом отзыве
function sendReviewToAdmin(review) {
    const botToken = 'YOUR_BOT_TOKEN'; // Замените на токен вашего бота
    const adminChatId = 'ADMIN_CHAT_ID'; // Замените на chat_id администратора

    const message = `Новый отзыв на модерации:\nПродукт ID: ${review.productId}\nПользователь: ${review.user}\nРейтинг: ${review.rating}\nКомментарий: ${review.comment}`;

    fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: adminChatId,
            text: message
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.ok) {
                console.log('Уведомление отправлено администратору:', review);
            } else {
                console.error('Ошибка при отправке уведомления:', data);
            }
        })
        .catch(error => console.error('Ошибка:', error));
}

// Функция для отображения списка отзывов с пагинацией
function showReviews(page = 1) {
    const showcase = document.getElementById('showcase');
    const productDetail = document.getElementById('product-detail');
    const reviewsSection = document.getElementById('reviews-section');
    const reviewsList = document.getElementById('reviews-list');
    const pagination = document.getElementById('pagination');
    const headerTitle = document.querySelector('.header-title');
    const searchBar = document.querySelector('.search-bar');
    const backBtn = document.getElementById('back-to-showcase');

    // Скрываем витрину и карточку товара, показываем список отзывов
    showcase.style.display = 'none';
    productDetail.style.display = 'none';
    reviewsSection.style.display = 'block';

    // Обновляем шапку
    headerTitle.style.display = 'block';
    headerTitle.textContent = 'Отзывы';
    searchBar.style.display = 'none';
    backBtn.style.display = 'flex';

    // Собираем все подтверждённые отзывы
    const allReviews = [];
    products.forEach(product => {
        product.reviews.forEach(review => {
            if (review.status === 'approved') {
                allReviews.push({ ...review, productName: product.name });
            }
        });
    });

    // Пагинация
    const reviewsPerPage = 5;
    const totalPages = Math.ceil(allReviews.length / reviewsPerPage);
    const start = (page - 1) * reviewsPerPage;
    const end = start + reviewsPerPage;
    const paginatedReviews = allReviews.slice(start, end);

    // Рендерим отзывы
    reviewsList.innerHTML = paginatedReviews.length > 0 ? paginatedReviews.map(review => `
        <div class="review">
            <p><strong>${review.user}</strong> о продукте <strong>${review.productName}</strong> (★ ${review.rating})</p>
            <p>${review.comment}</p>
        </div>
    `).join('') : '<p>Пока нет отзывов.</p>';

    // Рендерим пагинацию
    pagination.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.textContent = i;
        pageBtn.className = i === page ? 'page-btn active' : 'page-btn';
        pageBtn.addEventListener('click', () => showReviews(i));
        pagination.appendChild(pageBtn);
    }

    // Обработчик для кнопки "Назад"
    backBtn.addEventListener('click', () => {
        reviewsSection.style.display = 'none';
        showcase.style.display = 'block';
        headerTitle.textContent = 'Витрина';
        searchBar.style.display = 'flex';
        backBtn.style.display = 'none';
    });
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    if (!isMobileDevice()) {
        document.getElementById('app-content').style.display = 'none';
        document.getElementById('mobile-only-message').style.display = 'block';
        return;
    }

    loadProducts(); // Загружаем продукты с бэкенда
    connectWebSocket(); // Подключаемся к WebSocket

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredProducts = products.filter(product =>
            product.name.toLowerCase().includes(searchTerm)
        );
        renderProducts(filteredProducts);
    });

    // Обработчик для кнопки "Отзывы" в Telegram-боте
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.MainButton.hide(); // Скрываем главную кнопку, если она не нужна

        // Подписываемся на события от бота (через команды)
        tg.onEvent('message', (msg) => {
            if (msg.text === '/reviews') {
                showReviews();
            }
        });

        tg.expand(); // Разворачиваем приложение
    }
});