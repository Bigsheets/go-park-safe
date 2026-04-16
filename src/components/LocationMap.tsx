interface Props {
  lat: number;
  lng: number;
}

const LocationMap = ({ lat, lng }: Props) => {
  const mapSrc = `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`;

  return (
    <div className="w-full rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">Your location</p>
        <p className="text-xs text-muted-foreground">Map centered on your current GPS position</p>
      </div>

      <div className="h-56 w-full bg-muted">
        <iframe
          title="Your current location on Google Maps"
          src={mapSrc}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default LocationMap;
