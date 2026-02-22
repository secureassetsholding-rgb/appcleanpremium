# 🔧 ENDPOINTS DE DIAGNÓSTICO DE EMAILS

## ✅ Endpoints Agregados

Se han agregado 2 endpoints nuevos para diagnosticar el sistema de emails:

### 1. GET `/api/emails/debug` - Diagnóstico Completo

**Acceso:** Solo Super Admin

**Uso:**
```bash
GET /api/emails/debug
Headers: Authorization: Bearer <token>
```

**Respuesta incluye:**
- ✅ Configuración de SendGrid (API Key, email from, estado)
- ✅ Estado de MongoDB (conectado, readyState)
- ✅ Configuración de notificaciones (sectionCompletion, dayCompletion)
- ✅ Lista de admins disponibles con emails
- ✅ Emails que recibirían notificaciones (sectionCompletion y dayCompletion)

**Ejemplo de respuesta:**
```json
{
  "timestamp": "2025-12-10T12:00:00.000Z",
  "sendgrid": {
    "apiKeyConfigured": true,
    "apiKeyLength": 70,
    "apiKeyPrefix": "SG.xxx...",
    "emailFrom": "brightbroks@gmail.com",
    "emailConfiguredVar": true,
    "sgMailDefined": true
  },
  "mongodb": {
    "connected": true,
    "readyState": 1,
    "readyStateText": "connected",
    "dbName": "brightwork"
  },
  "emailNotificationConfig": {
    "exists": true,
    "sectionCompletion": {
      "enabled": true,
      "adminCount": 2
    },
    "dayCompletion": {
      "enabled": true,
      "adminCount": 2
    }
  },
  "admins": [
    {
      "username": "luis",
      "email": "bri...@gmail.com",
      "hasValidEmail": true,
      "role": "superadmin",
      "isActive": true
    }
  ],
  "emailRecipients": {
    "sectionCompletion": {
      "count": 2,
      "emails": ["bri...@gmail.com", "adm...@gmail.com"]
    },
    "dayCompletion": {
      "count": 2,
      "emails": ["bri...@gmail.com", "adm...@gmail.com"]
    }
  }
}
```

---

### 2. POST `/api/emails/test` - Probar Envío de Email

**Acceso:** Solo Super Admin

**Uso:**
```bash
POST /api/emails/test
Headers: 
  Authorization: Bearer <token>
  Content-Type: application/json

Body (opcional):
{
  "email": "tu-email@ejemplo.com"
}
```

Si no proporcionas `email` en el body, usará el email del usuario autenticado.

**Respuesta exitosa:**
```json
{
  "success": true,
  "message": "Email sent successfully",
  "recipients": 1,
  "details": {
    "to": "brightbroks@gmail.com",
    "from": "brightbroks@gmail.com",
    "emailConfigured": true,
    "sendgridApiKeyExists": true
  }
}
```

**Respuesta con error:**
```json
{
  "success": false,
  "error": "Error message here",
  "stack": "Error stack trace...",
  "details": {
    "to": "brightbroks@gmail.com",
    "from": "brightbroks@gmail.com",
    "emailConfigured": true
  }
}
```

---

## 📋 Checklist de Diagnóstico

Usa el endpoint `/api/emails/debug` para verificar:

### ✅ 1. SendGrid API Key
- [ ] `sendgrid.apiKeyConfigured` = `true`
- [ ] `sendgrid.apiKeyLength` > 0 (típicamente 70 caracteres)
- [ ] `sendgrid.emailFrom` tiene un email válido
- [ ] `sendgrid.emailConfiguredVar` = `true`

### ✅ 2. MongoDB
- [ ] `mongodb.connected` = `true`
- [ ] `mongodb.readyStateText` = `"connected"`

### ✅ 3. Configuración de Notificaciones
- [ ] `emailNotificationConfig.exists` = `true`
- [ ] `emailNotificationConfig.sectionCompletion.enabled` = `true`
- [ ] `emailNotificationConfig.sectionCompletion.adminCount` > 0
- [ ] `emailNotificationConfig.dayCompletion.enabled` = `true`
- [ ] `emailNotificationConfig.dayCompletion.adminCount` > 0

### ✅ 4. Admins con Emails Válidos
- [ ] `admins` array tiene al menos 1 admin
- [ ] Todos los admins tienen `hasValidEmail` = `true`
- [ ] Todos los admins tienen `isActive` = `true`

### ✅ 5. Emails que Recibirían Notificaciones
- [ ] `emailRecipients.sectionCompletion.count` > 0
- [ ] `emailRecipients.dayCompletion.count` > 0

