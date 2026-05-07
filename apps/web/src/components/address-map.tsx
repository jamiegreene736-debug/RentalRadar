import { MapPin } from "lucide-react";

export function AddressMap({ address }: { address: string }) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const encoded = encodeURIComponent(address);
  const mapbox = token
    ? `https://api.mapbox.com/styles/v1/mapbox/light-v11/static/pin-s+0e7490(-80.13,25.78)/-80.13,25.78,11,0/720x360@2x?access_token=${token}`
    : null;

  return (
    <div className="relative h-[300px] overflow-hidden rounded-lg border bg-card">
      {mapbox ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mapbox} alt={address} className="h-full w-full object-cover" />
      ) : (
        <iframe
          title="Property map"
          className="h-full w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={`https://www.google.com/maps?q=${encoded}&output=embed`}
        />
      )}
      <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-md bg-white/92 px-3 py-2 text-sm font-medium shadow-sm">
        <MapPin className="size-4 text-primary" />
        <span className="truncate">{address}</span>
      </div>
    </div>
  );
}
