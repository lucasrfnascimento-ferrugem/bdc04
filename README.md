# Bom D' Copus — Gestão do Time

App web (HTML + JS puro) para gerenciar o time: adversários, campos, atletas,
jogos, escalações, gols/assistências e avaliações pós-jogo — com dashboards,
ranking de artilharia e escalação ideal calculada automaticamente.

Os dados ficam salvos no **Firebase Firestore**, então tudo que você (ou
qualquer pessoa autorizada) cadastrar fica sincronizado em tempo real e
acessível de qualquer dispositivo, mesmo com o app hospedado como site
estático no GitHub Pages.

## 1. Criar o projeto no Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com) e crie um projeto (pode ser gratuito, plano Spark).
2. No menu lateral, vá em **Build → Authentication** → aba **Sign-in method** → ative o provedor **Google**.
3. Vá em **Build → Firestore Database** → **Criar banco de dados** → escolha o modo **produção** e a região mais próxima (ex: `southamerica-east1`).
4. Vá em **Configurações do projeto** (ícone de engrenagem) → aba **Geral** → seção **Seus apps** → clique no ícone **`</>`** (Web) para registrar um app web.
5. Copie o objeto `firebaseConfig` que aparece na tela.

## 2. Configurar o app

Abra `js/firebase-config.js` e:

- Cole os valores copiados no passo anterior em `firebaseConfig`.
- (Recomendado) Preencha `ALLOWED_EMAILS` com os e-mails Google de quem pode
  acessar o app (você, o técnico, etc). Deixe `[]` para liberar qualquer
  conta Google — não recomendado, pois qualquer pessoa poderia entrar.

```js
export const ALLOWED_EMAILS = [
  "seuemail@gmail.com",
  "outrapessoa@gmail.com",
];
```

## 3. Regras de segurança do Firestore

A lista `ALLOWED_EMAILS` só esconde os botões no navegador — a segurança de
verdade é configurada nas regras do Firestore. Vá em **Firestore Database →
Regras** e cole (ajustando a lista de e-mails):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function emailPermitido() {
      return request.auth != null && request.auth.token.email in [
        "seuemail@gmail.com",
        "outrapessoa@gmail.com"
      ];
    }

    // Leitura pública — alimenta Dashboard, Ranking, Escalação ideal e
    // Histórico sem exigir login. Escrita continua restrita aos e-mails
    // autorizados (telas de Jogos, Atletas, Adversários, Campos).
    match /adversarios/{id} {
      allow read: if true;
      allow write: if emailPermitido();
    }
    match /campos/{id} {
      allow read: if true;
      allow write: if emailPermitido();
    }
    match /atletas/{id} {
      allow read: if true;
      allow write: if emailPermitido();
    }
    match /jogos/{id} {
      allow read: if true;
      allow write: if emailPermitido();
    }

    // CPF e data de nascimento ficam numa coleção à parte, com o mesmo id
    // do atleta, e essa coleção NÃO é pública — só leitura/escrita para
    // e-mails autorizados.
    match /atletas_privado/{id} {
      allow read, write: if emailPermitido();
    }
  }
}
```

Clique em **Publicar**. Sem isso, as telas de Jogos/Atletas/Adversários/
Campos ficam com a leitura/escrita liberada para qualquer pessoa, mesmo que
o app esconda os botões no navegador.

> ℹ️ As coleções `adversarios`, `campos`, `atletas` e `jogos` ficam com
> **leitura pública** de propósito — é assim que Dashboard, Ranking,
> Escalação ideal e Histórico funcionam sem exigir login. Só a **escrita**
> (criar/editar/excluir) e a coleção `atletas_privado` (CPF, nascimento)
> exigem estar logado com um e-mail da lista `ALLOWED_EMAILS`.

## 4. Testar localmente

Como o app usa módulos ES (`type="module"`), abrir o `index.html` direto
pelo navegador (`file://`) não funciona — é preciso servir por HTTP. Duas
opções simples:

```bash
# Opção 1 — Python (já vem instalado na maioria dos sistemas)
python3 -m http.server 8000

# Opção 2 — Node
npx serve .
```

Depois acesse `http://localhost:8000`.

