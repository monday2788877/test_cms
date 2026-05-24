import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { isAdmin } from '../access/isAdmin'
import { isAdminOrSelf } from '../access/isAdminOrSelf'


const isAdminField = ({ req }: any): boolean => {
  return (req.user as any)?.role === 'admin'
}

const protectPublicRole: CollectionBeforeChangeHook = ({ req, data }) => {
  const user = req.user as any
  if (user && user.role !== 'admin') {
    data.role = 'user'
  }
  return data
}

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'fullName', 'role', 'createdAt'],
    group: 'User Management',
  },
  access: {
    create: isAdmin,
    read: isAdminOrSelf,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [protectPublicRole],
  },
  fields: [
    {
      name: 'fullName',
      type: 'text',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      required: false,
    },

    {
      name: 'authProvider',
      type: 'select',
      required: true,
      defaultValue: 'local',
      options: [
        { label: 'Local password', value: 'local' },
        { label: 'Google/Gmail', value: 'google' },
      ],
      admin: { position: 'sidebar' },
      access: { update: isAdminField },
    },
    {
      name: 'googleId',
      type: 'text',
      unique: true,
      admin: { position: 'sidebar', description: 'Google sub id dùng để link Gmail login.' },
      access: { update: isAdminField },
    },
    {
      name: 'googleEmailVerified',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
      access: { update: isAdminField },
    },
    {
      name: 'avatarUrl',
      type: 'text',
      admin: { position: 'sidebar' },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'user',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'User', value: 'user' },
      ],
      access: {
        update: isAdminField,
      },
    },
  ],
}
