# ComunicApp — BAMX GDL

App móvil (Expo + AWS Amplify Gen 2) que coordina la recolección de donaciones del
Banco de Alimentos de Guadalajara: desde que un donante llama hasta que Inspección
confirma cuántos kilos fueron realmente útiles.

> Rama `claude/fallback-app`: implementación completa de respaldo. Interfaz en español,
> código y base de datos en inglés.

## Flujo

`Solicitada → Asignada → Recolectada / en camino → Área de llegada lista → Descargada → En revisión → Cerrada`
(+ `Cancelada`, solo admin)

| Paso | Rol | Cómo |
|---|---|---|
| Registrar donación (donante, dirección, fecha/hora, contenido reportado) y asignar chofer | Administrador | "+ Nueva donación" |
| Ver dirección, abrir en Google Maps / Waze, registrar nota de recolección (productos, foto de la firma, foto de la lista escrita) | Chofer | "Mis recolecciones" → donación → "Registrar recolección" |
| Preparar área de llegada, marcar descargada | Almacén | Lista con filtros (en camino + hoy, etc.) |
| Revisar producto por producto: kg útiles, kg descartados + motivo, caducidad; agregar productos | Inspección | "Iniciar revisión" → "Cerrar revisión" |
| Reportes declarado vs útil, usuarios, forzar estado, cancelar, eliminar | Administrador | Pantalla principal |

Choferes, Almacén e Inspección pueden trabajar **sin conexión**: la app guarda lo último
que cargó y encola las notas/cambios; se envían solos cuando vuelve la señal.

## Arquitectura

| Pieza | Dónde | Qué es |
|---|---|---|
| Auth | `amplify/auth/resource.ts` | Cognito, login con correo, grupos `ADMIN`, `DRIVER`, `WAREHOUSE`, `INSPECTION`. Registro público deshabilitado (`backend.ts`). |
| Datos | `amplify/data/resource.ts` | AppSync + DynamoDB: `Donation`, `DonationItem`, `DonationEvent` (historial). Reglas por grupo; el chofer solo ve lo suyo a nivel API (`driverId` = su `sub`). |
| Fotos | `amplify/storage/resource.ts` | S3 privado, `donation-photos/<donationId>/…` |
| Usuarios | `amplify/functions/admin-users/` | Lambda detrás de la mutación `adminUsers` (solo ADMIN): crear, cambiar rol, deshabilitar, eliminar. |
| Offline | `src/lib/offline.ts` | Caché de lecturas + cola persistente de escrituras con IDs generados en el cliente (reintentos sin duplicados) y manejo de conflictos. |
| Pantallas | `src/app/` | `admin/`, `driver/`, `warehouse/`, `inspection/`, `donation/[id]` (detalle compartido). |

## Correr el proyecto

```bash
cd bamx-app
npm install
npx tsc --noEmit        # typecheck
npx expo lint
```

### 1. Desplegar el backend (genera `amplify_outputs.json`)

Necesitas las credenciales de AWS configuradas (`aws configure`, región `us-east-1`).

```bash
npx ampx sandbox        # deja corriendo; despliega y vigila cambios en amplify/
```

Para que todo el equipo use **el mismo** backend en la demo, despliega una rama en la consola de
Amplify (conecta el repo → rama → despliegue) y comparte su `amplify_outputs.json`
(`npx ampx generate outputs --app-id <id> --branch <rama>`). Un sandbox es personal.

### 2. Crear el primer administrador

El registro público está deshabilitado, así que el primer admin se crea por CLI.
El `user_pool_id` está en `amplify_outputs.json` → `auth.user_pool_id`.

```bash
POOL=<user_pool_id>
EMAIL=admin@ejemplo.com
aws cognito-idp admin-create-user --region us-east-1 --user-pool-id $POOL --username $EMAIL \
  --user-attributes Name=email,Value=$EMAIL Name=email_verified,Value=true Name=name,Value="Administrador" \
  --temporary-password 'Bamx-Temp1!' --message-action SUPPRESS
aws cognito-idp admin-add-user-to-group --region us-east-1 --user-pool-id $POOL --username $EMAIL --group-name ADMIN
```

Si ya tienes una cuenta de pruebas, basta con el segundo comando. Una cuenta sin grupo ve
"Sin rol asignado". Desde la app, el admin crea al resto en **Usuarios** (contraseña temporal;
cada persona crea la suya al entrar por primera vez).

### 3. Abrir la app

```bash
npx expo start          # Expo Go o development build
```

## Guion de demo (5 min)

1. **Admin**: Usuarios → crea un Chofer, una persona de Almacén y una de Inspección.
2. **Admin**: + Nueva donación "Walmart Av. Patria", dirección, "Hoy 12:00", asigna al chofer.
3. **Chofer**: la ve en "Por recolectar" → abre en Google Maps/Waze → activa **modo avión** →
   registra 3 productos (uno en "cajas" con kg estimados y uno con categoría "Otro"), foto de la
   firma y de la lista → aparece "Pendiente de sincronizar" → quita modo avión → se envía solo.
4. **Almacén**: "En camino" → "Área de llegada preparada" → "Marcar como descargada".
5. **Inspección**: "Iniciar revisión" → ajusta kg útiles, descarta 1 producto con motivo y
   caducidad, agrega un producto que no venía → "Guardar revisión y cerrar".
6. **Admin**: detalle con historial (quién/cuándo), fotos, y **Reportes** declarado vs útil,
   por categoría, por donante, motivos de descarte; exportar CSV.

## Limitaciones conocidas

- Las transiciones válidas se validan en la app; a nivel API, Almacén/Inspección tienen permiso
  de `update` sobre `Donation` completo. Endurecerlo requiere una mutación personalizada.
- Las fotos tomadas sin conexión quedan en la caché de la app hasta enviarse; si el sistema
  borra la caché antes de sincronizar, esa foto se pierde (las notas y productos no).
- Fecha/hora se capturan como texto `AAAA-MM-DD HH:MM` con atajos (sin selector nativo,
  para no agregar dependencias).
- Reportes se calculan en el dispositivo; para miles de donaciones conviene una función/consulta
  agregada en el backend.
- Notificaciones push: no implementadas (eran opcionales).