## 5. Publicar no GitHub Pages

```bash
git init
git add .
git commit -m "Bom D' Copus — app de gestão do time"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source** → selecione a branch `main` e a
pasta `/ (root)` → **Save**. Em alguns minutos o app estará disponível em
`https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`.

> ⚠️ O arquivo `js/firebase-config.js` fica público no repositório (é assim
> mesmo para apps Firebase client-side — a chave de API não é secreta). Quem
> protege seus dados são as **regras do Firestore** do passo 3, não o
> segredo da config. Por isso não pule aquele passo.

## Estrutura do projeto

```
index.html              shell do app (sidebar desktop / barra inferior mobile + área de conteúdo)
assets/logo-bomdcopus.png  escudo do time (usado na sidebar, header mobile e tela de acesso restrito)
css/style.css           design system (cores, tipografia, componentes)
js/firebase-config.js   chaves do seu projeto Firebase + e-mails autorizados
js/auth.js              login com Google / logout
js/db.js                funções genéricas de leitura/escrita no Firestore
js/stats.js             cálculos: médias, ranking, contagens
js/utils.js             helpers de UI (modal, toast, formatação)
js/app.js               roteamento (por #hash), controle de acesso e ligação entre views e dados
js/views/*.js           uma view por tela (dashboard, jogos, cadastros...)
```

## Navegação pública x protegida

- **Públicas (sem login):** Dashboard, Ranking, Escalação ideal e Histórico.
  Qualquer pessoa com o link consegue abrir e ver os dados.
- **Protegidas (exige login com e-mail autorizado):** Jogos, Atletas,
  Adversários e Campos. Sem login, esses links somem do menu e, se alguém
  tentar acessar direto pela URL (`#jogos`, `#atletas`...), o app mostra uma
  tela de "Acesso restrito" com um botão para entrar com Google.
- No celular, o menu vira uma barra fixa de ícones no rodapé; no desktop
  continua como uma barra lateral.

## Modelo de dados (Firestore)

- **`adversarios`**: `{ nome, cidade, observacoes }`
- **`campos`**: `{ nome, endereco, tipo, observacoes }`
- **`atletas`**: `{ nome, posicao, numero, ativo, observacoes }` (pública)
- **`atletas_privado`**: `{ cpf, dataNascimento }`, documento com o **mesmo id**
  do atleta correspondente — coleção não pública, só leitura/escrita para
  e-mails autorizados. Ambos os campos são opcionais.
- **`jogos`**: documento central de cada partida —
  `{ data, status, adversarioId, campoId, placarNos, placarAdversario,
  escalacaoInicial: [{ atletaId, posicao }...], escalacaoFinal: [{ atletaId, posicao }...],
  golsAssistencias: [{ atletaGolId, atletaAssistId, minuto }],
  avaliacoesJogadores: { [atletaId]: { nota, obs } },
  avaliacaoCampo: { nota, obs }, avaliacaoAdversario: { nota, obs },
  observacoes }`

  `posicao` em `escalacaoInicial`/`escalacaoFinal` é a posição que o atleta
  jogou **naquela partida específica**, não a posição de cadastro — é ela que
  alimenta a tela de Escalação ideal, já que um mesmo atleta pode jogar de
  posições diferentes em jogos diferentes. Jogos criados antes desse recurso
  existir têm esses campos como array simples de ids (sem posição); o app
  continua lendo esse formato antigo normalmente, só sem separar por posição.

Tudo relacionado a uma partida fica dentro do próprio documento do jogo —
mais simples de consultar e de fazer backup/export manual pelo console do
Firebase, se precisar um dia.

## Como usar

1. Cadastre primeiro **Adversários**, **Campos** e **Atletas**.
2. Crie um **Jogo** (pode ser antes ou depois de acontecer — use o status
   *Agendado*/*Realizado*).
3. Dentro do jogo: defina a **escalação inicial**, depois a **final**,
   registre os **gols e assistências** e, após a partida, as **avaliações**
   (jogadores, campo, adversário).
4. As telas **Dashboard**, **Ranking**, **Escalação ideal** e **Histórico**
   são todas calculadas automaticamente a partir desses cadastros.
