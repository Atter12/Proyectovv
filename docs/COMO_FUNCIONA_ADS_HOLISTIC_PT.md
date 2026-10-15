# Como funciona o Ads Holistic (PT)

Guia em português do produto. PDF gerado com:

```bash
python3 scripts/generate-ads-holistic-guide-pt.py
```

Arquivo: [`como-funciona-ads-holistic-pt.pdf`](./como-funciona-ads-holistic-pt.pdf)

## Em uma frase

**Ads Holistic** é o painel onde o cliente recarrega a carteira, atribui saldo às contas TikTok e acompanha gastos — operado por **Holistic Marketing** em [adsholistic.com](https://www.adsholistic.com).

## Empresa vs produto

| Nome | Papel |
|---|---|
| **Holistic Marketing** | Empresa: marca, suporte, operação TikTok BM |
| **Ads Holistic** | Produto: plataforma self-serve do cliente |
| **Hecom Club** | CRM interno: fee, cobranças, vínculo de contas |

## Fluxo do dinheiro

1. **Recarregar** a carteira Holistic (USD líquido + fee).
2. **Confirmação** via gateway (Stripe / Cobrana) ou aprovação manual.
3. **Atribuir** 1 a 1 a uma conta TikTok aprovada.
4. **Gastar** em campanhas; gasto e fee entram no histórico.

Métodos típicos: Stripe (cartão), Yape/Plin via Cobrana (soles), USDT ou transferência com comprovante.

## Fee

Percentual por cliente no Hecom (ex.: 10%). Pedir $100 líquido com 10% → cobrança $110; carteira recebe $100.

**Saldo estimado** ≠ dinheiro no TikTok: é cobranças Hecom − (gastos + fees).

## Contas TikTok

- Ativas/aprovadas: podem receber atribuição.
- Suspensas: sem nova atribuição; dá para transferir ou recuperar saldo.
- Cliente: visão somente leitura das contas.

## Menu do cliente

Resumo → Contas de ads → Pagamentos → Pixels / Criativos / Profit → Suporte Holistic (chat humano).
