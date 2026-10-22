import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import AdminLayout from './layout/AdminLayout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Events from './pages/Events.jsx';
import EventCreate from './pages/EventCreate.jsx';
import EventDetail from './pages/EventDetail.jsx';
import EventAnalytics from './pages/EventAnalytics.jsx';
import ExperienceSettings from './pages/ExperienceSettings.jsx';
import SharesList from './pages/SharesList.jsx';
import ShareView from './pages/ShareView.jsx';
import ManagePlan from './pages/ManagePlan.jsx';
import AiCredits from './pages/AiCredits.jsx';
import SmsHealth from './pages/SmsHealth.jsx';
import Settings from './pages/Settings.jsx';
import Account from './pages/Account.jsx';
import Subscriptions from './pages/Subscriptions.jsx';
import Placeholder from './pages/Placeholder.jsx';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="center">Memuat…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgotpassword" element={<Login mode="forgot" />} />

      {/* Rute PUBLIK (tanpa login) — link share yang dipindai dari QR. */}
      <Route path="/event/:eventid/shares/:id" element={<ShareView />} />
      <Route path="/shares/:id" element={<ShareView />} />
      <Route path="/shares/status/:id" element={<ShareView />} />

      <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/index" element={<Dashboard />} />
        <Route path="/admin/homepage" element={<Placeholder title="Homepage" />} />
        <Route path="/admin/homepage/edit" element={<Placeholder title="Edit Homepage" />} />
        <Route path="/admin/account" element={<Account />} />
        <Route path="/admin/settings" element={<Settings />} />
        <Route path="/admin/refer-earn" element={<Placeholder title="Refer & Earn" />} />

        <Route path="/event/all" element={<Events />} />
        <Route path="/event/create" element={<EventCreate />} />
        <Route path="/admin/event/:eventId" element={<EventDetail />} />
        <Route path="/admin/analytics/:eventId" element={<EventAnalytics />} />
        <Route path="/admin/shares/:eventId" element={<SharesList />} />
        <Route path="/event/:eventid/settings/experiences/:experienceKey" element={<ExperienceSettings />} />
        <Route path="/admin/subscriptions" element={<Subscriptions />} />
        <Route path="/admin/subscriptions/ai-credits" element={<AiCredits />} />
        <Route path="/admin/subscriptions/:appName/manage" element={<ManagePlan />} />
        <Route path="/admin/subscriptions/:appName/learn-more" element={<Placeholder title="Learn More" />} />
        <Route path="/admin/subscriptions/:appName/payment" element={<Placeholder title="Payment" />} />
        <Route path="/admin/subscriptions/:appName/sms" element={<Placeholder title="SMS Plan" />} />
        <Route path="/admin/subscriptions/dslrbooth/manage" element={<ManagePlan />} />
        <Route path="/admin/subscriptions/lumabooth/manage" element={<ManagePlan />} />

        <Route path="/admin/booth-payments/status" element={<Placeholder title="Booth Payments Status" />} />
        <Route path="/admin/booth-payments/disconnect-stripe" element={<Placeholder title="Disconnect Stripe" />} />
        <Route path="/admin/stripe-connect/status" element={<Placeholder title="Stripe Connect Status" />} />
        <Route path="/admin/licenses/:appName" element={<Placeholder title="Licenses" />} />
        <Route path="/admin/sms-health" element={<SmsHealth />} />
        <Route path="/admin/buy-for-others" element={<Placeholder title="Buy for Others" />} />
        <Route path="/admin/buy-for-others/status" element={<Placeholder title="Purchase Status" />} />

        <Route path="/subscription/checkout" element={<Placeholder title="Checkout" />} />
        <Route path="/subscription/redeem-voucher" element={<Placeholder title="Redeem Voucher" />} />
      </Route>

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
