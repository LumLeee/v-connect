import { Menu, X } from 'lucide-react'

export function WorkspaceMenuToggle({ menu }) {
  return <button ref={menu.toggleRef} className="workspace-menu-toggle" type="button" aria-expanded={menu.open} aria-controls={menu.id} aria-label={menu.open ? 'Đóng menu' : 'Mở menu'} onClick={menu.toggle}>
    <Menu size={22} aria-hidden="true" />
  </button>
}

export function WorkspaceMenuClose({ menu }) {
  return <button ref={menu.closeRef} className="workspace-sidebar-close" type="button" aria-label="Đóng menu" onClick={menu.close}><X size={22} aria-hidden="true" /></button>
}

export function WorkspaceMenuBackdrop({ menu }) {
  return menu.narrow && menu.open ? <button className="workspace-menu-backdrop" type="button" tabIndex={-1} aria-label="Đóng menu" onClick={menu.close} /> : null
}
