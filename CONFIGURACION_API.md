# Configuración de la API Backend

## Problema: Error 503 - API no disponible

Si ves errores como:
```
Failed to load resource: the server responded with a status of 503
API no disponible desde el servidor estático
```

Significa que el backend no está configurado o no está disponible.

## Solución

### Opción 1: Configurar Variable de Entorno en Render.com

1. Ve a tu dashboard de Render: https://dashboard.render.com
2. Selecciona el servicio `brightworks-app`
3. Ve a "Environment" (Variables de entorno)
4. Agrega estas variables:

```
BACKEND_URL=https://bright-works-schedule.onrender.com
VITE_API_URL=https://bright-works-schedule.onrender.com
```

**URL del backend configurada: `https://bright-works-schedule.onrender.com`**

### Opción 2: Si el Backend está en el mismo servidor

Si tu backend está corriendo en el mismo servidor pero en un puerto diferente, actualiza `render.yaml`:

```yaml
envVars:
  - key: BACKEND_URL
    value: http://localhost:10000  # O el puerto donde corre tu backend
```

## Verificar la Configuración

Después de configurar las variables de entorno:

1. Reinicia el servicio en Render.com
2. Verifica los logs del servidor - deberías ver:
   ```
   Backend URL configurado: https://bright-works-schedule.onrender.com
   ```

## Notas

- El servidor Express ahora hace proxy de las peticiones `/api/*` al backend configurado
- Si `BACKEND_URL` no está configurado, retornará error 503
- En desarrollo, Vite usa el proxy configurado en `vite.config.ts` (puerto 10000)
