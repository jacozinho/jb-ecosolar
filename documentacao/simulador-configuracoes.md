# Configuracoes do simulador

Este documento mostra como os valores definidos no painel administrativo sao aplicados na simulacao exibida ao cliente.

```mermaid
flowchart LR
  A[Administrador configura parametros] --> B[API: configuracoes]
  B --> C[Simulador do cliente]
  D[Valor da conta de energia] --> C

  C --> E[Consumo estimado]
  C --> F[Potencia estimada]
  C --> G[Economia mensal]
  C --> J[Investimento estimado]
  J --> K[Opcoes de pagamento e parcela estimada]
  G --> H[Economia anual]
  H --> I[Economia acumulada]
```

## Formulas aplicadas

| Resultado exibido | Formula | Configuracoes usadas |
| --- | --- | --- |
| Consumo estimado | `valor da conta / tarifa media` | Tarifa media de energia |
| Potencia estimada | `consumo / ((producao media / 12) * fator de perdas)` | Producao media por kWp e fator de perdas |
| Economia mensal | `valor da conta * percentual de economia` | Percentual de economia estimada |
| Economia anual | `economia mensal * 12` | Percentual de economia estimada |
| Economia acumulada | `economia anual * vida util` | Vida util |
| Investimento estimado | `potencia estimada * custo por kWp` | Custo estimado por kWp |
| Valor de pagamento estimado | `investimento estimado / quantidade de parcelas` (ou valor integral à vista) | Opção enviada na simulação (à vista, 12, 24 ou 36), sem juros ou taxas |

## Exemplo

Para uma conta mensal de R$ 520,00 e os valores padrao:

| Configuracao | Valor |
| --- | ---: |
| Tarifa media de energia | R$ 1,13 |
| Producao media por kWp | 1.400 kWh/ano |
| Fator de perdas | 0,25 |
| Percentual de economia estimada | 35% |
| Vida util | 25 anos |

O simulador calcula:

- Consumo estimado: `520 / 1,13 = 460 kWh`
- Potencia estimada: `460 / ((1.400 / 12) * 0,25) = 15,77 kWp`
- Investimento estimado: `15,77 * R$ 4.200,00 = R$ 66.234,00`
- Economia mensal: `520 * 0,35 = R$ 182,00`
- Economia anual: `182 * 12 = R$ 2.184,00`
- Economia acumulada: `2.184 * 25 = R$ 54.600,00`

## Custo estimado por kWp

O custo por kWp e usado para estimar o investimento do projeto. As opções de pagamento exibidas dividem esse valor em 12, 24 ou 36 parcelas sem juros ou taxas, apenas como referência matemática; não representam condições de crédito ou uma proposta comercial.
