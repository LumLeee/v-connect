import { Route, Routes } from 'react-router-dom'
import SiteLayout from './layouts/SiteLayout.jsx'
import HomePage from './pages/HomePage.jsx'
import AboutPage from './pages/AboutPage.jsx'
import StatusPage from './pages/StatusPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import WorkspacePage from './pages/WorkspacePage.jsx'
import VolunteerDashboard from './pages/VolunteerDashboard.jsx'
import RequireRole from './auth/RequireRole.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import ActivitiesPage from './pages/ActivitiesPage.jsx'
import ActivityDetailPage from './pages/ActivityDetailPage.jsx'
import ActivityEditorPage from './pages/ActivityEditorPage.jsx'
import { useAuth } from './auth/context.js'
import ParticipationsPage from './pages/ParticipationsPage.jsx'
import AttendancePage from './pages/AttendancePage.jsx'
import FeedbackPage from './pages/FeedbackPage.jsx'
import FeedbackListPage from './pages/FeedbackListPage.jsx'
import ReportsPage from './pages/ReportsPage.jsx'
import AdminAccountsPage from './pages/AdminAccountsPage.jsx'
import AuditPage from './pages/AuditPage.jsx'

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route element={<RequireRole />}>
          <Route path="bao-cao" element={<ReportsPage key={`overview-${user?.id}`} />} />
          <Route path="bao-cao/hoat-dong" element={<ReportsPage key={`activities-${user?.id}`} mode="activities" />} />
          <Route path="bao-cao/hoat-dong/:id" element={<ReportsPage key={`result-${user?.id}`} mode="result" />} />
          <Route path="bao-cao/dang-ky" element={<ReportsPage key={`participations-${user?.id}`} mode="participations" />} />
        </Route>
        <Route element={<RequireRole role="admin" />}>
          <Route path="quan-tri/tai-khoan" element={<AdminAccountsPage key={user?.id} />} />
          <Route path="quan-tri/nhat-ky" element={<AuditPage key={user?.id} />} />
        </Route>
        <Route index element={<HomePage />} />
        <Route path="gioi-thieu" element={<AboutPage />} />
        <Route path="trang-thai" element={<StatusPage />} />
        <Route path="hoat-dong" element={<ActivitiesPage key="public" />} />
        <Route path="hoat-dong/:id" element={<ActivityDetailPage />} />
        <Route element={<RequireRole role="organizer" />}>
          <Route path="nha-to-chuc/hoat-dong/:id/phan-hoi" element={<FeedbackListPage key={user?.id} />} />
          <Route path="nha-to-chuc/hoat-dong/:id/diem-danh" element={<AttendancePage key={user?.id} />} />
          <Route path="nha-to-chuc/hoat-dong/:id/dang-ky" element={<ParticipationsPage key={user?.id} managed />} />
          <Route path="nha-to-chuc/hoat-dong" element={<ActivitiesPage key={`managed-${user?.id}`} managed />} />
          <Route path="nha-to-chuc/hoat-dong/tao" element={<ActivityEditorPage key={`create-${user?.id}`} />} />
          <Route path="nha-to-chuc/hoat-dong/:id" element={<ActivityDetailPage key={user?.id} managed />} />
          <Route path="nha-to-chuc/hoat-dong/:id/sua" element={<ActivityEditorPage key={user?.id} />} />
        </Route>
        <Route path="dang-nhap" element={<AuthPage key="login" mode="login" />} />
        <Route path="dang-ky" element={<AuthPage key="register" mode="register" />} />
        <Route path="quen-mat-khau" element={<AuthPage key="forgot" mode="forgot" />} />
        <Route path="dat-lai-mat-khau/:uid/:token" element={<AuthPage key="reset" mode="reset" />} />
        <Route element={<RequireRole role="volunteer" />}><Route path="tinh-nguyen-vien" element={<VolunteerDashboard key={user?.id} />} /></Route>
        <Route element={<RequireRole role="volunteer" />}><Route path="tinh-nguyen-vien/dang-ky" element={<ParticipationsPage key={user?.id} />} /></Route>
        <Route element={<RequireRole role="volunteer" />}><Route path="tinh-nguyen-vien/lich-su" element={<ParticipationsPage key={`history-${user?.id}`} history />} /></Route>
        <Route element={<RequireRole role="volunteer" />}><Route path="hoat-dong/:id/phan-hoi" element={<FeedbackPage key={user?.id} />} /></Route>
        <Route element={<RequireRole role="admin" />}><Route path="quan-tri/phan-hoi" element={<FeedbackListPage key={user?.id} admin />} /></Route>
        <Route element={<RequireRole role="organizer" />}><Route path="nha-to-chuc" element={<WorkspacePage role="organizer" />} /></Route>
        <Route element={<RequireRole role="admin" />}><Route path="quan-tri" element={<WorkspacePage role="admin" />} /></Route>
        <Route element={<RequireRole />}><Route path="ho-so" element={<ProfilePage />} /></Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
