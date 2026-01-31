"use client";

import React from "react";
import Navbar from "./navbar";
import { usePathname } from "next/navigation";

function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathName = usePathname();

  return (
    <div
      className={`flex flex-col items-center min-h-screen w-full ${
        pathName == "/chat" ? "max-h-screen overflow-hidden" : ""
      }`}
    >
      <Navbar />
      {children}
    </div>
  );
}

export default MainWrapper;
