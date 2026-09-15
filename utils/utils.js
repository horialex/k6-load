function extractHrefs(res, selector) {
    const results = [];
    res.html(selector).each((i, el) => {
        const href = el.getAttribute('href');
        if (href) results.push(href);
    });
    return results;
}


export function extractSlugs(res, selector) {
    // Strip the URL fragment first — variant product links carry a "#/1-size-s/8-color-white"
    // suffix for client-side preselection, and naively splitting on "/" would grab a fragment
    // segment (e.g. "8-color-white") instead of the actual product slug.
    return extractHrefs(res, selector)
        .map((href) => href.split('#')[0])
        .map((href) => href.split('/').filter(Boolean).pop());
}


export function isLoggedIn(res, username) {
    const hasLogoutLink = res.html('a[href*="mylogout"]').size() > 0;
    const hasAccountName = res.body.includes(username);
    return hasLogoutLink && hasAccountName;
}

export function getRandom(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

const LOG_ENABLED = (__ENV.LOG || 'False') === 'True';

export function logRequest(res) {
    if (!LOG_ENABLED) return;
    const hasQuery = res.request.url.includes('?');
    const params = res.request.body ? `${hasQuery ? '&' : '?'}${res.request.body}` : '';
    console.log(`${res.request.method} ${res.request.url}${params} -> ${res.status} (${res.timings.duration.toFixed(0)}ms)`);
}


export function get_random(list) {
    return list[Math.floor((Math.random() * list.length))];
}