#!/usr/bin/env python3
"""Gera o PDF em português: Como funciona o Ads Holistic."""

from __future__ import annotations

from pathlib import Path

from fpdf import FPDF

OUT_DOCS = Path("/workspace/docs/como-funciona-ads-holistic-pt.pdf")
OUT_ARTIFACT = Path("/opt/cursor/artifacts/como-funciona-ads-holistic-pt.pdf")

FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
FONT_SERIF_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"

ORANGE = (232, 93, 36)
CHARCOAL = (28, 28, 30)
INK = (45, 45, 48)
MUTED = (90, 90, 95)
LINE = (220, 214, 208)
ACCENT_SOFT = (255, 241, 232)


class GuidePDF(FPDF):
    def __init__(self) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.add_font("Body", "", FONT_REG)
        self.add_font("Body", "B", FONT_BOLD)
        self.add_font("Display", "", FONT_SERIF)
        self.add_font("Display", "B", FONT_SERIF_BOLD)
        self.set_auto_page_break(auto=True, margin=20)
        self.set_margins(18, 20, 18)

    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_y(12)
        self.set_font("Body", "B", 9)
        self.set_text_color(*ORANGE)
        self.cell(0, 5, "Ads Holistic", align="L")
        self.set_font("Body", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 5, "Guia do produto  ·  Português", align="R", new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*LINE)
        self.set_line_width(0.3)
        self.line(self.l_margin, 18, self.w - self.r_margin, 18)
        self.set_y(24)

    def footer(self) -> None:
        self.set_y(-16)
        self.set_draw_color(*LINE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.set_y(-12)
        self.set_font("Body", "", 8)
        self.set_text_color(*MUTED)
        self.cell(
            0,
            8,
            f"Holistic Marketing  ·  adsholistic.com  ·  {self.page_no()}",
            align="C",
        )

    def cover(self) -> None:
        self.add_page()
        self.set_fill_color(*ORANGE)
        self.rect(0, 0, self.w, 8, "F")
        self.set_fill_color(*CHARCOAL)
        self.rect(0, 8, self.w, 78, "F")

        self.set_y(30)
        self.set_font("Body", "", 11)
        self.set_text_color(255, 255, 255)
        self.cell(0, 7, "HOLISTIC MARKETING", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Display", "B", 34)
        self.cell(0, 16, "Ads Holistic", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("Body", "", 13)
        self.set_text_color(255, 220, 200)
        self.cell(0, 8, "Como funciona a plataforma", align="C", new_x="LMARGIN", new_y="NEXT")

        self.set_y(112)
        self.set_font("Display", "B", 16)
        self.set_text_color(*CHARCOAL)
        self.multi_cell(
            0,
            8,
            "Guia em português para clientes e equipe:\ncarteira, taxas, contas TikTok e suporte.",
            align="C",
        )

        box_x = self.l_margin
        box_w = self.w - self.l_margin - self.r_margin
        self.set_fill_color(*ACCENT_SOFT)
        self.set_draw_color(*ORANGE)
        self.set_line_width(0.5)
        self.rect(box_x, 150, box_w, 48, "FD")
        self.set_xy(box_x + 8, 156)
        self.set_font("Body", "B", 11)
        self.set_text_color(*ORANGE)
        self.cell(0, 6, "Em uma frase", new_x="LMARGIN", new_y="NEXT")
        self.set_x(box_x + 8)
        self.set_font("Body", "", 11)
        self.set_text_color(*INK)
        self.multi_cell(
            box_w - 16,
            6,
            "Ads Holistic é o painel onde você recarrega a carteira, "
            "atribui saldo às contas TikTok e acompanha gastos — "
            "operado por Holistic Marketing em adsholistic.com.",
        )

        self.set_y(230)
        self.set_font("Body", "", 10)
        self.set_text_color(*MUTED)
        self.cell(0, 6, "Versão para leitura  ·  2026", align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(
            0,
            6,
            "Produto: Ads Holistic  ·  Empresa: Holistic Marketing",
            align="C",
        )

    def h1(self, text: str) -> None:
        self.ln(3)
        self.set_font("Display", "B", 15)
        self.set_text_color(*CHARCOAL)
        self.cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*ORANGE)
        self.set_line_width(0.9)
        y = self.get_y()
        self.line(self.l_margin, y, self.l_margin + 26, y)
        self.ln(5)

    def h2(self, text: str) -> None:
        self.ln(2)
        self.set_font("Body", "B", 11)
        self.set_text_color(*ORANGE)
        self.cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def body(self, text: str) -> None:
        self.set_font("Body", "", 10.5)
        self.set_text_color(*INK)
        self.multi_cell(0, 5.8, text)
        self.ln(2)

    def bullet(self, title: str, text: str) -> None:
        self.set_font("Body", "B", 10.5)
        self.set_text_color(*CHARCOAL)
        self.cell(4, 5.8, "•")
        self.cell(0, 5.8, title, new_x="LMARGIN", new_y="NEXT")
        self.set_x(self.l_margin + 4)
        self.set_font("Body", "", 10)
        self.set_text_color(*INK)
        self.multi_cell(0, 5.5, text)
        self.ln(1.5)

    def step(self, number: str, title: str, text: str) -> None:
        x = self.l_margin
        y = self.get_y()
        if y > 255:
            self.add_page()
            y = self.get_y()
        self.set_fill_color(*ORANGE)
        self.ellipse(x, y, 8, 8, "F")
        self.set_xy(x, y + 1.3)
        self.set_font("Body", "B", 9)
        self.set_text_color(255, 255, 255)
        self.cell(8, 5.5, number, align="C")
        self.set_xy(x + 11, y)
        self.set_font("Body", "B", 11)
        self.set_text_color(*CHARCOAL)
        self.cell(0, 7, title, new_x="LMARGIN", new_y="NEXT")
        self.set_x(x + 11)
        self.set_font("Body", "", 10)
        self.set_text_color(*INK)
        self.multi_cell(0, 5.5, text)
        self.ln(3)

    def callout(self, title: str, text: str) -> None:
        self.ln(2)
        start_y = self.get_y()
        x = self.l_margin
        w = self.w - self.l_margin - self.r_margin
        self.set_xy(x + 6, start_y + 2)
        self.set_font("Body", "B", 10)
        self.set_text_color(*ORANGE)
        self.cell(0, 5, title, new_x="LMARGIN", new_y="NEXT")
        self.set_x(x + 6)
        self.set_font("Body", "", 10)
        self.set_text_color(*INK)
        self.multi_cell(w - 12, 5.4, text)
        after = self.get_y()
        height = after - start_y + 2
        self.set_draw_color(*ORANGE)
        self.set_line_width(1.4)
        self.line(x, start_y, x, start_y + height)
        self.set_line_width(0.3)
        self.ln(4)


def build() -> None:
    pdf = GuidePDF()
    pdf.cover()

    pdf.add_page()
    pdf.h1("1. O que é o Ads Holistic?")
    pdf.body(
        "Ads Holistic é a plataforma (produto) de Holistic Marketing. "
        "Nela o anunciante gerencia contas TikTok Ads, recarrega uma carteira "
        "central em USD, atribui orçamento aos advertisers e acompanha gastos, "
        "taxas e suporte — tudo em adsholistic.com."
    )
    pdf.body(
        "Holistic Marketing é a empresa que opera o sistema, detém a marca e o "
        "suporte. Ads Holistic é o nome do produto que o cliente usa no dia a dia."
    )
    pdf.bullet(
        "Ads Holistic (produto)",
        "Painel web: Resumo, Contas de ads, Pagamentos, Criativos, Pixels, "
        "Profit e chat de suporte.",
    )
    pdf.bullet(
        "Holistic Marketing (empresa)",
        "Quem presta o serviço, confirma pagamentos, opera Business Centers "
        "TikTok e atende o cliente.",
    )
    pdf.bullet(
        "Hecom Club (CRM interno)",
        "Fonte dos dados de cliente, fee contratada, cobranças e vínculo com "
        "contas TikTok. O painel do cliente lê esses dados sem misturar outros anunciantes.",
    )

    pdf.h1("2. Para quem é?")
    pdf.body(
        "Para anunciantes e ecommerces que compram mídia no TikTok através da "
        "Holistic: precisam de contas aprovadas, recargas fáceis (cartão, Yape "
        "em soles, transferência) e um único lugar para ver saldo, dívida "
        "estimada e falar com o time."
    )
    pdf.bullet(
        "Cliente (self-serve)",
        "Entra com e-mail (OTP), vê só os próprios dados e recarrega / atribui "
        "saldo sem passar pelo CRM de outros clientes.",
    )
    pdf.bullet(
        "Equipe / gerente",
        "Opera recargas pelo Business Manager, aprova depósitos manuais e "
        "responde no chat de suporte.",
    )

    pdf.h1("3. Como funciona o dinheiro")
    pdf.body(
        "O saldo não vai direto do cartão para o TikTok. Ele passa pela "
        "carteira Holistic e só depois é atribuído a uma conta de ads."
    )
    pdf.step(
        "1",
        "Recarregar a carteira",
        "Em Pagamentos, escolha o valor líquido em USD que quer receber na "
        "carteira e o método (Stripe, Yape/Cobrana em soles, USDT ou "
        "transferência). A taxa Holistic é somada à cobrança.",
    )
    pdf.step(
        "2",
        "Confirmação do pagamento",
        "Quando o gateway ou a revisão interna confirma o pagamento, o ledger "
        "credita o líquido na carteira Holistic. Só a partir daí o saldo "
        "pode ser atribuído.",
    )
    pdf.step(
        "3",
        "Atribuir a uma conta TikTok",
        "Na seção Atribuir, escolha uma conta Aprovada/Ativa e o valor. "
        "O movimento é 1 a 1: se atribuir $100, o advertiser TikTok recebe $100.",
    )
    pdf.step(
        "4",
        "Gastar em campanhas",
        "O orçamento fica disponível no TikTok Ads Manager. O gasto é "
        "sincronizado de volta e aparece no histórico junto com a fee.",
    )
    pdf.callout(
        "Importante",
        "O saldo já colocado numa conta TikTok não volta sozinho para a "
        "carteira só porque você quer atribuir de novo. Para reutilizar, "
        "use Recuperar para a carteira ou Transferir entre contas.",
    )

    pdf.add_page()
    pdf.h1("4. A taxa (fee) Holistic")
    pdf.body(
        "Cada cliente tem uma porcentagem Holistic definida no Hecom "
        "(exemplo típico: 10%). Em depósitos você pede um valor líquido; "
        "o sistema cobra líquido + fee."
    )
    pdf.bullet(
        "Exemplo",
        "Quer $100 na carteira com fee de 10%. Cobrança bruta = $110. "
        "A carteira recebe $100 para atribuir aos ads.",
    )
    pdf.bullet(
        "No histórico",
        "A fee também entra no “cargo” junto com o gasto de ads, para "
        "refletir o custo real do serviço.",
    )
    pdf.bullet(
        "Saldo estimado",
        "Não é dinheiro no TikTok nem no cartão. É a leitura do CRM Hecom: "
        "cobranças menos (gastos + fees). Positivo = pagou mais do que "
        "gastou; negativo = dívida líquida.",
    )

    pdf.h1("5. Contas de ads TikTok")
    pdf.body(
        "No menu Contas de ads você vê advertisers (nome + ID), status "
        "(Ativa / Suspensa), fee e fuso. Como cliente a tela é somente "
        "leitura: não cria nem edita contas ali."
    )
    pdf.bullet(
        "Aprovadas / ativas",
        "Podem receber atribuição de saldo da carteira ou recarga pelo BM "
        "(operação de gerente).",
    )
    pdf.bullet(
        "Suspensas",
        "Não recebem nova atribuição. Ainda é possível transferir saldo "
        "recuperável ou devolver fundos à carteira Holistic.",
    )
    pdf.bullet(
        "Business Centers",
        "A Holistic opera contas via BMs TikTok (cash ou crédito). O painel "
        "esconde essa complexidade e mostra o que o cliente precisa: "
        "saldo, status e ações.",
    )

    pdf.h1("6. Formas de recarregar")
    pdf.bullet(
        "Stripe (cartão)",
        "Checkout seguro. Informe o líquido desejado; fee Holistic (+ "
        "eventual taxa do gateway) entra no total cobrado.",
    )
    pdf.bullet(
        "Yape / Plin via Cobrana (soles)",
        "Você informa o USD que quer na carteira; a Cobrana gera código e "
        "valor em soles. No Yape o serviço aparece com o nome da Cobrana, "
        "não como “Holistic”. Ao confirmar, o crédito cai na carteira.",
    )
    pdf.bullet(
        "USDT / transferência manual",
        "Anexe comprovante ou TxID. Um gerente revisa e aprova; só então "
        "o ledger credita a carteira.",
    )

    pdf.add_page()
    pdf.h1("7. Por onde começar no painel")
    pdf.body(
        "Após o login (OTP por e-mail), o menu esquerdo mostra o contexto "
        "do cliente: só os seus dados."
    )
    pdf.bullet("Resumo (Overview)", "Visão geral de saldo, contas e atalhos.")
    pdf.bullet("Contas de ads", "Lista de advertisers TikTok e status.")
    pdf.bullet(
        "Pagamentos",
        "Recarregar carteira, atribuir saldo, transferir, recuperar e ver histórico.",
    )
    pdf.bullet(
        "Pixels / Criativos / Profit",
        "Ferramentas para medir e otimizar (pixel TikTok, criativos, lucro "
        "quando a loja está conectada).",
    )
    pdf.bullet(
        "Suporte Holistic",
        "Chat humano com a equipe. Cole capturas (Ctrl+V) ou anexe PDF/fotos. "
        "Meta operacional: resposta em até 30 minutos no horário de atendimento.",
    )

    pdf.h1("8. Mapa do fluxo (resumo)")
    pdf.body(
        "Pagamento (Stripe / Yape / manual)\n"
        "        ↓\n"
        "Confirmação (webhook ou aprovação)\n"
        "        ↓\n"
        "Carteira Holistic (USD líquido)\n"
        "        ↓\n"
        "Atribuição a conta TikTok aprovada\n"
        "        ↓\n"
        "Campanhas no TikTok Ads  →  gasto sincronizado + fee no histórico"
    )

    pdf.h1("9. Perguntas frequentes")
    pdf.h2("O saldo da carteira é crédito TikTok?")
    pdf.body(
        "Não. É saldo Holistic disponível para atribuir. Só depois da "
        "atribuição o dinheiro (ou orçamento) aparece na conta TikTok."
    )
    pdf.h2("Posso atribuir a qualquer conta?")
    pdf.body(
        "Só contas ativas/aprovadas do seu vínculo. Suspensas não entram na "
        "lista de atribuição."
    )
    pdf.h2("O que já está no TikTok pode ser atribuído de novo?")
    pdf.body(
        "Não. “Já nesta conta” não se move outra vez pela carteira. Use "
        "transferência entre contas ou recuperar para a carteira."
    )
    pdf.h2("Como falo com alguém?")
    pdf.body(
        "Abra Suporte Holistic no menu. Não é bot: um gerente responde no "
        "mesmo chat, com atualização automática das mensagens."
    )

    pdf.h1("10. Resumo final")
    pdf.body(
        "1) Ads Holistic é o produto; Holistic Marketing é a empresa.\n"
        "2) Você recarrega a carteira (líquido + fee).\n"
        "3) Atribui 1 a 1 a contas TikTok aprovadas.\n"
        "4) Gasta em campanhas; o painel mostra saldo estimado, gastos e suporte.\n"
        "5) Dúvidas: chat de suporte em adsholistic.com."
    )
    pdf.ln(4)
    pdf.set_font("Body", "", 9.5)
    pdf.set_text_color(*MUTED)
    pdf.multi_cell(
        0,
        5.3,
        "Documento de apoio comercial/operacional. Detalhes de fee, métodos de "
        "pagamento e status de contas podem variar por cliente conforme o "
        "contrato no Hecom Club.",
    )

    OUT_DOCS.parent.mkdir(parents=True, exist_ok=True)
    OUT_ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT_DOCS))
    pdf.output(str(OUT_ARTIFACT))
    print(f"Wrote {OUT_DOCS} ({OUT_DOCS.stat().st_size} bytes)")
    print(f"Wrote {OUT_ARTIFACT} ({OUT_ARTIFACT.stat().st_size} bytes)")


if __name__ == "__main__":
    build()
