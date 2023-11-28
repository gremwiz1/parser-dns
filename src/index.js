const puppeteer = require('puppeteer');
const fs = require('fs');

async function scrapeData() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    let products = [];

    // Настройка перехвата запросов
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    let currentPage = 1;
    let hasNextPage = true;

    // Перебор страниц категории
    while (hasNextPage) {
        await page.goto(`https://www.dns-shop.ru/catalog/17a8d26216404e77/vstraivaemye-xolodilniki/?p=${currentPage}`, { waitUntil: 'networkidle2' });

        // Извлечение данных о товарах
        let newProducts = await page.evaluate(() => {
            const items = [];
            document.querySelectorAll('.catalog-product.ui-button-widget').forEach((product) => {
                const nameElement = product.querySelector('.catalog-product__name');
                const priceElement = product.querySelector('.product-buy__price');
                if (priceElement) {
                    const prevPriceElement = priceElement.querySelector('.product-buy__prev');
                    if (prevPriceElement) {
                        priceElement.removeChild(prevPriceElement);
                    }
                }
                const name = nameElement ? nameElement.innerText.trim() : 'Название не найдено';
                const price = priceElement ? priceElement.textContent.trim().replace(/[^0-9]/g, '') : 'Цена не указана';
                items.push({ name, price });
            });
            return items;
        });

        products = [...products, ...newProducts];

        // Проверка на наличие и активность кнопки следующей страницы
        hasNextPage = await page.evaluate(() => {
            const nextButton = document.querySelector('.pagination-widget__page-link_next:not(.pagination-widget__page-link_disabled)');
            return Boolean(nextButton);
        });

        currentPage++;
    }

    await browser.close();

    // Форматирование данных в CSV
    const csvContent = 'Наименование,Цена\n' + products.map(item => `"${item.name}","${item.price}"`).join('\n');
    fs.writeFileSync('products.csv', csvContent);
}

scrapeData().catch(console.error);
