import { useState } from "react";
import {
  FileUp,
  MessageSquareText,
  FileText,
  Link2,
  Truck,
  CreditCard,
  Layers,
  UserCircle,
  Key,
  Settings,
  Instagram,
  Package,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  ReceiptText,
} from "lucide-react";

import Frontpage from "./Embed";
import WebsiteURLConfiguration from "./WebsiteUrlConfiguration";
import ShippingPage from "./ShippingPage";
import RazorpayConnect from "./RazorpayConnect";
import Templates from "./Templates";
import TemplateMessage from "./TemplateMessage";
import IcebreakersTemplate from "./IcebreakersTemplate";
import Systemmenus from "./Systemmenus";
import FileUpload from "./FileUpload";
import ApiKeyDashboard from "./ApiKeyDashboard";
import AccountProfile from "./AccountProfile";
import EcommerceProductTemplate from "./EcommerceProductTemplate";
import TermsAndConditions from "./Terms&condition";
import PrivacyPolicy from "./Policy";

interface SettingItem {
  icon: React.ElementType;
  title: string;
  description: string;
  key: string;
  component: React.ComponentType;
  mobileOnly?: boolean;
}

interface SettingSection {
  label: string;
  items: SettingItem[];
}

const sections: SettingSection[] = [
  {
    label: "Commerce",
    items: [
      {
        icon: Link2,
        title: "Website URL Configuration",
        description: "Connect your Shopify or WooCommerce store",
        key: "website-url-configuration",
        component: WebsiteURLConfiguration,
      },
      {
        icon: Truck,
        title: "Shipping Settings",
        description: "Manage shipping methods and rates",
        key: "shipping-setting",
        component: ShippingPage,
      },
      {
        icon: CreditCard,
        title: "Razorpay Connect",
        description: "Payment gateway integration",
        key: "razorpay_connect",
        component: RazorpayConnect,
      },
    ],
  },
  {
    label: "Product",
    items: [
      {
        icon: Package,
        title: "Product Template",
        description: "Configure your ecommerce product templates",
        key: "ecommerce-product-template",
        component: EcommerceProductTemplate,
      },
    ],
  },
  {
    label: "Instagram",
    items: [
      {
        icon: Instagram,
        title: "Instagram Connect",
        description: "Connect and embed your Instagram account",
        key: "embed",
        component: Frontpage,
      },
    ],
  },
  {
    label: "Messaging",
    items: [
      {
        icon: Layers,
        title: "Templates",
        description: "Welcome and product message templates",
        key: "templates",
        component: Templates,
      },
      {
        icon: MessageSquareText,
        title: "Template Message",
        description: "Configure automated message templates",
        key: "template_message",
        component: TemplateMessage,
      },
      {
        icon: FileText,
        title: "Icebreaker Configuration",
        description: "Set up conversation starters",
        key: "icebreakers-template",
        component: IcebreakersTemplate,
      },
      {
        icon: Settings,
        title: "Persistent Menu",
        description: "Configure bot system menu options",
        key: "systemmenus",
        component: Systemmenus,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        icon: FileUp,
        title: "File Upload",
        description: "Upload files for bot responses",
        key: "upload",
        component: FileUpload,
      },
      {
        icon: Key,
        title: "API Key",
        description: "Manage your API access keys",
        key: "apikeydashboard",
        component: ApiKeyDashboard,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        icon: UserCircle,
        title: "Account Profile",
        description: "Manage your profile and business info",
        key: "accountprofile",
        component: AccountProfile,
      },
    ],
  },
  {
    label: "Legal",
    items: [
      {
        icon: ShieldCheck,
        title: "Terms & Condition",
        description: "Read our terms and conditions",
        key: "terms",
        component: TermsAndConditions,
        mobileOnly: true,
      },
      {
        icon: ReceiptText,
        title: "Privacy Policy",
        description: "Read our privacy policy",
        key: "policy",
        component: PrivacyPolicy,
        mobileOnly: true,
      },
    ],
  },
];

