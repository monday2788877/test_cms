import type { Access } from 'payload'

export const isAdminOrSelf: Access = ({ req, id }) => {
  if (req.user?.role === 'admin') return true
  return Boolean(req.user && id && String(req.user.id) === String(id))
}
