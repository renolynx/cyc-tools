/**
 * POST /api/team-auth
 * 验证团队管理密码
 */
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  const TEAM_PASSWORD = process.env.TEAM_PASSWORD;

  if (!TEAM_PASSWORD) {
    return res.status(500).json({ error: '管理密码未配置' });
  }

  if (!password || password !== TEAM_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }

  return res.status(200).json({ success: true });
}
