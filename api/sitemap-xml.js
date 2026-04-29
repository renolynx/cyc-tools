/**
 * GET /api/sitemap-xml
 * 动态生成 sitemap.xml，包含静态页 + 全部活动详情页 URL
 *
 * vercel.json rewrite: /sitemap.xml → /api/sitemap-xml
 */

import { fetchAllActivities }            from './_activity.js';
import { kvGet, kvSet, isKvConfigured }  from './_kv.js';

const SITE_URL      = 'https://cyc.center';
const CACHE_TTL_SEC = 600;
const EDGE_CACHE    = 'public, s-maxage=600, stale-while-revalidate=86400';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

export default async function handler(req, res) {
  // 缓存
  const cacheKey = 'sitemap:acts';
  let acts = null;
  if (isKvConfigured()) {
    try {
      const cached = await kvGet(cacheKey);
      if (cached) acts = JSON.parse(cached);
    } catch {}
  }

  if (!acts) {
    try {
      acts = await fetchAllActivities();
    } catch (err) {
      console.error('[sitemap]', err.message);
      acts = [];
    }
    if (acts.length && isKvConfigured()) {
      try { await kvSet(cacheKey, JSON.stringify(acts), CACHE_TTL_SEC); } catch {}
    }
  }

  // 静态页
  const staticUrls = [
    { loc: SITE_URL + '/',       changefreq: 'weekly',  priority: 1.0 },
    { loc: SITE_URL + '/events', changefreq: 'daily',   priority: 0.9 },
    { loc: SITE_URL + '/tools',  changefreq: 'monthly', priority: 0.5 },
  ];

  // 每条活动
  const eventUrls = acts
    .filter(a => a.record_id && a.title)
    .map(a => ({
      loc: `${SITE_URL}/events/${a.record_id}`,
      lastmod: a.date || '',
      changefreq: 'monthly',
      priority: 0.7,
    }));

  const all = [...staticUrls, ...eventUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(urlEntry).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', EDGE_CACHE);
  return res.status(200).send(xml);
}
