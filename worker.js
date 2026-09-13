export default {
  async fetch(request, env) {
    const expected = 'Basic ' + btoa('yiheng:' + env.SITE_PASSWORD);
    if (!env.SITE_PASSWORD || request.headers.get('Authorization') !== expected) {
      return new Response('请登录私人面试面板', {status:401,headers:{'WWW-Authenticate':'Basic realm="Private Interview", charset="UTF-8"','Cache-Control':'no-store'}});
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control','private, no-store');
    headers.set('X-Robots-Tag','noindex, nofollow');
    headers.set('Referrer-Policy','no-referrer');
    return new Response(response.body,{status:response.status,headers});
  }
};
