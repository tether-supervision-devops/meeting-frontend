/* src/App.tsx */
import "./App.css";
import { ZoomMtg } from "@zoom/meetingsdk";
import { useEffect, useRef, useState } from "react";

/* -------------------------------------------------
   1. Pre-load the SDK
   ------------------------------------------------- */
ZoomMtg.preLoadWasm();
ZoomMtg.prepareWebSDK();

/* -------------------------------------------------
   2. Extend ZoomMtg types
   ------------------------------------------------- */
declare global {
  interface Window {
    ZoomMtg: typeof ZoomMtg & {
      stream?: {
        startVideo: (opts: { success?: () => void; error?: (e: any) => void }) => void;
        stopVideo: (opts: { success?: () => void; error?: (e: any) => void }) => void;
      };
    };
  }
}

/* -------------------------------------------------
   3. App component
   ------------------------------------------------- */
function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const meetingNumber = urlParams.get("meetingNumber") ?? "";
  const passWord = urlParams.get("passWord") ?? "";
  const userName = urlParams.get("userName") ?? "";
  const leaveUrl = urlParams.get("leaveUrl") ?? "https://app.tethersupervision.com";
  const uuid = urlParams.get("uuid") ?? "";
  const authEndpoint =
    "https://tether-meetingsdk-auth-endpoint-production.up.railway.app/sign";

  const startedRef = useRef(false);
  const signatureExpRef = useRef<number | null>(null);
  const [joining, setJoining] = useState(false);
  const [inMeeting, setInMeeting] = useState(false);
  const [hostInvited, setHostInvited] = useState(false);

  /* ------------------- Signature fetch ------------------- */
  async function fetchSignature(): Promise<{
    signature: string;
    zak?: string;
    exp?: number;
    zoomEmail?: string;
  }> {
    const req = await fetch(authEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingNumber, uuid, videoWebRtcMode: 1 }),
    });
    const res = await req.json();
    if (!res.signature) throw new Error("No signature returned from server");
    if (res.exp) signatureExpRef.current = res.exp * 1000;
    return res;
  }

  const getSignature = async () => {
    if (startedRef.current || joining) return;
    startedRef.current = true;
    setJoining(true);
    try {
      const res = await fetchSignature();
      const zak = typeof res.zak === "string" && res.zak.trim() !== "" ? res.zak : undefined;
      const emailToUse =
        res.zoomEmail && typeof res.zoomEmail === "string" && res.zoomEmail.trim()
          ? res.zoomEmail
          : `${uuid}@tether.local`;
      startMeeting(res.signature, zak, emailToUse);
    } catch (e) {
      console.error("Signature fetch error:", e);
      alert("Failed to get signature");
      startedRef.current = false;
    } finally {
      setJoining(false);
    }
  };

  /* ------------------- Init / Join ------------------- */
  const startMeeting = (signature: string, zak?: string, email?: string) => {
    const rootElement = document.getElementById("zmmtg-root");
    if (rootElement) rootElement.style.display = "block";

    ZoomMtg.init({
      leaveUrl,
      patchJsMedia: true,
      leaveOnPageUnload: true,
      success: () => {
        // @ts-expect-error
        ZoomMtg.inMeetingServiceListener("disconnect", async () => {
          console.warn("Zoom disconnected; attempting to rejoin…");
          try {
            const msLeft = (signatureExpRef.current ?? 0) - Date.now();
            const needNewSig = msLeft < 60_000;
            let sig = "";
            let zakToUse: string | undefined = undefined;
            let emailToUse = email;

            if (needNewSig) {
              const fresh = await fetchSignature();
              sig = fresh.signature;
              zakToUse = typeof fresh.zak === "string" && fresh.zak.trim() !== "" ? fresh.zak : undefined;
              emailToUse = fresh.zoomEmail && typeof fresh.zoomEmail === "string" ? fresh.zoomEmail : `${uuid}@tether.local`;
            } else {
              const cur = await fetchSignature();
              sig = cur.signature;
              zakToUse = typeof cur.zak === "string" && cur.zak.trim() !== "" ? cur.zak : undefined;
              emailToUse = cur.zoomEmail && typeof cur.zoomEmail === "string" ? cur.zoomEmail : `${uuid}@tether.local`;
            }

            ZoomMtg.join({
              signature: sig,
              meetingNumber,
              passWord,
              userName,
              userEmail: emailToUse,
              ...(zakToUse ? { zak: zakToUse } : {}),
              success: () => console.log("Rejoin success"),
              error: (err: unknown) => {
                console.error("Rejoin failed", err);
                try { ZoomMtg.leaveMeeting({}); } catch { }
                fetchSignature()
                  .then((f) => {
                    const validZak = typeof f.zak === "string" && f.zak.trim() !== "" ? f.zak : undefined;
                    const emailToPass = f.zoomEmail && typeof f.zoomEmail === "string" ? f.zoomEmail : `${uuid}@tether.local`;
                    startMeeting(f.signature, validZak, emailToPass);
                  })
                  .catch((e) => console.error("Full restart failed", e));
              },
            } as any);
          } catch (err) {
            console.error("Rejoin flow error", err);
          }
        });

        const joinParams: any = {
          signature,
          meetingNumber,
          passWord,
          userName,
          userEmail: email,
          ...(typeof zak === "string" && zak.trim() !== "" ? { zak } : {}),
          success: () => {
            console.log("Join success");
            setInMeeting(true);
          },
          error: (error: unknown) => console.error("Join error:", error),
        };

        ZoomMtg.join(joinParams);
      },
      error: (error: unknown) => {
        console.error("Init error:", error);
        startedRef.current = false;
      },
    });
  };

  useEffect(() => {
    if (meetingNumber && userName) getSignature();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const goOffline = () => console.warn("You're offline — Zoom will try to reconnect.");
    const goOnline = () => console.warn("Back online — reconnecting if needed…");
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "ASK_FOR_HELP" || event.data?.type === "INVITE_HOST") {
        // Reuse the same logic as the in-app button
        inviteHost();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  /* ------------------- Invite Host (Auto-click exact button) ------------------- */
  const inviteHost = () => {
    if (hostInvited || typeof ZoomMtg.askForHelp !== "function") return;

    setHostInvited(true);

    ZoomMtg.askForHelp({
      success: () => {
        window.parent.postMessage({ type: "ASK_FOR_HELP_SUCCESS" }, "*");
      },
      error: (e: any) => {
        console.error("Invite host failed:", e);
        window.parent.postMessage({ type: "ASK_FOR_HELP_ERROR", reason: e?.reason }, "*");
        setHostInvited(false);
      },
    });

    // Auto-click "Invite host" button in Zoom modal
    const attemptClick = (retryCount = 0) => {
      if (retryCount > 3) {
        console.warn("Failed to find 'Invite host' button after 3 retries");
        setHostInvited(false);
        return;
      }

      const buttons = document.querySelectorAll("button.zm-btn.zm-btn--primary");
      let targetBtn: HTMLButtonElement | null = null;

      for (const btn of Array.from(buttons)) {
        const button = btn as HTMLButtonElement; // Cast once
        const text = button.textContent?.trim();
        if (text === "Invite host" || text?.includes("Invite host")) {
          targetBtn = button;
          break;
        }
      }

      if (targetBtn && !targetBtn.disabled) {
        targetBtn.click();
        console.log("Auto-clicked 'Invite host' button");
      } else {
        setTimeout(() => attemptClick(retryCount + 1), 200);
      }
    };

    setTimeout(() => attemptClick(0), 300);
  };

  /* -------------------------------------------------
     4. Render
     ------------------------------------------------- */
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        background: "linear-gradient(to bottom right, #ebf8ff, #bfdbfe, #93c5fd)",
      }}
    >
      {/* Pre-join screen */}
      <main
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: "40rem",
            background: "white",
            borderRadius: "1.5rem",
            boxShadow: "0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04)",
            padding: "64px 48px",
            marginTop: "2.5rem",
            marginBottom: "3rem",
            textAlign: "center",
            border: "1px solid #dbeafe",
            transition: "all 0.5s ease",
          }}
        >
          <img
            src="https://cdn.prod.website-files.com/67452425f61385512d1640b8/68661d220ff8dfd62198a6f7_Tether%20Logo%20(2)-p-500.png"
            alt="Tether Supervision Logo"
            style={{
              display: "block",
              margin: "0 auto 2.5rem auto",
              height: "96px",
              transition: "transform 0.5s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          />

          {!meetingNumber || !userName ? (
            <>
              <h2 style={{ fontSize: "1.875rem", fontWeight: 600, color: "#111827", marginBottom: "1.5rem" }}>
                Thank You
              </h2>
              <p style={{ fontSize: "1.125rem", lineHeight: 1.6, color: "#374151" }}>
                We appreciate your use of Tether Supervision. <br />
                Please refresh the supervision screen to start a new session.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: "1.25rem", lineHeight: 1.6, color: "#374151", marginBottom: "2.5rem" }}>
                You are about to join a secure Tether Supervision session.
              </p>
              <button
                disabled={joining}
                onClick={getSignature}
                style={{
                  width: "100%",
                  padding: "1rem 2rem",
                  borderRadius: "0.75rem",
                  fontWeight: 600,
                  transition: "all 0.3s ease",
                  boxShadow: joining ? "none" : "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)",
                  background: joining ? "#9ca3af" : "linear-gradient(to right, #2563eb, #1d4ed8)",
                  color: "white",
                  cursor: joining ? "not-allowed" : "pointer",
                  opacity: joining ? 0.7 : 1,
                }}
                onMouseOver={(e) => {
                  if (!joining) e.currentTarget.style.background = "linear-gradient(to right, #1d4ed8, #1e40af)";
                }}
                onMouseOut={(e) => {
                  if (!joining) e.currentTarget.style.background = "linear-gradient(to right, #2563eb, #1d4ed8)";
                }}
              >
                {joining ? "Joining…" : "Join Meeting"}
              </button>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "1.5rem 0",
          fontSize: "0.875rem",
          color: "#4b5563",
          borderTop: "1px solid #dbeafe",
        }}
      >
        <p style={{ marginBottom: "0.25rem" }}>© {new Date().getFullYear()} Tether Supervision</p>
        <p style={{ color: "#6b7280" }}>HIPAA-compliant supervision platform • All rights reserved</p>
      </footer>

      {/* Supervising Physician Card — Top Right */}
      {inMeeting && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 999999,
            pointerEvents: "auto",
          }}
        >
          {/* <SupervisingPhysicianCard
            online={true}
            name="Dr. Emily Carter"
            phone="+1 (555) 123-4567"
            imageUrl="https://images.pexels.com/photos/3760852/pexels-photo-3760852.jpeg?auto=compress&cs=tinysrgb&w=400"
          /> */}
        </div>
      )}

      <div
        id="zmmtg-root"
        style={{
          display: "none",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 1,
        }}
      ></div>
    </div>
  );
}


export default App;
