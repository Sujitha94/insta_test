import { useEffect, useState } from "react";
import instaxLogo from "../assets/Instaxbot_Logo2.jpeg";

function detectPlatform(): "ios" | "android" | "other" {
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

function IOSInstructionModal({ onClose }: { onClose: () => void }) {
  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .ios-modal-overlay {
          animation: fadeIn 0.25s ease forwards;
        }
        .ios-modal-card {
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      {/* Overlay */}
      <div
        className="ios-modal-overlay"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 20px",
        }}
      >
        {/* Card — stop click from closing */}
        <div
          className="ios-modal-card"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: "#1e1e2e",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: "24px 20px 20px",
            width: "100%",
            maxWidth: 340,
            boxSizing: "border-box",
            position: "relative",
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.6)",
              fontSize: 16,
              lineHeight: 1,
            }}
          >
            ×
          </button>

          {/* Title */}
          <p
            style={{
              color: "#fff",
              fontWeight: 700,
              fontSize: 17,
              margin: "0 0 4px",
            }}
          >
            Install InstaxBot
          </p>
          <p
            style={{
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              margin: "0 0 18px",
            }}
          >
            Get quick access by installing it on your home screen.
          </p>

          {/* Divider */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.08)",
              marginBottom: 16,
            }}
          />

          {/* Platform label */}
          <p
            style={{
              color: "rgba(255,255,255,0.4)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.5,
              margin: "0 0 12px",
              textTransform: "uppercase",
            }}
          >
            For iPhone / iPad:
          </p>

          {/* Steps */}
          {[
            {
              num: 1,
              text: (
                <>
                  Tap the{" "}
                  <strong style={{ color: "#fff" }}>Share</strong>{" "}
                  button (square with arrow) in Safari.
                </>
              ),
            },
            {
              num: 2,
              text: (
                <>
                  Scroll and tap{" "}
                  <strong style={{ color: "#fff" }}>Add to Home Screen</strong>.
                </>
              ),
            },
            {
              num: 3,
              text: (
                <>
                  Tap <strong style={{ color: "#fff" }}>Add</strong>{" "}
                  in the top-right corner.
                </>
              ),
            },
            {
              num: 4,
              text: (
                <>
                  The <strong style={{ color: "#fff" }}>InstaxBot</strong>{" "}
                  app icon will appear on your home screen.
                </>
              ),
            },
          ].map(({ num, text }) => (
            <div
              key={num}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {num}
              </div>
              <p
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 13,
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {text}
              </p>
            </div>
          ))}

          {/* Benefits callout */}
          <div
            style={{
              background: "rgba(255,255,255,0.05)",
              borderRadius: 10,
              padding: "10px 14px",
              marginTop: 6,
              marginBottom: 20,
            }}
          >
            <p
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: 12,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: "rgba(255,255,255,0.8)" }}>
                Benefits:
              </strong>{" "}
              Faster access, offline capability, and app-like experience.
            </p>
          </div>

          {/* Footer buttons */}
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                padding: "9px 18px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Maybe Later
            </button>
            <button
              onClick={onClose}
              style={{
                background: "#fff",
                color: "#1e1e2e",
                border: "none",
                borderRadius: 10,
                padding: "9px 18px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Got It
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [platform] = useState<"ios" | "android" | "other">(detectPlatform);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (platform === "android" || platform === "other") {
        setShowBanner(true);
        setTimeout(() => setVisible(true), 10);
      }
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (platform === "ios") {
      const isStandalone =
        (window.navigator as any).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches;
      if (!isStandalone) {
        setShowBanner(true);
        setTimeout(() => setVisible(true), 10);
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [platform]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    console.log(choice.outcome);
    setDeferredPrompt(null);
    dismiss();
  };

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setShowBanner(false), 400);
  };

  if (!showBanner) return null;

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes slideUpOut {
          from { transform: translateY(0);     opacity: 1; }
          to   { transform: translateY(-100%); opacity: 0; }
        }
        .install-banner {
          animation: ${visible ? "slideDown" : "slideUpOut"} 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>

      {/* iOS modal */}
      {showIOSModal && (
        <IOSInstructionModal
          onClose={() => {
            setShowIOSModal(false);
            dismiss();
          }}
        />
      )}

      <div
        className="install-banner"
        style={{
          position: "fixed",
          top: 70,
          left: 16,
          right: 16,
          zIndex: 9999,
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "14px 16px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            boxSizing: "border-box" as const,
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              flexShrink: 0,
              overflow: "hidden",
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={instaxLogo}
              alt="InstaxBot"
              style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 12 }}
            />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
            <p
              style={{
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                margin: 0,
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Add InstaxBot to Home Screen
            </p>
            <p
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 11,
                margin: "2px 0 0",
                lineHeight: 1.3,
              }}
            >
              {platform === "ios"
                ? "Tap Install to see instructions"
                : "Faster access, works offline"}
            </p>
          </div>

          {/* Buttons */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 5,
              flexShrink: 0,
            }}
          >
            {platform === "ios" ? (
              <>
                <button
                  onClick={() => setShowIOSModal(true)}
                  style={{
                    background: "linear-gradient(135deg, #c0390a, #e85d04)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "7px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Install
                </button>
                <button
                  onClick={dismiss}
                  style={{
                    background: "transparent",
                    color: "rgba(255,255,255,0.4)",
                    border: "none",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: "2px 0",
                    textAlign: "center" as const,
                  }}
                >
                  Not now
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleInstallClick}
                  style={{
                    background: "linear-gradient(135deg, #c0390a, #e85d04)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "7px 16px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Install
                </button>
                <button
                  onClick={dismiss}
                  style={{
                    background: "transparent",
                    color: "rgba(255,255,255,0.4)",
                    border: "none",
                    fontSize: 11,
                    cursor: "pointer",
                    padding: "2px 0",
                    textAlign: "center" as const,
                  }}
                >
                  Not now
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default InstallPrompt;
