# WPP-ZAPI

API REST para automação do WhatsApp Web com suporte a multi-sessões.

---

## Tecnologias

| | Tecnologia | Função |
|---|---|---|
| ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white) | **Node.js 22** | Runtime JavaScript no servidor |
| ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) | **TypeScript** | Tipagem estática e compilação |
| ![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white) | **Express** | Framework HTTP para rotas e middlewares |
| ![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socketdotio&logoColor=white) | **Socket.IO** | Comunicação em tempo real via WebSocket |
| ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white) | **MongoDB 4.4** | Banco de dados para contatos, mensagens e arquivos |
| ![Mongoose](https://img.shields.io/badge/Mongoose-880000?style=for-the-badge&logo=mongoose&logoColor=white) | **Mongoose** | ODM para modelagem e queries no MongoDB |
| ![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white) | **Redis 7** | Broker de filas para BullMQ (jobs em background) |
| ![BullMQ](https://img.shields.io/badge/BullMQ-E34F26?style=for-the-badge&logo=bull&logoColor=white) | **BullMQ** | Filas de tarefas: webhooks, uploads e downloads de mídia |
| ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white) | **Docker Compose** | Orquestração dos serviços (MongoDB, Redis) |
| ![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black) | **Swagger** | Documentação interativa da API |
| ![WhatsApp](https://img.shields.io/badge/WPPConnect-25D366?style=for-the-badge&logo=whatsapp&logoColor=white) | **WPPConnect** | Biblioteca de automação do WhatsApp Web |
| ![AWS S3](https://img.shields.io/badge/AWS_S3-569A31?style=for-the-badge&logo=amazons3&logoColor=white) | **AWS S3** | Storage externo opcional para arquivos e mídia |
| ![Winston](https://img.shields.io/badge/Winston-231F20?style=for-the-badge&logo=winston&logoColor=white) | **Winston** | Logging estruturado com múltiplos transports |
| ![Sharp](https://img.shields.io/badge/Sharp-99CC00?style=for-the-badge&logo=sharp&logoColor=black) | **Sharp** | Processamento e manipulação de imagens |
| ![FFmpeg](https://img.shields.io/badge/FFmpeg-007808?style=for-the-badge&logo=ffmpeg&logoColor=white) | **Fluent-FFmpeg** | Processamento de áudio e vídeo |
| ![Babel](https://img.shields.io/badge/Babel-F9DC3E?style=for-the-badge&logo=babel&logoColor=black) | **Babel** | Transpilação do TypeScript para JavaScript |
| ![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white) | **Jest** | Framework de testes automatizados |
| ![ESLint](https://img.shields.io/badge/ESLint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white) | **ESLint + Prettier** | Linting e formatação de código |

---

## Arquitetura

```
src/
├── controller/     # Controllers da API (mensagens, contatos, grupos, etc.)
├── middleware/      # Auth, health check, status de conexão
├── routes/          # Rotas Express + storage
├── queues/          # BullMQ: client (filas) e worker (processamento)
├── sync/            # Sincronização de contatos e mensagens com MongoDB
├── mapper/          # Mapeamento de dados (TagOne)
├── util/
│   ├── db/          # Conexão MongoDB (Mongoose)
│   ├── tokenStore/  # Armazenamento de tokens de sessão
│   └── ...          # Webhooks, logger, sessões
└── types/           # Definições TypeScript
```

## Variáveis de Ambiente

| Variável | Descrição |
|---|---|
| `MONGO_URI` | URI de conexão do MongoDB |
| `REDIS_HOST` | Host do Redis |
| `REDIS_PORT` | Porta do Redis |
| `REDIS_PASSWORD` | Senha do Redis |
| `SESSION_NAME` | Nome da sessão padrão |
| `STORAGE_PATH` | Caminho local para armazenamento de arquivos |
| `WEBHOOK_URL` | URL para envio de webhooks |
| `SECRET_KEY` | Chave secreta para autenticação da API |
| `STORAGE_SECRET_KEY` | Chave secreta do serviço de storage |

---

## Installation

Install the dependencies and start the server.

```sh
yarn install
//or
npm install
```

## Install puppeteer dependencies:

```sh
sudo apt-get install -y libxshmfence-dev libgbm-dev wget unzip fontconfig locales gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils libvips-dev

```

## Install google chrome

```sh

wget -c https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb

sudo apt-get update

sudo apt-get install libappindicator1

sudo dpkg -i google-chrome-stable_current_amd64.deb

```

### Troubleshooting

If you encounter installation issues, please try the procedures below
. Error Sharp Runtime

```sh
    yarn add sharp
    npm install --include=optional sharp
    //or
    yarn add sharp --ignore-engines
```

## Run Server

```sh
yarn dev
```

## Build Server

```sh
yarn build
```

---

# Configuration

This server use config.ts file to define some options, default values are:

```javascript
{
  /* secret key to generate access token */
  secretKey: 'THISISMYSECURETOKEN',
  host: 'http://localhost',
  port: '21465',
  // Device name for show on whatsapp device
  deviceName: 'WppConnect',
  poweredBy: 'WPPConnect-Server',
  // starts all sessions when starting the server.
  startAllSession: true,
  tokenStoreType: 'file',
  // sets the maximum global listeners. 0 = infinity.
  maxListeners: 15,
  // create userDataDir for each puppeteer instance for working with Multi Device
  customUserDataDir: './userDataDir/',
  webhook: {
    // set default webhook
    url: null,
    // automatically downloads files to upload to the webhook
    autoDownload: true,
    // enable upload to s3
    uploadS3: false,
    // set default bucket name on aws s3
    awsBucketName: null,
    //marks messages as read when the webhook returns ok
    readMessage: true,
    //sends all unread messages to the webhook when the server starts
    allUnreadOnStart: false,
    // send all events of message status (read, sent, etc)
    listenAcks: true,
    // send all events of contacts online or offline for webook and socket
    onPresenceChanged: true,
    // send all events of groups participants changed for webook and socket
    onParticipantsChanged: true,
    // send all events of reacted messages for webook and socket
    onReactionMessage: true,
    // send all events of poll messages for webook and socket
    onPollResponse: true,
    // send all events of revoked messages for webook and socket
    onRevokedMessage: true,
    // send all events of labels for webook and socket
    onLabelUpdated: true,
    // 'event', 'from' or 'type' to ignore and not send to webhook
    ignore: [],
  },
  websocket: {
    // Just leave one active, here or on webhook.autoDownload
    autoDownload: false,
    // Just leave one active, here or on webhook.uploadS3, to avoid duplication in S3
    uploadS3: false,
  },
  // send data to chatwoot
  chatwoot: {
    sendQrCode: true,
    sendStatus: true,
  },
  //functionality that archives conversations, runs when the server starts
  archive: {
    enable: false,
    //maximum interval between filings.
    waitTime: 10,
    daysToArchive: 45,
  },
  log: {
    level: 'silly', // Before open a issue, change level to silly and retry an action
    logger: ['console', 'file'],
  },
  // create options for using on wppconnect-lib
  createOptions: {
    browserArgs: [
      '--disable-web-security',
      '--no-sandbox',
      '--disable-web-security',
      '--aggressive-cache-discard',
      '--disable-cache',
      '--disable-application-cache',
      '--disable-offline-load-stale-cache',
      '--disk-cache-size=0',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--ignore-certificate-errors-spki-list',
      '--disable-features=LeakyPeeker' // Disable the browser's sleep mode when idle, preventing the browser from going into sleep mode, this is useful for WhatsApp not to be in economy mode in the background, avoiding possible crashes
    ],
  },
  mapper: {
    enable: false,
    prefix: 'tagone-',
  },
  // Configurations for connect with database
  db: {
    mongodbDatabase: 'tokens',
    mongodbCollection: '',
    mongodbUser: '',
    mongodbPassword: '',
    mongodbHost: '',
    mongoIsRemote: true,
    mongoURLRemote: '',
    mongodbPort: 27017,
    redisHost: 'localhost',
    redisPort: 6379,
    redisPassword: '',
    redisDb: 0,
    redisPrefix: 'docker',
  },
  // Your configurations to upload on AWS
  aws_s3: {
    region: 'sa-east-1',
    access_key_id: '',
    secret_key: '',
    // If you already have a bucket created that will be used. Will be stored: you-default-bucket/{session}/{filename}
    defaultBucketName: ''
  },
}
```

# Secret Key

Your `secretKey` is inside the `config.ts` file. You must change the default value to one that only you know.

<!-- ![Peek 2021-03-25 09-33](https://user-images.githubusercontent.com/40338524/112473515-3b310a80-8d4d-11eb-94bb-ff409c91d9b8.gif) -->

# Generate Token

To generate an access token, you must use your `SECRET_KEY`.

Using the route:

```shell
  curl -X POST --location "http://localhost:21465/api/mySession/THISISMYSECURETOKEN/generate-token"
```

### Response:

```json
{
  "status": "Success",
  "session": "mySession",
  "token": "$2b$10$duQ5YYV6fojn5qFiFv.aEuY32_SnHgcmxdfxohnjG4EHJ5_Z6QWhe",
  "full": "wppconnect:$2b$10$duQ5YYV6fojn5qFiFv.aEuY32_SnHgcmxdfxohnjG4EHJ5_Z6QWhe"
}
```

# Using Token

Save the value of the "full" response. Then use this value to call the routes.

# Examples

```sh
#Starting Session
# /api/:session/start-session

curl -X POST --location "http://localhost:21465/api/mySession/start-session" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer \$2b\$10\$JcHd97xHN6ErBuiLd7Yu4.r6McvOvEZZDQTQwev2MRK_zQObUZZ9C"
```

```sh
#Get QrCode
# /api/:session/start-session
# when the session is starting if the method is called again it will return the base64 qrCode

curl -X POST --location "http://localhost:21465/api/mySession/start-session" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer \$2b\$10\$JcHd97xHN6ErBuiLd7Yu4.r6McvOvEZZDQTQwev2MRK_zQObUZZ9C"
```

```sh
#Send Message
# /api/:session/send-message
curl -X POST --location "http://localhost:21465/api/mySession/send-message" \
    -H "Content-Type: application/json; charset=utf-8" \
    -H "Accept: application/json" \
    -H "Authorization: Bearer \$2b\$10\$8aQFQxnWREtBEMZK_iHMe.u7NeoNkjL7s6NYai_83Pb31Ycss6Igm" \
    -d "{
          \"phone\": \"5511900000000\",
          \"message\": \"*Abner* Rodrigues\"
        }"
```

See the `routes` file for all the routes. [here](/src/routes/index.js) and HTTP [file](/requests.http).

# Swagger UI

Swagger ui can be found at `/api-docs`
