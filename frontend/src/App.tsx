import { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation,Navigate  } from 'react-router-dom';
import InstallPrompt from './components/InstallPrompt';
import Login from './Services/Login';
import Signup from './Services/Signup';
import Dashboard from './pages/Dashboard';
import LiveChat from './pages/Livechat';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Profile from './pages/Profile';
import TermsAndConditions from './pages/Terms&condition';
import PrivacyPolicy from './pages/Policy';
import FrontPrivacyPolicy from './pages/FPolicy';
import FrontTermsAndConditions from './pages/FrontTerms&conditions';
import Frontpage from './pages/Embed';
import FileUpload from './pages/FileUpload';
import Templates from './pages/Templates';
import ProductTemplate from './pages/ProductTemplate';
import EcommerceProductTemplate from './pages/EcommerceProductTemplate';
import ProductTypeTemplate from './pages/ProductTypeTemplate';
import ProductDetailsTemplate from './pages/ProductDetailsTemplate';
import IcebreakersTemplate from './pages/IcebreakersTemplate';
import ProtectedRoute from './components/ProtectedRoute';
import WebsiteURLConfiguration from './pages/WebsiteUrlConfiguration'
import AdminPage from './pages/AdminPage'
import CartPage from './pages/CartPage'
import CartPageSize from './pages/CartPageSize'
import ProductInventory from './pages/ProductInventory'
import ProductInventorySize from './pages/ProductInventorySize'
import ShippingPage from './pages/ShippingPage'
import ProductCatalog from './pages/ProductCatalog'
import ProductCatalogSize from './pages/ProductCatalogSize'
import CommentsContainer from './pages/CommentsContainer'
import TemplateMessage from './pages/TemplateMessage'
import RazorpayConnect from './pages/RazorpayConnect'
import Printing from './pages/Printing'
import Packing from './pages/Packing'
import Holding from './pages/Holding'
import Order from './pages/Order'
import Tracking from './pages/Tracking'
import Welcomepage from './pages/Welcomepage'
import Chatflowwelcomemessage from './pages/Chatflowwelcomemessage'
import Systemmenus from './pages/Systemmenus'
import AllCommentsAutomation from './pages/AllCommentsAutomation'
import Setting from './pages/Setting'
import AccountProfile from './pages/AccountProfile'
import Status from './pages/Status'
import ApiKeyDashboard from './pages/ApiKeyDashboard'
import DashboardNotification from './pages/DashboardNotification'
import Fullfillment from './pages/Fullfillment'
import ViewportFix from './components/ViewportFix';
import { getWithExpiry } from './utils/storage';
import Moderationcommentslist from './pages/Moderationcommentslist';
import Analytics from "./pages/Analytics";

function HomeRedirect() {
  const token = getWithExpiry('token');
  const isAdmin = getWithExpiry('isAdmin');
 
  if (token) {
    return isAdmin === 'true'
      ? <Navigate to="/admin" replace />
      : <Navigate to="/dashboard" replace />;
  }
 
  return <Login />;
}
 
