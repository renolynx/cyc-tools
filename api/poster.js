/**
 * GET /api/poster?token={file_token}
 * 飞书云盘附件代理：服务端用 tenant_access_token 获取
 * 临时下载 URL 后流式回传，处理浏览器无法直接拉取私有附件的问题
 */

import { getAccessToken } from './_feishu.js';

export default async function handler(req, res) {
  const token = req.query.token || req.query.file_token;
  if (!token) return res.status(400).json({ error: 'missing token' });

  try {
    // 1. 鉴权
    const accessToken = await getAccessToken();

    // 2. 获取临时下载 URL（适用于 drive 上的所有附件）
    const tmpRes = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=${encodeURIComponent(token)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const tmpData = await tmpRes.json();
    if (tmpData.code !== 0)
      return res.status(500).json({ error: '获取下载链接失败: ' + tmpData.msg });

    const tmpUrl = tmpData.data?.tmp_download_urls?.[0]?.tmp_download_url;
    if (!tmpUrl) return res.status(404).json({ error: 'file not found' });

    // 3. 下载并流式回传
    const fileRes = await fetch(tmpUrl);
    if (!fileRes.ok)
      return res.status(fileRes.status).json({ error: 'download failed' });

    const buf = Buffer.from(await fileRes.arrayBuffer());
    const ct  = fileRes.headers.get('content-type') || 'image/jpeg';

    res.setHeader('Content-Type',  ct);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('Content-Length', buf.length);
    return res.status(200).send(buf);

  } catch (err) {
    console.error('[poster proxy]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
