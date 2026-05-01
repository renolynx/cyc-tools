/**
 * POST /api/photo-upload
 *   header:  Authorization: Bearer <identity-token>
 *   body: {
 *     data_url:       'data:image/jpeg;base64,...',  // 前端 canvas 压缩后
 *     title:          '一句话回忆',
 *     taken_at:       1715000000000,                 // ms
 *     activity_id?:   'rec_xxx',                     // 关联活动（可选）
 *     activity_title?:'...',
 *     description?:   '一段话回忆',
 *     privacy:        'public' | 'self'
 *   }
 *
 *   流程：
 *     1. verify token → member_rec_id
 *     2. 检查配额：count >= quota → 403
 *     3. 解析 data_url → Buffer
 *     4. PUT @vercel/blob → 拿 url + pathname
 *     5. createPhoto → 写飞书
 *     6. 失败时尝试清 blob（避免孤儿）
 *
 *   返回：{ success, photo, quota_remaining }
 */

import { applyCors } from './_feishu.js';
import { authFromRequest } from './_auth.js';
import { getQuota, countPhotos, createPhoto } from './_photo.js';
import { put } from '@vercel/blob';

// 默认 Vercel body parser 上限 1MB —— 调到 5MB 容纳 base64 后的图片
export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
  },
};

const MAX_DATAURL_LEN = 6_500_000;   // ~ 4.8MB 原始（base64 膨胀 33% 后）

function parseDataUrl(s) {
  const m = String(s || '').match(/^data:(image\/[\w+.-]+);base64,(.+)$/i);
  if (!m) throw new Error('data_url 格式不正确，必须是 data:image/...;base64,<payload>');
  return { mime: m[1].toLowerCase(), buf: Buffer.from(m[2], 'base64') };
}
function extFor(mime) {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png')  return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif')  return 'gif';
  return 'jpg';
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'POST only' });

  // 鉴权
  const auth = authFromRequest(req);
  if (!auth) return res.status(401).json({ error: '身份未验证或已过期，请重新关联身份' });

  // 环境变量
  const required = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_MEMBER_APP_TOKEN', 'BLOB_READ_WRITE_TOKEN'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    return res.status(500).json({ error: `服务端环境变量未配置: ${missing.join(', ')}` });
  }

  const body = req.body || {};
  const { data_url, title, taken_at, activity_id, activity_title, description, privacy } = body;

  if (!data_url) return res.status(400).json({ error: '缺 data_url' });
  if (typeof data_url !== 'string' || data_url.length > MAX_DATAURL_LEN) {
    return res.status(413).json({ error: '图片太大（请前端先压缩到 1.5MB 以内）' });
  }

  // 配额检查
  let quota, count;
  try {
    [quota, count] = await Promise.all([
      getQuota(auth.member_rec_id),
      countPhotos(auth.member_rec_id),
    ]);
  } catch (err) {
    return res.status(500).json({ error: '查询配额失败：' + err.message });
  }
  if (count >= quota) {
    return res.status(403).json({
      error: `已达 ${quota} 张上传上限。删除一张旧的或联系社区管理员开权限。`,
      code: 'QUOTA_EXCEEDED',
      quota, count,
    });
  }

  // 解析 dataURL
  let mime, buf;
  try {
    ({ mime, buf } = parseDataUrl(data_url));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // 上传到 Vercel Blob
  const ts = Date.now();
  const ext = extFor(mime);
  const ymd = new Date(Number(taken_at) || ts).toISOString().slice(0, 7);
  // 路径含 random 后缀 + member_rec_id —— 避免同毫秒并发 + 便于人工排查归属
  const rand = Math.random().toString(36).slice(2, 8);
  const pathname = `photos/${ymd}/${auth.member_rec_id}-${ts}-${rand}.${ext}`;

  let blob;
  try {
    blob = await put(pathname, buf, {
      access: 'public',
      contentType: mime,
      addRandomSuffix: false,   // 我们已经在 pathname 里加了 random
    });
  } catch (err) {
    return res.status(500).json({ error: 'Blob 上传失败：' + err.message });
  }

  // 写飞书
  try {
    const photo = await createPhoto({
      uploader_rec_id: auth.member_rec_id,
      blob_url:        blob.url,
      blob_pathname:   blob.pathname || pathname,
      title:           (title || '').trim() || '未命名',
      description:     (description || '').trim(),
      taken_at:        Number(taken_at) || ts,
      activity_id:     activity_id || '',
      activity_title:  activity_title || '',
      privacy:         privacy === 'self' ? 'self' : 'public',
    });
    return res.status(200).json({
      success: true,
      photo,
      quota_remaining: Math.max(0, quota - (count + 1)),
    });
  } catch (err) {
    // 飞书写失败但 blob 已传 — 尝试 cleanup 避免孤儿
    try {
      const { del } = await import('@vercel/blob');
      await del(blob.url);
    } catch {}
    return res.status(500).json({ error: '记录写入失败：' + err.message });
  }
}
