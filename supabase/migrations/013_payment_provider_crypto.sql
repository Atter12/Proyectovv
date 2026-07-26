-- Add crypto as voucher-style payment provider (USDT / Binance proof flow).
ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'crypto';
