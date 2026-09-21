import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)
export const workspacePaths = { volunteer: '/tinh-nguyen-vien', organizer: '/nha-to-chuc', admin: '/quan-tri' }
export const roleLabels = { volunteer: 'Tình nguyện viên', organizer: 'Nhà tổ chức', admin: 'Quản trị viên' }
export function useAuth() { return useContext(AuthContext) }