const allItems = sections.flatMap((s) => s.items);

function SidebarNav({
  activeKey,
  onSelect,
  mobileView = false,
}: {
  activeKey: string;
  onSelect: (key: string) => void;
  mobileView?: boolean;
}) {
  return (
    <nav className="py-3">
      {sections.map((section) => {
        const visibleItems = mobileView
          ? section.items
          : section.items.filter((item) => !item.mobileOnly);

        if (visibleItems.length === 0) return null;

        return (
          <div key={section.label} className="mb-1">
            <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest px-5 py-2">
              {section.label}
            </p>
            {visibleItems.map((item) => {
              const isActive = activeKey === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onSelect(item.key)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 border-l-2 ${
                    isActive
                      ? "bg-orange-50 border-[#E87028]"
                      : "border-transparent hover:bg-orange-50/50"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150 ${
                      isActive ? "bg-orange-100" : "bg-gray-100"
                    }`}
                  >
                    <item.icon
                      className={`w-4 h-4 ${
                        isActive ? "text-[#E87028]" : "text-gray-400"
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium leading-tight truncate ${
                        isActive ? "text-[#E87028]" : "text-gray-700"
                      }`}
                    >
                      {item.title}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  {isActive && (
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[#E87028]" />
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/** Mobile-only: flat list of all settings grouped by section */
function MobileSettingsList({ onSelect }: { onSelect: (key: string) => void }) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      {sections.map((section) => (
        <div key={section.label} className="mb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-4 pt-4 pb-1">
            {section.label}
          </p>
          <div className="bg-white rounded-xl mx-3 overflow-hidden shadow-sm border border-gray-100">
            {section.items.map((item, idx) => (
              <button
                key={item.key}
                onClick={() => onSelect(item.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-orange-50 transition-colors ${
                  idx !== section.items.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-[#E87028]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {item.description}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      ))}
      {/* Extra space so last items aren't hidden behind the bottom nav footer */}
      <div className="h-24" />
    </div>
  );
}

export default function Setting() {
  const [activeKey, setActiveKey] = useState<string | null>(null); // null = show list on mobile
  const [desktopActiveKey, setDesktopActiveKey] = useState<string>(allItems[0].key);

  const handleMobileSelect = (key: string) => {
    setActiveKey(key);
  };

  const handleMobileBack = () => {
    setActiveKey(null);
  };

  const activeItem = activeKey
    ? allItems.find((i) => i.key === activeKey) ?? null
    : null;

  const desktopActiveItem =
    allItems.find((i) => i.key === desktopActiveKey) ?? allItems[0];
  const DesktopActiveComponent = desktopActiveItem.component;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">

      {/* ── Mobile Layout ── */}
      <div className="md:hidden flex flex-col h-full">

        {/* Mobile Header */}
        <header className="flex items-center bg-white border-b border-gray-100 px-4 py-3 flex-shrink-0">
          {activeKey ? (
            <button
              onClick={handleMobileBack}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-orange-50 transition-colors mr-3"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          ) : null}
          <h1 className="text-base font-semibold text-gray-800">
            {activeKey && activeItem ? activeItem.title : "Settings"}
          </h1>
        </header>

        {/* Mobile Body */}
        {activeKey && activeItem ? (
          // Show selected setting's component
          <div className="flex-1 overflow-y-auto">
            <activeItem.component />
          </div>
        ) : (
          // Show the grouped list
          <MobileSettingsList onSelect={handleMobileSelect} />
        )}
      </div>

      {/* ── Desktop Layout ── */}
      <div className="hidden md:flex flex-1 min-h-0">
        <aside className="w-[260px] flex-shrink-0 bg-white border-r border-gray-100 overflow-y-auto">
          <SidebarNav
            activeKey={desktopActiveKey}
            onSelect={setDesktopActiveKey}
            mobileView={false}
          />
        </aside>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <DesktopActiveComponent />
        </main>
      </div>
    </div>
  );
}
