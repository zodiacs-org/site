/**
 * Plain-language copy for local calculation records. Kept beside the islands
 * (like PF_BOOK_COPY) rather than in the UI catalogs. Internal terms such as
 * capability, journal, admission or generation never appear here.
 */
import type { CatalogLocale } from '../lib/i18n';

export interface SavedRecordsCopy {
  readonly heading: string;
  readonly intro: string;
  readonly keep: string;
  readonly keeping: string;
  readonly kept: string;
  /** Short button label once kept; the status line carries the sentence and the Profile link. */
  readonly keptButton: string;
  readonly keptLink: string;
  readonly keepAgain: string;
  readonly keepUnavailable: string;
  readonly keepLocked: string;
  readonly keepReadOnly: string;
  readonly keepFull: string;
  readonly keepUncertain: string;
  readonly keepFailed: string;
  /** Nothing stored because another tab changed the records; an explicit second keep is offered. */
  readonly keepChanged: string;
  readonly keepPending: string;
  readonly keepErasedNote: string;
  readonly guestScope: string;
  readonly accountScope: string;
  readonly retainedScope: string;
  readonly empty: string;
  readonly emptyErased: string;
  readonly emptyLink: string;
  readonly locked: string;
  readonly unavailable: string;
  readonly unsupported: string;
  readonly pending: string;
  readonly pendingRetry: string;
  readonly retainedNotice: string;
  /** Records kept while the feature was offered, on a build that no longer offers it. */
  readonly retiredNotice: string;
  /** Signed in: guest records kept before sign-in exist on the device and are not listed. */
  readonly hiddenGuest: (count: number) => string;
  readonly useGuest: string;
  readonly useAccount: string;
  readonly guestViewNotice: string;
  readonly download: string;
  readonly downloadFailed: string;
  readonly remove: string;
  readonly removeConfirm: string;
  /** Announced while a single removal waits for its second activation. */
  readonly removeArmed: string;
  readonly removeDone: string;
  readonly removeFailed: string;
  readonly removeAll: string;
  readonly removeAllConfirm: string;
  /** Announced while the whole-list removal waits for its second activation. */
  readonly removeAllArmed: string;
  readonly removeAllDone: string;
  readonly removeAllPending: string;
  readonly removeAllFailed: string;
  readonly staleRefresh: string;
  readonly unknownTime: string;
  readonly savedOn: string;
  readonly count: (n: number) => string;
  readonly privacy: string;
}

