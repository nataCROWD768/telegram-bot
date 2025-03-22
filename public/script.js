Telegram.WebApp.ready();

function loadProducts() {
    fetch('/api/products')
        .then(response => response.json())
        .then(data => {
            const productList = document.getElementById('product-list');
            productList.innerHTML = '';

            data.products.forEach(product => {
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
                    <button class="review-btn" data-id="${product._id}">Отзыв</button>
                `;
                productList.appendChild(card);
            });

            // Обработчики кнопок
            document.querySelectorAll('.order-btn').forEach(btn => {
                btn.addEventListener('click', () => {
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

            document.querySelectorAll('.review-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const productId = btn.getAttribute('data-id');
                    const rating = prompt('Введите рейтинг (1-5):', '5');
                    const comment = prompt('Введите комментарий:');
                    if (rating && comment && !isNaN(rating)) {
                        Telegram.WebApp.sendData(JSON.stringify({
                            type: 'review',
                            productId,
                            rating: parseInt(rating),
                            comment
                        }));
                        Telegram.WebApp.close();
                    }
                });
            });
        })
        .catch(error => {
            console.error('Ошибка загрузки товаров:', error);
            Telegram.WebApp.showAlert('Ошибка загрузки товаров');
        });
}

// Показ кнопки "Наверх" при прокрутке
window.addEventListener('scroll', () => {
    const btn = document.getElementById('scroll-top-btn');
    btn.style.display = window.scrollY > 300 ? 'block' : 'none';
});

document.getElementById('scroll-top-btn').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Загружаем товары при открытии
loadProducts();