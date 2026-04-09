import { useEffect, useState, useRef } from "react";

// DALTON UI v2 — Luxury Control Panel
// Minimal. Matte. Confident. No noise.

const daltonStyles = `
  .dalton-trigger {
      position: fixed;
          bottom: 24px;
              right: 24px;
                  width: 56px;
                      height: 56px;
                          background: rgba(10,10,10,0.75);
                              backdrop-filter: blur(12px);
                                  -webkit-backdrop-filter: blur(12px);
                                      border-radius: 50%;
                                          border: 1px solid rgba(255,255,255,0.08);
                                              display: flex;
                                                  align-items: center;
                                                      justify-content: center;
                                                          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
                                                              cursor: pointer;
                                                                  z-index: 999;
                                                                      transition: all 0.2s ease;
                                                                        }
                                                                          .dalton-trigger:hover {
                                                                              background: rgba(20,20,20,0.85);
                                                                                  border-color: rgba(255,255,255,0.14);
                                                                                    }

                                                                                      .dalton-overlay {
                                                                                          position: fixed;
                                                                                              inset: 0;
                                                                                                  background: rgba(0,0,0,0.35);
                                                                                                      backdrop-filter: blur(4px);
                                                                                                          -webkit-backdrop-filter: blur(4px);
                                                                                                              z-index: 1000;
                                                                                                                }
                                                                                                                  
                                                                                                                    .dalton-panel {
                                                                                                                        position: fixed;
                                                                                                                            bottom: 24px;
                                                                                                                                right: 24px;
                                                                                                                                    width: 360px;
                                                                                                                                        max-width: 90vw;
                                                                                                                                            padding: 24px;
                                                                                                                                                background: rgba(10,10,10,0.78);
                                                                                                                                                    backdrop-filter: blur(18px);
                                                                                                                                                        -webkit-backdrop-filter: blur(18px);
                                                                                                                                                            border-radius: 14px;
                                                                                                                                                                border: 1px solid rgba(255,255,255,0.06);
                                                                                                                                                                    box-shadow: 0 20px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04);
                                                                                                                                                                        z-index: 1001;
                                                                                                                                                                            font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
                                                                                                                                                                                transform: scale(0.96);
                                                                                                                                                                                    opacity: 0;
                                                                                                                                                                                        transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), opacity 0.25s cubic-bezier(0.22,1,0.36,1);
                                                                                                                                                                                          }
                                                                                                                                                                                            .dalton-panel.dalton-open {
                                                                                                                                                                                                transform: scale(1);
                                                                                                                                                                                                    opacity: 1;
                                                                                                                                                                                                      }
                                                                                                                                                                                                        
                                                                                                                                                                                                          .dalton-label {
                                                                                                                                                                                                              font-size: 12px;
                                                                                                                                                                                                                  letter-spacing: 0.12em;
                                                                                                                                                                                                                      text-transform: uppercase;
                                                                                                                                                                                                                          color: rgba(255,255,255,0.6);
                                                                                                                                                                                                                              margin-bottom: 12px;
                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                  .dalton-hook {
                                                                                                                                                                                                                                      font-size: 20px;
                                                                                                                                                                                                                                          font-weight: 500;
                                                                                                                                                                                                                                              color: #ffffff;
                                                                                                                                                                                                                                                  margin-bottom: 12px;
                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                      .dalton-sub {
                                                                                                                                                                                                                                                          font-size: 14px;
                                                                                                                                                                                                                                                              line-height: 1.6;
                                                                                                                                                                                                                                                                  color: rgba(255,255,255,0.7);
                                                                                                                                                                                                                                                                      margin-bottom: 20px;
                                                                                                                                                                                                                                                                          white-space: pre-line;
                                                                                                                                                                                                                                                                            }
                                                                                                                                                                                                                                                                              
                                                                                                                                                                                                                                                                                .dalton-input-row {
                                                                                                                                                                                                                                                                                    display: flex;
                                                                                                                                                                                                                                                                                        align-items: center;
                                                                                                                                                                                                                                                                                            gap: 8px;
                                                                                                                                                                                                                                                                                              }
                                                                                                                                                                                                                                                                                                .dalton-input {
                                                                                                                                                                                                                                                                                                    flex: 1;
                                                                                                                                                                                                                                                                                                        background: rgba(255,255,255,0.04);
                                                                                                                                                                                                                                                                                                            border: 1px solid rgba(255,255,255,0.08);
                                                                                                                                                                                                                                                                                                                border-radius: 10px;
                                                                                                                                                                                                                                                                                                                    padding: 14px 16px;
                                                                                                                                                                                                                                                                                                                        font-size: 14px;
                                                                                                                                                                                                                                                                                                                            color: #ffffff;
                                                                                                                                                                                                                                                                                                                                outline: none;
                                                                                                                                                                                                                                                                                                                                    transition: all 0.2s ease;
                                                                                                                                                                                                                                                                                                                                        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
                                                                                                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                                                                                                            .dalton-input::placeholder {
                                                                                                                                                                                                                                                                                                                                                color: rgba(255,255,255,0.35);
                                                                                                                                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                                                                                                                                    .dalton-input:focus {
                                                                                                                                                                                                                                                                                                                                                        border: 1px solid rgba(255,255,255,0.18);
                                                                                                                                                                                                                                                                                                                                                            box-shadow: 0 0 0 1px rgba(255,255,255,0.08);
                                                                                                                                                                                                                                                                                                                                                              }
                                                                                                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                                                                                                  .dalton-send {
                                                                                                                                                                                                                                                                                                                                                                      width: 40px;
                                                                                                                                                                                                                                                                                                                                                                          height: 40px;
                                                                                                                                                                                                                                                                                                                                                                              min-width: 40px;
                                                                                                                                                                                                                                                                                                                                                                                  background: rgba(255,255,255,0.08);
                                                                                                                                                                                                                                                                                                                                                                                      border-radius: 8px;
                                                                                                                                                                                                                                                                                                                                                                                          border: none;
                                                                                                                                                                                                                                                                                                                                                                                              display: flex;
                                                                                                                                                                                                                                                                                                                                                                                                  align-items: center;
                                                                                                                                                                                                                                                                                                                                                                                                      justify-content: center;
                                                                                                                                                                                                                                                                                                                                                                                                          cursor: pointer;
                                                                                                                                                                                                                                                                                                                                                                                                              transition: all 0.2s ease;
                                                                                                                                                                                                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                                                                                                                                                                                                  .dalton-send:hover {
                                                                                                                                                                                                                                                                                                                                                                                                                      background: rgba(255,255,255,0.16);
                                                                                                                                                                                                                                                                                                                                                                                                                        }
                                                                                                                                                                                                                                                                                                                                                                                                                          .dalton-send:disabled {
                                                                                                                                                                                                                                                                                                                                                                                                                              opacity: 0.4;
                                                                                                                                                                                                                                                                                                                                                                                                                                  cursor: default;
                                                                                                                                                                                                                                                                                                                                                                                                                                    }
                                                                                                                                                                                                                                                                                                                                                                                                                                      
                                                                                                                                                                                                                                                                                                                                                                                                                                        .dalton-messages {
                                                                                                                                                                                                                                                                                                                                                                                                                                            margin-bottom: 16px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                display: flex;
                                                                                                                                                                                                                                                                                                                                                                                                                                                    flex-direction: column;
                                                                                                                                                                                                                                                                                                                                                                                                                                                        gap: 12px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                            max-height: 260px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                overflow-y: auto;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                    .dalton-msg-user {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                        align-self: flex-end;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                            background: rgba(255,255,255,0.07);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                color: #ffffff;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    border-radius: 10px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        padding: 10px 14px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            font-size: 14px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                max-width: 85%;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    white-space: pre-wrap;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            .dalton-msg-ai {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                color: rgba(255,255,255,0.85);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    font-size: 14px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        line-height: 1.6;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            white-space: pre-wrap;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    .dalton-thinking {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        color: rgba(255,255,255,0.35);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            font-size: 13px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    .dalton-search-btn {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        display: block;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            width: 100%;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                margin-top: 12px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    padding: 14px 20px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        background: rgba(255,255,255,0.10);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            border: 1px solid rgba(255,255,255,0.15);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                border-radius: 10px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    color: #ffffff;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        font-size: 14px;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            font-weight: 500;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    letter-spacing: 0.04em;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        cursor: pointer;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            transition: all 0.2s ease;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                text-align: center;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    text-decoration: none;
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        .dalton-search-btn:hover {
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            background: rgba(255,255,255,0.18);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                border-color: rgba(255,255,255,0.25);
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  `;

const DaltonIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 4 H11 C16 4 18 7 18 12 C18 17 16 20 11 20 H6 V4 Z"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"/>
        <path d="M17.5 6.5 L18.3 8.2 L20 9 L18.3 9.8 L17.5 11.5 L16.7 9.8 L15 9 L16.7 8.2 Z"
                fill="rgba(255,255,255,0.8)"/>
        <path d="M14.5 11 L15 12 L16 12.5 L15 13 L14.5 14 L14 13 L13 12.5 L14 12 Z"
                fill="rgba(255,255,255,0.8)"/>
    </svg>svg>
  );

const ArrowIcon = () => (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 8 H13 M9 4 L13 8 L9 12"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"/>
    </svg>svg>
  );

export default function Dalton({ isOpen, onClose }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [started, setStarted] = useState(false);
    const [searchUrl, setSearchUrl] = useState(null);
    const bottomRef = useRef(null);
    
    // Lock scroll when panel open
    useEffect(() => {
          document.body.style.overflow = isOpen ? "hidden" : "";
    }, [isOpen]);
    
    // Entrance animation trigger
    useEffect(() => {
          if (isOpen) {
                  const t = setTimeout(() => setMounted(true), 10);
                  return () => clearTimeout(t);
          } else {
                  setMounted(false);
                  setStarted(false);
                  setMessages([]);
                  setInput("");
                  setSearchUrl(null);
          }
    }, [isOpen]);
    
    // Scroll to bottom on new messages
    useEffect(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);
    
    if (!isOpen) return null;
    
    async function sendMessage() {
          const trimmed = input.trim();
          if (!trimmed || loading) return;
          
          if (!started) setStarted(true);
          
          const userMessage = { role: "user", content: trimmed };
          setMessages(prev => [...prev, userMessage]);
          setInput("");
          setLoading(true);
          
          try {
                  const res = await fetch("/api/dalton", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                        message: trimmed,
                                        history: [...messages.map(m => ({ role: m.role, content: m.content })), { role: "user", content: trimmed }],
                            }),
                  });
                  const data = await res.json();
                  const reply = data.reply || data.message || "Sorry, I didn't get a response.";
                  setMessages(prev => [...prev, { role: "assistant", content: reply }]);
            
                  // Check if the API returned a search URL
                  if (data.searchUrl) {
                            setSearchUrl(data.searchUrl);
                  }
          } catch (err) {
                  setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
          } finally {
                  setLoading(false);
          }
    }
    
    function handleKeyDown(e) {
          if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
          }
    }
    
    return (
          <>
                <style dangerouslySetInnerHTML={{ __html: daltonStyles }} />
                
            {/* OVERLAY */}
                <div className="dalton-overlay" onClick={onClose} />
                
            {/* WIDGET PANEL — bottom right, 360px */}
                <div className={`dalton-panel${mounted ? " dalton-open" : ""}`}>
                        
                  {/* HEADER LABEL */}
                        <div className="dalton-label">DALTON</div>div>
                        
                  {/* PRIMARY HOOK */}
                        <div className="dalton-hook">Stop the scroll.</div>div>
                        
                  {/* SECONDARY COPY — shown until user starts typing */}
                  {!started && (
                      <div className="dalton-sub">{`Tell me what you're actually looking for.\n\nI'll narrow it down.`}</div>div>
                        )}
                        
                  {/* MESSAGES — shown after first send */}
                  {started && messages.length > 0 && (
                      <div className="dalton-messages">
                        {messages.map((msg, i) => (
                                      <div key={i} className={msg.role === "user" ? "dalton-msg-user" : "dalton-msg-ai"}>
                                        {msg.content}
                                      </div>div>
                                    ))}
                        {loading && <div className="dalton-thinking">narrowing it down…</div>div>}
                                  <div ref={bottomRef} />
                      </div>div>
                        )}
                  {started && messages.length === 0 && loading && (
                      <div className="dalton-messages">
                                  <div className="dalton-thinking">narrowing it down…</div>div>
                      </div>div>
                        )}
                
                  {/* SEARCH RESULTS BUTTON — shown when Dalton has a search URL */}
                  {searchUrl && (
                      <a
                                    className="dalton-search-btn"
                                    href={searchUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                  View Your Matches →
                      </a>a>
                        )}
                        
                  {/* INPUT ROW — hidden once search is ready */}
                  {!searchUrl && (
                      <div className="dalton-input-row">
                                  <input
                                                  className="dalton-input"
                                                  placeholder="Modern home in East Austin under $2M"
                                                  value={input}
                                                  onChange={(e) => setInput(e.target.value)}
                                                  onKeyDown={handleKeyDown}
                                                  disabled={loading}
                                                  autoFocus
                                                />
                                  <button
                                                  className="dalton-send"
                                                  onClick={sendMessage}
                                                  disabled={loading}
                                                >
                                                <ArrowIcon />
                                  </button>button>
                      </div>div>
                        )}
                </div>div>
          </>>
        );
}

