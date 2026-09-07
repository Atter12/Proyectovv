-- =============================================================================
-- Yape / Plin P2P: libro de "dinero que realmente llegó".
--
-- Cada fila es un cobro observado en la cuenta receptora, reportado por un
-- agente externo (notificación push del celular, correo de constancia del banco
-- o carga manual del admin).
--
-- Es la prueba de que la plata LLEGÓ. El análisis del comprobante que sube el
-- cliente dice que la captura "se ve bien", que no es lo mismo: una captura se
-- falsifica en minutos, y de hecho ya pasó una vez
-- (metadata.reversal_reason = fake_voucher_auto_approve_incident).
--
-- Por eso la auto-aprobación exige las dos cosas: comprobante coherente Y
-- cobro observado en la cuenta receptora.
--
-- El matcher cruza estas filas contra payment_intents abiertos por monto exacto
-- en PEN. La unicidad de `fingerprint` y de `operation_number` impide acreditar
-- dos veces el mismo cobro.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.yape_inbound_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  -- De dónde vino el aviso. 'manual' = un admin lo cargó a mano desde el panel.
  source text NOT NULL,
  -- Clave de deduplicación calculada por el agente/servidor. Evita que el mismo
  -- aviso reenviado dos veces genere dos acreditaciones.
  fingerprint text NOT NULL,
  -- N° de operación de Yape. Las notificaciones push no siempre lo traen; el
  -- correo y la captura sí. Cuando existe, es la mejor clave anti-replay.
  operation_number text,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'PEN',
  sender_name text,
  sender_phone_suffix text,
  -- Texto crudo del push/correo, para auditoría y para reprocesar si el parser
  -- mejora más adelante.
  raw_text text,
  received_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'unmatched',
  matched_payment_intent_id uuid,
  matched_at timestamptz,
  -- Por qué quedó sin cruzar: sin candidatos, monto ambiguo, fuera de ventana.
  match_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT yape_inbound_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT yape_inbound_notifications_fingerprint_key UNIQUE (fingerprint),
  CONSTRAINT yape_inbound_notifications_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT yape_inbound_notifications_source_check
    CHECK (source IN ('android_push', 'email', 'manual', 'test')),
  CONSTRAINT yape_inbound_notifications_status_check
    CHECK (status IN ('unmatched', 'matched', 'ignored')),
  CONSTRAINT yape_inbound_notifications_intent_fkey
    FOREIGN KEY (matched_payment_intent_id)
    REFERENCES public.payment_intents(id) ON DELETE SET NULL
);

-- Un mismo N° de operación no puede acreditarse dos veces, venga del push,
-- del correo o de la carga manual.
CREATE UNIQUE INDEX IF NOT EXISTS uq_yape_inbound_operation_number
  ON public.yape_inbound_notifications (operation_number)
  WHERE operation_number IS NOT NULL;

-- Ruta caliente del matcher: buscar avisos sin cruzar por monto exacto.
CREATE INDEX IF NOT EXISTS idx_yape_inbound_unmatched_amount
  ON public.yape_inbound_notifications (amount_cents, received_at DESC)
  WHERE status = 'unmatched';

CREATE INDEX IF NOT EXISTS idx_yape_inbound_received_at
  ON public.yape_inbound_notifications (received_at DESC);

CREATE INDEX IF NOT EXISTS idx_yape_inbound_intent
  ON public.yape_inbound_notifications (matched_payment_intent_id)
  WHERE matched_payment_intent_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_yape_inbound_updated_at ON public.yape_inbound_notifications;
CREATE TRIGGER trg_yape_inbound_updated_at
  BEFORE UPDATE ON public.yape_inbound_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS activo y SIN políticas permisivas: esta tabla contiene el flujo de caja
-- real de la cuenta receptora y no pertenece a ninguna organización. Solo el
-- service role (que hace bypass de RLS) la lee y escribe, vía el endpoint de
-- ingesta y el panel admin.
ALTER TABLE public.yape_inbound_notifications ENABLE ROW LEVEL SECURITY;

-- El matcher levanta los pagos manuales abiertos dentro de la ventana de cruce
-- y compara el monto en memoria, así que lo que hace falta indexar es el filtro
-- por estado y fecha, no el campo del metadata.
CREATE INDEX IF NOT EXISTS idx_payment_intents_manual_open
  ON public.payment_intents (status, created_at DESC)
  WHERE provider = 'manual';

COMMENT ON TABLE public.yape_inbound_notifications IS
  'Cobros Yape/Plin observados en la cuenta receptora. Prueba de que el dinero llegó; requisito para auto-aprobar un pago manual en PEN.';