---

## 🛠️ Cómo Usar desde el Frontend

### Opción 1: Usar en el navegador (Console)

```javascript
// 1. Obtener token (desde localStorage o cookies)
const token = localStorage.getItem('token') // o como lo tengas guardado

// 2. Llamar al endpoint de diagnóstico
fetch('https://bright-works-schedule.onrender.com/api/emails/debug', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
  .then(res => res.json())
  .then(data => {
    console.log('📊 Email Diagnostics:', data)
    
    // Verificar problemas comunes
    if (!data.sendgrid.apiKeyConfigured) {
      console.error('❌ SendGrid API Key no configurada')
    }
    if (!data.sendgrid.emailConfiguredVar) {
      console.error('❌ SendGrid no está configurado')
    }
    if (!data.mongodb.connected) {
      console.error('❌ MongoDB no conectado')
    }
    if (data.emailRecipients.sectionCompletion.count === 0) {
      console.warn('⚠️ No hay destinatarios para section completion')
    }
    if (data.emailRecipients.dayCompletion.count === 0) {
      console.warn('⚠️ No hay destinatarios para day completion')
    }
  })

// 3. Probar envío de email
fetch('https://bright-works-schedule.onrender.com/api/emails/test', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'tu-email@ejemplo.com' // opcional
  })
})
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      console.log('✅ Email de prueba enviado exitosamente')
    } else {
      console.error('❌ Error enviando email:', data.error)
    }
  })
```

### Opción 2: Usar Postman o cURL

```bash
# Diagnóstico
curl -X GET https://bright-works-schedule.onrender.com/api/emails/debug \
  -H "Authorization: Bearer TU_TOKEN_AQUI"

# Probar email
curl -X POST https://bright-works-schedule.onrender.com/api/emails/test \
  -H "Authorization: Bearer TU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"email": "tu-email@ejemplo.com"}'
```

---

## 🔍 Problemas Comunes y Soluciones

### ❌ `sendgrid.apiKeyConfigured = false`
**Problema:** La variable de entorno `SENDGRID_API_KEY` no está configurada en Render.com

**Solución:**
1. Ve a Render.com > Tu servicio > Environment
2. Agrega la variable: `SENDGRID_API_KEY` = `tu-api-key-de-sendgrid`
3. Reinicia el servicio

### ❌ `sendgrid.emailConfiguredVar = false`
**Problema:** SendGrid no se configuró correctamente al iniciar

**Solución:**
1. Verifica que `SENDGRID_API_KEY` esté configurada
2. Verifica que `SENDGRID_FROM_EMAIL` esté configurada
3. Verifica que el email "from" esté verificado en SendGrid
4. Revisa los logs del servidor al iniciar

### ❌ `mongodb.connected = false`
**Problema:** MongoDB no está conectado

**Solución:**
1. Verifica que `MONGODB_URI` esté configurada en Render.com
2. Verifica que la conexión a MongoDB esté funcionando
3. Revisa los logs del servidor

### ❌ `emailRecipients.sectionCompletion.count = 0`
**Problema:** No hay administradores configurados para recibir emails

**Solución:**
1. Ve a la página "Email Notifications" como superadmin
2. Activa el toggle de "Section Completion Emails"
3. Selecciona al menos un administrador
4. Guarda los cambios

### ❌ `admins[].hasValidEmail = false`
**Problema:** Los administradores no tienen emails válidos

**Solución:**
1. Ve a la página "Users"
2. Edita cada administrador
3. Asegúrate de que tengan un email válido (debe contener "@")
4. Guarda los cambios

---

## 📝 Notas

- Los endpoints requieren autenticación con token
- Solo Super Admin puede acceder a estos endpoints
- Los emails en las respuestas están parcialmente ocultos por seguridad
- El endpoint de prueba envía un email real, úsalo con cuidado

---

## 🚀 Próximos Pasos

1. **Prueba el endpoint de diagnóstico:**
   ```bash
   GET /api/emails/debug
   ```

2. **Revisa cada sección del diagnóstico** y verifica que todo esté en verde

3. **Si hay problemas, usa el checklist** para identificar qué falta

4. **Prueba el envío de email:**
   ```bash
   POST /api/emails/test
   ```

5. **Si el email de prueba funciona**, el problema está en la configuración de notificaciones, no en SendGrid

6. **Si el email de prueba NO funciona**, revisa:
   - SendGrid API Key
   - Email "from" verificado en SendGrid
   - Límites de SendGrid alcanzados
   - Logs del servidor para más detalles



