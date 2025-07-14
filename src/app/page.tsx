"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the chat page on load
    router.push("/chat");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse">
        <p className="text-lg text-muted-foreground">Redirecting to NexusAI...</p>
      </div>
    </div>
  );
}
