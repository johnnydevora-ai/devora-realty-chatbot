import { useEffect, useState, useRef } from "react";

const OPENING_MESSAGE = `Stop the scroll.

Tell me what you're actually looking for.

I'll narrow it down.`;

// Dalton overlay + entrance animation styles
const daltonStyles = `
  .dalton-overlay {
      position: fixed;
          inset: 0;
              background: rgba(0, 0, 0, 0.35);
                  backdrop-filter: blur(4px);
                      z-index: 40;
                          transition: all 0.3s ease;
                            }

                              .dalton-container {
                                  background: rgba(11, 11, 12, 0.92);
                                      backdrop-filter: blur(12px);
                                          border: 1px solid rgba(255,255,255,0.08);
                                              border-radius: 10px;
                                                  box-shadow: 0 8px 30px rgba(0,0,0,0.4);
                                                      transform: translateY(10px);
                                                          opacity: 0;
                                                              transition: all 0.25s ease;
                                                                }

                                                                  .dalton-container.dalton-open {
                                                                      transform: translateY(0);
                                                                          opacity: 1;
                                                                            }
                                                                            `;

export default function Dalton({ isOpen, onClose }) {
          const [messages, setMessages] = useState([
                  {
                                role: "assistant",
                                content: OPENING_MESSAGE,
                                type: "opening",
                  },
                    ]);
          const [input, setInput] = useState("");
          const [loading, setLoading] = useState(false);
          const [mounted, setMounted] = useState(false);
          const bottomRef = useRef(null);

  // lock scroll when open
  useEffect(() => {
              document.body.style.overflow = isOpen ? "hidden" : "auto";
  }, [isOpen]);

  // trigger entrance animation after mount
  useEffect(() => {
              if (isOpen) {
                            const t = setTimeout(() => setMounted(true), 10);
                            return () => clearTimeout(t);
              } else {
                            setMounted(false);
              }
  }, [isOpen]);

  // scroll to bottom on new messages
  useEffect(() => {
              bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  if (!isOpen) return null;

  async function sendMessage() {
              const trimmed = input.trim();
              if (!trimmed || loading) return;

            const userMessage = { role: "user", content: trimmed };
              setMessages(prev => [...prev, userMessage]);
              setInput("");
              setLoading(true);

            try {
                          const res = await fetch("/api/chat", {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                                            message: trimmed,
                                                            history: messages.map(m => ({
                                                                                role: m.role,
                                                                                content: m.content,
                                                            })),
                                          }),
                          });
                          const data = await res.json();
                          const reply = data.reply || data.message || "Sorry, I didn't get a response.";
                          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
            } catch (err) {
                          setMessages((prev) => [
                                          ...prev,
                                  { role: "assistant", content: "Something went wrong. Please try again." },
                                        ]);
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
                      {/* INJECT STYLES */}
                    <style dangerouslySetInnerHTML={{ __html: daltonStyles }} />
              
                      {/* OVERLAY — clicking outside closes Dalton */}
                      {isOpen && (
                              <div
                                                className="dalton-overlay"
                                                onClick={onClose}
                                              />
                            )}
              
                      {/* MODAL WRAPPER */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                            {/* DALTON CONTAINER — stopPropagation prevents overlay click-through */}
                            <div
                                              className={`dalton-container w-full max-w-[420px] flex flex-col z-50 fixed${mounted ? " dalton-open" : ""}`}
                                              style={{ maxHeight: "80vh", position: "relative" }}
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                    {/* HEADER */}
                                      <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F2933]">
                                                  <div>
                                                                <div className="text-[15px] font-medium text-white">Dalton</div>div>
                                                                <div className="text-[12px] text-[#6B7280]">
                                                                                Describe it. I'll narrow it down.
                                                                </div>div>
                                                  </div>div>
                                                  <button
                                                                        onClick={onClose}
                                                                        className="text-[#6B7280] hover:text-white text-lg"
                                                                      >
                                                                ×
                                                  </button>button>
                                      </div>div>
                            
                                    {/* MESSAGES */}
                                      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
                                              {messages.map((msg, i) => (
                                                                  <div
                                                                                          key={i}
                                                                                          className={msg.role === "user" ? "flex justify-end" : ""}
                                                                                        >
                                                                          {msg.role === "user" ? (
                                                                                                                  <div className="bg-[#1C2A38] text-white px-4 py-3 rounded-md text-[14px] max-w-[75%] whitespace-pre-wrap">
                                                                                                                          {msg.content}
                                                                                                                          </div>div>
                                                                                                                ) : msg.type === "opening" ? (
                                                                                                                  <div className="text-[16px] font-medium text-white leading-loose whitespace-pre-wrap">
                                                                                                                          {msg.content}
                                                                                                                          </div>div>
                                                                                                                ) : (
                                                                                                                  <div className="text-[14px] leading-relaxed text-white max-w-[85%] whitespace-pre-wrap">
                                                                                                                          {msg.content}
                                                                                                                          </div>div>
                                                                                  )}
                                                                  </div>div>
                                                                ))}
                                              {loading && (
                                                                  <div className="text-[13px] text-[#6B7280]">Dalton is thinking…</div>div>
                                                  )}
                                                  <div ref={bottomRef} />
                                      </div>div>
                            
                                    {/* INPUT */}
                                      <div className="border-t border-[#1F2933] px-5 py-4">
                                                  <div className="flex items-center gap-2">
                                                                <input
                                                                                        className="flex-1 bg-[#0F1113] border border-[#1F2933] text-[14px] px-4 py-3 rounded-md outline-none focus:border-[#3A5A7A] text-white placeholder-[#6B7280]"
                                                                                        placeholder="Try: modern home in East Austin under 1.2 with a pool"
                                                                                        value={input}
                                                                                        onChange={(e) => setInput(e.target.value)}
                                                                                        onKeyDown={handleKeyDown}
                                                                                        disabled={loading}
                                                                                      />
                                                                <button
                                                                                        onClick={sendMessage}
                                                                                        disabled={loading}
                                                                                        className="px-4 py-3 bg-[#1C2A38] text-white rounded-md hover:bg-[#243648] disabled:opacity-50"
                                                                                      >
                                                                                →
                                                                </button>button>
                                                  </div>div>
                                      </div>div>
                            </div>div>
                    </div>div>
              </>>
            );
}</>
