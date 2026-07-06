# Recuperación de contraseña por OTP

Se agregó el flujo `/forgot-password` para restablecer contraseña con verificación de correo.

## Flujo

1. El usuario hace clic en `¿Olvidaste tu contraseña?` desde `/login`.
2. Ingresa su correo en `/forgot-password`.
3. Supabase envía un código OTP de recuperación.
4. El usuario ingresa el código de 6 dígitos.
5. Si el OTP es válido, se habilita el formulario de nueva contraseña.
6. El usuario ingresa y confirma su nueva contraseña.
7. El sistema actualiza la contraseña, cierra sesión y muestra el acceso a `/login`.

## Configuración necesaria en Supabase

Para que el usuario reciba un código de 6 dígitos en vez de depender solo de un enlace, configura el email template de recuperación de contraseña en Supabase Auth usando la variable de template del token OTP (`{{ .Token }}`), además del texto de recuperación de acceso.

La vista usa `supabase.auth.resetPasswordForEmail()` para enviar el OTP y `supabase.auth.verifyOtp({ type: "recovery" })` para validar el código antes de cambiar la contraseña.
