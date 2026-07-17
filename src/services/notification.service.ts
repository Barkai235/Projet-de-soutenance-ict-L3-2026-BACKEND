import NotificationModel from '../models/notification.model';

const NotificationService = {

  async lister(utilisateur_id: number, limit = 30) {
    const notifications = await NotificationModel.findByUser(utilisateur_id, limit);
    const nonLues       = await NotificationModel.countNonLues(utilisateur_id);
    return { notifications, total_non_lues: nonLues };
  },

  async marquerLue(id: number, utilisateur_id: number) {
    await NotificationModel.marquerLue(id, utilisateur_id);
    return { message: 'Notification marquée comme lue' };
  },

  async toutMarquerLues(utilisateur_id: number) {
    await NotificationModel.toutMarquerLues(utilisateur_id);
    return { message: 'Toutes les notifications marquées comme lues' };
  },

  async supprimer(id: number, utilisateur_id: number) {
    await NotificationModel.supprimer(id, utilisateur_id);
    return { message: 'Notification supprimée' };
  },

  async toutSupprimer(utilisateur_id: number) {
    const n = await NotificationModel.toutSupprimer(utilisateur_id);
    return { message: `${n} notification(s) supprimée(s)`, count: n };
  },

  async countNonLues(utilisateur_id: number) {
    return NotificationModel.countNonLues(utilisateur_id);
  },

  async badgesNavigation(utilisateur_id: number) {
    return NotificationModel.countNonLuesParOnglet(utilisateur_id);
  },

  async marquerLuesParSection(utilisateur_id: number, section: string) {
    const n = await NotificationModel.marquerLuesParSection(utilisateur_id, section);
    return { message: `${n} notification(s) marquée(s) comme lue(s)`, count: n };
  },
};

export default NotificationService;