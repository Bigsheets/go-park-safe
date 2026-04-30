CREATE TABLE public.parking_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lat double precision,
  lng double precision,
  result text NOT NULL,
  hydrant boolean,
  driveway boolean,
  sign boolean,
  note text,
  photo_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.parking_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read parking logs"
  ON public.parking_logs FOR SELECT USING (true);

CREATE POLICY "Anyone can insert parking logs"
  ON public.parking_logs FOR INSERT WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
  VALUES ('parking-photos', 'parking-photos', true);

CREATE POLICY "Public can view parking photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'parking-photos');

CREATE POLICY "Anyone can upload parking photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'parking-photos');