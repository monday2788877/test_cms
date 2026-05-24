import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'

export const Districts: CollectionConfig = {
  slug: 'districts',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'city', 'createdAt'],
  },
  access: {
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'city', type: 'text', required: true, defaultValue: 'Hà Nội' },
    { name: 'code', type: 'text', unique: true },
  ],
}