const en: SavedRecordsCopy = {
  heading: 'Calculation records on this device',
  intro: 'Each record is the exact calculation file for a chart you chose to keep. Records stay in this browser only; they are never part of account sync. Clearing this browser’s site data removes them, and the browser can discard them if storage runs low — download anything you want to keep for good.',
  keep: 'Keep this calculation on this device',
  keeping: 'Keeping…',
  kept: 'Kept on this device.',
  keptButton: 'Kept',
  keptLink: 'Find it under Profile',
  keepAgain: 'Keep this calculation again',
  keepUnavailable: 'Calculation records are not available in this browser.',
  keepLocked: 'Calculation records for this browser’s account are locked. Sign in to keep this calculation.',
  keepReadOnly: 'Sign in to keep new calculations. Records kept for your account stay readable while you are signed out.',
  keepFull: 'The records kept here are at the maximum of 40. Remove one under Profile to keep another.',
  keepUncertain: 'The record may or may not have been kept. Check Profile before keeping it again; nothing is retried automatically.',
  keepFailed: 'This calculation could not be kept. Nothing was stored.',
  keepChanged: 'Nothing was stored: the records available here changed in another tab or with your sign-in state. Keep it again if you still want it.',
  keepPending: 'Records on this device are still being removed. Open Profile to finish that first.',
  keepErasedNote: 'The records kept here were removed earlier. Keeping this calculation starts a new set.',
  guestScope: 'Stays on this device only. Not part of any account.',
  accountScope: 'Stays on this device only, kept for your signed-in account. Not synced to the account.',
  retainedScope: 'Kept for the account you signed out of. Readable on this device; sign in to keep more.',
  empty: 'No calculation records kept here yet.',
  emptyErased: 'The records listed here were removed. Keeping a new calculation starts a new set.',
  emptyLink: 'Calculate a chart',
  locked: 'Calculation records for this browser’s account are locked. Sign in, or finish the sign-in hand-off under Profile, to see them.',
  unavailable: 'Calculation records are not available in this browser, so nothing is shown. Your saved charts are unaffected.',
  unsupported: 'Calculation records need a browser feature this browser does not offer, or the record storage here is from a version this site cannot read. Nothing was changed or removed.',
  pending: 'Records on this device are marked for removal but the removal did not finish.',
  pendingRetry: 'Finish removing',
  retainedNotice: 'You are signed out. These records stay readable; sign in to keep new ones.',
  retiredNotice: 'Keeping new calculations is not offered here at the moment. Records kept earlier are still on this device: you can download or remove them below.',
  hiddenGuest: (n) => n === 1 ? '1 calculation record kept without an account also stays on this device, hidden while you are signed in. “Sign out · clear all Zodiacs data” removes it too.' : `${n} calculation records kept without an account also stay on this device, hidden while you are signed in. “Sign out · clear all Zodiacs data” removes them too.`,
  useGuest: 'Use this device as a guest instead',
  useAccount: 'Show the account’s records again',
  guestViewNotice: 'Showing guest records on this device. Records kept for the account you signed out of are hidden until you switch back.',
  download: 'Download',
  downloadFailed: 'The download could not start. Try again.',
  remove: 'Remove',
  removeConfirm: 'Remove this record from this device?',
  removeArmed: 'Confirm removal: choose Remove again, or press Escape to cancel. This confirmation expires on its own.',
  removeDone: 'The record was removed.',
  removeFailed: 'The record could not be removed. Refresh the list and try again.',
  removeAll: 'Remove all of these records',
  removeAllConfirm: 'Remove every record listed here? This cannot be undone.',
  removeAllArmed: 'Confirm removing every record listed here: choose Remove all again, or press Escape to cancel. This confirmation expires on its own.',
  removeAllDone: 'All listed records were removed.',
  removeAllPending: 'Removal was queued but did not finish. Records stay locked until it completes; reopen Profile to finish.',
  removeAllFailed: 'Nothing was removed. Try again.',
  staleRefresh: 'Your sign-in state changed. Refresh the list to continue.',
  unknownTime: 'time unknown',
  savedOn: 'Kept',
  count: (n) => n === 1 ? '1 record' : `${n} records`,
  privacy: 'A record contains birth details and chart data. Downloads are exact copies; keep them private.',
};

