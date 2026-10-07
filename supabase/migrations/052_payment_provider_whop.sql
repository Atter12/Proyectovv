-- Whop Payments (tarjeta / wallets) como pasarela de recarga.
ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'whop';
