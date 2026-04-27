# 🔧 Configuração Manual do Render

## ⚠️ IMPORTANTE: Atualize as configurações no painel do Render

O arquivo `render.yaml` foi atualizado, mas você precisa **atualizar manualmente** as configurações no painel do Render.

### 📋 Passos para Atualizar:

1. **Acesse o painel do Render**: https://dashboard.render.com
2. **Selecione seu serviço**: `gestao-vendas-verduras` (srv-d7nknrbeo5us73fcaf1g)
3. **Vá em "Settings"** (menu lateral esquerdo)
4. **Role até a seção "Build & Deploy"**
5. **Atualize os comandos**:

   **Build Command:**
   ```
   npm install && npm run build
   ```

   **Start Command:**
   ```
   node server.js
   ```

6. **Clique em "Save Changes"**
7. **Vá em "Manual Deploy"** (menu superior direito)
8. **Clique em "Deploy latest commit"**

### 🎯 Verificação

Após o deploy, você verá nos logs:
```
==> Running 'node server.js'
Server running on http://0.0.0.0:10000
==> Your service is live 🎉
```

### 📝 Configurações Completas

**Runtime:** Node
**Node Version:** 20.11.0
**Build Command:** `npm install && npm run build`
**Start Command:** `node server.js`

### 🔍 Se o erro persistir:

1. Verifique se o comando está exatamente como acima
2. Certifique-se de que salvou as configurações
3. Faça um "Clear build cache & deploy" nas configurações

---

**Depois de atualizar, o deploy deve funcionar! 🚀**