const es: SavedRecordsCopy = {
  ...en,
  heading: 'Registros de cálculo en este dispositivo',
  intro: 'Cada registro es el archivo de cálculo exacto de una carta que decidiste conservar. Los registros se quedan solo en este navegador; nunca forman parte de la sincronización de la cuenta. Si borras los datos de este sitio, desaparecen, y el navegador puede descartarlos si se queda sin espacio: descarga lo que quieras conservar para siempre.',
  keep: 'Conservar este cálculo en este dispositivo',
  keeping: 'Conservando…',
  kept: 'Conservado en este dispositivo.',
  keptButton: 'Conservado',
  keptLink: 'Encuéntralo en Perfil',
  keepAgain: 'Conservar este cálculo de nuevo',
  keepUnavailable: 'Los registros de cálculo no están disponibles en este navegador.',
  keepLocked: 'Los registros de cálculo de la cuenta de este navegador están bloqueados. Inicia sesión para conservar este cálculo.',
  keepReadOnly: 'Inicia sesión para conservar cálculos nuevos. Los registros de tu cuenta siguen legibles mientras no hayas iniciado sesión.',
  keepFull: 'Los registros conservados aquí ya alcanzan el máximo de 40. Elimina uno en Perfil para conservar otro.',
  keepUncertain: 'Puede que el registro se haya conservado o no. Revisa Perfil antes de conservarlo de nuevo; no se reintenta automáticamente.',
  keepFailed: 'No se pudo conservar este cálculo. No se guardó nada.',
  keepChanged: 'No se guardó nada: los registros disponibles aquí cambiaron en otra pestaña o con tu estado de sesión. Consérvalo de nuevo si todavía lo quieres.',
  keepPending: 'Los registros de este dispositivo aún se están eliminando. Abre Perfil para terminar primero.',
  keepErasedNote: 'Los registros conservados aquí se eliminaron antes. Conservar este cálculo inicia un conjunto nuevo.',
  guestScope: 'Se queda solo en este dispositivo. No forma parte de ninguna cuenta.',
  accountScope: 'Se queda solo en este dispositivo, para tu cuenta con sesión iniciada. No se sincroniza con la cuenta.',
  retainedScope: 'Conservado para la cuenta de la que cerraste sesión. Legible en este dispositivo; inicia sesión para conservar más.',
  empty: 'Todavía no hay registros de cálculo conservados aquí.',
  emptyErased: 'Los registros de esta lista se eliminaron. Conservar un cálculo nuevo inicia un conjunto nuevo.',
  emptyLink: 'Calcular una carta',
  locked: 'Los registros de cálculo de la cuenta de este navegador están bloqueados. Inicia sesión, o termina la decisión de inicio de sesión en Perfil, para verlos.',
  unavailable: 'Los registros de cálculo no están disponibles en este navegador, así que no se muestra nada. Tus cartas guardadas no se ven afectadas.',
  unsupported: 'Los registros de cálculo necesitan una función que este navegador no ofrece, o el almacenamiento de registros aquí es de una versión que este sitio no puede leer. No se cambió ni se eliminó nada.',
  pending: 'Los registros de este dispositivo están marcados para eliminarse, pero la eliminación no terminó.',
  pendingRetry: 'Terminar la eliminación',
  retainedNotice: 'Has cerrado sesión. Estos registros siguen legibles; inicia sesión para conservar nuevos.',
  retiredNotice: 'Por ahora no se ofrece guardar nuevos cálculos aquí. Los registros guardados antes siguen en este dispositivo: puedes descargarlos o eliminarlos abajo.',
  hiddenGuest: (n) => n === 1 ? '1 registro de cálculo conservado sin cuenta también sigue en este dispositivo, oculto mientras tienes la sesión iniciada. Cerrar la sesión borrando todos los datos de Zodiacs de este navegador también lo elimina.' : `${n} registros de cálculo conservados sin cuenta también siguen en este dispositivo, ocultos mientras tienes la sesión iniciada. Cerrar la sesión borrando todos los datos de Zodiacs de este navegador también los elimina.`,
  useGuest: 'Usar este dispositivo como invitado',
  useAccount: 'Mostrar de nuevo los registros de la cuenta',
  guestViewNotice: 'Mostrando los registros de invitado de este dispositivo. Los registros de la cuenta de la que cerraste sesión quedan ocultos hasta que vuelvas.',
  download: 'Descargar',
  downloadFailed: 'La descarga no pudo empezar. Inténtalo de nuevo.',
  remove: 'Eliminar',
  removeConfirm: '¿Eliminar este registro de este dispositivo?',
  removeArmed: 'Confirma la eliminación: vuelve a elegir Eliminar o pulsa Escape para cancelar. Esta confirmación caduca sola.',
  removeDone: 'El registro se eliminó.',
  removeFailed: 'No se pudo eliminar el registro. Actualiza la lista e inténtalo de nuevo.',
  removeAll: 'Eliminar todos estos registros',
  removeAllConfirm: '¿Eliminar todos los registros de esta lista? Esto no se puede deshacer.',
  removeAllArmed: 'Confirma que quieres eliminar todos los registros de esta lista: vuelve a elegir Eliminar todo o pulsa Escape para cancelar. Esta confirmación caduca sola.',
  removeAllDone: 'Se eliminaron todos los registros de la lista.',
  removeAllPending: 'La eliminación quedó en cola pero no terminó. Los registros quedan bloqueados hasta que se complete; vuelve a abrir Perfil para terminar.',
  removeAllFailed: 'No se eliminó nada. Inténtalo de nuevo.',
  staleRefresh: 'Tu estado de sesión cambió. Actualiza la lista para continuar.',
  unknownTime: 'hora desconocida',
  savedOn: 'Conservado',
  count: (n) => n === 1 ? '1 registro' : `${n} registros`,
  privacy: 'Un registro contiene datos de nacimiento y de la carta. Las descargas son copias exactas; mantenlas privadas.',
};

