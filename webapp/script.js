window.Telegram.WebApp.ready();

const productsContainer = document.getElementById('products');
const prevButton = document.getElementById('prev');
const nextButton = document.getElementById('next');
const pageInfo = document.getElementById('page-info');

let currentPage = 1;
const itemsPerPage = 20;

async function loadProducts(page) {
    try {
        const response = await fetch(`/api/products?page=${page}&limit=${itemsPerPage}`);
        const { products, total } = await response.json();

        productsContainer.innerHTML = '';
        products.forEach(product => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <h3>${product.name}</h3>
                <div class="prices">
                    <span class="club-price">${product.clubPrice} ₽</span> /
                    <span class="client-price">${product.clientPrice} ₽</span>
                </div>
                <div class="rating">★ ${product.averageRating.toFixed(1)}</div>
                <button onclick="showProduct('${product._id}')">Подробнее</button>
            `;
            productsContainer.appendChild(card);
        });

        const totalPages = Math.ceil(total / itemsPerPage);
        pageInfo.textContent = `Страница ${page} из ${totalPages}`;
        prevButton.disabled = page === 1;
        nextButton.disabled = page === totalPages;

        currentPage = page;
    } catch (error) {
        console.error('Ошибка загрузки товаров:', error);
        productsContainer.innerHTML = '<p>Ошибка загрузки товаров</p>';
    }
}

function showProduct(productId) {
    Telegram.WebApp.showPopup({
        title: 'Открыть карточку товара?',
        message: 'Перейти к подробной информации о товаре?',
        buttons: [
            { id: 'open', type: 'ok', text: 'Да' },
            { type: 'cancel', text: 'Нет' }
        ]
    }, (buttonId) => {
        if (buttonId === 'open') {
            Telegram.WebApp.sendData(JSON.stringify({ action: 'show_product', productId }));
            Telegram.WebApp.close();
        }
    });
}

prevButton.addEventListener('click', () => loadProducts(currentPage - 1));
nextButton.addEventListener('click', () => loadProducts(currentPage + 1));

// Загружаем первую страницу при открытии
loadProducts(1);