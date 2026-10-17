// The CMS server's API (same origin, session cookie). Errors come back as Error with the server's message.
export async function api(path, { method = 'GET', body, form } = {}) {
    const res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : form,
    });
    let data = null;
    try { data = await res.json(); } catch { /* no JSON */ }
    if (!res.ok || data?.success === false) {
        const err = new Error(data?.error || data?.message || `Server answered ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}
