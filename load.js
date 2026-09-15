import { sleep, check, group } from 'k6'
import http from 'k6/http'
import { Trend, Rate } from 'k6/metrics'
import { extractSlugs, getRandom, logRequest, isLoggedIn, get_random } from './utils/utils.js'

// ---- Config ----

const hostname = __ENV.HOSTNAME || "http://172.22.4.19";
const lang = __ENV.LANGUAGE || "en";

// In seconds
const THINK_TIME = {
    LOW: 1,
    MEDIUM: 3,
    HIGH: 5,
    TYPING: 0.3,
}

const SELECTORS = {
    MAIN_CATEGORY: 'a.dropdown-item[data-depth="0"]',
    SUB_CATEGORY: 'a.dropdown-item[data-depth="1"]',
    PRODUCT: 'a.product-thumbnail',
}

const USER = {
    email: 'horatiu.encian@evozon.com',
    password: 'horatiu123',
    username: 'Encian Horatiu'
}

// Traffic mix for the browse scenario. Each VU is assigned a role once, when its JS
// instance initializes, and keeps that role for all of its iterations — a real user
// doesn't flip between guest and logged-in mid-session. With a small VU pool this is
// an approximate (statistical) split, not an exact quota.
const GUEST_SHARE = 0.65; // 65% guest / 35% logged-in
const isGuestVU = Math.random() < GUEST_SHARE;
let hasLoggedIn = false; // guards against re-logging-in on every iteration of a logged-in VU

// Per-request-type duration breakdown, shown in the end-of-test summary.
const homepageDuration = new Trend('homepage_duration');
const categoryDuration = new Trend('category_duration');
const subCategoryDuration = new Trend('sub_category_duration');
const productDetailsDuration = new Trend('product_details_duration');
const loginPageDuration = new Trend('login_page_duration');
const loginDuration = new Trend('login_duration');
const autocompleteDuration = new Trend('autocomplete_duration');
const searchDuration = new Trend('search_duration');
const addToCartDuration = new Trend('add_to_cart_duration');
const addToCartAjaxDuration = new Trend('add_to_cart_ajax_duration');
const viewCartDuration = new Trend('view_cart_duration');

// Per-request-type error rate (non-200 responses).
const homepageErrors = new Rate('homepage_errors');
const categoryErrors = new Rate('category_errors');
const subCategoryErrors = new Rate('sub_category_errors');
const productDetailsErrors = new Rate('product_details_errors');
const loginPageErrors = new Rate('login_page_errors');
const loginErrors = new Rate('login_errors');
const autocompleteErrors = new Rate('autocomplete_errors');
const searchErrors = new Rate('search_errors');
const addToCartErrors = new Rate('add_to_cart_errors');
const addToCartAjaxErrors = new Rate('add_to_cart_ajax_errors');
const viewCartErrors = new Rate('view_cart_errors');

// ---- Load profile ----

// Shared load profile — reused by every scenario so they all run the same test.
const LOAD_STAGES = [
    { duration: '5s', target: 5 },  // ramp-up
    { duration: '20s', target: 30 }, // stable load
    { duration: '10s', target: 0 }, // ramp-down to 0 users
]

export const options = {
    scenarios: {
        // browse: {
        //     executor: 'ramping-vus',
        //     exec: 'browse',
        //     stages: LOAD_STAGES,
        // },
        // search: {
        //     executor: 'ramping-vus',
        //     exec: 'search',
        //     stages: LOAD_STAGES,
        // },
        addToCart: {
            executor: 'ramping-vus',
            exec: 'addToCart',
            stages: LOAD_STAGES,
        }

    },
    // adds p(99) to the console summary alongside the defaults
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
    // starting-point thresholds — tune once a real baseline run has been observed
    thresholds: {
        http_req_duration: ['p(95) < 2000', 'p(99) < 3000'],
        http_req_failed: ['rate < 0.01'],

        homepage_duration: ['p(95) < 2000', 'p(99) < 3000'],
        category_duration: ['p(95) < 2000', 'p(99) < 3000'],
        sub_category_duration: ['p(95) < 2000', 'p(99) < 3000'],
        product_details_duration: ['p(95) < 2000', 'p(99) < 3000'],
        autocomplete_duration: ['p(95) < 2000', 'p(99) < 3000'],
        search_duration: ['p(95) < 2000', 'p(99) < 3000'],
        add_to_cart_duration: ['p(95) < 2000', 'p(99) < 3000'],
        add_to_cart_ajax_duration: ['p(95) < 2000', 'p(99) < 3000'],
        view_cart_duration: ['p(95) < 2000', 'p(99) < 3000'],

        homepage_errors: ['rate < 0.01'],
        category_errors: ['rate < 0.01'],
        sub_category_errors: ['rate < 0.01'],
        product_details_errors: ['rate < 0.01'],
        login_page_errors: ['rate < 0.01'],
        login_errors: ['rate < 0.01'],
        autocomplete_errors: ['rate < 0.01'],
        search_errors: ['rate < 0.01'],
        add_to_cart_errors: ['rate < 0.01'],
        add_to_cart_ajax_errors: ['rate < 0.01'],
        view_cart_errors: ['rate < 0.01'],
    }
}