const pt: SavedRecordsCopy = {
  ...en,
  heading: 'Registros de cálculo neste dispositivo',
  intro: 'Cada registro é o arquivo de cálculo exato de um mapa que você decidiu guardar. Os registros ficam apenas neste navegador; nunca fazem parte da sincronização da conta. Limpar os dados deste site remove os registros, e o navegador pode descartá-los se faltar espaço — baixe o que você quiser guardar de vez.',
  keep: 'Guardar este cálculo neste dispositivo',
  keeping: 'Guardando…',
  kept: 'Guardado neste dispositivo.',
  keptButton: 'Guardado',
  keptLink: 'Encontre em Perfil',
  keepAgain: 'Guardar este cálculo novamente',
  keepUnavailable: 'Os registros de cálculo não estão disponíveis neste navegador.',
  keepLocked: 'Os registros de cálculo da conta deste navegador estão bloqueados. Entre para guardar este cálculo.',
  keepReadOnly: 'Entre na conta para guardar novos cálculos. Os registros da sua conta continuam legíveis enquanto você estiver desconectado.',
  keepFull: 'Os registros guardados aqui já estão no máximo de 40. Remova um no Perfil para guardar outro.',
  keepUncertain: 'O registro pode ter sido guardado ou não. Verifique o Perfil antes de guardá-lo de novo; nada é repetido automaticamente.',
  keepFailed: 'Não foi possível guardar este cálculo. Nada foi armazenado.',
  keepChanged: 'Nada foi guardado: os registros disponíveis aqui mudaram em outra aba ou com o seu estado de sessão. Guarde de novo se ainda quiser.',
  keepPending: 'Os registros deste dispositivo ainda estão sendo removidos. Abra o Perfil para concluir isso primeiro.',
  keepErasedNote: 'Os registros guardados aqui foram removidos antes. Guardar este cálculo inicia um conjunto novo.',
  guestScope: 'Fica apenas neste dispositivo. Não faz parte de nenhuma conta.',
  accountScope: 'Fica apenas neste dispositivo, guardado para a conta conectada. Não é sincronizado com a conta.',
  retainedScope: 'Guardado para a conta da qual você saiu. Legível neste dispositivo; entre para guardar mais.',
  empty: 'Ainda não há registros de cálculo guardados aqui.',
  emptyErased: 'Os registros desta lista foram removidos. Guardar um cálculo novo inicia um conjunto novo.',
  emptyLink: 'Calcular um mapa',
  locked: 'Os registros de cálculo da conta deste navegador estão bloqueados. Entre, ou conclua a decisão de entrada no Perfil, para vê-los.',
  unavailable: 'Os registros de cálculo não estão disponíveis neste navegador, então nada é mostrado. Seus mapas salvos não são afetados.',
  unsupported: 'Os registros de cálculo precisam de um recurso que este navegador não oferece, ou o armazenamento de registros aqui é de uma versão que este site não consegue ler. Nada foi alterado ou removido.',
  pending: 'Os registros deste dispositivo estão marcados para remoção, mas a remoção não terminou.',
  pendingRetry: 'Concluir a remoção',
  retainedNotice: 'Você saiu da conta. Estes registros continuam legíveis; entre para guardar novos.',
  retiredNotice: 'Guardar novos cálculos não está disponível aqui neste momento. Os registros guardados antes continuam neste dispositivo: você pode baixá-los ou removê-los abaixo.',
  hiddenGuest: (n) => n === 1 ? '1 registro de cálculo guardado sem conta também continua neste dispositivo, oculto enquanto você está conectado. Sair da conta limpando todos os dados do Zodiacs neste navegador também o remove.' : `${n} registros de cálculo guardados sem conta também continuam neste dispositivo, ocultos enquanto você está conectado. Sair da conta limpando todos os dados do Zodiacs neste navegador também os remove.`,
  useGuest: 'Usar este dispositivo como visitante',
  useAccount: 'Mostrar os registros da conta novamente',
  guestViewNotice: 'Mostrando os registros de visitante deste dispositivo. Os registros da conta da qual você saiu ficam ocultos até você voltar.',
  download: 'Baixar',
  downloadFailed: 'O download não pôde começar. Tente novamente.',
  remove: 'Remover',
  removeConfirm: 'Remover este registro deste dispositivo?',
  removeArmed: 'Confirme a remoção: escolha Remover outra vez ou pressione Escape para cancelar. Esta confirmação expira sozinha.',
  removeDone: 'O registro foi removido.',
  removeFailed: 'Não foi possível remover o registro. Atualize a lista e tente novamente.',
  removeAll: 'Remover todos estes registros',
  removeAllConfirm: 'Remover todos os registros desta lista? Isso não pode ser desfeito.',
  removeAllArmed: 'Confirme a remoção de todos os registros desta lista: escolha Remover tudo outra vez ou pressione Escape para cancelar. Esta confirmação expira sozinha.',
  removeAllDone: 'Todos os registros da lista foram removidos.',
  removeAllPending: 'A remoção foi enfileirada, mas não terminou. Os registros ficam bloqueados até ela concluir; reabra o Perfil para concluir.',
  removeAllFailed: 'Nada foi removido. Tente novamente.',
  staleRefresh: 'Seu estado de login mudou. Atualize a lista para continuar.',
  unknownTime: 'horário desconhecido',
  savedOn: 'Guardado',
  count: (n) => n === 1 ? '1 registro' : `${n} registros`,
  privacy: 'Um registro contém dados de nascimento e do mapa. Os downloads são cópias exatas; mantenha-os privados.',
};

