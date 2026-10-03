#!/usr/bin/env python3
"""PDF para el cliente: guía simple Ads Holistic (español)."""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

OUT_DOCS = Path("/workspace/docs/guia-cliente-ads-holistic.pdf")
OUT_ARTIFACT = Path("/opt/cursor/artifacts/guia-cliente-ads-holistic.pdf")

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

ORANGE = (232, 93, 36)
CHARCOAL = (28, 28, 30)
INK = (45, 45, 48)
MUTED = (90, 90, 95)
LINE = (220, 214, 208)
SOFT = (255, 241, 232)
OK_BG = (236, 247, 240)
WARN_BG = (255, 246, 230)


class ClientPDF(FPDF):
    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.add_font("Body", "", FONT_REG)
        self.add_font("Body", "B", FONT_BOLD)
        self.add_font("Display", "B", FONT_SERIF_BOLD)
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(16, 18, 16)

    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_y(11)
        self.set_font("Body", "B", 9)
        self.set_text_color(*ORANGE)
        self.cell(0, 5, "Ads Holistic")
        self.set_font("Body", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 5, "Guía rápida para clientes", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*LINE)
        self.line(self.l_margin, 17, self.w - self.r_margin, 17)
        self.set_y(22)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_draw_color(*LINE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.set_y(-11)
        self.set_font("Body", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 7, f"adsholistic.com  ·  Soporte en el chat  ·  {self.page_no()}", align="C")

    def cover(self) -> None:
        self.add_page()
        self.set_fill_color(*ORANGE)
        self.rect(0, 0, self.w, 6, "F")
        self.set_fill_color(*CHARCOAL)
        self.rect(0, 6, self.w, 70, "F")

        self.set_y(24)
        self.set_font("Body", "", 11)
        self.set_text_color(255, 255, 255)
        self.cell(0, 7, "PARA TI, COMO CLIENTE", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Display", "B", 30)
        self.cell(0, 14, "Ads Holistic", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Body", "", 13)
        self.set_text_color(255, 220, 200)
        self.cell(0, 8, "Guía simple: recargar, ver cuentas y mover saldo", align="C")

        self.set_y(95)
        self.set_font("Display", "B", 15)
        self.set_text_color(*CHARCOAL)
        self.multi_cell(
            0,
            8,
            "Todo lo que necesitas saber para usar\ntu panel sin complicaciones.",
            align="C",
        )

        # índice visual
        items = [
            ("1", "Cómo recargar tu saldo"),
            ("2", "Cómo ver tus cuentas TikTok"),
            ("3", "Cómo poner saldo en una cuenta"),
            ("4", "Si te suspenden una cuenta: pasar el saldo"),
            ("5", "Otras cosas útiles + soporte"),
        ]
        y = 125
        for num, label in items:
            self.set_fill_color(*SOFT)
            self.rect(self.l_margin, y, self.w - self.l_margin - self.r_margin, 12, "F")
            self.set_xy(self.l_margin + 4, y + 2.5)
            self.set_fill_color(*ORANGE)
            self.set_font("Body", "B", 10)
            self.set_text_color(255, 255, 255)
            # número en caja
            self.set_xy(self.l_margin + 5, y + 2.8)
            self.set_text_color(*ORANGE)
            self.cell(8, 6, num)
            self.set_text_color(*CHARCOAL)
            self.set_font("Body", "", 11)
            self.cell(0, 6, label)
            y += 15

        self.set_y(265)
        self.set_font("Body", "", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 5, "Entra en adsholistic.com con tu correo", align="C")

    def h1(self, text: str) -> None:
        self.ln(2)
        self.set_font("Display", "B", 15)
        self.set_text_color(*CHARCOAL)
        self.multi_cell(0, 8, text)
        self.set_draw_color(*ORANGE)
        self.set_line_width(0.9)
        y = self.get_y()
        self.line(self.l_margin, y, self.l_margin + 22, y)
        self.ln(4)

    def lead(self, text: str) -> None:
        self.set_font("Body", "", 11)
        self.set_text_color(*INK)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def step(self, n: str, title: str, body: str) -> None:
        if self.get_y() > 250:
            self.add_page()
        x = self.l_margin
        y = self.get_y()
        self.set_fill_color(*ORANGE)
        self.ellipse(x, y, 7.5, 7.5, "F")
        self.set_xy(x, y + 1.1)
        self.set_font("Body", "B", 9)
        self.set_text_color(255, 255, 255)
        self.cell(7.5, 5.2, n, align="C")
        self.set_xy(x + 10, y)
        self.set_font("Body", "B", 11)
        self.set_text_color(*CHARCOAL)
        self.cell(0, 6.5, title, new_x="LMARGIN", new_y="NEXT")
        self.set_x(x + 10)
        self.set_font("Body", "", 10)
        self.set_text_color(*INK)
        self.multi_cell(0, 5.4, body)
        self.ln(2.5)

    def tip(self, title: str, text: str, kind: str = "ok") -> None:
        bg = OK_BG if kind == "ok" else WARN_BG if kind == "warn" else SOFT
        if self.get_y() > 245:
            self.add_page()
        start = self.get_y()
        x = self.l_margin
        w = self.w - self.l_margin - self.r_margin
        self.set_xy(x + 5, start + 3)
        self.set_font("Body", "B", 10)
        self.set_text_color(*ORANGE if kind != "ok" else (34, 120, 70))
        self.cell(0, 5, title, new_x="LMARGIN", new_y="NEXT")
        self.set_x(x + 5)
        self.set_font("Body", "", 10)
        self.set_text_color(*INK)
        self.multi_cell(w - 10, 5.3, text)
        end = self.get_y() + 2
        # fondo detrás: redibujar midiendo
        height = end - start
        # Dibujar borde izquierdo + relleno suave
        self.set_fill_color(*bg)
        # No podemos pintar detrás del texto ya escrito fácilmente; usar línea
        color = (34, 120, 70) if kind == "ok" else ORANGE
        self.set_draw_color(*color)
        self.set_line_width(1.5)
        self.line(x, start, x, end)
        self.set_line_width(0.3)
        self.set_y(end + 2)

    def bullet(self, text: str) -> None:
        self.set_font("Body", "", 10.5)
        self.set_text_color(*INK)
        self.cell(5, 5.8, "•")
        self.multi_cell(0, 5.8, text)
        self.ln(0.8)


def build() -> None:
    pdf = ClientPDF()
    pdf.cover()

    # —— Recargar ——
    pdf.add_page()
    pdf.h1("1. Cómo recargar tu saldo")
    pdf.lead(
        "Primero el dinero llega a tu cartera Holistic. "
        "Después tú eliges a qué cuenta TikTok enviarlo."
    )
    pdf.step(
        "1",
        "Entra a Pagos",
        "En el menú de la izquierda toca Pagos (o Pagamentos). "
        "Ahí verás tu saldo disponible.",
    )
    pdf.step(
        "2",
        "Toca Recargar / Agregar saldo",
        "Escribe cuánto quieres recibir en tu cartera (en dólares). "
        "Ese es el monto neto que te queda para usar en ads.",
    )
    pdf.step(
        "3",
        "Elige cómo pagar",
        "Puedes usar tarjeta (Stripe), Yape/Plin (código Cobrana en soles), "
        "USDT u otra transferencia. Sigue las instrucciones en pantalla.",
    )
    pdf.step(
        "4",
        "Espera la confirmación",
        "Cuando el pago se confirma, el saldo aparece en tu cartera. "
        "Si pagaste por transferencia, a veces hay una revisión breve.",
    )
    pdf.tip(
        "Sobre la comisión (fee)",
        "Si tu fee es 10% y quieres $100 en la cartera, te cobran $110. "
        "Los $100 quedan listos para asignar a tus cuentas. "
        "Tu porcentaje lo ves en el panel.",
        "warn",
    )
    pdf.tip(
        "Yape",
        "En Yape el servicio puede aparecer con otro nombre (Cobrana), "
        "no como “Holistic”. Usa el código que te muestra el panel.",
        "ok",
    )

    # —— Ver cuentas ——
    pdf.h1("2. Cómo ver tus cuentas")
    pdf.step(
        "1",
        "Abre Contas de ads / Cuentas",
        "En el menú izquierdo entra a Cuentas de ads. "
        "Ahí están todas tus cuentas TikTok vinculadas.",
    )
    pdf.step(
        "2",
        "Revisa nombre, ID y estado",
        "Verás el nombre, el ID del advertiser y si está "
        "Activa o Suspendida. Como cliente solo miras; no creas cuentas aquí.",
    )
    pdf.tip(
        "Estados que importan",
        "Activa / Aprobada = puedes ponerle saldo.\n"
        "Suspendida = no le pongas saldo nuevo, pero sí puedes "
        "sacar o pasar el dinero que le queda (ver sección 4).",
        "warn",
    )

    # —— Asignar ——
    pdf.add_page()
    pdf.h1("3. Cómo pasarle saldo a una cuenta")
    pdf.lead(
        "Cuando ya tienes dinero en la cartera, lo envías a la cuenta "
        "TikTok donde quieres anunciar. Es 1 a 1: si envías $50, la cuenta recibe $50."
    )
    pdf.step(
        "1",
        "Ve a Pagos → Asignar",
        "Elige una cuenta Activa/Aprobada de la lista.",
    )
    pdf.step(
        "2",
        "Escribe el monto y confirma",
        "El TikTok suele pedir un mínimo (por ejemplo $10). "
        "Confirma y listo: el presupuesto queda en esa cuenta.",
    )
    pdf.tip(
        "Importante",
        "Lo que ya está dentro de una cuenta TikTok no se “vuelve a asignar” "
        "desde la cartera. Si quieres moverlo, usa Transferir o Recuperar.",
        "warn",
    )

    # —— Suspendida ——
    pdf.h1("4. Si te suspenden una cuenta")
    pdf.lead(
        "No pierdes el saldo que no gastaste. Puedes pasarlo a otra cuenta "
        "tuya o devolverlo a la cartera — sin esperar al soporte."
    )

    pdf.set_font("Body", "B", 12)
    pdf.set_text_color(*ORANGE)
    pdf.cell(0, 7, "Opción A — Pasar saldo a otra cuenta", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.step(
        "1",
        "En Pagos, abre la cuenta suspendida",
        "Busca la acción Transferir a otra cuenta.",
    )
    pdf.step(
        "2",
        "Elige origen y destino",
        "Origen = la suspendida. Destino = otra cuenta tuya que esté activa. "
        "Solo se mueve lo que no gastaste.",
    )
    pdf.step(
        "3",
        "Confirma el monto",
        "En segundos el saldo queda en la cuenta activa y puedes seguir anunciando.",
    )

    pdf.set_font("Body", "B", 12)
    pdf.set_text_color(*ORANGE)
    pdf.cell(0, 7, "Opción B — Devolver saldo a tu cartera", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)
    pdf.step(
        "1",
        "Toca Recuperar para la cartera",
        "En la misma fila de la cuenta (también si está suspendida).",
    )
    pdf.step(
        "2",
        "Indica cuánto recuperar",
        "Ese dinero vuelve a tu cartera Holistic. Luego puedes asignarlo "
        "a otra cuenta aprobada.",
    )
    pdf.tip(
        "Consejo",
        "Si tienes otra cuenta activa y quieres seguir gastando ya, "
        "usa Transferir. Si aún no sabes a dónde enviarlo, usa Recuperar.",
        "ok",
    )

    # —— Útiles ——
    pdf.add_page()
    pdf.h1("5. Otras cosas útiles")
    pdf.set_font("Body", "B", 11)
    pdf.set_text_color(*CHARCOAL)
    pdf.cell(0, 7, "Saldo estimado", new_x="LMARGIN", new_y="NEXT")
    pdf.lead(
        "No es el dinero de tu tarjeta ni el cash del TikTok. "
        "Es un resumen: lo que pagaste menos lo que gastaste y las fees. "
        "Si sale negativo, tienes deuda neta; si sale positivo, vas adelantado."
    )

    pdf.set_font("Body", "B", 11)
    pdf.set_text_color(*CHARCOAL)
    pdf.cell(0, 7, "Orden recomendado la primera vez", new_x="LMARGIN", new_y="NEXT")
    pdf.bullet("Entra con tu correo (te llega un código).")
    pdf.bullet("Mira Resumo / Inicio para ver tu saldo.")
    pdf.bullet("Recarga la cartera.")
    pdf.bullet("Asigna saldo a una cuenta Activa.")
    pdf.bullet("Anuncia en TikTok Ads Manager con esa cuenta.")
    pdf.ln(2)

    pdf.set_font("Body", "B", 11)
    pdf.set_text_color(*CHARCOAL)
    pdf.cell(0, 7, "Si algo falla", new_x="LMARGIN", new_y="NEXT")
    pdf.bullet("El pago no aparece: espera un poco o revisa el comprobante.")
    pdf.bullet("No puedes asignar: confirma que la cuenta esté Activa y que haya saldo en la cartera.")
    pdf.bullet("Cuenta suspendida: Transfiere o Recupera; no intentes asignar de nuevo ahí.")
    pdf.ln(2)

    pdf.h1("6. ¿Necesitas ayuda?")
    pdf.lead(
        "Abre Soporte Holistic en el menú. Es un chat con una persona del equipo "
        "(no un bot). Puedes pegar capturas (Ctrl+V) o adjuntar fotos y PDF."
    )
    pdf.tip(
        "Para que te respondan más rápido",
        "Escribe: qué cuenta (nombre o ID), qué monto, qué estabas haciendo "
        "y una captura del error. La meta es responder en minutos en horario de atención.",
        "ok",
    )

    pdf.ln(4)
    pdf.set_fill_color(*SOFT)
    box_w = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.rect(pdf.l_margin, pdf.get_y(), box_w, 38, "F")
    y = pdf.get_y() + 5
    pdf.set_xy(pdf.l_margin + 6, y)
    pdf.set_font("Body", "B", 12)
    pdf.set_text_color(*ORANGE)
    pdf.cell(0, 6, "Resumen en 4 líneas", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(pdf.l_margin + 6)
    pdf.set_font("Body", "", 10.5)
    pdf.set_text_color(*INK)
    pdf.multi_cell(
        box_w - 12,
        5.5,
        "1) Recargas la cartera en Pagos.\n"
        "2) Asignas a una cuenta Activa.\n"
        "3) Si suspenden una cuenta: Transferir o Recuperar.\n"
        "4) Dudas: chat de Soporte Holistic.",
    )

    OUT_DOCS.parent.mkdir(parents=True, exist_ok=True)
    OUT_ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT_DOCS))
    pdf.output(str(OUT_ARTIFACT))
    print(f"Wrote {OUT_DOCS} ({OUT_DOCS.stat().st_size} bytes)")
    print(f"Wrote {OUT_ARTIFACT}")


if __name__ == "__main__":
    build()