function AppContent() {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const isLoginPage = ['/login', '/', '/signup','/frontpolicy','/frontterms','/admin','/cart','/productcatalog','/cartsize','/productcatalogsize','/dashboardnotification'].includes(location.pathname);

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="flex h-screen bg-white">
      {/* Show Sidebar only if it's not the login/signup page */}
      {!isLoginPage && <Sidebar isOpen={isSidebarOpen} onToggle={handleToggleSidebar} />}

      <div className="flex flex-col flex-1">
        {!isLoginPage && <Header onToggleSidebar={handleToggleSidebar} />}
        <main className={`flex-1 ${isLoginPage ? 'w-full' : ''} overflow-auto`}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomeRedirect />} /> 
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/policy" element={<PrivacyPolicy />} />
          <Route path="/frontpolicy" element={<FrontPrivacyPolicy />} />
          <Route path="/frontterms" element={<FrontTermsAndConditions />} />
          <Route
        path="/cart"
         element={<CartPage />}
      />
      <Route
        path="/cartsize"
         element={<CartPageSize />}
      />

           <Route
        path="/admin"
        element={<ProtectedRoute element={<AdminPage />} />}
      />
      <Route
        path="/dashboard"
        element={<ProtectedRoute element={<Dashboard />} />}
      />
      <Route
        path="/live-chat"
        element={<ProtectedRoute element={<LiveChat />} />}
      />
      <Route
        path="/profile"
        element={<ProtectedRoute element={<Profile />} />}
      />
      <Route
        path="/upload"
        element={<ProtectedRoute element={<FileUpload />} />}
      />
      <Route
        path="/embed"
        element={<ProtectedRoute element={<Frontpage />} />}
      />
      <Route
        path="/templates"
        element={<ProtectedRoute element={<Templates />} />}
      />
      <Route
        path="/product-template"
        element={<ProtectedRoute element={<ProductTemplate />} />}
      />

      <Route
        path="/ecommerce-product-template"
        element={<ProtectedRoute element={<EcommerceProductTemplate />} />}
      />
      <Route
        path="/product-type-template"
        element={<ProtectedRoute element={<ProductTypeTemplate />} />}
      />
      <Route
        path="/product-details-template"
        element={<ProtectedRoute element={<ProductDetailsTemplate />} />}
      />
       <Route
        path="/dashboardnotification"
        element={<ProtectedRoute element={<DashboardNotification />} />}
      />

       <Route
        path="/apikeydashboard"
        element={<ProtectedRoute element={<ApiKeyDashboard />} />}
      />
      
      <Route
       path="/analytics" 
       element={<Analytics />} />

      <Route
        path="/website-url-configuration"
        element={<ProtectedRoute element={<WebsiteURLConfiguration />} />}
      />
      <Route
        path="/policy"
        element={<ProtectedRoute element={<PrivacyPolicy />} />}
      />
      <Route
        path="/terms"
        element={<ProtectedRoute element={<TermsAndConditions />} />}
      />
      <Route
        path="/icebreakers-template"
        element={<ProtectedRoute element={<IcebreakersTemplate />} />}
      />
    <Route
        path="/product-inventory"
        element={<ProtectedRoute element={<ProductInventory />} />}
      />
      <Route
        path="/product-inventory-size"
        element={<ProtectedRoute element={<ProductInventorySize />} />}
      />
      <Route
        path="/template_message"
        element={<ProtectedRoute element={<TemplateMessage />} />}
      />
      <Route
        path="/printing"
        element={<ProtectedRoute element={<Printing />} />}
      />
      <Route
        path="/packing"
        element={<ProtectedRoute element={<Packing />} />}
      />
      <Route
        path="/holding"
        element={<ProtectedRoute element={<Holding />} />}
      />
      <Route
        path="/order"
        element={<ProtectedRoute element={<Order />} />}
      />
      <Route
        path="/tracking"
        element={<ProtectedRoute element={<Tracking />} />}
      />
       <Route
        path="/accountprofile"
        element={<ProtectedRoute element={<AccountProfile />} />}
      />
      <Route
        path="/status"
        element={<ProtectedRoute element={<Status />} />}
      />
      <Route
        path="/fullfillment"
        element={<ProtectedRoute element={<Fullfillment />} />}
      />
      <Route
        path="/welcomepage"
        element={<ProtectedRoute element={<Welcomepage />} />}
      />
      <Route
        path="/chatflowwelcomemessage"
        element={<ProtectedRoute element={<Chatflowwelcomemessage />} />}
      />
      <Route
        path="/systemmenus"
        element={<ProtectedRoute element={<Systemmenus />} />}
      />
      <Route
          path="/setting"
          element={<ProtectedRoute element={<Setting />} />}
            />
      <Route
  path="/productcatalog"
  element={<ProtectedRoute
    element={<ProductCatalog />}
    bypassTokenCheck={true}
  />}
/>
<Route
  path="/productcatalogsize"
  element={<ProtectedRoute
    element={<ProductCatalogSize />}
    bypassTokenCheck={true}
  />}
/>

<Route
        path="/comments_chat"
        element={<ProtectedRoute element={<CommentsContainer />} />}
      />

      <Route
        path="/shipping-setting"
        element={<ProtectedRoute element={<ShippingPage />} />}
      />

<Route
        path="/razorpay_connect"
        element={<ProtectedRoute element={<RazorpayConnect />} />}
      />
      <Route
              path="/allcomments_automation"
              element={<ProtectedRoute element={<AllCommentsAutomation />} />}
            />
        <Route
              path="/moderationcommentslist"
              element={<ProtectedRoute element={<Moderationcommentslist />} />}
            />
        </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <InstallPrompt />
      <ViewportFix />  
      <AppContent />
    </Router>
  );
}


export default App;

