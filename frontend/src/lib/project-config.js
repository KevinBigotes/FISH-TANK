// Configuración PÚBLICA del proyecto Fish Tank. No incluir claves secret/service_role.
// Supabase protege los datos con Auth + RLS; esta clave ya se entrega al navegador.
// Las variables VITE_* pueden reemplazar estos valores en otro despliegue.
export const projectConfig = Object.freeze({
  supabaseUrl: 'https://zskigxxernjyvectrjhl.supabase.co',
  supabaseKey: 'sb_publishable_CMK3u-x8nLkhav-ftkwlow_WBZtqJCc',
});
