import React, { useState } from 'react';
import Order from './Order';
import Printing from './Printing';
import Packing from './Packing';
import Tracking from './Tracking';
import Holding from './Holding';
import { ClipboardList, Printer, Package, MapPin, PauseCircle } from 'lucide-react';

type View = 'order' | 'printing' | 'packing' | 'tracking' | 'holding';

interface Tab {
  id: View;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: 'order',    label: 'Order',   icon: <ClipboardList size={18} /> },
  { id: 'printing', label: 'Print',   icon: <Printer       size={18} /> },
  { id: 'packing',  label: 'Pack',    icon: <Package       size={18} /> },
  { id: 'tracking', label: 'Track',   icon: <MapPin        size={18} /> },
  { id: 'holding',  label: 'Hold',    icon: <PauseCircle   size={18} /> },
];

const Fulfillment: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('order');

  const renderStation = () => {
    switch (currentView) {
      case 'order':    return <Order />;
      case 'printing': return <Printing />;
      case 'packing':  return <Packing />;
      case 'tracking': return <Tracking />;
      case 'holding':  return <Holding />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* ── Top Tab Bar ── */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="flex w-full">
          {TABS.map((tab) => {
            const isActive = currentView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCurrentView(tab.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: '10px 0',
                  border: 'none',
                  borderBottom: isActive ? '2.5px solid transparent' : '2.5px solid transparent',
                  borderImage: isActive ? 'linear-gradient(to right, #F57F26, #D63031) 1' : 'none',
                  background: isActive ? 'linear-gradient(to bottom, #fff7f0, #ffffff)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: isActive ? '#F57F26' : '#9ca3af',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.color = '#F57F26';
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.color = '#9ca3af';
                }}
              >
                {/* Icon with gradient when active */}
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isActive ? 'transparent' : 'inherit',
                  ...(isActive ? {
                    background: 'linear-gradient(to right, #F57F26, #D63031)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  } : {}),
                }}>
                  {/* Re-render icon with explicit color for non-SVG-text approach */}
                  {React.cloneElement(tab.icon as React.ReactElement, {
                    color: isActive ? '#F57F26' : '#9ca3af',
                    size: 18,
                  })}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  background: isActive ? 'linear-gradient(to right, #F57F26, #D63031)' : 'none',
                  WebkitBackgroundClip: isActive ? 'text' : 'unset',
                  WebkitTextFillColor: isActive ? 'transparent' : 'inherit',
                  color: isActive ? 'transparent' : '#9ca3af',
                }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Station Content ── */}
      <div className="flex-1 overflow-auto">
        {renderStation()}
      </div>

    </div>
  );
};

export default Fulfillment;
