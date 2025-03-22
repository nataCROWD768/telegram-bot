const ITEMS_PER_PAGE = 20;
let currentPage = 1;
let totalPages = 1;

Telegram.WebApp.ready();

function loadProducts(page) {
    fetch(`/api/products?page=${page}&limit=${ITEMS_PER_PAGE}`)
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
                        <span class="club-price">${product.clubPrice} ₽</span> /
                        <span class="client-price">${product.clientPrice} ₽</span>
                    </div>
                    <div class="rating">★ ${product.averageRating.toFixed(1)}</div>
                `;
                card.onclick = () => Telegram.WebApp.showAlert(`Вы выбрали: ${product.name}\nОписание: ${product.description}`);
                productList.appendChild(card);
            });

            totalPages = Math.ceil(data.total / ITEMS_PER_PAGE);
            document.getElementById('page-info').textContent = `Страница ${page} из ${totalPages}`;
            document.getElementById('prev-btn').disabled = page === 1;
            document.getElementById('next-btn').disabled = page === totalPages;
        })
        .catch(error => {
            console.error('Ошибка загрузки товаров:', error);
            Telegram.WebApp.showAlert('Ошибка загрузки товаров');
        });
}

document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        loadProducts(currentPage);
    }
});

document.getElementById('next-btn').addEventListener('click', () => {
    if (currentPage < totalPages) {
        currentPage++;
        loadProducts(currentPage);
    }
});

// Загружаем первую страницу при открытии
loadProducts(currentPage);