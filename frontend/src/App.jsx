import { Route, Routes } from 'react-router-dom'
import SiteLayout from './layouts/SiteLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import AboutPage from './pages/AboutPage.jsx'
import StatusPage from './pages/StatusPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import WorkspacePage from './pages/WorkspacePage.jsx'
import RequireRole from './auth/RequireRole.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="gioi-thieu" element={<AboutPage />} />
        <Route path="trang-thai" element={<StatusPage />} />
        <Route path="dang-nhap" element={<AuthPage key="login" mode="login" />} />
        <Route path="dang-ky" element={<AuthPage key="register" mode="register" />} />
        <Route path="quen-mat-khau" element={<AuthPage key="forgot" mode="forgot" />} />
        <Route path="dat-lai-mat-khau/:uid/:token" element={<AuthPage key="reset" mode="reset" />} />
        <Route element={<RequireRole role="volunteer" />}><Route path="tinh-nguyen-vien" element={<WorkspacePage role="volunteer" />} /></Route>
        <Route element={<RequireRole role="organizer" />}><Route path="nha-to-chuc" element={<WorkspacePage role="organizer" />} /></Route>
        <Route element={<RequireRole role="admin" />}><Route path="quan-tri" element={<WorkspacePage role="admin" />} /></Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