// ---- Lifecycle hooks ----

export function setup() {
    console.log("Setup: Verfying Presta Shop availability before running the tests...");
    const res = http.get(hostname, { tags: { name: 'homepage_check' } });
    logRequest(res);
    if (res.status !== 200) {
        throw new Error(`Setup failed: Unexpected status code ${res.status} when accessing the application`)
    }
    console.log("Setup: Presta Shop is available. Ready to run the Load tests.")
}

export function teardown() {
    console.log("Teardown: Cleaning environment after test run")
}

// ---- Actions ----

export function getHomepage() {
    const res = http.get(`${hostname}/${lang}/`, { tags: { name: '[GET] Homepage' } });
    logRequest(res);
    homepageDuration.add(res.timings.duration);
    homepageErrors.add(res.status !== 200);
    check(res, { '200': (r) => r.status === 200 });

    return {
        mainCategories: extractSlugs(res, SELECTORS.MAIN_CATEGORY),
        subCategories: extractSlugs(res, SELECTORS.SUB_CATEGORY),
    };
}

export function getCategory(category) {
    const res = http.get(`${hostname}/${lang}/${category}`, { tags: { name: '[GET] Category' } });
    logRequest(res);
    categoryDuration.add(res.timings.duration);
    categoryErrors.add(res.status !== 200);
    check(res, { '200': (r) => r.status === 200 });
}

export function getSubCategory(subCategory) {
    const res = http.get(`${hostname}/${lang}/${subCategory}`, { tags: { name: '[GET] SubCategory' } });
    logRequest(res);
    subCategoryDuration.add(res.timings.duration);
    subCategoryErrors.add(res.status !== 200);
    check(res, { '200': (r) => r.status === 200 });

    return extractSlugs(res, SELECTORS.PRODUCT);
}

export function getProductDetails(product) {
    const res = http.get(`${hostname}/${lang}/${product}`, { tags: { name: '[GET] Product details' } });
    logRequest(res);
    productDetailsDuration.add(res.timings.duration);
    productDetailsErrors.add(res.status !== 200);
    check(res, { '200': (r) => r.status === 200 });

    const productId = res.html("#product_page_product_id").attr("value");
    const productCustomizationId = res.html("#product_customization_id").attr("value");
    const token = res.html("#add-to-cart-or-refresh input[name='token']").attr("value");

    return { productId, productCustomizationId, token }
}

export function getLoginPage() {
    const res = http.get(`${hostname}/${lang}/login`, { tags: { name: '[GET] Login page' } });
    logRequest(res);
    loginPageDuration.add(res.timings.duration);
    loginPageErrors.add(res.status !== 200);
    check(res, { '200': (r) => r.status === 200 });
}

export function login() {
    getLoginPage();
    sleep(THINK_TIME.LOW);

    let formData = { email: USER.email, password: USER.password, submitLogin: 1, back: `${hostname}/${lang}` };
    let headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    const res = http.post(`${hostname}/${lang}/login`, formData, { headers: headers, tags: { name: '[POST] Login' } });
    logRequest(res);
    loginDuration.add(res.timings.duration);

    const loggedIn = isLoggedIn(res, USER.username);
    loginErrors.add(res.status !== 200 || !loggedIn);
    check(res, {
        '200': (r) => r.status === 200,
        'logged in': () => loggedIn,
    });
    sleep(THINK_TIME.MEDIUM);
}

export function addProductToCart(productId, productCustomizationId, token, qty = 1) {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Accept': 'application/json, text/javascript, */*; q=0.01' };
    const formData = {
        token: token,
        id_product: productId,
        id_customization: productCustomizationId,
        qty: qty,
        add: 1,
        action: 'update',
    };
    const res = http.post(`${hostname}/${lang}/cart`, formData, { headers: headers, tags: { name: '[POST] Add to cart' } });
    logRequest(res);
    addToCartDuration.add(res.timings.duration);
    addToCartErrors.add(res.status !== 200);
    check(res, { '200': (r) => r.status === 200 });

    const ajaxRes = http.post(`${hostname}/${lang}/module/ps_shoppingcart/ajax`, {
        id_customization: productCustomizationId,
        id_product_attribute: 0,
        id_product: productId,
        action: 'add-to-cart',
    }, { headers: { 'X-Requested-With': 'XMLHttpRequest' }, tags: { name: '[POST] Ajax Add to cart' } })
    logRequest(ajaxRes);
    addToCartAjaxDuration.add(ajaxRes.timings.duration);
    addToCartAjaxErrors.add(ajaxRes.status !== 200);
    check(ajaxRes, { '200': (r) => r.status === 200 });
}

export function viewCart() {
    const res = http.get(`${hostname}/${lang}/cart?action=show`, { tags: { name: '[GET] View cart' } });
    logRequest(res);
    viewCartDuration.add(res.timings.duration);
    viewCartErrors.add(res.status !== 200);

    const cartQty = parseInt(res.html('.cart-products-count').text().replace(/\D/g, ''), 10);
    check(res, {
        '200': (r) => r.status === 200,
        'cart quantity is not 0': () => cartQty > 0,
    });
}

export function autocomplete(term) {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/javascript, */*; q=0.01' };
    const res = http.post(`${hostname}/${lang}/search`, { s: term, resultsPerPage: 10 }, { headers: headers, tags: { name: '[POST] Search product - Autocomplete' } });
    logRequest(res);
    autocompleteDuration.add(res.timings.duration);
    autocompleteErrors.add(res.status !== 200);
    check(res, { '200': (r) => r.status === 200 });
}

