This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Publicação

Publique este diretório na Vercel e defina `NEXT_PUBLIC_API_URL` com a URL pública do backend, por exemplo `https://jb-ecosolar-api.onrender.com`.

Publique o diretório `backend` no Render ou Railway e configure `DATABASE_URL` com a conexão PostgreSQL, `DATABASE_SSL=true`, `CORS_ORIGIN` com a URL da Vercel e credenciais seguras em `ADMIN_USERNAME` e `ADMIN_PASSWORD`. Para enviar uma notificação pelo WhatsApp a cada nova simulação, configure também `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_RECIPIENT_PHONE` (somente dígitos no formato internacional) e, se necessário, `WHATSAPP_API_VERSION`. Para mais de um domínio, separe as URLs em `CORS_ORIGIN` por vírgulas. Em produção, o backend encerra o startup se banco ou credenciais não forem configurados e nunca usa armazenamento em memória.

No ambiente local, as credenciais administrativas padrão são `admin` e `jb2025`. Em produção, configure sempre `ADMIN_USERNAME` e `ADMIN_PASSWORD`; não use essas credenciais padrão.

Para executar em produção, defina `NODE_ENV=production`, instale as dependências com `npm ci`, execute `npm run build` no frontend e inicie os dois serviços com `npm start`. Configure também health checks para `GET /api/health` e backups do PostgreSQL.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