const fr: SavedRecordsCopy = {
  ...en,
  heading: 'Relevés de calcul sur cet appareil',
  intro: 'Chaque relevé est le fichier de calcul exact d’un thème que tu as choisi de garder. Les relevés restent dans ce navigateur uniquement ; ils ne font jamais partie de la synchronisation du compte. Effacer les données de ce site les supprime, et le navigateur peut les écarter si l’espace manque : télécharge ce que tu veux garder pour de bon.',
  keep: 'Garder ce calcul sur cet appareil',
  keeping: 'Enregistrement…',
  kept: 'Gardé sur cet appareil.',
  keptButton: 'Gardé',
  keptLink: 'Retrouve-le dans Profil',
  keepAgain: 'Garder ce calcul à nouveau',
  keepUnavailable: 'Les relevés de calcul ne sont pas disponibles dans ce navigateur.',
  keepLocked: 'Les relevés de calcul du compte de ce navigateur sont verrouillés. Connecte-toi pour garder ce calcul.',
  keepReadOnly: 'Connecte-toi pour garder de nouveaux calculs. Les relevés de ton compte restent lisibles tant que tu es déconnecté.',
  keepFull: 'Les relevés gardés ici ont atteint le maximum de 40. Supprimes-en un dans Profil pour en garder un autre.',
  keepUncertain: 'Le relevé a peut-être été gardé, peut-être pas. Vérifie Profil avant de le garder à nouveau ; rien n’est retenté automatiquement.',
  keepFailed: 'Ce calcul n’a pas pu être gardé. Rien n’a été enregistré.',
  keepChanged: 'Rien n’a été enregistré : les relevés disponibles ici ont changé dans un autre onglet ou avec ton état de connexion. Garde-le à nouveau si tu le veux toujours.',
  keepPending: 'Les relevés de cet appareil sont encore en cours de suppression. Ouvre Profil pour terminer d’abord.',
  keepErasedNote: 'Les relevés gardés ici ont été supprimés plus tôt. Garder ce calcul commence une nouvelle série.',
  guestScope: 'Reste uniquement sur cet appareil. Ne fait partie d’aucun compte.',
  accountScope: 'Reste uniquement sur cet appareil, gardé pour ton compte connecté. Non synchronisé avec le compte.',
  retainedScope: 'Gardé pour le compte dont tu t’es déconnecté. Lisible sur cet appareil ; connecte-toi pour en garder davantage.',
  empty: 'Aucun relevé de calcul gardé ici pour l’instant.',
  emptyErased: 'Les relevés de cette liste ont été supprimés. Garder un nouveau calcul commence une nouvelle série.',
  emptyLink: 'Calculer un thème',
  locked: 'Les relevés de calcul du compte de ce navigateur sont verrouillés. Connecte-toi, ou termine la décision de connexion dans Profil, pour les voir.',
  unavailable: 'Les relevés de calcul ne sont pas disponibles dans ce navigateur, donc rien n’est affiché. Tes thèmes enregistrés ne sont pas concernés.',
  unsupported: 'Les relevés de calcul nécessitent une fonction que ce navigateur n’offre pas, ou le stockage des relevés ici vient d’une version que ce site ne peut pas lire. Rien n’a été modifié ni supprimé.',
  pending: 'Les relevés de cet appareil sont marqués pour suppression, mais la suppression n’a pas abouti.',
  pendingRetry: 'Terminer la suppression',
  retainedNotice: 'Tu es déconnecté. Ces relevés restent lisibles ; connecte-toi pour en garder de nouveaux.',
  retiredNotice: 'Conserver de nouveaux calculs n’est pas proposé ici pour le moment. Les relevés conservés auparavant sont toujours sur cet appareil : tu peux les télécharger ou les supprimer ci-dessous.',
  hiddenGuest: (n) => n === 1 ? '1 relevé de calcul gardé sans compte reste aussi sur cet appareil, masqué tant que tu es connecté. Te déconnecter en effaçant toutes les données Zodiacs de ce navigateur le supprime aussi.' : `${n} relevés de calcul gardés sans compte restent aussi sur cet appareil, masqués tant que tu es connecté. Te déconnecter en effaçant toutes les données Zodiacs de ce navigateur les supprime aussi.`,
  useGuest: 'Utiliser cet appareil en tant qu’invité',
  useAccount: 'Afficher à nouveau les relevés du compte',
  guestViewNotice: 'Affichage des relevés invité de cet appareil. Les relevés du compte dont tu t’es déconnecté restent masqués jusqu’à ce que tu reviennes.',
  download: 'Télécharger',
  downloadFailed: 'Le téléchargement n’a pas pu démarrer. Réessaie.',
  remove: 'Supprimer',
  removeConfirm: 'Supprimer ce relevé de cet appareil ?',
  removeArmed: 'Confirme la suppression : choisis de nouveau Supprimer, ou appuie sur Échap pour annuler. Cette confirmation expire d’elle-même.',
  removeDone: 'Le relevé a été supprimé.',
  removeFailed: 'Le relevé n’a pas pu être supprimé. Actualise la liste et réessaie.',
  removeAll: 'Supprimer tous ces relevés',
  removeAllConfirm: 'Supprimer tous les relevés de cette liste ? Cette action est irréversible.',
  removeAllArmed: 'Confirme la suppression de tous les relevés de cette liste : choisis de nouveau Tout supprimer, ou appuie sur Échap pour annuler. Cette confirmation expire d’elle-même.',
  removeAllDone: 'Tous les relevés de la liste ont été supprimés.',
  removeAllPending: 'La suppression a été lancée mais n’a pas abouti. Les relevés restent verrouillés jusqu’à la fin ; rouvre Profil pour terminer.',
  removeAllFailed: 'Rien n’a été supprimé. Réessaie.',
  staleRefresh: 'Ton état de connexion a changé. Actualise la liste pour continuer.',
  unknownTime: 'heure inconnue',
  savedOn: 'Gardé',
  count: (n) => n === 1 ? '1 relevé' : `${n} relevés`,
  privacy: 'Un relevé contient des données de naissance et du thème. Les téléchargements sont des copies exactes ; garde-les privées.',
};

