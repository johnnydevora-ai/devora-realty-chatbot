import { useEffect } from "react";

export default function Dalton({ isOpen, onClose }) {

  // lock scroll when open

  useEffect(() => {

    document.body.style.overflow = isOpen ? "hidden" : "auto";

  }, [isOpen]);

  if (!isOpen) return null;

  return (

    <>

      {/* OVERLAY */}

      <div

        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"

        onClick={onClose}

      />

      {/* MODAL */}

      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">

        <div

          className="w-full max-w-[420px] bg-[#0B0B0C] border border-[#1F2933] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]"

          onClick={(e) => e.stopPropagation()}

        >

          {/* HEADER */}

          <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F2933]">

            <div>

              <div className="text-[15px] font-medium text-white">Dalton</div>

              <div className="text-[12px] text-[#6B7280]">

                Describe it. I'll narrow it down.

              </div>

            </div>

            <button

              onClick={onClose}

              className="text-[#6B7280] hover:text-white text-lg"

            >

              ×

            </button>

          </div>

          {/* BODY */}

          <div className="px-6 py-7 space-y-7">

            {/* OPENING MESSAGE */}

            <div className="text-[15px] leading-relaxed space-y-2 text-white">

              <div>Stop the scroll.</div>

              <div>Tell me what you're actually looking for.</div>

              <div className="text-[#A1A1AA]">Skip the filters.</div>

              <div className="text-[#A1A1AA]">Just say it.</div>

            </div>

            {/* SAMPLE USER MESSAGE */}

            <div className="flex justify-end">

              <div className="bg-[#1C2A38] text-white px-4 py-3 rounded-md text-[14px] max-w-[75%]">

                Modern home in East Austin under $1.5mm

              </div>

            </div>

            {/* DALTON RESPONSE (NO BUBBLE) */}

            <div className="text-[14px] leading-relaxed space-y-2 max-w-[75%] text-white">

              <div>Let's narrow it down.</div>

              <div className="text-[#6B7280]">

                What kind of property are you thinking about?

              </div>

            </div>

          </div>

          {/* INPUT */}

          <div className="border-t border-[#1F2933] px-5 py-4">

            <div className="flex items-center gap-2">

              <input

                className="flex-1 bg-[#0F1113] border border-[#1F2933] text-[14px] px-4 py-3 rounded-md outline-none focus:border-[#3A5A7A] text-white placeholder-[#6B7280]"

                placeholder="Try: modern home in East Austin under 1.2 with a pool"

              />

              <button className="px-4 py-3 bg-[#1C2A38] text-white rounded-md hover:bg-[#243648]">

                →

              </button>

            </div>

          </div>

        </div>

      </div>

    </>

  );

}
