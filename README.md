# Lucky 38 Blackjack

Um blackjack simples para navegador, que montei misturando duas referências de que gosto muito: a cara do **Solitaire clássico da Microsoft** (janela, menus, estatísticas, escolha de baralho) e o clima do **Lucky 38 de Fallout: New Vegas**, aquele cassino clássico de Vegas com letreiro neon, lâmpadas de marquise e muito preto e vermelho.

É um projeto pessoal, feito para rodar localmente, sem build e sem dependências.

## Como rodar

O jeito mais simples é abrir o `index.html` direto no navegador.

Se preferir servir por HTTP:

```bash
python3 -m http.server 8738
```

Depois é só acessar http://localhost:8738.

## O que tem no jogo

- **Regras:** Hit, Stand e Double. O dealer para no 17 e blackjack paga 3:2. Começo com $1,000 e, se zerar, a casa repõe.
- **Apostas com fichas:** fichas de $10, $50, $100 e $500, com opção de desfazer a última ficha.
- **Menus no estilo Solitaire:**
  - *Jogo:* Novo jogo, Desfazer, Dica, Estatísticas, Baralho e Opções.
  - *Ajuda:* regras, atalhos e uma tela "Sobre".
- **Dica:** sugere a jogada pela estratégia básica (simplificada) e faz o botão certo brilhar.
- **Estatísticas:** mãos jogadas, vitórias, derrotas, empates, blackjacks, maior saldo e sequências.
- **Baralho:** quatro versos de carta (Lucky 38, Noir, Neon Strip e Marfim).
- **Opções:** som, animações rápidas e mostrar tempo.
- **HUD:** saldo animado com indicação de ganho/perda, aposta, mãos e tempo.
- **Croupier:** um mascote que muda de expressão e de pose conforme a jogada e comenta em balões de fala.
- **Sons:** todos sintetizados com Web Audio, sem nenhum arquivo de áudio.
- **Atalhos:** `1`–`4` fichas, `Enter` distribui, `H`/`S`/`D` Hit/Stand/Double, `T` dica, `Ctrl+Z` desfazer, `M` som, `F1` ajuda, `F2` novo jogo.

As preferências e as estatísticas ficam salvas no `localStorage` do navegador. O saldo volta para $1,000 ao recarregar, de propósito.

## Estrutura

```
lucky38-blackjack/
├── index.html   # layout: barra de menus, letreiro, mesa, croupier (SVG), HUD e diálogos
├── style.css    # tema preto/vermelho, neon, marquise, cartas, croupier e responsividade
├── game.js      # baralho, regras, fluxo da rodada, dica, sons, estatísticas e reações do croupier
└── README.md
```

Algumas decisões que tomei:

- **HTML, CSS e JavaScript puros:** é um jogo pequeno, então não quis framework nem etapa de build.
- **Recursos nativos do navegador:** `<dialog>` para as janelas, `popover` para os menus, Web Animations API para distribuir as cartas e Web Audio para os sons.
- **Cartas em CSS:** feitas com CSS e caracteres Unicode, sem imagens. O verso muda por variáveis CSS.
- **Croupier em SVG inline:** cada expressão é um conjunto de partes (sobrancelhas, olhos, boca, braço, extras) que o `game.js` mostra ou esconde.
- **Layout:** no desktop a mesa é um grid de duas colunas, com o croupier à esquerda e as cartas à direita. No celular ele vai para cima das cartas.

## Como usei IA neste projeto

Desenvolvi o projeto com o **Claude Code** (Anthropic) como assistente de programação. Meu papel foi definir a ideia e o estilo visual, mandar as imagens de referência, escolher as preferências em cada etapa e testar o resultado. Também pedi ajustes até ficar do jeito que eu queria.

O processo foi mais ou menos este:

1. **Conceito:** descrevi o que queria (blackjack com cara de Solitaire e clima de New Vegas, em preto e vermelho) e mandei imagens do Lucky 38 como referência.
2. **Escolhas:** a IA propôs uma estrutura e me perguntou as preferências. Escolhi fichas em dólar, só as regras básicas, animação de distribuir cartas e sons.
3. **Primeira versão:** a IA gerou o código, e o jogo foi testado no navegador.
4. **HUD e menus:** pedi uma HUD mais moderna e menus e funções parecidos com os do Solitaire.
5. **Croupier:** pedi um croupier inspirado no Vault Boy que mudasse de expressão. Depois pedi para refazer, maior e mais parecido com a referência.

Todo o código deste repositório foi gerado pela IA a partir das minhas instruções, e eu revisei e testei o resultado.

## Sobre o croupier (provisório)

**O boneco usado hoje como croupier é provisório e foi desenhado pela IA**, em SVG, inspirado no estilo do Vault Boy. Ele serve para validar a ideia de um mascote que reage ao jogo. Minha intenção é trocá-lo por uma arte própria, mantendo o mesmo sistema de expressões.

## Aviso

Projeto de fã, sem fins comerciais. Fallout, New Vegas, Lucky 38 e Vault Boy são marcas da Bethesda Softworks/ZeniMax, e este projeto não tem nenhuma ligação com elas. Solitaire é marca da Microsoft.