const it: SavedRecordsCopy = {
  ...en,
  heading: 'Resoconti di calcolo su questo dispositivo',
  intro: 'Ogni resoconto è il file di calcolo esatto di un tema che hai scelto di conservare. I resoconti restano solo in questo browser; non fanno mai parte della sincronizzazione dell’account. Cancellare i dati di questo sito li rimuove, e il browser può scartarli se lo spazio si esaurisce: scarica ciò che vuoi conservare per sempre.',
  keep: 'Conserva questo calcolo su questo dispositivo',
  keeping: 'Salvataggio…',
  kept: 'Conservato su questo dispositivo.',
  keptButton: 'Conservato',
  keptLink: 'Trovalo in Profilo',
  keepAgain: 'Conserva di nuovo questo calcolo',
  keepUnavailable: 'I resoconti di calcolo non sono disponibili in questo browser.',
  keepLocked: 'I resoconti di calcolo dell’account di questo browser sono bloccati. Accedi per conservare questo calcolo.',
  keepReadOnly: 'Accedi per conservare nuovi calcoli. I resoconti del tuo account restano leggibili mentre sei disconnesso.',
  keepFull: 'I resoconti conservati qui hanno raggiunto il massimo di 40. Rimuovine uno in Profilo per conservarne un altro.',
  keepUncertain: 'Il resoconto potrebbe essere stato conservato oppure no. Controlla Profilo prima di conservarlo di nuovo; nulla viene ritentato automaticamente.',
  keepFailed: 'Questo calcolo non è stato conservato. Non è stato salvato nulla.',
  keepChanged: 'Nulla è stato salvato: i resoconti disponibili qui sono cambiati in un’altra scheda o con il tuo stato di accesso. Conservalo di nuovo se lo vuoi ancora.',
  keepPending: 'I resoconti di questo dispositivo sono ancora in fase di rimozione. Apri Profilo per completare prima quella.',
  keepErasedNote: 'I resoconti conservati qui sono stati rimossi in precedenza. Conservare questo calcolo avvia una nuova serie.',
  guestScope: 'Resta solo su questo dispositivo. Non fa parte di alcun account.',
  accountScope: 'Resta solo su questo dispositivo, conservato per l’account con cui hai effettuato l’accesso. Non viene sincronizzato con l’account.',
  retainedScope: 'Conservato per l’account da cui sei uscito. Leggibile su questo dispositivo; accedi per conservarne altri.',
  empty: 'Nessun resoconto di calcolo conservato qui per ora.',
  emptyErased: 'I resoconti di questo elenco sono stati rimossi. Conservare un nuovo calcolo avvia una nuova serie.',
  emptyLink: 'Calcola un tema',
  locked: 'I resoconti di calcolo dell’account di questo browser sono bloccati. Accedi, oppure completa la decisione di accesso in Profilo, per vederli.',
  unavailable: 'I resoconti di calcolo non sono disponibili in questo browser, quindi non viene mostrato nulla. I tuoi temi salvati non sono interessati.',
  unsupported: 'I resoconti di calcolo richiedono una funzione che questo browser non offre, oppure l’archivio dei resoconti qui proviene da una versione che questo sito non può leggere. Nulla è stato modificato o rimosso.',
  pending: 'I resoconti di questo dispositivo sono contrassegnati per la rimozione, ma la rimozione non è terminata.',
  pendingRetry: 'Completa la rimozione',
  retainedNotice: 'Sei disconnesso. Questi resoconti restano leggibili; accedi per conservarne di nuovi.',
  retiredNotice: 'Conservare nuovi calcoli non è disponibile qui al momento. I resoconti conservati in precedenza restano su questo dispositivo: puoi scaricarli o rimuoverli qui sotto.',
  hiddenGuest: (n) => n === 1 ? '1 resoconto di calcolo conservato senza account resta anche su questo dispositivo, nascosto finché hai effettuato l’accesso. Uscire cancellando tutti i dati Zodiacs di questo browser rimuove anche quello.' : `${n} resoconti di calcolo conservati senza account restano anche su questo dispositivo, nascosti finché hai effettuato l’accesso. Uscire cancellando tutti i dati Zodiacs di questo browser rimuove anche quelli.`,
  useGuest: 'Usa questo dispositivo come ospite',
  useAccount: 'Mostra di nuovo i resoconti dell’account',
  guestViewNotice: 'Stai vedendo i resoconti ospite di questo dispositivo. I resoconti dell’account da cui sei uscito restano nascosti finché non torni indietro.',
  download: 'Scarica',
  downloadFailed: 'Il download non è partito. Riprova.',
  remove: 'Rimuovi',
  removeConfirm: 'Rimuovere questo resoconto da questo dispositivo?',
  removeArmed: 'Conferma la rimozione: scegli di nuovo Rimuovi, oppure premi Esc per annullare. Questa conferma scade da sola.',
  removeDone: 'Il resoconto è stato rimosso.',
  removeFailed: 'Il resoconto non è stato rimosso. Aggiorna l’elenco e riprova.',
  removeAll: 'Rimuovi tutti questi resoconti',
  removeAllConfirm: 'Rimuovere tutti i resoconti di questo elenco? L’operazione non può essere annullata.',
  removeAllArmed: 'Conferma la rimozione di tutti i resoconti elencati qui: scegli di nuovo Rimuovi tutto, oppure premi Esc per annullare. Questa conferma scade da sola.',
  removeAllDone: 'Tutti i resoconti dell’elenco sono stati rimossi.',
  removeAllPending: 'La rimozione è stata avviata ma non è terminata. I resoconti restano bloccati finché non si completa; riapri Profilo per completarla.',
  removeAllFailed: 'Non è stato rimosso nulla. Riprova.',
  staleRefresh: 'Il tuo stato di accesso è cambiato. Aggiorna l’elenco per continuare.',
  unknownTime: 'ora sconosciuta',
  savedOn: 'Conservato',
  count: (n) => n === 1 ? '1 resoconto' : `${n} resoconti`,
  privacy: 'Un resoconto contiene dati di nascita e del tema. I download sono copie esatte; conservali in privato.',
};

