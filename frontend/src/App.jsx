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
import AdvancedReportsPage from './pages/AdvancedReportsPage.jsx'
import AdminAccountsPage from './pages/AdminAccountsPage.jsx'
import AuditPage from './pages/AuditPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import CheckInPage from './pages/CheckInPage.jsx'
import OrganizerDashboard from './pages/OrganizerDashboard.jsx'
import VolunteerParticipations from './pages/VolunteerParticipations.jsx'

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route element={<RequireRole />}>
          <Route path="thong-bao" element={<NotificationsPage key={user?.id} />} />
          <Route path="bao-cao/mo-rong" element={<AdvancedReportsPage key={user?.id} />} />
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
          <Route path="nha-to-chuc/dang-ky" element={<ActivitiesPage key={`registrations-${user?.id}`} managed mode="registrations" />} />
          <Route path="nha-to-chuc/diem-danh" element={<ActivitiesPage key={`attendance-${user?.id}`} managed mode="attendance" />} />
          <Route path="nha-to-chuc/phan-hoi" element={<ActivitiesPage key={`feedback-${user?.id}`} managed mode="feedback" />} />
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
        <Route element={<RequireRole role="volunteer" />}><Route path="hoat-dong/:id/check-in" element={<CheckInPage key={user?.id} />} /></Route>
        <Route element={<RequireRole role="volunteer" />}><Route path="tinh-nguyen-vien" element={<VolunteerDashboard key={user?.id} />} /></Route>
        <Route element={<RequireRole role="volunteer" />}>
          <Route path="tinh-nguyen-vien/dang-ky" element={<VolunteerParticipations key={`registrations-${user?.id}`} />} />
          <Route path="tinh-nguyen-vien/lich-su" element={<VolunteerParticipations key={`history-${user?.id}`} mode="history" />} />
          <Route path="tinh-nguyen-vien/check-in" element={<VolunteerParticipations key={`checkin-${user?.id}`} mode="checkin" />} />
          <Route path="tinh-nguyen-vien/phan-hoi" element={<VolunteerParticipations key={`feedback-${user?.id}`} mode="feedback" />} />
        </Route>
        <Route element={<RequireRole role="volunteer" />}><Route path="hoat-dong/:id/phan-hoi" element={<FeedbackPage key={user?.id} />} /></Route>
        <Route element={<RequireRole role="admin" />}><Route path="quan-tri/phan-hoi" element={<FeedbackListPage key={user?.id} admin />} /></Route>
        <Route element={<RequireRole role="organizer" />}><Route path="nha-to-chuc" element={<OrganizerDashboard key={user?.id} />} /></Route>
        <Route element={<RequireRole role="admin" />}><Route path="quan-tri" element={<WorkspacePage role="admin" />} /></Route>
        <Route element={<RequireRole />}><Route path="ho-so" element={<ProfilePage />} /></Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
