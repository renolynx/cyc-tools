/**
 * POST /api/avatar-upload
 *   header:  Authorization: Bearer <identity-token>
 *   body:    { data_url: 'data:image/jpeg;base64,...' }
 *
 *   流程：
 *     1. verify token → member_rec_id
 *     2. 删旧头像（KV 里查上次的 blob URL → del）
 *     3. PUT 新 blob → avatars/{rec_id}-{ts}.jpg（带 random ts 防 CDN 缓存）
 *     4. KV 存 avatar_url:{rec_id} → blob URL
 *     5. 返回 { success, avatar_url }
 *
 *   头像不计入照片配额（路径独立 avatars/，跟 photos/ 分开）。
 *   每人一张，新传覆盖旧的（删旧 + 写新）。
 */

import { applyCors } from './_feishu.js';
import { authFromRequest } from './_auth.js';
import { put, del } from '@vercel/blob';
import { kvGet, kvSet, isKvConfigured, invalidate } from './_kv.js';

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },   // 头像比照片小，2MB 够用
};

const MAX_DATAURL_LEN = 2_500_000;  // ~ 1.8MB JPEG 后

function parseDataUrl(s) {
  const m = String(s || '').match(/^data:(image\/[\w+.-]+);base64,(.+)$/i);
  if (!m) throw new Error('data_url 格式不正确');
  return { mime: m[1].toLowerCase(), buf: Buffer.from(m[2], 'base64') };
}
function extFor(mime) {
  if (mime === 'image/png')  return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  const auth = authFromRequest(req);
  if (!auth) return res.status(401).json({ error: '身份未验证或已过期' });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN 未配置' });
  }

  const { data_url } = req.body || {};
  if (!data_url) return res.status(400).json({ error: '缺 data_url' });
  if (typeof data_url !== 'string' || data_url.length > MAX_DATAURL_LEN) {
    return res.status(413).json({ error: '头像太大（建议先压缩到 256×256 以内）' });
  }

  let mime, buf;
  try {
    ({ mime, buf } = parseDataUrl(data_url));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // 删旧头像（best-effort）
  if (isKvConfigured()) {
    try {
      const oldUrl = await kvGet('avatar_url:' + auth.member_rec_id);
      if (oldUrl) {
        try { await del(oldUrl); } catch {}
      }
    } catch {}
  }

  const ts = Date.now();
  const ext = extFor(mime);
  const pathname = `avatars/${auth.member_rec_id}-${ts}.${ext}`;

  let blob;
  try {
    blob = await put(pathname, buf, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: false,
    });
  } catch (err) {
    return res.status(500).json({ error: '头像上传失败：' + err.message });
  }

  // 持久化 URL → KV（永久，无 TTL）
  if (isKvConfigured()) {
    try { await kvSet('avatar_url:' + auth.member_rec_id, blob.url); } catch (err) {
      console.warn('[avatar-upload] KV 写入失败（云端图存了，但无法持久化映射）:', err.message);
    }
  }
  // 头像变 → 成员资料展示变（picker / community 列表 / 详情 / 公开 list 都得刷）
  await invalidate('member', auth.member_rec_id);

  return res.status(200).json({ success: true, avatar_url: blob.url });
}
