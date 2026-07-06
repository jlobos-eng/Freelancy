// utils/bancosCL.js — fallback estático con los bancos chilenos.
// Idealmente leemos public.cl_banks desde Supabase (siempre fresco), pero
// dejamos esta lista como red de seguridad si la query falla / app está offline.
// Mantener sincronizado con la migración 2026_04_26_withdrawals.sql.

export const BANCOS_CL_FALLBACK = [
    { code: '012', name: 'Banco Estado', short_name: 'BancoEstado' },
    { code: '001', name: 'Banco de Chile', short_name: 'BCH' },
    { code: '037', name: 'Banco Santander', short_name: 'Santander' },
    { code: '016', name: 'Banco BCI', short_name: 'BCI' },
    { code: '504', name: 'BBVA', short_name: 'BBVA' },
    { code: '027', name: 'Itaú', short_name: 'Itaú' },
    { code: '014', name: 'Scotiabank', short_name: 'Scotiabank' },
    { code: '028', name: 'Banco BICE', short_name: 'BICE' },
    { code: '049', name: 'Banco Security', short_name: 'Security' },
    { code: '051', name: 'Banco Falabella', short_name: 'Falabella' },
    { code: '053', name: 'Banco Ripley', short_name: 'Ripley' },
    { code: '055', name: 'Banco Consorcio', short_name: 'Consorcio' },
    { code: '672', name: 'Coopeuch', short_name: 'Coopeuch' },
    { code: '999', name: 'Mercado Pago', short_name: 'MercadoPago' },
    { code: '730', name: 'Tenpo', short_name: 'Tenpo' },
    { code: '729', name: 'MACH', short_name: 'MACH' },
];

export const TIPOS_CUENTA = [
    { value: 'corriente', label: 'Cuenta Corriente' },
    { value: 'vista', label: 'Cuenta Vista / Chequera Electrónica' },
    { value: 'ahorro', label: 'Cuenta de Ahorro' },
    { value: 'rut', label: 'CuentaRUT (BancoEstado)' },
    { value: 'digital', label: 'Billetera Digital (MP / Tenpo / MACH)' },
];

export const WITHDRAWAL_STATUS_LABEL = {
    requested: 'Solicitado',
    processing: 'Procesando',
    paid: 'Transferido',
    failed: 'Rechazado',
    cancelled: 'Cancelado',
};

export const WITHDRAWAL_MIN_AMOUNT = 1000;
export const WITHDRAWAL_MAX_AMOUNT = 5000000;
