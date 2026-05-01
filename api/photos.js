/**
 * GET  /api/photos?member_rec_id=...   → 该成员的照片（本人 token 时返回所有；他人只返回公开+审核通过）
 * GET  /api/photos?public=1            → 全社区公开照片（公共回忆聚合页用）
 * POST /api/photos { action: 'update'|'delete', record_id, ...patch }
 *
 *   POST 必须带 Authorization: Bearer <identity-token>
 *   且操作的 record 必须 uploader = token 中的 member_rec_id
 *
 *   GET 不强制 token（用 token 时本人能看到自己私照，无 token 只看到公开）
 */

import { applyCors } from './_feishu.js';
import { authFromRequest } from './_auth.js';
import {
  fetchPhotosByMember, fetchPublicPhotos, fetchPhoto,
  updatePhoto, deletePhotoRecord,
  getQuota, countPhotos,
} from './_photo.js';

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET')  return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'method not allowed' });
}

// ─────────── GET ───────────

async function handleGet(req, res) {
  const q = req.query || {};
  const isPublic = q.public === '1' || q.public === 'true';

  // 公开聚合
  if (isPublic) {
    try {
      const photos = await fetchPublicPhotos();
      return res.status(200).json({ success: true, count: photos.length, photos });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 单成员
  const member_rec_id = (q.member_rec_id || '').toString().trim();
  if (!member_rec_id) {
    return res.status(400).json({ error: '缺 member_rec_id 或 public=1' });
  }

  const auth = authFromRequest(req);
  const isSelf = !!(auth && auth.member_rec_id === member_rec_id);

  try {
    const all = await fetchPhotosByMember(member_rec_id);
    // 非本人：只返回公开 + 审核通过的
    const photos = isSelf
      ? all
      : all.filter(p => p.privacy === 'public' && p.review_status === '通过');

    // 本人才返回配额信息
    let quota = null;
    if (isSelf) {
      const [q1, c] = await Promise.all([
        getQuota(member_rec_id),
        countPhotos(member_rec_id),
      ]);
      quota = { quota: q1, count: c, remaining: Math.max(0, q1 - c) };
    }

    return res.status(200).json({
      success: true,
      count: photos.length,
      photos,
      quota,
      is_self: isSelf,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─────────── POST（update / delete）───────────

async function handlePost(req, res) {
  const auth = authFromRequest(req);
  if (!auth) return res.status(401).json({ error: '身份未验证或已过期，请重新关联身份' });

  const body = req.body || {};
  const action = (body.action || '').toString();
  const record_id = (body.record_id || '').toString().trim();
  if (!action || !record_id) {
    return res.status(400).json({ error: '缺 action 或 record_id' });
  }

  // 拿到照片确认归属
  let photo;
  try {
    photo = await fetchPhoto(record_id);
  } catch (err) {
    return res.status(500).json({ error: '查询照片失败：' + err.message });
  }
  if (!photo) {
    if (action === 'delete') {
      return res.status(200).json({ success: true, alreadyDeleted: true });   // 幂等
    }
    return res.status(404).json({ error: '照片不存在' });
  }
  if (photo.uploader_rec_id !== auth.member_rec_id) {
    return res.status(403).json({ error: '只能操作自己的照片' });
  }

  if (action === 'update') {
    try {
      const updated = await updatePhoto(record_id, auth.member_rec_id, {
        title:          body.title,
        description:    body.description,
        taken_at:       body.taken_at,
        activity_id:    body.activity_id,
        activity_title: body.activity_title,
        privacy:        body.privacy,
      });
      return res.status(200).json({ success: true, photo: updated });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (action === 'delete') {
    try {
      await deletePhotoRecord(record_id, auth.member_rec_id);
      // 飞书删完再清 blob（best-effort，失败不报错——孤儿 blob 后续可清）
      if (photo.blob_url) {
        try {
          const { del } = await import('@vercel/blob');
          await del(photo.blob_url);
        } catch (err) {
          console.warn('[photos delete] blob 清理失败（孤儿可后续处理）:', err.message);
        }
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'action 必须是 update 或 delete' });
}
