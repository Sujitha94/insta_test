import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  ReceiptText,
  MessageCircle,
  MessageSquareDot,
  ChevronLeft,
  CircleUserRound,
  Boxes,
  ShieldCheck,
  X,
  Settings,
  MessageSquareMore,
  Truck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import instaxbotLogo from "../assets/Instaxbot_Logo2.jpeg";
import chatLogo from "../assets/mass.logo.png";

// ─── Types ───────────────────────────────────────────────────────────────────
interface NavItem {
  name: string;
  icon: React.ComponentType<any>;
  path: string;
  children?: NavItem[];
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
export default function Sidebar({ isOpen: isOpenProp, onToggle }: SidebarProps) {
  const [isMobile, setIsMobile]         = useState(false);
  const [isHovering, setIsHovering]     = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [hoveredSubMenu, setHoveredSubMenu] = useState<string | null>(null);
  const [hidden, setHidden]             = useState(false);

  const scrollRef  = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const lastScrollY = useRef(0);

  const location = useLocation();
  const navigate  = useNavigate();

  const isOpen = isMobile ? isOpenProp : isHovering;
  const type   = localStorage.getItem("type");

  // ── responsive detection ──────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── clear hover submenu on collapse ──────────────────────────────────────
  useEffect(() => {
    if (!isMobile && !isHovering) setHoveredSubMenu(null);
  }, [isHovering, isMobile]);

  // ── restore scroll ────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = sessionStorage.getItem("sidebarScrollPosition");
      if (saved && scrollRef.current) scrollRef.current.scrollTop = parseInt(saved, 10);
    }, 100);
    return () => clearTimeout(t);
  }, [location.pathname]);

  // ── auto-expand active parent ─────────────────────────────────────────────
  useEffect(() => {
    const activeParent = getNavItems().find(item =>
      item.children?.some(child => child.path === location.pathname)
    );
    if (activeParent && !expandedMenus.includes(activeParent.name)) {
      setExpandedMenus(prev => [...prev, activeParent.name]);
    }
  }, [location.pathname]);

  // ── mobile hide/show on scroll ────────────────────────────────────────────
  useEffect(() => {
    if (!isMobile) return;
    const onScroll = () => {
      const currentY = window.scrollY;
      const delta    = currentY - lastScrollY.current;
      if (delta > 2 && currentY > 60)  setHidden(true);
      else if (delta < -2)              setHidden(false);
      if (currentY <= 10)               setHidden(false);
      lastScrollY.current = currentY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const handleScroll = () => {
    if (scrollRef.current)
      sessionStorage.setItem("sidebarScrollPosition", scrollRef.current.scrollTop.toString());
  };

  const handleMouseEnter = () => { if (!isMobile) setIsHovering(true); };
  const handleMouseLeave = () => { if (!isMobile) setIsHovering(false); };

  const toggleSubMenu = (name: string) => {
    if (!isOpen) return;
    setExpandedMenus(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    );
  };

  const handleNavClick = () => {
    if (scrollRef.current)
      sessionStorage.setItem("sidebarScrollPosition", scrollRef.current.scrollTop.toString());
    if (isMobile) onToggle();
  };

  // ── nav data ──────────────────────────────────────────────────────────────
  const getNavItems = (): NavItem[] => {
    const items: NavItem[] = [
      { name: "Dashboard",            icon: Home,              path: "/dashboard" },
      { name: "Live Chat",            icon: MessageCircle,     path: "/live-chat" },
      { name: "Comments Chat",        icon: MessageSquareDot,  path: "/comments_chat" },
      { name: "Instagram Automation", icon: MessageSquareMore, path: "/allcomments_automation" },
      { name: "Products",             icon: Boxes,             path: "/product-inventory" },
      { name: "Fullfillment",         icon: Truck,             path: "/fullfillment" },
      { name: "Setting",              icon: Settings,          path: "/setting" },
    ];
    if (type === "size-variation") {
      const idx = items.findIndex(i => i.name === "Products");
      if (idx !== -1) items[idx] = { name: "Products", icon: Boxes, path: "/product-inventory-size" };
    }
    return items;
  };

  const mobileNavItems = [
    { name: "Home", icon: Home, path: "/dashboard" },
    { name: "Auto", icon: Zap, path: "/allcomments_automation" },
    { name: "Chat", icon: MessageCircle, path: "/live-chat" },
    { name: "Fullfillment", icon: Truck, path: "/fullfillment" },
    {
      name: "Store",
      icon: Boxes,
      path: type === "size-variation" ? "/product-inventory-size" : "/product-inventory",
    },
  ];

  const bottomNavItems: NavItem[] = [
    { name: "Terms & Condition", icon: ShieldCheck,     path: "/terms" },
    { name: "Privacy Policy",    icon: ReceiptText,     path: "/policy" },
    { name: "My Profile",        icon: CircleUserRound, path: "/profile" },
  ];

  const activeIndex = mobileNavItems.findIndex(item => location.pathname.includes(item.path));

  // ── render nav items (sidebar) ────────────────────────────────────────────
  const renderNavItems = (items: NavItem[]) =>
    items.map((item) => {
      const isChildActive  = item.children?.some(child => location.pathname === child.path);
      const isParentActive = location.pathname === item.path || isChildActive;
      const IconComponent  = item.icon;
      const hasChildren    = item.children && item.children.length > 0;
      const isExpanded     = expandedMenus.includes(item.name);
      const isSubmenuVisible = isExpanded || (isOpen && hoveredSubMenu === item.name);
      const activeBg = "bg-gradient-to-r from-[#C90000] via-[#D74100] to-[#DF7701]";

      return (
        <div
          key={item.name}
          className="relative group"
          onMouseEnter={() => { if (isOpen && !isMobile && hasChildren) setHoveredSubMenu(item.name); }}
          onMouseLeave={() => { if (isOpen && !isMobile && hasChildren) setHoveredSubMenu(null); }}
        >
          <Link
            to={item.path}
            className={`
              flex items-center rounded-xl transition-all duration-200
              ${isParentActive ? `${activeBg} shadow-sm` : "text-gray-600 hover:bg-orange-50 hover:text-[#E86C15]"}
              ${isOpen ? "justify-start px-3 py-2.5 mb-0.5" : "justify-center p-3 mb-0.5 mx-auto w-12 h-12"}
            `}
            onClick={() => {
              if (hasChildren && isOpen) toggleSubMenu(item.name);
              handleNavClick();
            }}
          >
            <IconComponent
              className={`flex-shrink-0 ${isOpen ? "h-6 w-6" : "h-7 w-7"} ${isParentActive ? "text-white" : "text-current"}`}
            />
            {isOpen && (
              <span className={`ml-3 text-sm font-medium whitespace-nowrap truncate ${isParentActive ? "text-white" : ""}`}>
                {item.name}
              </span>
            )}
          </Link>

          {hasChildren && isSubmenuVisible && (
            <div className="ml-4 pl-3 border-l-2 border-orange-200 space-y-0.5 mb-1">
              {item.children!.map((child) => {
                const isChildItemActive = location.pathname === child.path;
                return (
                  <Link
                    key={child.name}
                    to={child.path}
                    onClick={handleNavClick}
                    className={`
                      flex items-center w-full rounded-lg px-2 py-1.5 text-sm transition-colors duration-200
                      ${isChildItemActive
                        ? "text-[#E86C15] font-medium bg-orange-100"
                        : "text-gray-600 hover:text-[#E86C15] hover:bg-gray-50"
                      }
                    `}
                  >
                    <child.icon className="h-4 w-4 mr-2 opacity-70" />
                    <span className="truncate">{child.name}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {!isOpen && !isMobile && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-lg">
              {item.name}
              <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45" />
            </div>
          )}
        </div>
      );
    });

  // ── Mobile Drawer ─────────────────────────────────────────────────────────
  const MobileDrawer = () => (
    <>
      {isOpenProp && (
        <div className="fixed inset-0 z-[10000] flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onToggle} />
          <div className="relative flex flex-col w-72 max-w-[85vw] bg-white h-screen shadow-2xl overflow-hidden transform transition-transform duration-300 ease-in-out">
            <div className="flex justify-between items-center h-16 px-4 border-b border-gray-100 flex-shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <img src={instaxbotLogo} alt="InstaX Bot Logo" className="h-9 w-9" />
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">InstaX bot</h1>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-orange-100 hover:text-[#E86C15] rounded-full h-10 w-10"
                onClick={onToggle}
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
            <nav className="flex-1 px-4 py-4 overflow-y-auto bg-white">
              <div className="space-y-1">{renderNavItems(getNavItems())}</div>
            </nav>
            <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/50 mb-0">
              {renderNavItems(bottomNavItems)}
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ── Desktop Sidebar ───────────────────────────────────────────────────────
  const RegularSidebar = () => (
    <aside
      ref={sidebarRef}
      className={`
        ${isOpen ? "w-60" : "w-[68px]"}
        flex flex-col bg-white h-screen
        transition-all duration-300 ease-in-out
        hidden md:flex shadow-xl border-r border-gray-100
        sticky top-0 z-30 overflow-hidden rounded-r-[20px]
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`flex items-center h-14 flex-shrink-0 border-b border-gray-100 ${isOpen ? "px-4 justify-between" : "justify-center"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <img src={instaxbotLogo} alt="InstaX Bot Logo" className="h-8 w-8 flex-shrink-0" />
          {isOpen && <h1 className="text-lg font-bold text-gray-900 truncate tracking-tight">InstaX bot</h1>}
        </div>
        {isOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-500 hover:bg-orange-100 hover:text-[#D63031] flex-shrink-0 rounded-xl h-8 w-8"
            onClick={() => setIsHovering(false)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <nav
          ref={scrollRef}
          className={`flex-1 py-3 overflow-y-auto overflow-x-hidden ${isOpen ? "px-3" : "px-2"}`}
          onScroll={handleScroll}
        >
          {renderNavItems(getNavItems())}
        </nav>
        <div className={`py-3 border-t border-gray-100 flex-shrink-0 ${isOpen ? "px-3" : "px-2"}`}>
          {renderNavItems(bottomNavItems)}
        </div>
      </div>
    </aside>
  );

  // ── Return ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Mobile Bottom Nav ── */}
      {isMobile && (
        <motion.div
          initial="visible"
          variants={{
            visible: { y: 0, opacity: 1, scale: 1 },
            hidden:  { y: 150, opacity: 0, scale: 0.95 },
          }}
          animate={hidden ? "hidden" : "visible"}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-0 left-0 right-0 z-[10000] md:hidden"
          style={{ height: 88, paddingBottom: 12, paddingLeft: 12, paddingRight: 12 }}
        >
          <nav
            className="relative h-[64px] mx-auto max-w-[420px] flex items-center rounded-[36px] bg-white/95 px-2 shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-white/20 backdrop-blur-md"
            style={{ marginTop: 8 }}
          >
            {activeIndex !== -1 && activeIndex !== 2 && (
              <motion.div
                layoutId="activePillIndicator"
                className="absolute h-[50px] rounded-[28px] bg-orange-600 shadow-[0_8px_20px_rgba(232,108,21,0.3)]"
                initial={false}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
                style={{
                  width: `calc((100% - 16px) / 5)`,
                  left:  `calc(8px + (${activeIndex} * (100% - 16px) / 5))`,
                }}
              />
            )}

            {mobileNavItems.map((item, idx) => {
              const isActive = activeIndex === idx;
              const isChat   = item.name === "Chat";

              if (isChat) {
                return (
                  <button
                    key={item.name}
                    onClick={() => navigate(item.path)}
                    className="relative z-20 flex flex-1 flex-col items-center outline-none"
                    style={{ marginTop: -36 }}
                  >
                    <div
                      className={`
                        relative flex items-center justify-center
                        w-[60px] h-[60px] rounded-full
                        transition-all duration-300
                        ${isActive
                          ? "shadow-[0_0_0_4px_rgba(234,88,12,0.25),0_8px_24px_rgba(234,88,12,0.4)]"
                          : "shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
                        }
                      `}
                    >
                      <div
                        className={`
                          flex items-center justify-center
                          w-[60px] h-[60px] rounded-full bg-white
                          border-[3px] transition-all duration-300
                          ${isActive ? "border-orange-500" : "border-gray-100"}
                        `}
                      >
                        {isActive ? (
                          <div className="flex items-center justify-center w-[50px] h-[50px] rounded-full bg-gradient-to-br from-[#C90000] via-[#D74100] to-[#DF7701]">
                            <img src={chatLogo} alt="Chat" className="w-7 h-7 object-contain" />
                          </div>
                        ) : (
                          <img src={chatLogo} alt="Chat" className="w-7 h-7 object-contain" />
                        )}
                      </div>
                    </div>

                    <span
                      className={`
                        text-[10px] font-bold uppercase tracking-tight mt-1 leading-none
                        transition-colors duration-200
                        ${isActive ? "text-orange-600" : "text-slate-500"}
                      `}
                    >
                      {item.name}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.path)}
                  className="relative z-10 flex flex-1 flex-col items-center justify-center gap-1 outline-none"
                >
                  <motion.div
                    animate={{ scale: isActive ? 1.15 : 1, y: isActive ? -1 : 0 }}
                    className={isActive ? "text-white" : "text-slate-400"}
                  >
                    <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  </motion.div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-tight transition-colors duration-200 ${
                      isActive ? "text-white" : "text-slate-500"
                    }`}
                  >
                    {item.name}
                  </span>
                </button>
              );
            })}
          </nav>
        </motion.div>
      )}

      {isMobile && <MobileDrawer />}
      {!isMobile && <RegularSidebar />}
    </>
  );
}
