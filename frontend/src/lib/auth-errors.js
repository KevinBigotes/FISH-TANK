export function authErrorMessage(error) {
  const messages = {
    invalid_credentials: 'El correo o la contraseña no son correctos.',
    email_not_confirmed: 'Confirma tu correo antes de iniciar sesión.',
    user_already_exists: 'Ya existe una cuenta con ese correo. Inicia sesión.',
    email_exists: 'Ya existe una cuenta con ese correo. Inicia sesión.',
    weak_password: 'Usa una contraseña más segura. Debe tener al menos 8 caracteres.',
    over_email_send_rate_limit: 'Se enviaron demasiados correos. Espera unos minutos antes de reintentar.',
    over_request_rate_limit: 'Demasiados intentos. Espera unos minutos e inténtalo otra vez.',
    signup_disabled: 'Los registros están desactivados temporalmente.',
    email_address_invalid: 'Escribe un correo válido.',
  };
  if (messages[error?.code]) return messages[error.code];
  if (error?.message?.includes('Database error saving new user')) {
    return 'No pudimos crear tu perfil. Prueba otro nombre de creador. Si persiste, revisa que schema.sql esté instalado.';
  }
  if (error?.name === 'AuthRetryableFetchError' || error instanceof TypeError) {
    return 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.';
  }
  return 'No pudimos completar la solicitud. Inténtalo de nuevo.';
}
