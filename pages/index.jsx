import { useState } from "react";
import Dalton, { DaltonTrigger } from "../components/Dalton";

export default function Home() {
    const [open, setOpen] = useState(false);

  return (
        <main className="min-h-screen bg-[#0B0B0C]">
          {/* DALTON TRIGGER — subtle matte circle, bottom right */}
          {!open && <DaltonTrigger onClick={() => setOpen(true)} />}
        
          {/* DALTON PANEL + OVERLAY */}
              <Dalton isOpen={open} onClose={() => setOpen(false)} />
        </main>main>
      );
}</main>
