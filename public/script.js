Telegram.WebApp.ready();

let allProducts = [];

function loadProducts(products) {
    const productList = document.getElementById('product-list');
    productList.innerHTML = '';

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}">
            <h3>${product.name}</h3>
            <div class="prices">
                <span class="club-price">${product.clubPrice} ₽</span>
                <span class="client-price">${product.clientPrice} ₽</span>
            </div>
            <div class="rating">★ ${product.averageRating.toFixed(1)}</div>
            <button class="order-btn" data-id="${product._id}">В корзину</button>
        `;
        card.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') showProductDetail(product);
        });
        productList.appendChild(card);
    });

    // Обработчики кнопок "В корзину"
    document.querySelectorAll('.order-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const productId = btn.getAttribute('data-id');
            const quantity = prompt('Введите количество:', '1');
            if (quantity && !isNaN(quantity)) {
                Telegram.WebApp.sendData(JSON.stringify({
                    type: 'order',
                    productId,
                    quantity: parseInt(quantity)
                }));
                Telegram.WebApp.close();
            }
        });
    });
}

function showProductDetail(product) {
    const showcase = document.getElementById('showcase');
    const detail = document.getElementById('product-detail');
    const detailContent = document.getElementById('product-detail-content');

    showcase.style.display = 'none';
    detail.style.display = 'block';

    const reviewsHtml = product.reviews.length > 0
        ? product.reviews.map(r => `
            <div class="review">
                <span class="username">${r.username}</span>: 
                <span class="rating">★ ${r.rating}</span>
                <p>${r.comment}</p>
            </div>
        `).join('')
        : '<p>Отзывов пока нет</p>';

    detailContent.innerHTML = `
        <img src="${product.image}" alt="${product.name}">
        <h2>${product.name}</h2>
        <div class="description">${product.description}</div>
        <div class="prices">
            <span class="club-price">Клубная: ${product.clubPrice} ₽</span>
            <span class="client-price">Клиентская: ${product.clientPrice} ₽</span>
        </div>
        <div class="rating">Рейтинг: ★ ${product.averageRating.toFixed(1)}</div>
        <button class="order-btn" data-id="${product._id}">В корзину</button>
        <div class="reviews">
            <h3>Отзывы</h3>
            ${reviewsHtml}
        </div>
        <div class="review-form">
            <h3>Оставить отзыв</h3>
            <div class="rating-stars" data-rating="0">
                <span class="star" data-value="1">★</span>
                <span class="star" data-value="2">★</span>
                <span class="star" data-value="3">★</span>
                <span class="star" data-value="4">★</span>
                <span class="star" data-value="5">★</span>
            </div>
            <textarea id="review-comment" rows="4" placeholder="Ваш отзыв..."></textarea>
            <button class="submit-btn" data-id="${product._id}">Отправить отзыв</button>
        </div>
    `;

    // Обработчик кнопки "Назад"
    document.getElementById('back-btn').addEventListener('click', () => {
        detail.style.display = 'none';
        showcase.style.display = 'block';
    });

    // Обработчик кнопки "В корзину" в карточке
    detailContent.querySelector('.order-btn').addEventListener('click', () => {
        const productId = product._id;
        const quantity = prompt('Введите количество:', '1');
        if (quantity && !isNaN(quantity)) {
            Telegram.WebApp.sendData(JSON.stringify({
                type: 'order',
                productId,
                quantity: parseInt(quantity)
            }));
            Telegram.WebApp.close();
        }
    });

    // Обработчик рейтинга
    const stars = detailContent.querySelectorAll('.rating-stars .star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.getAttribute('data-value'));
            stars.forEach(s => {
                s.classList.toggle('filled', parseInt(s.getAttribute('data-value')) <= rating);
            });
            detailContent.querySelector('.rating-stars').setAttribute('data-rating', rating);
        });
    });

    // Обработчик отправки отзыва
    detailContent.querySelector('.submit-btn').addEventListener('click', () => {
        const productId = product._id;
        const rating = parseInt(detailContent.querySelector('.rating-stars').getAttribute('data-rating'));
        const comment = document.getElementById('review-comment').value.trim();

        if (rating > 0 && comment) {
            Telegram.WebApp.sendData(JSON.stringify({
                type: 'review',
                productId,
                rating,
                comment
            }));
            Telegram.WebApp.close();
        } else {
            Telegram.WebApp.showAlert('Пожалуйста, выберите рейтинг и введите комментарий');
        }
    });
}

// Загрузка товаров и поиск
fetch('/api/products')
    .then(response => response.json())
    .then(data => {
        allProducts = data.products;
        loadProducts(allProducts);

        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const filteredProducts = allProducts.filter(product =>
                product.name.toLowerCase().includes(query) ||
                product.description.toLowerCase().includes(query)
            );
            loadProducts(filteredProducts);
        });
    })
    .catch(error => {
        console.error('Ошибка загрузки товаров:', error);
        Telegram.WebApp.showAlert('Ошибка загрузки товаров');
    });

// Показ кнопки "Наверх" при прокрутке
window.addEventListener('scroll', () => {
    const btn = document.getElementById('scroll-top-btn');
    btn.style.display = window.scrollY > 300 ? 'block' : 'none';
});

document.getElementById('scroll-top-btn').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});