// Trigger button — exported for use in index.jsx
export function DaltonTrigger({ onClick }) {
    return (
          <>
                <style dangerouslySetInnerHTML={{ __html: `
                        .dalton-trigger {
                                  position: fixed;
                                            bottom: 24px;
                                                      right: 24px;
                                                                width: 56px;
                                                                          height: 56px;
                                                                                    background: rgba(10,10,10,0.75);
                                                                                              backdrop-filter: blur(12px);
                                                                                                        -webkit-backdrop-filter: blur(12px);
                                                                                                                  border-radius: 50%;
                                                                                                                            border: 1px solid rgba(255,255,255,0.08);
                                                                                                                                      display: flex;
                                                                                                                                                align-items: center;
                                                                                                                                                          justify-content: center;
                                                                                                                                                                    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
                                                                                                                                                                              cursor: pointer;
                                                                                                                                                                                        z-index: 999;
                                                                                                                                                                                                  transition: all 0.2s ease;
                                                                                                                                                                                                          }
                                                                                                                                                                                                                  .dalton-trigger:hover {
                                                                                                                                                                                                                            background: rgba(20,20,20,0.85);
                                                                                                                                                                                                                                      border-color: rgba(255,255,255,0.14);
                                                                                                                                                                                                                                              }
                                                                                                                                                                                                                                                    `}} />
                <button className="dalton-trigger" onClick={onClick} aria-label="Open Dalton">
                        <DaltonIcon />
                </button>button>
          </>>
        );
}</></></svg>
