// Проверка, является ли устройство мобильным
function isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
}

// Глобальные переменные
let products = [];
let pendingReviews = [];
let ws;

const BASE_URL = 'https://telegram-bot-gmut.onrender.com';

// Подключение к WebSocket
function connectWebSocket() {
    ws = new WebSocket('wss://telegram-bot-gmut.onrender.com');
    ws.onopen = () => console.log('Подключено к WebSocket');
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('Получено сообщение WebSocket:', message);
        if (message.type === 'update_products') {
            products = message.data;
            console.log('Обновлены продукты через WebSocket:', products);
            renderProducts(products);
            const productDetail = document.getElementById('product-detail');
            if (productDetail.style.display === 'block') {
                const productId = document.querySelector('.submit-btn').getAttribute('data-id');
                const product = products.find(p => p._id === productId);
                showProductDetail(product);
            }
            const reviewsSection = document.getElementById('reviews-section');
            if (reviewsSection.style.display === 'block') {
                showReviews();
            }
        }
    };
    ws.onclose = () => {
        console.log('WebSocket отключён, переподключение...');
        setTimeout(connectWebSocket, 5000);
    };
    ws.onerror = (error) => console.error('Ошибка WebSocket:', error);
}

// Загрузка продуктов с бэкенда
async function loadProducts() {
    try {
        console.log(`Попытка загрузить продукты с ${BASE_URL}/api/products`);
        const response = await fetch(`${BASE_URL}/api/products`);
        console.log('Ответ от сервера:', response);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Не удалось загрузить продукты. Статус: ${response.status}, Текст: ${errorText}`);
        }
        const data = await response.json();
        products = data.products;
        console.log('Продукты загружены:', products);
        renderProducts(products);
    } catch (error) {
        console.error('Ошибка при загрузке продуктов:', error.message);
        alert('Не удалось загрузить продукты. Попробуйте позже.');
    }
}

// Рендеринг списка продуктов
function renderProducts(productArray) {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';
    productArray.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        const hasReviews = product.reviews && product.reviews.some(review => review.isApproved) && product.averageRating > 0;
        const ratingHtml = hasReviews ? `<div class="rating">★ ${product.averageRating.toFixed(1)}</div>` : '';
        card.innerHTML = `
            <div class="card-image">
                <img src="${product.image || '/images/placeholder.jpg'}" alt="${product.name}">
                ${ratingHtml}
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
                    <a href="#" class="product-detail-link" data-id="${product._id}">Карточка продукта</a>
                </div>
            </div>
        `;
        productList.appendChild(card);
    });

    document.querySelectorAll('.product-detail-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const productId = e.target.getAttribute('data-id');
            const product = products.find(p => p._id === productId);
            showProductDetail(product);
        });
    });
}

// Отображение карточки продукта
function showProductDetail(product) {
    const showcase = document.getElementById('showcase');
    const productDetail = document.getElementById('product-detail');
    const reviewsSection = document.getElementById('reviews-section');
    const productDetailContent = document.querySelector('.product-detail-content');
    const headerTitle = document.querySelector('.header-title');
    const searchBar = document.querySelector('.search-bar');
    const backBtn = document.getElementById('back-to-showcase');

    showcase.style.display = 'none';
    reviewsSection.style.display = 'none';
    productDetail.style.display = 'block';
    headerTitle.style.display = 'none';
    searchBar.style.display = 'none';
    backBtn.style.display = 'flex';

    const hasReviews = product.reviews && product.reviews.some(review => review.isApproved) && product.averageRating > 0;
    const ratingHtml = hasReviews ? `<div class="product-detail-rating">★ ${product.averageRating.toFixed(1)}</div>` : '';

    productDetailContent.innerHTML = `
        <div class="product-detail-image">
            <img src="${product.image || '/images/placeholder.jpg'}" alt="${product.name}">
            ${ratingHtml}
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
            <div class="product-detail-reviews review-container">
                <h4>Отзывы (${product.reviews ? product.reviews.filter(r => r.isApproved).length : 0})</h4>
                ${product.reviews && product.reviews.length > 0 ? product.reviews.filter(r => r.isApproved).map(review => `
                    <div class="review">
                        <p><strong>${review.username.startsWith('@') ? review.username : '@' + review.username}</strong> (★ ${review.rating})</p>
                        <p>${review.comment}</p>
                    </div>
                `).join('') : '<p>Пока нет отзывов.</p>'}
            </div>
            <div class="product-detail-review-form review-container">
                <h4>Оставить отзыв</h4>
                <div class="rating-stars" id="rating-stars-${product._id}">
                    <span class="star" data-value="1">★</span>
                    <span class="star" data-value="2">★</span>
                    <span class="star" data-value="3">★</span>
                    <span class="star" data-value="4">★</span>
                    <span class="star" data-value="5">★</span>
                </div>
                <textarea id="review-comment-${product._id}" placeholder="Ваш отзыв..."></textarea>
                <button class="submit-btn" data-id="${product._id}">Отправить</button>
            </div>
        </div>
    `;

    backBtn.onclick = () => {
        productDetail.style.display = 'none';
        showcase.style.display = 'block';
        headerTitle.style.display = 'block';
        headerTitle.textContent = 'Витрина';
        searchBar.style.display = 'flex';
        backBtn.style.display = 'none';
    };

    const stars = document.querySelectorAll(`#rating-stars-${product._id} .star`);
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

    document.querySelector(`.submit-btn[data-id="${product._id}"]`).addEventListener('click', () => {
        const comment = document.getElementById(`review-comment-${product._id}`).value;
        if (selectedRating > 0 && comment.trim() !== '') {
            const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
            const username = tg && tg.initDataUnsafe && tg.initDataUnsafe.user
                ? (tg.initDataUnsafe.user.username ? `@${tg.initDataUnsafe.user.username}` : 'Аноним')
                : 'Аноним';

            const review = {
                productId: product._id,
                user: username,
                rating: selectedRating,
                comment: comment
            };
            sendReviewToAdmin(review);
            document.getElementById(`review-comment-${product._id}`).value = '';
            stars.forEach(s => s.classList.remove('filled'));
            selectedRating = 0;
        } else {
            alert('Пожалуйста, выберите рейтинг и напишите отзыв.');
        }
    });
}

// Отправка отзыва на сервер
function sendReviewToAdmin(review) {
    fetch(`${BASE_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            productId: review.productId,
            username: review.user,
            rating: review.rating,
            comment: review.comment,
            isApproved: false
        })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Отзыв сохранён на сервере:', data);
                alert('Отзыв отправлен на модерацию.');
                loadProducts();
            } else {
                console.error('Ошибка сохранения отзыва:', data);
                alert('Ошибка при отправке отзыва');
            }
        })
        .catch(error => {
            console.error('Ошибка отправки отзыва на сервер:', error);
            alert('Ошибка сервера');
        });
}

// Отображение списка отзывов с пагинацией
function showReviews(page = 1) {
    const showcase = document.getElementById('showcase');
    const productDetail = document.getElementById('product-detail');
    const reviewsSection = document.getElementById('reviews-section');
    const reviewsList = document.getElementById('reviews-list');
    const pagination = document.getElementById('pagination');
    const headerTitle = document.querySelector('.header-title');
    const searchBar = document.querySelector('.search-bar');
    const backBtn = document.getElementById('back-to-showcase');

    showcase.style.display = 'none';
    productDetail.style.display = 'none';
    reviewsSection.style.display = 'block';
    headerTitle.style.display = 'block';
    headerTitle.textContent = 'Отзывы';
    searchBar.style.display = 'none';
    backBtn.style.display = 'flex';

    const allReviews = [];
    products.forEach(product => {
        if (product.reviews) {
            product.reviews.forEach(review => {
                if (review.isApproved) {
                    allReviews.push({ ...review, productName: product.name });
                }
            });
        }
    });
    console.log('Все одобренные отзывы:', allReviews);

    const reviewsPerPage = 10;
    const totalReviews = allReviews.length;
    const totalPages = Math.ceil(totalReviews / reviewsPerPage);
    const start = (page - 1) * reviewsPerPage;
    const end = Math.min(start + reviewsPerPage, totalReviews);
    const paginatedReviews = allReviews.slice(start, end);

    reviewsList.innerHTML = paginatedReviews.length > 0 ? paginatedReviews.map(review => `
        <div class="review">
            <p><strong>${review.username.startsWith('@') ? review.username : '@' + review.username}</strong> о продукте <strong>${review.productName}</strong> (★ ${review.rating})</p>
            <p>${review.comment}</p>
        </div>
    `).join('') : '<p>Пока нет отзывов.</p>';

    pagination.innerHTML = '';
    if (totalReviews > reviewsPerPage) {
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = '←';
        prevBtn.className = 'pagination-btn' + (page === 1 ? ' disabled' : '');
        prevBtn.disabled = page === 1;
        prevBtn.addEventListener('click', () => showReviews(page - 1));
        paginationContainer.appendChild(prevBtn);

        const maxVisiblePages = 5;
        let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            const firstPage = document.createElement('button');
            firstPage.textContent = '1';
            firstPage.className = 'pagination-btn';
            firstPage.addEventListener('click', () => showReviews(1));
            paginationContainer.appendChild(firstPage);

            if (startPage > 2) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'pagination-ellipsis';
                paginationContainer.appendChild(ellipsis);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.textContent = i;
            pageBtn.className = 'pagination-btn' + (i === page ? ' active' : '');
            pageBtn.addEventListener('click', () => showReviews(i));
            paginationContainer.appendChild(pageBtn);
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.className = 'pagination-ellipsis';
                paginationContainer.appendChild(ellipsis);
            }

            const lastPage = document.createElement('button');
            lastPage.textContent = totalPages;
            lastPage.className = 'pagination-btn';
            lastPage.addEventListener('click', () => showReviews(totalPages));
            paginationContainer.appendChild(lastPage);
        }

        const nextBtn = document.createElement('button');
        nextBtn.textContent = '→';
        nextBtn.className = 'pagination-btn' + (page === totalPages ? ' disabled' : '');
        nextBtn.disabled = page === totalPages;
        nextBtn.addEventListener('click', () => showReviews(page + 1));
        paginationContainer.appendChild(nextBtn);

        pagination.appendChild(paginationContainer);
    }

    backBtn.onclick = () => {
        reviewsSection.style.display = 'none';
        showcase.style.display = 'block';
        headerTitle.textContent = 'Витрина';
        searchBar.style.display = 'flex';
        backBtn.style.display = 'none';
    };
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    if (!isMobileDevice()) {
        document.getElementById('app-content').style.display = 'none';
        document.getElementById('mobile-only-message').style.display = 'block';
        return;
    }

    loadProducts();
    connectWebSocket();

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredProducts = products.filter(product =>
            product.name.toLowerCase().includes(searchTerm)
        );
        renderProducts(filteredProducts);
    });

    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.MainButton.hide();
        tg.onEvent('message', (msg) => {
            if (msg.text === '/reviews') showReviews();
        });
        tg.expand();
    }
});