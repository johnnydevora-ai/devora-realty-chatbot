import { useState } from "react";
import Dalton from "../components/Dalton";

export default function Home() {
  const [open, setOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#0B0B0C] flex items-center justify-center">
      <button
        onClick={() => setOpen(true)}
        className="px-6 py-3 bg-[#1C2A38] text-white rounded-md hover:bg-[#243648] text-[15px]"
      >
        Talk to Dalton
      </button>

      <Dalton isOpen={open} onClose={() => setOpen(false)} />
    </main>
  );
}
