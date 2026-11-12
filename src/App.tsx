import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { CatchAllRoute } from './auth/CatchAllRoute'
import { ProfileProvider } from './auth/ProfileProvider'
import { LoginPage } from './auth/LoginPage'
import { RegisterPage } from './auth/RegisterPage'
import { NewPasswordPage, ResetPasswordPage } from './auth/ResetPasswordPage'
import { CupsPage } from './drinks/CupsPage'
import { FeedbackForm } from './feedback/FeedbackForm'
import { ReportPage } from './feedback/ReportPage'
import { CalendarPage } from './history/CalendarPage'
import { HistoryPage } from './history/HistoryPage'
import { HomePage } from './home/HomePage'
import { LeaderboardPage } from './leaderboard/LeaderboardPage'
import { NewsPage } from './news/NewsPage'
import { OnboardingPage } from './onboarding/OnboardingPage'
import { PrivacyPage } from './profile/PrivacyPage'
import { NotificationStatusPage } from './push/NotificationStatusPage'
import { ProfilePage } from './profile/ProfilePage'
import { SchedulesPage } from './schedules/SchedulesPage'
import { TabsLayout } from './ui/tabs'

// Galleria di Glu: solo nell'app di prova, fuori dal bundle di produzione.
const GluGallery = import.meta.env.MODE === 'devapp' ? lazy(() => import('./dev/GluGallery')) : null

function RequireAuth() {
  const { user, loading, recovering } = useAuth()
  if (loading) return <p className="center-note">Caricamento…</p>
  if (recovering) return <NewPasswordPage />
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function GuestOnly() {
  const { user, loading, recovering } = useAuth()
  if (loading) return <p className="center-note">Caricamento…</p>
  if (recovering) return <NewPasswordPage />
  if (user) return <Navigate to="/home" replace />
  return <Outlet />
}

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <HashRouter>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/registrati" element={<RegisterPage />} />
              <Route path="/recupera" element={<ResetPasswordPage />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="/inizia" element={<OnboardingPage />} />
              <Route element={<TabsLayout />}>
                <Route path="/home" element={<HomePage />} />
                <Route path="/classifica" element={<LeaderboardPage />} />
                <Route path="/storico" element={<HistoryPage />} />
                <Route path="/storico/calendario" element={<CalendarPage />} />
                <Route path="/tazze" element={<CupsPage />} />
                <Route path="/profilo" element={<ProfilePage />} />
                <Route path="/promemoria" element={<SchedulesPage />} />
                <Route path="/notifiche" element={<NotificationStatusPage />} />
                <Route path="/feedback" element={<FeedbackForm />} />
                <Route path="/segnala" element={<ReportPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/novita" element={<NewsPage />} />
              </Route>
            </Route>
            {GluGallery && (
              <Route
                path="/dev-glu"
                element={
                  <Suspense fallback={null}>
                    <GluGallery />
                  </Suspense>
                }
              />
            )}
            <Route path="*" element={<CatchAllRoute />} />
          </Routes>
        </HashRouter>
      </ProfileProvider>
    </AuthProvider>
  )
}