export function searchProduct(term) {
    const res = http.get(`${hostname}/${lang}/search?controller=search&s=${encodeURIComponent(term)}`, { tags: { name: '[GET] Search product' } });
    logRequest(res);
    searchDuration.add(res.timings.duration);
    searchErrors.add(res.status !== 200);
    check(res, { '200': (r) => r.status === 200 });

    return extractSlugs(res, SELECTORS.PRODUCT);
}

export function updateCartQuantity() {

}



// ---- Scenarios - User Jurneys ----

export function browse() {
    // Login or Guest
    if (!isGuestVU && !hasLoggedIn) {
        login();
        hasLoggedIn = true;
    }

    const { mainCategories, subCategories } = getHomepage();
    sleep(THINK_TIME.LOW);

    const category = getRandom(mainCategories);
    if (category === null) {
        console.warn("No main categories found on homepage, skipping rest of iteration");
        return;
    }
    sleep(THINK_TIME.MEDIUM);
    getCategory(category);

    const subCategory = getRandom(subCategories);
    if (subCategory === null) {
        console.warn("No sub-categories found on homepage, skipping rest of iteration");
        return;
    }
    sleep(THINK_TIME.LOW);
    const products = getSubCategory(subCategory);

    const product = getRandom(products);
    if (product === null) {
        console.warn(`No products found in sub-category "${subCategory}", skipping rest of iteration`);
        return;
    }
    sleep(THINK_TIME.MEDIUM);
    getProductDetails(product);

    sleep(THINK_TIME.MEDIUM);
}


export function search() {
    // Login or Guest
    if (!isGuestVU && !hasLoggedIn) {
        login();
        hasLoggedIn = true;
    }

    getHomepage();
    sleep(THINK_TIME.LOW);

    group('autocompleteSearchRequests', function () {
        autocomplete(getSearchTerm(3));
        sleep(THINK_TIME.TYPING);

        autocomplete(getSearchTerm(4));
        sleep(THINK_TIME.TYPING);

        autocomplete(getSearchTerm(5));
    });

    sleep(THINK_TIME.LOW);
    const products = searchProduct(getSearchTerm());

    const product = getRandom(products);
    if (product === null) {
        console.warn("No products found in search results, skipping rest of iteration");
        return;
    }
    sleep(THINK_TIME.MEDIUM);
    getProductDetails(product);
}

export function addToCart() {
    // Login or Guest
    if (!isGuestVU && !hasLoggedIn) {
        login();
        hasLoggedIn = true;
    }

    const { mainCategories, subCategories } = getHomepage();
    sleep(THINK_TIME.LOW);

    const category = getRandom(mainCategories);
    if (category === null) {
        console.warn("No main categories found on homepage, skipping rest of iteration");
        return;
    }
    sleep(THINK_TIME.MEDIUM);
    getCategory(category);

    const subCategory = getRandom(subCategories);
    if (subCategory === null) {
        console.warn("No sub-categories found on homepage, skipping rest of iteration");
        return;
    }
    sleep(THINK_TIME.LOW);
    const products = getSubCategory(subCategory);

    const product = getRandom(products);
    if (product === null) {
        console.warn(`No products found in sub-category "${subCategory}", skipping rest of iteration`);
        return;
    }
    sleep(THINK_TIME.MEDIUM);
    const { productId, productCustomizationId, token } = getProductDetails(product);

    sleep(THINK_TIME.LOW);
    addProductToCart(productId, productCustomizationId, token);

    sleep(THINK_TIME.LOW);
    viewCart();

    sleep(THINK_TIME.MEDIUM);
}

export function updateCart() {

}

function getSearchTerm(slice = 0) {
    let searchTerms = [
        "jeans",
        "shirt",
        "laptop",
        "sweater",
        "shoes",
        "notebook",
        "samsung",
        "vector",
        "hummingbird",
        "mountain"
    ]

    let searchTerm = get_random(searchTerms);

    if (slice === 0) {
        return searchTerm;
    }

    return searchTerm.slice(0, slice);
}