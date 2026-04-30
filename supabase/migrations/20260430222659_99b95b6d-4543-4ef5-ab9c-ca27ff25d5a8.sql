CREATE TABLE public.parking_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  hydrant BOOLEAN,
  driveway BOOLEAN,
  sign BOOLEAN,
  result TEXT NOT NULL,
  reason TEXT,
  user_parked BOOLEAN NOT NULL DEFAULT false,
  timer_started BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.parking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert parking sessions"
  ON public.parking_sessions FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Anyone can read parking sessions"
  ON public.parking_sessions FOR SELECT TO public USING (true);