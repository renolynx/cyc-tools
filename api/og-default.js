/**
 * GET /api/og-default
 * 默认 Open Graph 分享图：1200×630 SVG 渐变 + CYC 品牌
 * 用作没有海报的活动详情页的 og:image fallback
 */

const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"  stop-color="#1c3d2e"/>
      <stop offset="55%" stop-color="#2a5740"/>
      <stop offset="100%" stop-color="#d9652a"/>
    </linearGradient>
    <radialGradient id="blob1" cx="20%" cy="30%" r="50%">
      <stop offset="0%"   stop-color="#d9652a" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#d9652a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blob2" cx="80%" cy="80%" r="55%">
      <stop offset="0%"   stop-color="#c8a96e" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#c8a96e" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft">
      <feGaussianBlur stdDeviation="60"/>
    </filter>
  </defs>

  <!-- 背景 -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#blob1)" filter="url(#soft)"/>
  <rect width="1200" height="630" fill="url(#blob2)" filter="url(#soft)"/>

  <!-- 顶部小标 -->
  <g transform="translate(80, 110)">
    <circle cx="9" cy="14" r="6" fill="#d9652a"/>
    <text x="28" y="22" font-family="-apple-system, 'PingFang SC', sans-serif"
          font-size="22" font-weight="600" letter-spacing="2"
          fill="rgba(255,255,255,0.85)">链岛青年社区 · 大理</text>
  </g>

  <!-- 主标 -->
  <g transform="translate(80, 240)">
    <text x="0" y="0" font-family="-apple-system, 'PingFang SC', sans-serif"
          font-size="120" font-weight="800" letter-spacing="-2"
          fill="#ffffff">链接每一座</text>
    <text x="0" y="140" font-family="-apple-system, 'PingFang SC', sans-serif"
          font-size="120" font-weight="800" letter-spacing="-2"
          fill="#f2ede6">孤岛<tspan fill="#ffd9b8">.</tspan></text>
  </g>

  <!-- 副标 -->
  <g transform="translate(80, 470)">
    <text x="0" y="0" font-family="-apple-system, 'PingFang SC', sans-serif"
          font-size="28" font-weight="500" letter-spacing="1"
          fill="rgba(255,255,255,0.78)">CYC · Connected Youth Community</text>
  </g>

  <!-- 底栏 -->
  <g transform="translate(80, 560)">
    <text x="0" y="0" font-family="-apple-system, 'PingFang SC', sans-serif"
          font-size="24" font-weight="700" letter-spacing="3"
          fill="rgba(255,255,255,0.55)">CYC.CENTER</text>
  </g>
  <g transform="translate(1060, 555)">
    <circle cx="0" cy="-5" r="36" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
    <text x="0" y="3" text-anchor="middle"
          font-family="-apple-system, 'PingFang SC', sans-serif"
          font-size="32" font-weight="800"
          fill="#ffffff">C</text>
  </g>
</svg>`;

export default function handler(req, res) {
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  return res.status(200).send(SVG);
}