const ru: SavedRecordsCopy = {
  ...en,
  heading: 'Записи расчёта на этом устройстве',
  intro: 'Каждая запись — это точный файл расчёта карты, которую вы решили сохранить. Записи остаются только в этом браузере и никогда не участвуют в синхронизации аккаунта. Очистка данных сайта удаляет их, а браузер может отбросить их при нехватке места: скачайте то, что хотите сохранить навсегда.',
  keep: 'Сохранить этот расчёт на этом устройстве',
  keeping: 'Сохраняем…',
  kept: 'Сохранено на этом устройстве.',
  keptButton: 'Сохранено',
  keptLink: 'Найти в Профиле',
  keepAgain: 'Сохранить этот расчёт ещё раз',
  keepUnavailable: 'Записи расчёта недоступны в этом браузере.',
  keepLocked: 'Записи расчёта для аккаунта этого браузера заблокированы. Войдите, чтобы сохранить этот расчёт.',
  keepReadOnly: 'Войдите, чтобы сохранять новые расчёты. Записи вашего аккаунта остаются доступными для чтения, пока вы не вошли.',
  keepFull: 'Сохранённых здесь записей уже максимум — 40. Удалите одну в Профиле, чтобы сохранить другую.',
  keepUncertain: 'Запись могла сохраниться, а могла и нет. Проверьте Профиль, прежде чем сохранять снова; автоматических повторов нет.',
  keepFailed: 'Не удалось сохранить этот расчёт. Ничего не записано.',
  keepChanged: 'Ничего не сохранено: доступные здесь записи изменились в другой вкладке или вместе с состоянием входа. Сохраните ещё раз, если это по-прежнему нужно.',
  keepPending: 'Записи на этом устройстве ещё удаляются. Сначала откройте Профиль, чтобы завершить удаление.',
  keepErasedNote: 'Сохранённые здесь записи были удалены ранее. Сохранение этого расчёта начинает новый набор.',
  guestScope: 'Остаётся только на этом устройстве. Не относится ни к какому аккаунту.',
  accountScope: 'Остаётся только на этом устройстве, для аккаунта, в который вы вошли. Не синхронизируется с аккаунтом.',
  retainedScope: 'Сохранено для аккаунта, из которого вы вышли. Доступно для чтения на этом устройстве; войдите, чтобы сохранять ещё.',
  empty: 'Здесь пока нет сохранённых записей расчёта.',
  emptyErased: 'Записи из этого списка удалены. Сохранение нового расчёта начинает новый набор.',
  emptyLink: 'Рассчитать карту',
  locked: 'Записи расчёта для аккаунта этого браузера заблокированы. Войдите или завершите решение о входе в Профиле, чтобы их увидеть.',
  unavailable: 'Записи расчёта недоступны в этом браузере, поэтому ничего не показано. Ваши сохранённые карты не затронуты.',
  unsupported: 'Записям расчёта нужна функция, которой нет в этом браузере, либо хранилище записей здесь создано версией, которую этот сайт не может прочитать. Ничего не изменено и не удалено.',
  pending: 'Записи на этом устройстве помечены на удаление, но удаление не завершилось.',
  pendingRetry: 'Завершить удаление',
  retainedNotice: 'Вы вышли из аккаунта. Эти записи остаются доступными для чтения; войдите, чтобы сохранять новые.',
  retiredNotice: 'Сохранение новых расчётов здесь сейчас недоступно. Записи, сохранённые ранее, остаются на этом устройстве: их можно скачать или удалить ниже.',
  hiddenGuest: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'запись расчёта, сохранённая' : 'записи расчёта, сохранённые'} без аккаунта, также ${n % 10 === 1 && n % 100 !== 11 ? 'остаётся' : 'остаются'} на этом устройстве и ${n % 10 === 1 && n % 100 !== 11 ? 'скрыта' : 'скрыты'}, пока вы вошли в аккаунт. Выход из аккаунта с удалением всех данных Zodiacs в этом браузере удаляет и их.`,
  useGuest: 'Использовать это устройство как гость',
  useAccount: 'Снова показать записи аккаунта',
  guestViewNotice: 'Показаны гостевые записи этого устройства. Записи аккаунта, из которого вы вышли, скрыты, пока вы не переключитесь обратно.',
  download: 'Скачать',
  downloadFailed: 'Не удалось начать скачивание. Попробуйте ещё раз.',
  remove: 'Удалить',
  removeConfirm: 'Удалить эту запись с этого устройства?',
  removeArmed: 'Подтвердите удаление: снова выберите «Удалить» или нажмите Escape, чтобы отменить. Это подтверждение истекает само.',
  removeDone: 'Запись удалена.',
  removeFailed: 'Не удалось удалить запись. Обновите список и попробуйте ещё раз.',
  removeAll: 'Удалить все эти записи',
  removeAllConfirm: 'Удалить все записи из этого списка? Это нельзя отменить.',
  removeAllArmed: 'Подтвердите удаление всех записей из этого списка: снова выберите «Удалить все» или нажмите Escape, чтобы отменить. Это подтверждение истекает само.',
  removeAllDone: 'Все записи из списка удалены.',
  removeAllPending: 'Удаление поставлено в очередь, но не завершилось. Записи остаются заблокированными до завершения; откройте Профиль снова, чтобы закончить.',
  removeAllFailed: 'Ничего не удалено. Попробуйте ещё раз.',
  staleRefresh: 'Состояние входа изменилось. Обновите список, чтобы продолжить.',
  unknownTime: 'время неизвестно',
  savedOn: 'Сохранено',
  count: (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'запись' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'записи' : 'записей'}`,
  privacy: 'Запись содержит данные о рождении и данные карты. Скачанные файлы — точные копии; храните их в безопасном месте.',
};

export const SAVED_RECORDS_COPY: Record<CatalogLocale, SavedRecordsCopy> = { en, es, pt, fr, it, ru };
