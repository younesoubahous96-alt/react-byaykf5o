// ─── FireSafe Pro — Translations ──────────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect } from "react";

export const LANGS = [
  { value:"fr", label:"🇫🇷 Français",  dir:"ltr" },
  { value:"en", label:"🇬🇧 English",   dir:"ltr" },
  { value:"ar", label:"🇲🇦 العربية",   dir:"rtl" },
  { value:"es", label:"🇪🇸 Español",   dir:"ltr" },
];

const T = {
  dashboard:           { fr:"Tableau de bord",   en:"Dashboard",        ar:"لوحة القيادة",     es:"Panel de control" },
  scheduling:          { fr:"Planification",     en:"Scheduling",       ar:"الجدولة",           es:"Planificación" },
  inspections:         { fr:"Inspections",       en:"Inspections",      ar:"التفتيش",           es:"Inspecciones" },
  deficiencies:        { fr:"Déficiences",       en:"Deficiencies",     ar:"أوجه القصور",       es:"Deficiencias" },
  proposals:           { fr:"Devis",             en:"Quotes",           ar:"العروض",            es:"Presupuestos" },
  workorders:          { fr:"Bons de travail",   en:"Work Orders",      ar:"أوامر العمل",       es:"Órdenes de trabajo" },
  invoices:            { fr:"Factures",          en:"Invoices",         ar:"الفواتير",           es:"Facturas" },
  payments:            { fr:"Paiements",         en:"Payments",         ar:"المدفوعات",         es:"Pagos" },
  customers:           { fr:"Clients",           en:"Customers",        ar:"العملاء",           es:"Clientes" },
  ai_assistant:        { fr:"Assistant IA",      en:"AI Assistant",     ar:"مساعد الذكاء",      es:"Asistente IA" },
  settings:            { fr:"Paramètres",        en:"Settings",         ar:"الإعدادات",         es:"Configuración" },
  seed_templates:      { fr:"🌱 Seed Templates", en:"🌱 Seed Templates",ar:"🌱 قوالب",          es:"🌱 Plantillas" },
  sub_scheduling:      { fr:"Gérer les interventions et le calendrier des techniciens", en:"Manage interventions and technician schedules", ar:"إدارة التدخلات وجداول الفنيين", es:"Gestionar intervenciones y calendarios" },
  sub_inspections:     { fr:"Voir et gérer toutes les inspections",  en:"View and manage all inspections",   ar:"عرض وإدارة عمليات التفتيش",   es:"Ver y gestionar todas las inspecciones" },
  sub_deficiencies:    { fr:"Suivre et résoudre les problèmes de sécurité", en:"Track and resolve safety issues", ar:"تتبع وحل مشكلات السلامة", es:"Rastrear y resolver problemas de seguridad" },
  sub_proposals:       { fr:"Créer et gérer les devis clients",      en:"Create and manage customer quotes",  ar:"إنشاء وإدارة عروض العملاء", es:"Crear y gestionar presupuestos" },
  sub_workorders:      { fr:"Gérer les interventions et réparations",en:"Manage interventions and repairs",   ar:"إدارة التدخلات والإصلاحات", es:"Gestionar intervenciones y reparaciones" },
  sub_invoices:        { fr:"Facturation et suivi des paiements",    en:"Billing and payment tracking",       ar:"الفوترة وتتبع المدفوعات",  es:"Facturación y seguimiento de pagos" },
  sub_payments:        { fr:"Enregistrer et suivre les règlements",  en:"Record and track payments",          ar:"تسجيل وتتبع المدفوعات",   es:"Registrar y rastrear pagos" },
  sub_customers:       { fr:"Gérer les bâtiments et les contacts",   en:"Manage buildings and contacts",      ar:"إدارة المباني وجهات الاتصال", es:"Gestionar edificios y contactos" },
  sub_ai:              { fr:"Propulsé par Claude IA",                en:"Powered by Claude AI",               ar:"مدعوم بكلود للذكاء الاصطناعي", es:"Impulsado por Claude IA" },
  sub_settings:        { fr:"Configuration du compte et du système", en:"Account and system configuration",   ar:"إعدادات الحساب والنظام",  es:"Configuración de cuenta y sistema" },
  sub_seeder:          { fr:"Peupler les templates NFPA (une seule fois)", en:"Populate NFPA templates (one time)", ar:"ملء قوالب NFPA مرة واحدة", es:"Poblar plantillas NFPA (una vez)" },
  todays_inspections:  { fr:"Inspections aujourd'hui", en:"Today's Inspections",   ar:"تفتيش اليوم",          es:"Inspecciones hoy" },
  open_deficiencies:   { fr:"Déficiences ouvertes",    en:"Open Deficiencies",     ar:"أوجه القصور المفتوحة", es:"Deficiencias abiertas" },
  pending_invoices:    { fr:"Factures en attente",     en:"Pending Invoices",      ar:"الفواتير المعلقة",      es:"Facturas pendientes" },
  monthly_revenue:     { fr:"Revenus du mois",         en:"Monthly Revenue",       ar:"إيرادات الشهر",         es:"Ingresos del mes" },
  recent_inspections:  { fr:"Inspections récentes",    en:"Recent Inspections",    ar:"التفتيش الأخير",        es:"Inspecciones recientes" },
  my_schedule:         { fr:"Mon planning",            en:"My Schedule",           ar:"جدولي",                 es:"Mi horario" },
  my_deficiencies:     { fr:"Déficiences assignées",   en:"Assigned Deficiencies", ar:"أوجه القصور المسندة",   es:"Deficiencias asignadas" },
  recent_list:         { fr:"Inspections récentes",    en:"Recent Inspections",    ar:"عمليات التفتيش الأخيرة",es:"Inspecciones recientes" },
  status_scheduled:    { fr:"Planifiée",     en:"Scheduled",    ar:"مجدولة",       es:"Planificada" },
  status_in_progress:  { fr:"En cours",      en:"In Progress",  ar:"قيد التنفيذ",  es:"En curso" },
  status_completed:    { fr:"Terminée",      en:"Completed",    ar:"مكتملة",       es:"Completada" },
  status_deficient:    { fr:"Déficiente",    en:"Deficient",    ar:"قاصرة",        es:"Deficiente" },
  status_cancelled:    { fr:"Annulée",       en:"Cancelled",    ar:"ملغاة",         es:"Cancelada" },
  status_open:         { fr:"Ouvert",        en:"Open",         ar:"مفتوح",         es:"Abierto" },
  status_quoted:       { fr:"Devisé",        en:"Quoted",       ar:"مُسعَّر",       es:"Presupuestado" },
  status_in_repair:    { fr:"En réparation", en:"In Repair",    ar:"قيد الإصلاح",  es:"En reparación" },
  status_repaired:     { fr:"Réparé",        en:"Repaired",     ar:"تم الإصلاح",   es:"Reparado" },
  status_verified:     { fr:"Vérifié",       en:"Verified",     ar:"تم التحقق",    es:"Verificado" },
  status_closed:       { fr:"Fermé",         en:"Closed",       ar:"مغلق",          es:"Cerrado" },
  col_building:        { fr:"Bâtiment",    en:"Building",    ar:"المبنى",     es:"Edificio" },
  col_customer:        { fr:"Client",      en:"Customer",    ar:"العميل",     es:"Cliente" },
  col_trade:           { fr:"Spécialité",  en:"Trade",       ar:"التخصص",     es:"Especialidad" },
  col_technician:      { fr:"Technicien",  en:"Technician",  ar:"الفني",      es:"Técnico" },
  col_status:          { fr:"Statut",      en:"Status",      ar:"الحالة",     es:"Estado" },
  col_score:           { fr:"Score",       en:"Score",       ar:"النتيجة",    es:"Puntuación" },
  col_date:            { fr:"Date",        en:"Date",        ar:"التاريخ",    es:"Fecha" },
  col_actions:         { fr:"Actions",     en:"Actions",     ar:"الإجراءات",  es:"Acciones" },
  col_severity:        { fr:"Sévérité",   en:"Severity",    ar:"الخطورة",    es:"Gravedad" },
  col_report:          { fr:"Rapport",     en:"Report",      ar:"التقرير",    es:"Informe" },
  col_title:           { fr:"Titre",       en:"Title",       ar:"العنوان",    es:"Título" },
  col_assigned:        { fr:"Assigné à",  en:"Assigned to", ar:"مسند إلى",   es:"Asignado a" },
  new_inspection:      { fr:"Nouvelle inspection",  en:"New Inspection",   ar:"تفتيش جديد",      es:"Nueva inspección" },
  btn_save:            { fr:"✓ Enregistrer",         en:"✓ Save",           ar:"✓ حفظ",           es:"✓ Guardar" },
  btn_saving:          { fr:"Enregistrement…",       en:"Saving…",          ar:"جارٍ الحفظ…",    es:"Guardando…" },
  btn_cancel:          { fr:"Annuler",               en:"Cancel",           ar:"إلغاء",            es:"Cancelar" },
  btn_delete:          { fr:"🗑 Supprimer",          en:"🗑 Delete",        ar:"🗑 حذف",          es:"🗑 Eliminar" },
  btn_deleting:        { fr:"Suppression…",          en:"Deleting…",        ar:"جارٍ الحذف…",    es:"Eliminando…" },
  btn_retry:           { fr:"Réessayer",             en:"Retry",            ar:"إعادة المحاولة",   es:"Reintentar" },
  logout:              { fr:"Déconnexion",           en:"Logout",           ar:"تسجيل الخروج",    es:"Cerrar sesión" },
  filter_all:          { fr:"Tous",          en:"All",           ar:"الكل",           es:"Todos" },
  empty_inspections:   { fr:"Aucune inspection trouvée",  en:"No inspections found",   ar:"لا يوجد تفتيش",         es:"Sin inspecciones" },
  empty_hint:          { fr:"Changez le filtre ou créez une nouvelle inspection.", en:"Change filter or create a new inspection.", ar:"غيّر المرشح أو أنشئ تفتيشاً جديداً.", es:"Cambia el filtro o crea una nueva inspección." },
  no_inspections:      { fr:"Aucune inspection assignée", en:"No inspections assigned", ar:"لا يوجد تفتيش مسند",   es:"Sin inspecciones asignadas" },
  edit_inspection:     { fr:"✏️ Modifier l'inspection",   en:"✏️ Edit Inspection",    ar:"✏️ تعديل التفتيش",     es:"✏️ Editar inspección" },
  edit_status:         { fr:"Statut",                     en:"Status",                ar:"الحالة",                es:"Estado" },
  edit_trade:          { fr:"Spécialité",                 en:"Trade",                 ar:"التخصص",                es:"Especialidad" },
  edit_date:           { fr:"Date planifiée",             en:"Scheduled Date",        ar:"التاريخ المجدول",       es:"Fecha planificada" },
  edit_score:          { fr:"Score (%)",                  en:"Score (%)",             ar:"النتيجة (%)",            es:"Puntuación (%)" },
  edit_notes:          { fr:"Notes",                      en:"Notes",                 ar:"ملاحظات",               es:"Notas" },
  delete_title:        { fr:"🗑 Supprimer l'inspection ?",en:"🗑 Delete Inspection?", ar:"🗑 حذف التفتيش؟",       es:"🗑 ¿Eliminar?" },
  delete_body:         { fr:"sera définitivement supprimée", en:"will be permanently deleted", ar:"سيتم حذفه نهائياً", es:"se eliminará permanentemente" },
  form_pass:           { fr:"✓ Conforme",         en:"✓ Pass",         ar:"✓ مطابق",        es:"✓ Conforme" },
  form_fail:           { fr:"✗ Non conforme",     en:"✗ Fail",         ar:"✗ غير مطابق",    es:"✗ No conforme" },
  form_na:             { fr:"N/A",                en:"N/A",            ar:"لا ينطبق",       es:"N/A" },
  form_required:       { fr:"Obligatoire",        en:"Required",       ar:"مطلوب",          es:"Obligatorio" },
  form_deficiency:     { fr:"⚠ Déficience",      en:"⚠ Deficiency",   ar:"⚠ قصور",         es:"⚠ Deficiencia" },
  form_add_note:       { fr:"+ Ajouter une note", en:"+ Add a note",  ar:"+ إضافة ملاحظة", es:"+ Agregar nota" },
  form_note_fail:      { fr:"Décrire le problème…",   en:"Describe the issue…",    ar:"وصف المشكلة…",     es:"Describir el problema…" },
  form_note_optional:  { fr:"Notes additionnelles…",  en:"Additional notes…",      ar:"ملاحظات إضافية…",  es:"Notas adicionales…" },
  form_all_pass:       { fr:"✓✓ Tout marquer conforme (section)", en:"✓✓ Mark all pass (section)", ar:"✓✓ تحديد الكل مطابق", es:"✓✓ Todo conforme (sección)" },
  form_no_questions:   { fr:"Aucune question dans cette section.", en:"No questions in this section.", ar:"لا توجد أسئلة.", es:"Sin preguntas en esta sección." },
  form_answered:       { fr:"répondues",          en:"answered",       ar:"تمت الإجابة",    es:"respondidas" },
  form_prev:           { fr:"← Précédent",        en:"← Previous",    ar:"→ السابق",       es:"← Anterior" },
  form_next_section:   { fr:"Section suivante →", en:"Next Section →",ar:"القسم التالي ←", es:"Siguiente sección →" },
  form_review:         { fr:"Vérifier les réponses →", en:"Review answers →", ar:"مراجعة الإجابات", es:"Revisar respuestas →" },
  form_submit:         { fr:"✓ Vérifier et soumettre", en:"✓ Review & Submit", ar:"✓ مراجعة وإرسال", es:"✓ Revisar y enviar" },
  summary_title:       { fr:"Résumé de l'inspection",  en:"Inspection Summary",   ar:"ملخص التفتيش",         es:"Resumen de inspección" },
  summary_questions:   { fr:"Questions",               en:"Questions",            ar:"الأسئلة",              es:"Preguntas" },
  summary_answered:    { fr:"Répondues",               en:"Answered",             ar:"تمت الإجابة",          es:"Respondidas" },
  summary_passed:      { fr:"Conformes",               en:"Passed",               ar:"مطابقة",               es:"Conformes" },
  summary_deficiencies:{ fr:"Déficiences",             en:"Deficiencies",         ar:"أوجه القصور",          es:"Deficiencias" },
  summary_score:       { fr:"Score de conformité",     en:"Compliance Score",     ar:"نتيجة الامتثال",       es:"Puntuación de conformidad" },

  // ── New inspection form ───────────────────────────────────────────────────
  new_insp_title:      { fr:"Démarrer une nouvelle inspection", en:"Start a New Inspection",    ar:"بدء تفتيش جديد",        es:"Iniciar nueva inspección" },
  new_insp_subtitle:   { fr:"Créer et démarrer une inspection maintenant", en:"Create and start an inspection now", ar:"إنشاء وبدء تفتيش الآن", es:"Crear e iniciar una inspección ahora" },
  select_customer:     { fr:"Sélectionner un client...",    en:"Select a customer...",    ar:"اختر عميلاً...",       es:"Seleccionar cliente..." },
  select_building:     { fr:"Sélectionner un bâtiment...", en:"Select a building...",    ar:"اختر مبنى...",         es:"Seleccionar edificio..." },
  select_template:     { fr:"Sélectionner un modèle...",   en:"Select a template...",   ar:"اختر نموذجاً...",      es:"Seleccionar plantilla..." },
  lbl_customer:        { fr:"Client",                       en:"Customer",               ar:"العميل",               es:"Cliente" },
  lbl_building:        { fr:"Bâtiment",                    en:"Building",               ar:"المبنى",               es:"Edificio" },
  lbl_template:        { fr:"Modèle d'inspection",         en:"Inspection Template",    ar:"نموذج التفتيش",        es:"Plantilla de inspección" },
  lbl_trade:           { fr:"Spécialité",                  en:"Trade",                  ar:"التخصص",               es:"Especialidad" },
  lbl_date:            { fr:"Date",                        en:"Date",                   ar:"التاريخ",              es:"Fecha" },
  btn_start_insp:      { fr:"→ Démarrer l'inspection",     en:"→ Start Inspection",     ar:"→ بدء التفتيش",        es:"→ Iniciar inspección" },
  btn_creating:        { fr:"Création...",                  en:"Creating...",            ar:"جارٍ الإنشاء...",     es:"Creando..." },
  no_insp_hint:        { fr:"Cliquez sur + pour démarrer une nouvelle inspection.", en:"Click + to start a new inspection.", ar:"انقر على + لبدء تفتيش جديد.", es:"Haz clic en + para iniciar una inspección." },

  // ── Inspection form - result screen ──────────────────────────────────────
  insp_passed:         { fr:"Inspection réussie !",      en:"Inspection Passed!",      ar:"نجح التفتيش!",          es:"¡Inspección aprobada!" },
  insp_done:           { fr:"Inspection terminée",       en:"Inspection Complete",     ar:"اكتمل التفتيش",         es:"Inspección completada" },
  all_conforming:      { fr:"Tous les éléments sont conformes.", en:"All items are conforming.", ar:"جميع العناصر مطابقة.", es:"Todos los elementos son conformes." },
  deficiencies_found:  { fr:"déficience(s) relevée(s)", en:"deficiency(s) found",      ar:"عيب(عيوب) موجودة",      es:"deficiencia(s) encontrada(s)" },
  results_by_section:  { fr:"Résultats par section",    en:"Results by section",       ar:"النتائج حسب القسم",     es:"Resultados por sección" },
  pending:             { fr:"En attente",               en:"Pending",                  ar:"في انتظار",              es:"Pendiente" },
  excellent:           { fr:"Excellent",                en:"Excellent",                ar:"ممتاز",                  es:"Excelente" },
  good:                { fr:"Bien",                     en:"Good",                     ar:"جيد",                   es:"Bien" },
  needs_work:          { fr:"À améliorer",              en:"Needs Work",               ar:"يحتاج تحسين",            es:"Necesita trabajo" },
  btn_submit_deficiencies: { fr:"✓ Soumettre",          en:"✓ Submit",                 ar:"✓ إرسال",               es:"✓ Enviar" },
  questions_required:  { fr:"question(s) obligatoire(s) manquante(s)", en:"required question(s) missing", ar:"سؤال(أسئلة) مطلوبة ناقصة", es:"pregunta(s) obligatoria(s) faltante(s)" },
  answers_label:       { fr:"répondues",               en:"answered",                 ar:"تمت الإجابة",            es:"respondidas" },
  // ── Technician dashboard ──────────────────────────────────────────────────
  scheduled_today:     { fr:"Planifié aujourd'hui",     en:"Scheduled Today",          ar:"مجدول اليوم",           es:"Planificado hoy" },
  nothing_today:       { fr:"Rien de planifié aujourd'hui", en:"Nothing scheduled today", ar:"لا شيء مجدول اليوم", es:"Nada planificado hoy" },
  no_deficiencies:     { fr:"Aucune déficience à traiter", en:"No deficiencies to handle", ar:"لا توجد عيوب للمعالجة", es:"Sin deficiencias que atender" },
  greeting_morning:    { fr:"Bonjour",                  en:"Good morning",             ar:"صباح الخير",            es:"Buenos días" },
  greeting_afternoon:  { fr:"Bon après-midi",           en:"Good afternoon",           ar:"مساء الخير",            es:"Buenas tardes" },
  greeting_evening:    { fr:"Bonsoir",                  en:"Good evening",             ar:"مساء الخير",            es:"Buenas noches" },
  // ── Deficiencies page ─────────────────────────────────────────────────────
  report_deficiency:   { fr:"Signaler une déficience",  en:"Report Deficiency",        ar:"الإبلاغ عن عيب",        es:"Reportar deficiencia" },
  no_deficiencies_found: { fr:"Aucune déficience trouvée", en:"No deficiencies found", ar:"لا توجد عيوب",          es:"Sin deficiencias encontradas" },
  all_clear:           { fr:"Tout est en ordre !",      en:"All clear!",               ar:"كل شيء على ما يرام!",   es:"¡Todo en orden!" },
  sev_critical:        { fr:"Critique",                 en:"Critical",                 ar:"حرج",                   es:"Crítico" },
  sev_high:            { fr:"Élevée",                   en:"High",                     ar:"مرتفع",                 es:"Alto" },
  sev_medium:          { fr:"Moyenne",                  en:"Medium",                   ar:"متوسط",                 es:"Medio" },
  sev_low:             { fr:"Faible",                   en:"Low",                      ar:"منخفض",                 es:"Bajo" },
  // ── Invoices ──────────────────────────────────────────────────────────────
  create_invoice:      { fr:"Créer une facture",        en:"Create Invoice",           ar:"إنشاء فاتورة",           es:"Crear factura" },
  no_invoices:         { fr:"Aucune facture",           en:"No invoices",              ar:"لا توجد فواتير",         es:"Sin facturas" },
  select_one:          { fr:"— Sélectionner —",        en:"— Select —",               ar:"— اختر —",              es:"— Seleccionar —" },
  lbl_building_req:    { fr:"Bâtiment *",              en:"Building *",               ar:"المبنى *",               es:"Edificio *" },
  lbl_issue_date:      { fr:"Date d'émission",         en:"Issue Date",               ar:"تاريخ الإصدار",          es:"Fecha de emisión" },
  lbl_due_date:        { fr:"Date d'échéance",         en:"Due Date",                 ar:"تاريخ الاستحقاق",       es:"Fecha de vencimiento" },
  status_draft:        { fr:"Brouillon",               en:"Draft",                    ar:"مسودة",                  es:"Borrador" },
  status_sent:         { fr:"Envoyée",                 en:"Sent",                     ar:"أُرسلت",                 es:"Enviada" },
  status_overdue:      { fr:"En retard",               en:"Overdue",                  ar:"متأخرة",                 es:"Atrasada" },
  status_void:         { fr:"Annulée",                 en:"Void",                     ar:"ملغاة",                  es:"Anulada" },
  btn_create_invoice:  { fr:"📄 Créer la facture",     en:"📄 Create Invoice",         ar:"📄 إنشاء الفاتورة",      es:"📄 Crear factura" },
  // ── Login ─────────────────────────────────────────────────────────────────
  login_btn:           { fr:"Connexion",               en:"Sign In",                  ar:"تسجيل الدخول",           es:"Iniciar sesión" },
  register_btn:        { fr:"Créer un compte",         en:"Create Account",           ar:"إنشاء حساب",             es:"Crear cuenta" },
  logging_in:          { fr:"Connexion en cours...",   en:"Signing in...",            ar:"جارٍ تسجيل الدخول...",  es:"Iniciando sesión..." },
  creating_account:    { fr:"Création du compte...",   en:"Creating account...",      ar:"جارٍ إنشاء الحساب...",  es:"Creando cuenta..." },
  retry:               { fr:"Réessayer",               en:"Retry",                    ar:"إعادة المحاولة",          es:"Reintentar" },
  loading:             { fr:"Chargement…",  en:"Loading…",   ar:"جارٍ التحميل…", es:"Cargando…" },
  no_data:             { fr:"Aucune donnée",en:"No data",    ar:"لا توجد بيانات", es:"Sin datos" },
};

const LangContext = createContext({ lang:"fr", t: key => T[key]?.fr || key, dir:"ltr" });

export const LangProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem("fsLanguage") || "fr"; } catch { return "fr"; }
  });

  useEffect(() => {
    const info = LANGS.find(l => l.value === lang);
    document.documentElement.dir = info?.dir || "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "fsLanguage" && e.newValue) setLang(e.newValue);
    };
    window.addEventListener("storage", handler);
    const interval = setInterval(() => {
      try {
        const stored = localStorage.getItem("fsLanguage") || "fr";
        setLang(prev => prev !== stored ? stored : prev);
      } catch {}
    }, 500);
    return () => { window.removeEventListener("storage", handler); clearInterval(interval); };
  }, []);

  const t = (key) => T[key]?.[lang] || T[key]?.["fr"] || key;
  const dir = LANGS.find(l => l.value === lang)?.dir || "ltr";

  return (
    <LangContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LangContext.Provider>
  );
};

export const useT = () => useContext(LangContext);
export default T;