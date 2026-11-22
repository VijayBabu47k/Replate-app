import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, HOME } from './lib/auth';
import { Loading } from './components/Feedback';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ListingDetail from './pages/ListingDetail';
import ImpactPage from './pages/ImpactPage';
import Outbox from './pages/Outbox';
import DonorDashboard from './pages/donor/DonorDashboard';
import QuickPost from './pages/donor/QuickPost';
import DonorListings from './pages/donor/DonorListings';
import DonorAnalytics from './pages/donor/DonorAnalytics';
import ReceiverFeed from './pages/receiver/ReceiverFeed';
import ReceiverClaims from './pages/receiver/ReceiverClaims';
import ReceiverProfile from './pages/receiver/ReceiverProfile';
import VolunteerTasks from './pages/volunteer/VolunteerTasks';
import VolunteerProfile from './pages/volunteer/VolunteerProfile';
import VolunteerEarnings from './pages/volunteer/VolunteerEarnings';

function RoleGate({ role, children }) {
  const { user } = useAuth();
  return user.role === role ? children : <Navigate to={HOME[user.role]} replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;

  if (!user)
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/donor" element={<RoleGate role="DONOR"><DonorDashboard /></RoleGate>} />
        <Route path="/donor/post" element={<RoleGate role="DONOR"><QuickPost /></RoleGate>} />
        <Route path="/donor/listings" element={<RoleGate role="DONOR"><DonorListings /></RoleGate>} />
        <Route path="/donor/analytics" element={<RoleGate role="DONOR"><DonorAnalytics /></RoleGate>} />

        <Route path="/receiver" element={<RoleGate role="RECEIVER"><ReceiverFeed /></RoleGate>} />
        <Route path="/receiver/claims" element={<RoleGate role="RECEIVER"><ReceiverClaims /></RoleGate>} />
        <Route path="/receiver/profile" element={<RoleGate role="RECEIVER"><ReceiverProfile /></RoleGate>} />

        <Route path="/volunteer" element={<RoleGate role="VOLUNTEER"><VolunteerTasks /></RoleGate>} />
        <Route path="/volunteer/earnings" element={<RoleGate role="VOLUNTEER"><VolunteerEarnings /></RoleGate>} />
        <Route path="/volunteer/profile" element={<RoleGate role="VOLUNTEER"><VolunteerProfile /></RoleGate>} />

        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route path="/impact" element={<ImpactPage />} />
        <Route path="/outbox" element={<Outbox />} />
        <Route path="*" element={<Navigate to={HOME[user.role]} replace />} />
      </Route>
    </Routes>
  );
}
