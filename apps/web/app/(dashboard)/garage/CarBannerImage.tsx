"use client";

import { useState } from "react";
import { Car } from "lucide-react";

interface Props {
  src: string;
  alt: string;
}

export function CarBannerImage({ src, alt }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/30 flex items-center justify-center">
        <Car className="w-16 h-16 text-muted-foreground/20" strokeWidth={1} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}
