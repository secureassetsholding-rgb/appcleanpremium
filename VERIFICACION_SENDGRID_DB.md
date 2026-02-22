# Verificación de SendGrid y Base de Datos

## Variables de Entorno Requeridas en Render.com

### Para el Backend (brightworks-backend)

El backend necesita estas variables de entorno configuradas en Render.com:

#### 1. SendGrid (Para envío de emails)

```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@brightworks.com
```

**Cómo obtener SENDGRID_API_KEY:**
1. Ve a https://app.sendgrid.com
2. Ve a Settings → API Keys
3. Crea una nueva API Key o usa una existente
4. Copia la clave (empieza con `SG.`)

**SENDGRID_FROM_EMAIL:**
- Debe ser un email verificado en SendGrid
- Formato: `noreply@tudominio.com` o `noreply@brightworks.com`

#### 2. MongoDB (Base de datos)

```
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/brightworks?retryWrites=true&w=majority
```

**Cómo obtener MONGODB_URI:**
1. Ve a https://www.mongodb.com/cloud/atlas
2. Selecciona tu cluster
3. Ve a "Connect" → "Connect your application"
4. Copia la connection string
5. Reemplaza `<password>` con tu contraseña real

#### 3. Otras Variables Importantes

```
JWT_SECRET=tu-secret-key-super-segura-aqui-minimo-32-caracteres
JWT_EXPIRATION=24h
NODE_ENV=production
PORT=10000
```

## Cómo Configurar en Render.com

### Paso 1: Ve al Dashboard del Backend
1. Ve a https://dashboard.render.com
2. Busca el servicio del **backend** (no el frontend)
3. Debería llamarse algo como `brightworks-backend` o similar

### Paso 2: Configurar Variables de Entorno
1. Ve a "Environment" (Variables de entorno)
2. Agrega cada variable una por una:

**SendGrid:**
- Key: `SENDGRID_API_KEY`
- Value: `SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

- Key: `SENDGRID_FROM_EMAIL`
- Value: `noreply@brightworks.com` (o tu email verificado)

**MongoDB:**
- Key: `MONGODB_URI`
- Value: `mongodb+srv://usuario:password@cluster.mongodb.net/brightworks?retryWrites=true&w=majority`

**Seguridad:**
- Key: `JWT_SECRET`
- Value: `[genera una clave secreta de al menos 32 caracteres]`

**Otras:**
- Key: `NODE_ENV`
- Value: `production`

- Key: `PORT`
- Value: `10000`

### Paso 3: Reiniciar el Servicio
Después de agregar todas las variables:
1. Haz clic en "Manual Deploy" → "Deploy latest commit"
2. O espera a que Render detecte los cambios automáticamente

## Verificación

### Verificar SendGrid
En los logs del backend deberías ver:
```
✅ SendGrid configurado correctamente
   From: noreply@brightworks.com
```

Si no está configurado:
```
⚠️  SendGrid no configurado
   Missing: SENDGRID_API_KEY
```

### Verificar MongoDB
En los logs del backend deberías ver:
```
✅ MongoDB connected successfully
   Database: brightworks
```

Si no está configurado:
```
⚠️  MONGODB_URI not set. Server will run without database.
```

## Problemas Comunes

### Error: SendGrid API Key inválida
- Verifica que la API Key empiece con `SG.`
- Asegúrate de que la API Key tenga permisos de "Mail Send"
- Verifica que no haya espacios extra al copiar

### Error: MongoDB connection failed
- Verifica que la contraseña en MONGODB_URI esté correctamente codificada (usa %40 para @)
- Verifica que la IP de Render.com esté en la whitelist de MongoDB Atlas
- En MongoDB Atlas: Network Access → Add IP Address → "Allow Access from Anywhere" (0.0.0.0/0)

### Error: Email from address not verified
- Ve a SendGrid → Settings → Sender Authentication
- Verifica el dominio o email que estás usando en SENDGRID_FROM_EMAIL

## Checklist de Configuración

- [ ] SENDGRID_API_KEY configurada en Render.com
- [ ] SENDGRID_FROM_EMAIL configurada y verificado en SendGrid
- [ ] MONGODB_URI configurada con credenciales correctas
- [ ] JWT_SECRET configurado (mínimo 32 caracteres)
- [ ] IP de Render.com agregada a MongoDB Atlas whitelist
- [ ] Backend reiniciado después de agregar variables
- [ ] Logs verificados para confirmar conexiones exitosas
